import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import express from 'express'
import { loadEnv } from './env.js'

loadEnv()

if (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 16) {
  console.error(
    '[api] AUTH_SECRET is missing or too short. Copy .env.example to .env and set a long random secret.',
  )
  process.exit(1)
}

const { db, event } = await import('./db.js')
const { checkDatabase } = await import('./db/index.js')

const databaseHealth = () => checkDatabase(db)

const {
  googleConfig,
  createState,
  verifyState,
  authorizationUrl,
  exchangeCode,
  createExchange,
  consumeExchange,
} = await import('./oauth.js')
const { rateLimit } = await import('./rate-limit.js')

const AUTH_RATE_MAX = Number(process.env.AUTH_RATE_MAX || 60)
const authLimit = rateLimit({ name: 'auth', windowMs: 60_000, max: AUTH_RATE_MAX })
const oauthLimit = rateLimit({ name: 'oauth', windowMs: 60_000, max: 30 })
const {
  signToken,
  verifyToken,
  verifyPassword,
  hashPassword,
  requireOrganizer,
  requireAuth,
} = await import('./auth.js')

const CATEGORIES = ['Important', 'Registration', 'Schedule', 'Competition', 'General']
const PROJECT_CATEGORIES = ['Web', 'Mobile', 'AI / ML', 'Game', 'Tool', 'Hardware', 'Other']
const PROJECT_CATEGORY_LOOKUP = new Map(
  PROJECT_CATEGORIES.map((category) => [category.toLowerCase(), category]),
)
const OWNER_PROJECT_STATUSES = ['draft', 'submitted']
const ADMIN_PROJECT_STATUSES = ['published', 'submitted', 'rejected']
const CATEGORY_LOOKUP = new Map(CATEGORIES.map((category) => [category.toLowerCase(), category]))
const MAX_LIMIT = 50
const DEFAULT_LIMIT = 6

const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '100kb' }))

/**
 * PostgreSQL and SQLite are both reached through an async driver, so every
 * route handler can reject. Express 4 does not forward rejected promises, so
 * handlers registered through these helpers are wrapped once here instead of
 * in 25 places.
 */
for (const method of ['get', 'post', 'patch', 'put', 'delete']) {
  const register = app[method].bind(app)
  app[method] = (routePath, ...handlers) =>
    register(
      routePath,
      ...handlers.map((handler) =>
        typeof handler === 'function'
          ? (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
          : handler,
      ),
    )
}

// Unique-constraint violations surface as SQLITE_CONSTRAINT* on SQLite and
// 23505 on PostgreSQL.
function isUniqueViolation(error) {
  const code = String(error?.code || '')
  return code.startsWith('SQLITE_CONSTRAINT') || code === '23505'
}

// Both engines accept CAST(... AS TEXT); JSONB (PostgreSQL) cannot be LIKE'd
// directly, so searchable JSON columns are cast in the query.
const likeText = (column) => `CAST(${column} AS TEXT)`

function slugify(value) {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

function excerpt(content, length = 190) {
  const cleaned = content.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= length) return cleaned
  const cut = cleaned.slice(0, length)
  const lastSpace = cut.lastIndexOf(' ')
  return `${cut.slice(0, lastSpace > 80 ? lastSpace : length).trimEnd()}…`
}

function serialize(row, { includeContent = false } = {}) {
  const payload = {
    id: row.id,
    eventId: row.event_id,
    eventSlug: row.event_slug,
    eventName: row.event_name,
    title: row.title,
    slug: row.slug,
    category: row.category,
    publishedAt: row.published_at,
    isPublished: Boolean(row.is_published),
    excerpt: excerpt(row.content),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  if (includeContent) payload.content = row.content
  return payload
}

function parseId(value) {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function pagination(query) {
  const errors = {}
  const page = query.page === undefined ? 1 : Number(query.page)
  const limit = query.limit === undefined ? DEFAULT_LIMIT : Number(query.limit)

  if (!Number.isInteger(page) || page < 1) {
    errors.page = 'page must be an integer greater than or equal to 1.'
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    errors.limit = `limit must be an integer between 1 and ${MAX_LIMIT}.`
  }

  return { page, limit, errors }
}

function categoryParam(value) {
  if (value === undefined || value === '') return { category: null }
  const match = CATEGORY_LOOKUP.get(String(value).toLowerCase())
  if (!match) {
    return {
      error: `category must be one of: ${CATEGORIES.join(', ')}.`,
    }
  }
  return { category: match }
}

function readBoolean(value, field, errors) {
  if (value === undefined) return undefined
  if (typeof value !== 'boolean') {
    errors[field] = `${field} must be a boolean.`
    return undefined
  }
  return value
}

async function validateAnnouncement(input, { partial = false } = {}) {
  const errors = {}
  const data = {}

  if (!partial || input.title !== undefined) {
    if (typeof input.title !== 'string') {
      errors.title = 'title is required.'
    } else {
      const title = input.title.trim()
      if (title.length < 3 || title.length > 180) {
        errors.title = 'title must be between 3 and 180 characters.'
      } else {
        data.title = title
      }
    }
  }

  if (!partial || input.content !== undefined) {
    if (typeof input.content !== 'string') {
      errors.content = 'content is required.'
    } else {
      const content = input.content.trim()
      if (content.length < 20 || content.length > 20000) {
        errors.content = 'content must be between 20 and 20,000 characters.'
      } else {
        data.content = content
      }
    }
  }

  if (input.category !== undefined) {
    if (typeof input.category !== 'string') {
      errors.category = 'category must be a string.'
    } else {
      const match = CATEGORY_LOOKUP.get(input.category.toLowerCase())
      if (!match) errors.category = `category must be one of: ${CATEGORIES.join(', ')}.`
      else data.category = match
    }
  } else if (!partial) {
    data.category = 'General'
  }

  if (input.slug !== undefined) {
    if (typeof input.slug !== 'string') {
      errors.slug = 'slug must be a string.'
    } else {
      const slug = input.slug.trim().toLowerCase()
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 80) {
        errors.slug = 'slug must be 3–80 characters of lowercase letters, numbers, and hyphens.'
      } else {
        data.slug = slug
      }
    }
  }

  const isPublished = readBoolean(input.isPublished, 'isPublished', errors)
  if (isPublished !== undefined) data.isPublished = isPublished

  if (input.publishedAt !== undefined) {
    if (input.publishedAt === null) {
      data.publishedAt = null
    } else if (
      typeof input.publishedAt !== 'string' ||
      Number.isNaN(Date.parse(input.publishedAt))
    ) {
      errors.publishedAt = 'publishedAt must be a valid ISO date or null.'
    } else {
      data.publishedAt = new Date(input.publishedAt).toISOString()
    }
  }

  if (input.eventSlug !== undefined) {
    if (typeof input.eventSlug !== 'string') {
      errors.eventSlug = 'eventSlug must be a string.'
    } else {
      const row = await db.get('SELECT id FROM events WHERE slug = ?', [input.eventSlug])
      if (!row) errors.eventSlug = 'Unknown event.'
      else data.eventId = row.id
    }
  }

  return { data, errors }
}

async function uniqueSlug(base, excludeId = null) {
  let candidate = base || 'announcement'
  let suffix = 2

  for (;;) {
    const clash = excludeId
      ? await db.get('SELECT id FROM announcements WHERE slug = ? AND id != ?', [candidate, excludeId])
      : await db.get('SELECT id FROM announcements WHERE slug = ?', [candidate])
    if (!clash) return candidate
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

function findAnnouncementById(id) {
  return db.get(
    `SELECT a.*, e.slug AS event_slug, e.name AS event_name
       FROM announcements a
       JOIN events e ON e.id = a.event_id
       WHERE a.id = ?`,
    [id],
  )
}

function parseTechnologies(value) {
  // SQLite stores TEXT, PostgreSQL returns a JSONB array already.
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function registrationReference(id) {
  return `C3-REG-${String(id).padStart(4, '0')}`
}

function serializeRegistration(row, { includeEmail = false } = {}) {
  const payload = {
    id: row.id,
    reference: registrationReference(row.id),
    eventId: row.event_id,
    eventSlug: row.event_slug,
    eventName: row.event_name,
    fullName: row.full_name,
    campus: row.campus,
    status: 'registered',
    createdAt: row.created_at,
  }
  if (includeEmail) payload.email = row.email
  return payload
}

function validateRegistration(input) {
  const errors = {}
  const fullName = typeof input.fullName === 'string' ? input.fullName.trim().replace(/\s+/g, ' ') : ''
  const campus = typeof input.campus === 'string' ? input.campus.trim().replace(/\s+/g, ' ') : ''

  if (fullName.length < 2 || fullName.length > 120) {
    errors.fullName = 'Full name must be between 2 and 120 characters.'
  }
  if (campus.length < 2 || campus.length > 120) {
    errors.campus = 'Campus must be between 2 and 120 characters.'
  }

  return { data: { fullName, campus }, errors }
}

function findRegistrationByUser(userId) {
  return db.get(
    `SELECT r.*, e.slug AS event_slug, e.name AS event_name, u.email
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       JOIN users u ON u.id = r.user_id
       WHERE r.user_id = ? AND r.event_id = ?`,
    [userId, event.id],
  )
}

function optionalUrl(value, field, errors, { github = false } = {}) {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') {
    errors[field] = `${field} must be a URL string or null.`
    return null
  }

  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.length > 2048) {
    errors[field] = `${field} must be 2,048 characters or fewer.`
    return null
  }

  let url
  try {
    url = new URL(trimmed)
  } catch {
    errors[field] = `${field} must be a valid http or https URL.`
    return null
  }

  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
    errors[field] = `${field} must be a valid http or https URL.`
    return null
  }

  if (github) {
    if (
      url.protocol !== 'https:' ||
      !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase())
    ) {
      errors[field] = 'Repository URL must be a GitHub https://github.com URL.'
      return null
    }
  }

  return url.toString()
}

function validateProject(input, { partial = false, statuses = OWNER_PROJECT_STATUSES } = {}) {
  const errors = {}
  const data = {}

  if (!partial || input.title !== undefined) {
    if (typeof input.title !== 'string') {
      errors.title = 'title is required.'
    } else {
      const title = input.title.trim()
      if (title.length < 3 || title.length > 120) {
        errors.title = 'title must be between 3 and 120 characters.'
      } else {
        data.title = title
      }
    }
  }

  if (!partial || input.tagline !== undefined) {
    if (typeof input.tagline !== 'string') {
      errors.tagline = 'tagline is required.'
    } else {
      const tagline = input.tagline.trim()
      if (tagline.length < 8 || tagline.length > 160) {
        errors.tagline = 'tagline must be between 8 and 160 characters.'
      } else {
        data.tagline = tagline
      }
    }
  }

  if (!partial || input.description !== undefined) {
    if (typeof input.description !== 'string') {
      errors.description = 'description is required.'
    } else {
      const description = input.description.trim()
      if (description.length < 40 || description.length > 12000) {
        errors.description = 'description must be between 40 and 12,000 characters.'
      } else {
        data.description = description
      }
    }
  }

  if (!partial || input.category !== undefined) {
    if (typeof input.category !== 'string') {
      errors.category = 'category is required.'
    } else {
      const match = PROJECT_CATEGORY_LOOKUP.get(input.category.toLowerCase())
      if (!match) errors.category = `category must be one of: ${PROJECT_CATEGORIES.join(', ')}.`
      else data.category = match
    }
  }

  if (!partial || input.technologies !== undefined) {
    if (!Array.isArray(input.technologies)) {
      errors.technologies = 'technologies must be an array of technology names.'
    } else {
      const seen = new Set()
      const technologies = []
      for (const item of input.technologies) {
        if (typeof item !== 'string') {
          errors.technologies = 'Each technology must be a string.'
          break
        }
        const value = item.trim().replace(/\s+/g, ' ')
        if (!value) continue
        if (value.length > 40) {
          errors.technologies = 'Each technology must be 40 characters or fewer.'
          break
        }
        const key = value.toLowerCase()
        if (!seen.has(key)) {
          seen.add(key)
          technologies.push(value)
        }
      }
      if (!errors.technologies) {
        if (technologies.length < 1 || technologies.length > 12) {
          errors.technologies = 'List between 1 and 12 technologies.'
        } else {
          data.technologies = JSON.stringify(technologies)
        }
      }
    }
  }

  if (input.teamName !== undefined) {
    if (input.teamName === null || input.teamName === '') {
      data.teamName = null
    } else if (typeof input.teamName !== 'string') {
      errors.teamName = 'teamName must be a string.'
    } else {
      const teamName = input.teamName.trim().replace(/\s+/g, ' ')
      if (teamName.length > 120 || (teamName.length > 0 && teamName.length < 2)) {
        errors.teamName = 'teamName must be between 2 and 120 characters.'
      } else {
        data.teamName = teamName || null
      }
    }
  }

  const repoUrl = optionalUrl(input.repoUrl, 'repoUrl', errors, { github: true })
  if (repoUrl !== undefined) data.repoUrl = repoUrl
  const demoUrl = optionalUrl(input.demoUrl, 'demoUrl', errors)
  if (demoUrl !== undefined) data.demoUrl = demoUrl
  const coverImageUrl = optionalUrl(input.coverImageUrl, 'coverImageUrl', errors)
  if (coverImageUrl !== undefined) data.coverImageUrl = coverImageUrl

  if (input.status !== undefined) {
    if (typeof input.status !== 'string' || !statuses.includes(input.status)) {
      errors.status = `status must be one of: ${statuses.join(', ')}.`
    } else {
      data.status = input.status
    }
  } else if (!partial) {
    data.status = 'draft'
  }

  return { data, errors }
}

function parseProjectId(value) {
  if (!/^\d+$/.test(value)) return null
  const id = Number(value)
  return Number.isSafeInteger(id) && id > 0 ? id : null
}

function findProjectById(id) {
  return db.get(
    `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
       FROM projects p
       JOIN users u ON u.id = p.user_id
       JOIN events e ON e.id = p.event_id
       WHERE p.id = ?`,
    [id],
  )
}

function serializeProject(row, { includeOwner = false } = {}) {
  const payload = {
    id: row.id,
    eventId: row.event_id,
    eventSlug: row.event_slug,
    eventName: row.event_name,
    title: row.title,
    slug: row.slug,
    tagline: row.tagline,
    description: row.description,
    category: row.category,
    technologies: parseTechnologies(row.technologies),
    teamName: row.team_name,
    repoUrl: row.repo_url,
    demoUrl: row.demo_url,
    coverImageUrl: row.cover_image_url,
    status: row.status,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
  if (includeOwner) {
    payload.ownerId = row.user_id
    payload.ownerEmail = row.owner_email
  }
  return payload
}

async function uniqueProjectSlug(base, excludeId = null) {
  let candidate = base || 'project'
  let suffix = 2

  for (;;) {
    const clash = excludeId
      ? await db.get('SELECT id FROM projects WHERE slug = ? AND id != ?', [candidate, excludeId])
      : await db.get('SELECT id FROM projects WHERE slug = ?', [candidate])
    if (!clash) return candidate
    candidate = `${base}-${suffix}`
    suffix += 1
  }
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateSignup(input) {
  const errors = {}
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : ''
  const password = typeof input.password === 'string' ? input.password : ''

  if (!email) {
    errors.email = 'Email is required.'
  } else if (email.length > 254 || !EMAIL_PATTERN.test(email)) {
    errors.email = 'Enter a valid email address.'
  }

  if (!password) {
    errors.password = 'Password is required.'
  } else if (password.length < 8) {
    errors.password = 'Password must be at least 8 characters.'
  } else if (password.length > 128) {
    errors.password = 'Password must be 128 characters or fewer.'
  } else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
    errors.password = 'Password must include at least one letter and one number.'
  }

  return { email, password, errors }
}

// ---------------------------------------------------------------- public API

app.get('/api/health', async (req, res) => {
  const status = await databaseHealth()
  res.status(status.ok ? 200 : 503).json({
    status: status.ok ? 'ok' : 'degraded',
    event: event.slug,
    database: status,
  })
})

app.get('/api/announcements', async (req, res) => {
  const { page, limit, errors } = pagination(req.query)
  const { category, error: categoryError } = categoryParam(req.query.category)
  if (categoryError) errors.category = categoryError

  const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (search.length > 100) errors.q = 'q must be 100 characters or fewer.'

  let eventId = event.id
  if (req.query.event !== undefined && req.query.event !== '') {
    const row = await db.get('SELECT id FROM events WHERE slug = ?', [String(req.query.event)])
    if (!row) errors.event = 'Unknown event.'
    else eventId = row.id
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters.', fields: errors },
    })
  }

  const where = ['a.is_published = TRUE', 'a.event_id = ?']
  const params = [eventId]

  if (category) {
    where.push('a.category = ?')
    params.push(category)
  }

  if (search) {
    const escaped = search.replace(/[%_!]/g, (character) => `!${character}`)
    where.push(
      `(a.title ${db.likeOperator} ? ESCAPE '!' OR a.content ${db.likeOperator} ? ESCAPE '!')`,
    )
    params.push(`%${escaped}%`, `%${escaped}%`)
  }

  const whereSql = where.join(' AND ')
  const total = (await db.get(`SELECT COUNT(*) AS count FROM announcements a WHERE ${whereSql}`, params))
    .count

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = await db.all(
    `SELECT a.*, e.slug AS event_slug, e.name AS event_name
       FROM announcements a
       JOIN events e ON e.id = a.event_id
       WHERE ${whereSql}
       ORDER BY a.published_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  res.json({
    data: rows.map((row) => serialize(row)),
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
    },
  })
})

app.get('/api/announcements/:identifier', async (req, res) => {
  const { identifier } = req.params
  const id = parseId(identifier)

  const row = id
    ? await db.get(
        `SELECT a.*, e.slug AS event_slug, e.name AS event_name
           FROM announcements a
           JOIN events e ON e.id = a.event_id
           WHERE a.id = ? AND a.is_published = TRUE`,
        [id],
      )
    : await db.get(
        `SELECT a.*, e.slug AS event_slug, e.name AS event_name
           FROM announcements a
           JOIN events e ON e.id = a.event_id
           WHERE a.slug = ? AND a.is_published = TRUE`,
        [identifier],
      )

  if (!row) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
    })
  }

  return res.json({ data: serialize(row, { includeContent: true }) })
})

// ------------------------------------------------------- participant API

app.get('/api/registrations/me', requireAuth, async (req, res) => {
  const row = await findRegistrationByUser(Number(req.user.sub))
  return res.json({ data: row ? serializeRegistration(row, { includeEmail: true }) : null })
})

app.post('/api/registrations', requireAuth, async (req, res) => {
  const { data, errors } = validateRegistration(req.body || {})
  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fields: errors },
    })
  }

  const existing = await findRegistrationByUser(Number(req.user.sub))
  if (existing) {
    return res.status(409).json({
      error: {
        code: 'REGISTRATION_EXISTS',
        message: 'You are already registered for C³.',
      },
    })
  }

  try {
    const timestamp = new Date().toISOString()
    const result = await db.run(
      `INSERT INTO registrations (event_id, user_id, full_name, campus, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      [event.id, Number(req.user.sub), data.fullName, data.campus, timestamp],
    )

    return res.status(201).json({
      data: serializeRegistration(await findRegistrationByUser(Number(req.user.sub)), {
        includeEmail: true,
      }),
      id: result.id,
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({
        error: {
          code: 'REGISTRATION_EXISTS',
          message: 'You are already registered for C³.',
        },
      })
    }
    throw error
  }
})

function projectCategoryParam(value) {
  if (value === undefined || value === '') return { category: null }
  const match = PROJECT_CATEGORY_LOOKUP.get(String(value).toLowerCase())
  if (!match) {
    return { error: `category must be one of: ${PROJECT_CATEGORIES.join(', ')}.` }
  }
  return { category: match }
}

app.get('/api/projects', async (req, res) => {
  const { page, limit, errors } = pagination(req.query)
  const { category, error: categoryError } = projectCategoryParam(req.query.category)
  if (categoryError) errors.category = categoryError

  const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (search.length > 100) errors.q = 'q must be 100 characters or fewer.'

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters.', fields: errors },
    })
  }

  const where = ["p.status = 'published'", 'p.event_id = ?']
  const params = [event.id]
  if (category) {
    where.push('p.category = ?')
    params.push(category)
  }
  if (search) {
    const escaped = search.replace(/[%_!]/g, (character) => `!${character}`)
    where.push(
      `(p.title ${db.likeOperator} ? ESCAPE '!' OR p.tagline ${db.likeOperator} ? ESCAPE '!' OR p.description ${db.likeOperator} ? ESCAPE '!' OR ${likeText('p.technologies')} ${db.likeOperator} ? ESCAPE '!' OR p.team_name ${db.likeOperator} ? ESCAPE '!')`,
    )
    params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`, `%${escaped}%`, `%${escaped}%`)
  }

  const whereSql = where.join(' AND ')
  const total = (await db.get(`SELECT COUNT(*) AS count FROM projects p WHERE ${whereSql}`, params))
    .count
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = await db.all(
    `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
       FROM projects p
       JOIN users u ON u.id = p.user_id
       JOIN events e ON e.id = p.event_id
       WHERE ${whereSql}
       ORDER BY p.published_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  return res.json({
    data: rows.map((row) => serializeProject(row)),
    meta: { total, page, limit, totalPages, hasMore: page < totalPages },
  })
})

app.get('/api/projects/mine', requireAuth, async (req, res) => {
  const rows = await db.all(
    `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
       FROM projects p
       JOIN users u ON u.id = p.user_id
       JOIN events e ON e.id = p.event_id
       WHERE p.user_id = ? AND p.event_id = ?
       ORDER BY p.updated_at DESC, p.id DESC`,
    [Number(req.user.sub), event.id],
  )

  return res.json({ data: rows.map((row) => serializeProject(row)), meta: { total: rows.length } })
})

app.get('/api/projects/mine/:id', requireAuth, async (req, res) => {
  const id = parseProjectId(req.params.id)
  if (!id) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Project id must be a positive integer.' } })
  }
  const row = await findProjectById(id)
  if (!row || row.user_id !== Number(req.user.sub)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } })
  }
  return res.json({ data: serializeProject(row) })
})

app.get('/api/projects/:identifier', async (req, res) => {
  const { identifier } = req.params
  const id = parseId(identifier)
  const row = id
    ? await db.get(
        `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
           FROM projects p
           JOIN users u ON u.id = p.user_id
           JOIN events e ON e.id = p.event_id
           WHERE p.id = ? AND p.status = 'published'`,
        [id],
      )
    : await db.get(
        `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
           FROM projects p
           JOIN users u ON u.id = p.user_id
           JOIN events e ON e.id = p.event_id
           WHERE p.slug = ? AND p.status = 'published'`,
        [identifier],
      )

  if (!row) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } })
  }
  return res.json({ data: serializeProject(row) })
})

app.post('/api/projects', requireAuth, async (req, res) => {
  const { data, errors } = validateProject(req.body || {})
  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fields: errors },
    })
  }

  const baseSlug = slugify(data.title)
  if (!baseSlug) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Check the highlighted fields.',
        fields: { title: 'A readable project URL could not be generated from this title.' },
      },
    })
  }

  const timestamp = new Date().toISOString()
  const result = await db.run(
    `INSERT INTO projects
        (event_id, user_id, title, slug, tagline, description, category, technologies,
         team_name, repo_url, demo_url, cover_image_url, status, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      event.id,
      Number(req.user.sub),
      data.title,
      await uniqueProjectSlug(baseSlug),
      data.tagline,
      data.description,
      data.category,
      data.technologies,
      data.teamName ?? null,
      data.repoUrl ?? null,
      data.demoUrl ?? null,
      data.coverImageUrl ?? null,
      data.status,
      timestamp,
      timestamp,
      null,
    ],
  )

  return res.status(201).json({ data: serializeProject(await findProjectById(result.id)) })
})

app.patch('/api/projects/:id', requireAuth, async (req, res) => {
  const id = parseProjectId(req.params.id)
  if (!id) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Project id must be a positive integer.' } })
  }
  const existing = await findProjectById(id)
  if (!existing) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } })
  }
  if (existing.user_id !== Number(req.user.sub)) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only edit your own project.' } })
  }

  const { data, errors } = validateProject(req.body || {}, { partial: true })
  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fields: errors },
    })
  }
  if (!Object.keys(data).length) {
    return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'Provide at least one field to update.' } })
  }
  if (existing.status === 'published') {
    return res.status(409).json({
      error: {
        code: 'PROJECT_PUBLISHED',
        message: 'Published projects can only be changed by an organizer.',
      },
    })
  }

  const updates = {
    title: data.title,
    tagline: data.tagline,
    description: data.description,
    category: data.category,
    technologies: data.technologies,
    team_name: data.teamName,
    repo_url: data.repoUrl,
    demo_url: data.demoUrl,
    cover_image_url: data.coverImageUrl,
    status: data.status,
    updated_at: new Date().toISOString(),
  }
  const columns = Object.fromEntries(
    Object.entries(updates).filter(([, value]) => value !== undefined),
  )
  const assignments = Object.keys(columns)
    .map((column) => `${column} = ?`)
    .join(', ')
  await db.run(`UPDATE projects SET ${assignments} WHERE id = ?`, [...Object.values(columns), id])

  return res.json({ data: serializeProject(await findProjectById(id)) })
})

app.delete('/api/projects/:id', requireAuth, async (req, res) => {
  const id = parseProjectId(req.params.id)
  if (!id) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Project id must be a positive integer.' } })
  }
  const existing = await findProjectById(id)
  if (!existing) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } })
  }

  const isOwner = existing.user_id === Number(req.user.sub)
  const isOrganizer = req.user.role === 'organizer' || req.user.role === 'admin'
  if (!isOwner && !isOrganizer) {
    return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'You can only delete your own project.' } })
  }
  if (isOwner && !isOrganizer && existing.status === 'published') {
    return res.status(409).json({
      error: {
        code: 'PROJECT_PUBLISHED',
        message: 'Published projects can only be removed by an organizer.',
      },
    })
  }

  await db.run('DELETE FROM projects WHERE id = ?', [id])
  return res.status(204).end()
})

// ------------------------------------------------------------ organizer API

// ------------------------------------------------------------ google sign-in

function readCookie(req, name) {
  const header = req.headers.cookie || ''
  for (const part of header.split(';')) {
    const trimmed = part.trim()
    const separator = trimmed.indexOf('=')
    if (separator === -1) continue
    if (trimmed.slice(0, separator) === name) {
      return decodeURIComponent(trimmed.slice(separator + 1))
    }
  }
  return null
}

function safeNextPath(value) {
  if (typeof value !== 'string') return null
  if (!value.startsWith('/') || value.startsWith('//')) return null
  if (value.length > 512) return null
  return value
}

function publicUser(user) {
  return { id: user.id, email: user.email, role: user.role }
}

/**
 * Links or creates the local account for a Google identity.
 *
 * The email is only trusted because it came from a verified Google ID token.
 * An existing account with the same verified email is linked rather than
 * duplicated, and an account already linked to another Google subject is
 * refused so a second Google account cannot take over an existing one.
 */
async function findOrCreateGoogleUser(profile) {
  const linked = await db.get(
    `SELECT u.* FROM oauth_accounts a JOIN users u ON u.id = a.user_id
      WHERE a.provider = ? AND a.provider_user_id = ?`,
    ['google', profile.subject],
  )
  if (linked) {
    if (String(linked.email).toLowerCase() !== profile.email) {
      throw new Error('This Google account no longer matches the linked account.')
    }
    return linked
  }

  const existing = await db.get('SELECT * FROM users WHERE lower(email) = lower(?)', [
    profile.email,
  ])

  if (existing) {
    const alreadyLinked = await db.get(
      'SELECT user_id FROM oauth_accounts WHERE provider = ? AND user_id = ?',
      ['google', existing.id],
    )
    if (alreadyLinked) {
      throw new Error('This account is already linked to a different Google account.')
    }

    await db.run(
      `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, created_at)
       VALUES (?, ?, ?, ?, ?)`,
      [existing.id, 'google', profile.subject, profile.email, new Date().toISOString()],
    )
    return existing
  }

  const createdAt = new Date().toISOString()
  // OAuth-only accounts get an unusable marker, never a password that could be
  // guessed or logged. verifyPassword() rejects anything that is not scrypt$.
  const unusable = `oauth$${crypto.randomBytes(32).toString('hex')}`

  const created = await db.run(
    'INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
    [profile.email, unusable, 'participant', createdAt],
  )

  await db.run(
    `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, email, created_at)
     VALUES (?, ?, ?, ?, ?)`,
    [created.id, 'google', profile.subject, profile.email, createdAt],
  )

  return db.get('SELECT * FROM users WHERE id = ?', [created.id])
}

app.get('/api/auth/providers', (req, res) => {
  const config = googleConfig()
  res.json({ google: config.enabled })
})

app.get('/api/auth/google/start', oauthLimit, (req, res) => {
  const config = googleConfig()
  if (!config.enabled) {
    return res.status(503).json({
      error: {
        code: 'GOOGLE_NOT_CONFIGURED',
        message: 'Google sign-in is not configured on this deployment.',
      },
    })
  }

  const { state, nonce, maxAge } = createState()
  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  }

  res.cookie('uf_oauth_state', nonce, { ...cookieOptions, maxAge })

  const next = safeNextPath(req.query.next)
  if (next) res.cookie('uf_oauth_next', next, { ...cookieOptions, maxAge })
  else res.clearCookie('uf_oauth_next', { path: '/' })

  return res.redirect(authorizationUrl(state))
})

app.get('/api/auth/google/callback', oauthLimit, async (req, res) => {
  const config = googleConfig()
  const backToLogin = (reason) =>
    res.redirect(`${config.appUrl}/login?google_error=${encodeURIComponent(reason)}`)

  if (req.query.error) {
    return backToLogin(req.query.error === 'access_denied' ? 'cancelled' : 'denied')
  }

  // CSRF state is checked before anything else is believed.
  const state = typeof req.query.state === 'string' ? req.query.state : ''
  const cookieNonce = readCookie(req, 'uf_oauth_state') || ''
  if (!verifyState(state, cookieNonce)) return backToLogin('state')

  if (!config.enabled) return backToLogin('not_configured')

  const code = typeof req.query.code === 'string' ? req.query.code : ''
  if (!code) return backToLogin('code')

  res.clearCookie('uf_oauth_state', { path: '/' })

  try {
    const profile = await exchangeCode(code)
    const user = await findOrCreateGoogleUser(profile)
    const { token, expiresAt } = signToken(user)
    const exchange = createExchange({ token, expiresAt, user: publicUser(user) })

    const next = safeNextPath(readCookie(req, 'uf_oauth_next'))
    res.clearCookie('uf_oauth_next', { path: '/' })

    const target = new URL(`${config.appUrl}/login`)
    target.searchParams.set('google_code', exchange)
    if (next) target.searchParams.set('next', next)
    return res.redirect(target.toString())
  } catch (error) {
    // No token, no email, no account details in the log.
    console.error('[auth] Google sign-in rejected:', error.message)
    return backToLogin('failed')
  }
})

app.post('/api/auth/google/session', authLimit, (req, res) => {
  const entry = consumeExchange(req.body?.code)
  if (!entry) {
    return res.status(400).json({
      error: {
        code: 'INVALID_EXCHANGE',
        message: 'That sign-in link is invalid or has expired. Start again.',
      },
    })
  }

  return res.json({ token: entry.token, expiresAt: entry.expiresAt, user: entry.user })
})

app.post('/api/auth/login', authLimit, async (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
    })
  }

  const user = await db.get('SELECT * FROM users WHERE email = ?', [email])
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({
      error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' },
    })
  }

  const { token, expiresAt } = signToken(user)
  return res.json({
    token,
    expiresAt,
    user: { id: user.id, email: user.email, role: user.role },
  })
})

app.get('/api/auth/me', (req, res) => {
  const header = req.get('authorization') || ''
  const [scheme, token] = header.split(' ')
  const claims = scheme === 'Bearer' ? verifyToken(token) : null
  if (!claims) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'The session is invalid or has expired.' },
    })
  }
  return res.json({ user: { id: claims.sub, email: claims.email, role: claims.role } })
})

app.post('/api/auth/signup', authLimit, async (req, res) => {
  const { email, password, errors } = validateSignup(req.body || {})

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fields: errors },
    })
  }

  const existing = await db.get('SELECT id FROM users WHERE email = ?', [email])
  if (existing) {
    return res.status(409).json({
      error: {
        code: 'EMAIL_TAKEN',
        message: 'An account with that email already exists.',
        fields: { email: 'That email is already registered.' },
      },
    })
  }

  try {
    const result = await db.run(
      'INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
      [email, hashPassword(password), 'participant', new Date().toISOString()],
    )

    return res.status(201).json({
      user: { id: result.id, email, role: 'participant' },
    })
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_TAKEN',
          message: 'An account with that email already exists.',
          fields: { email: 'That email is already registered.' },
        },
      })
    }
    throw error
  }
})

app.get('/api/admin/announcements', requireOrganizer, async (req, res) => {
  const { page, limit, errors } = pagination(req.query)
  const { category, error: categoryError } = categoryParam(req.query.category)
  if (categoryError) errors.category = categoryError

  const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (search.length > 100) errors.q = 'q must be 100 characters or fewer.'

  const status = req.query.status === undefined ? 'all' : String(req.query.status)
  if (!['all', 'published', 'draft'].includes(status)) {
    errors.status = 'status must be all, published, or draft.'
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters.', fields: errors },
    })
  }

  const where = ['a.event_id = ?']
  const params = [event.id]

  if (status === 'published') where.push('a.is_published = TRUE')
  if (status === 'draft') where.push('a.is_published = FALSE')
  if (category) {
    where.push('a.category = ?')
    params.push(category)
  }
  if (search) {
    const escaped = search.replace(/[%_!]/g, (character) => `!${character}`)
    where.push(
      `(a.title ${db.likeOperator} ? ESCAPE '!' OR a.content ${db.likeOperator} ? ESCAPE '!')`,
    )
    params.push(`%${escaped}%`, `%${escaped}%`)
  }

  const whereSql = where.join(' AND ')
  const total = (await db.get(`SELECT COUNT(*) AS count FROM announcements a WHERE ${whereSql}`, params))
    .count
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = await db.all(
    `SELECT a.*, e.slug AS event_slug, e.name AS event_name
       FROM announcements a
       JOIN events e ON e.id = a.event_id
       WHERE ${whereSql}
       ORDER BY a.updated_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  const summary = await db.get(
    `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN is_published = TRUE THEN 1 ELSE 0 END), 0) AS published,
         COALESCE(SUM(CASE WHEN is_published = FALSE THEN 1 ELSE 0 END), 0) AS drafts
       FROM announcements WHERE event_id = ?`,
    [event.id],
  )

  return res.json({
    data: rows.map((row) => serialize(row)),
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      summary,
    },
  })
})

app.get('/api/admin/announcements/:id', requireOrganizer, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Announcement id must be a positive integer.' },
    })
  }

  const row = await findAnnouncementById(id)
  if (!row) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Announcement not found.' } })
  }

  return res.json({ data: serialize(row, { includeContent: true }) })
})

app.post('/api/announcements', requireOrganizer, async (req, res) => {
  const { data, errors } = await validateAnnouncement(req.body || {})

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid announcement data.', fields: errors },
    })
  }

  const baseSlug = data.slug || slugify(data.title)
  if (!baseSlug) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Invalid announcement data.',
        fields: { slug: 'A readable slug could not be generated from the title.' },
      },
    })
  }

  const slug = await uniqueSlug(baseSlug)
  const timestamp = new Date().toISOString()
  const isPublished = data.isPublished ?? false
  const publishedAt = isPublished ? data.publishedAt || timestamp : data.publishedAt || null
  const eventId = data.eventId || event.id

  const result = await db.run(
    `INSERT INTO announcements
        (event_id, title, slug, content, category, published_at, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      eventId,
      data.title,
      slug,
      data.content,
      data.category,
      publishedAt,
      isPublished,
      timestamp,
      timestamp,
    ],
  )

  const row = await findAnnouncementById(result.id)
  return res.status(201).json({ data: serialize(row, { includeContent: true }) })
})

app.patch('/api/announcements/:id', requireOrganizer, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Announcement id must be a positive integer.' },
    })
  }

  const existing = await findAnnouncementById(id)
  if (!existing) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
    })
  }

  const { data, errors } = await validateAnnouncement(req.body || {}, { partial: true })

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid announcement data.', fields: errors },
    })
  }

  if (!Object.keys(data).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Provide at least one field to update.' },
    })
  }

  const updates = {}
  if (data.title !== undefined) updates.title = data.title
  if (data.content !== undefined) updates.content = data.content
  if (data.category !== undefined) updates.category = data.category
  if (data.eventId !== undefined) updates.event_id = data.eventId
  if (data.publishedAt !== undefined) updates.published_at = data.publishedAt

  if (data.slug !== undefined) {
    updates.slug = data.slug === existing.slug ? existing.slug : await uniqueSlug(data.slug, id)
  }

  if (data.isPublished !== undefined) {
    updates.is_published = data.isPublished
    if (data.isPublished) {
      updates.published_at =
        data.publishedAt !== undefined
          ? data.publishedAt
          : existing.published_at || new Date().toISOString()
    }
  }

  updates.updated_at = new Date().toISOString()

  const assignments = Object.keys(updates)
    .map((column) => `${column} = ?`)
    .join(', ')
  await db.run(`UPDATE announcements SET ${assignments} WHERE id = ?`, [...Object.values(updates), id])

  res.json({ data: serialize(await findAnnouncementById(id), { includeContent: true }) })
})

app.delete('/api/announcements/:id', requireOrganizer, async (req, res) => {
  const id = parseId(req.params.id)
  if (!id) {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Announcement id must be a positive integer.' },
    })
  }

  const result = await db.run('DELETE FROM announcements WHERE id = ?', [id])
  if (result.changes === 0) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
    })
  }

  res.status(204).end()
})

app.get('/api/admin/registrations', requireOrganizer, async (req, res) => {
  const { page, limit, errors } = pagination(req.query)
  const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (search.length > 100) errors.q = 'q must be 100 characters or fewer.'

  const campus = typeof req.query.campus === 'string' ? req.query.campus.trim() : ''
  if (campus.length > 120) errors.campus = 'campus must be 120 characters or fewer.'

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters.', fields: errors },
    })
  }

  const where = ['r.event_id = ?']
  const params = [event.id]
  if (campus) {
    where.push('lower(r.campus) = lower(?)')
    params.push(campus)
  }
  if (search) {
    const escaped = search.replace(/[%_!]/g, (character) => `!${character}`)
    where.push(
      `(r.full_name ${db.likeOperator} ? ESCAPE '!' OR u.email ${db.likeOperator} ? ESCAPE '!' OR r.campus ${db.likeOperator} ? ESCAPE '!')`,
    )
    params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`)
  }

  const whereSql = where.join(' AND ')
  const total = (
    await db.get(
      `SELECT COUNT(*) AS count FROM registrations r JOIN users u ON u.id = r.user_id WHERE ${whereSql}`,
      params,
    )
  ).count
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = await db.all(
    `SELECT r.*, e.slug AS event_slug, e.name AS event_name, u.email
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       JOIN users u ON u.id = r.user_id
       WHERE ${whereSql}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  const campuses = (
    await db.all(
      // DISTINCT + ORDER BY needs the sort expression in the select list on
      // PostgreSQL; SQLite accepts the same statement.
      'SELECT DISTINCT campus, lower(campus) AS sort_key FROM registrations WHERE event_id = ? ORDER BY sort_key',
      [event.id],
    )
  ).map((row) => row.campus)
  const totalAll = (
    await db.get('SELECT COUNT(*) AS count FROM registrations WHERE event_id = ?', [event.id])
  ).count

  return res.json({
    data: rows.map((row) => serializeRegistration(row, { includeEmail: true })),
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      campuses,
      summary: { total: totalAll, campuses: campuses.length },
    },
  })
})

app.get('/api/admin/projects', requireOrganizer, async (req, res) => {
  const { page, limit, errors } = pagination(req.query)
  const { category, error: categoryError } = projectCategoryParam(req.query.category)
  if (categoryError) errors.category = categoryError

  const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (search.length > 100) errors.q = 'q must be 100 characters or fewer.'

  const status = req.query.status === undefined ? 'all' : String(req.query.status)
  if (!['all', 'draft', 'submitted', 'published', 'rejected'].includes(status)) {
    errors.status = 'status must be all, draft, submitted, published, or rejected.'
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters.', fields: errors },
    })
  }

  const where = ['p.event_id = ?']
  const params = [event.id]
  if (status !== 'all') {
    where.push('p.status = ?')
    params.push(status)
  }
  if (category) {
    where.push('p.category = ?')
    params.push(category)
  }
  if (search) {
    const escaped = search.replace(/[%_!]/g, (character) => `!${character}`)
    where.push(
      `(p.title ${db.likeOperator} ? ESCAPE '!' OR p.tagline ${db.likeOperator} ? ESCAPE '!' OR p.description ${db.likeOperator} ? ESCAPE '!' OR ${likeText('p.technologies')} ${db.likeOperator} ? ESCAPE '!' OR p.team_name ${db.likeOperator} ? ESCAPE '!' OR u.email ${db.likeOperator} ? ESCAPE '!')`,
    )
    params.push(
      `%${escaped}%`,
      `%${escaped}%`,
      `%${escaped}%`,
      `%${escaped}%`,
      `%${escaped}%`,
      `%${escaped}%`,
    )
  }

  const whereSql = where.join(' AND ')
  const total = (
    await db.get(
      `SELECT COUNT(*) AS count FROM projects p JOIN users u ON u.id = p.user_id WHERE ${whereSql}`,
      params,
    )
  ).count
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = await db.all(
    `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
       FROM projects p
       JOIN users u ON u.id = p.user_id
       JOIN events e ON e.id = p.event_id
       WHERE ${whereSql}
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  )

  const summary = await db.get(
    `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS drafts,
         COALESCE(SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END), 0) AS submitted,
         COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published,
         COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected
       FROM projects WHERE event_id = ?`,
    [event.id],
  )

  return res.json({
    data: rows.map((row) => serializeProject(row, { includeOwner: true })),
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasMore: page < totalPages,
      summary,
    },
  })
})

app.patch('/api/admin/projects/:id', requireOrganizer, async (req, res) => {
  const id = parseProjectId(req.params.id)
  if (!id) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Project id must be a positive integer.' } })
  }
  const existing = await findProjectById(id)
  if (!existing) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } })
  }

  const status = req.body?.status
  if (!ADMIN_PROJECT_STATUSES.includes(status)) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: `status must be one of: ${ADMIN_PROJECT_STATUSES.join(', ')}.`,
      },
    })
  }

  const timestamp = new Date().toISOString()
  const publishedAt = status === 'published' ? timestamp : null
  await db.run('UPDATE projects SET status = ?, published_at = ?, updated_at = ? WHERE id = ?', [
    status,
    publishedAt,
    timestamp,
    id,
  ])

  return res.json({ data: serializeProject(await findProjectById(id), { includeOwner: true }) })
})

// ------------------------------------------------------------ static + errors

const distDirectory = path.resolve(process.cwd(), 'dist')
if (fs.existsSync(distDirectory)) {
  app.use(express.static(distDirectory))
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(distDirectory, 'index.html'))
  })
}

app.use('/api', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'API route not found.' } })
})

app.use((error, req, res, next) => {
  if (res.headersSent) return next(error)

  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
    })
  }

  console.error('[api] Unhandled error:', error)
  return res.status(500).json({
    error: { code: 'INTERNAL_ERROR', message: 'Something went wrong on the server.' },
  })
})

const port = Number(process.env.PORT) || 4000
app.listen(port, () => {
  console.log(`[api] Unstable Forge API listening on http://localhost:${port}`)
})
