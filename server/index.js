import fs from 'node:fs'
import path from 'node:path'
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

function validateAnnouncement(input, { partial = false } = {}) {
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
      const row = db.prepare('SELECT id FROM events WHERE slug = ?').get(input.eventSlug)
      if (!row) errors.eventSlug = 'Unknown event.'
      else data.eventId = row.id
    }
  }

  return { data, errors }
}

function uniqueSlug(base, excludeId = null) {
  let candidate = base || 'announcement'
  let suffix = 2
  const stmt = excludeId
    ? db.prepare('SELECT id FROM announcements WHERE slug = ? AND id != ?')
    : db.prepare('SELECT id FROM announcements WHERE slug = ?')

  while (excludeId ? stmt.get(candidate, excludeId) : stmt.get(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
}

function findAnnouncementById(id) {
  return db
    .prepare(
      `SELECT a.*, e.slug AS event_slug, e.name AS event_name
       FROM announcements a
       JOIN events e ON e.id = a.event_id
       WHERE a.id = ?`,
    )
    .get(id)
}

function parseTechnologies(value) {
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
  return db
    .prepare(
      `SELECT r.*, e.slug AS event_slug, e.name AS event_name, u.email
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       JOIN users u ON u.id = r.user_id
       WHERE r.user_id = ? AND r.event_id = ?`,
    )
    .get(userId, event.id)
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
  return db
    .prepare(
      `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
       FROM projects p
       JOIN users u ON u.id = p.user_id
       JOIN events e ON e.id = p.event_id
       WHERE p.id = ?`,
    )
    .get(id)
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

function uniqueProjectSlug(base, excludeId = null) {
  let candidate = base || 'project'
  let suffix = 2
  const statement = excludeId
    ? db.prepare('SELECT id FROM projects WHERE slug = ? AND id != ?')
    : db.prepare('SELECT id FROM projects WHERE slug = ?')

  while (excludeId ? statement.get(candidate, excludeId) : statement.get(candidate)) {
    candidate = `${base}-${suffix}`
    suffix += 1
  }
  return candidate
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

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', event: event.slug })
})

app.get('/api/announcements', (req, res) => {
  const { page, limit, errors } = pagination(req.query)
  const { category, error: categoryError } = categoryParam(req.query.category)
  if (categoryError) errors.category = categoryError

  const search = typeof req.query.q === 'string' ? req.query.q.trim() : ''
  if (search.length > 100) errors.q = 'q must be 100 characters or fewer.'

  let eventId = event.id
  if (req.query.event !== undefined && req.query.event !== '') {
    const row = db.prepare('SELECT id FROM events WHERE slug = ?').get(String(req.query.event))
    if (!row) errors.event = 'Unknown event.'
    else eventId = row.id
  }

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters.', fields: errors },
    })
  }

  const where = ['a.is_published = 1', 'a.event_id = ?']
  const params = [eventId]

  if (category) {
    where.push('a.category = ?')
    params.push(category)
  }

  if (search) {
    const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`)
    where.push("(a.title LIKE ? ESCAPE '\\' OR a.content LIKE ? ESCAPE '\\')")
    params.push(`%${escaped}%`, `%${escaped}%`)
  }

  const whereSql = where.join(' AND ')
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM announcements a WHERE ${whereSql}`)
    .get(...params).count

  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = db
    .prepare(
      `SELECT a.*, e.slug AS event_slug, e.name AS event_name
       FROM announcements a
       JOIN events e ON e.id = a.event_id
       WHERE ${whereSql}
       ORDER BY a.published_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset)

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

app.get('/api/announcements/:identifier', (req, res) => {
  const { identifier } = req.params
  const id = parseId(identifier)

  const row = id
    ? db
        .prepare(
          `SELECT a.*, e.slug AS event_slug, e.name AS event_name
           FROM announcements a
           JOIN events e ON e.id = a.event_id
           WHERE a.id = ? AND a.is_published = 1`,
        )
        .get(id)
    : db
        .prepare(
          `SELECT a.*, e.slug AS event_slug, e.name AS event_name
           FROM announcements a
           JOIN events e ON e.id = a.event_id
           WHERE a.slug = ? AND a.is_published = 1`,
        )
        .get(identifier)

  if (!row) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
    })
  }

  return res.json({ data: serialize(row, { includeContent: true }) })
})

// ------------------------------------------------------- participant API

app.get('/api/registrations/me', requireAuth, (req, res) => {
  const row = findRegistrationByUser(Number(req.user.sub))
  return res.json({ data: row ? serializeRegistration(row, { includeEmail: true }) : null })
})

app.post('/api/registrations', requireAuth, (req, res) => {
  const { data, errors } = validateRegistration(req.body || {})
  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fields: errors },
    })
  }

  const existing = findRegistrationByUser(Number(req.user.sub))
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
    const result = db
      .prepare(
        `INSERT INTO registrations (event_id, user_id, full_name, campus, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(event.id, Number(req.user.sub), data.fullName, data.campus, timestamp)

    return res.status(201).json({
      data: serializeRegistration(findRegistrationByUser(Number(req.user.sub)), {
        includeEmail: true,
      }),
      id: Number(result.lastInsertRowid),
    })
  } catch (error) {
    if (String(error?.code).startsWith('SQLITE_CONSTRAINT')) {
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

app.get('/api/projects', (req, res) => {
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
    const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`)
    where.push(
      "(p.title LIKE ? ESCAPE '\\' OR p.tagline LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR p.technologies LIKE ? ESCAPE '\\' OR p.team_name LIKE ? ESCAPE '\\')",
    )
    params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`, `%${escaped}%`, `%${escaped}%`)
  }

  const whereSql = where.join(' AND ')
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM projects p WHERE ${whereSql}`)
    .get(...params).count
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = db
    .prepare(
      `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
       FROM projects p
       JOIN users u ON u.id = p.user_id
       JOIN events e ON e.id = p.event_id
       WHERE ${whereSql}
       ORDER BY p.published_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset)

  return res.json({
    data: rows.map((row) => serializeProject(row)),
    meta: { total, page, limit, totalPages, hasMore: page < totalPages },
  })
})

app.get('/api/projects/mine', requireAuth, (req, res) => {
  const rows = db
    .prepare(
      `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
       FROM projects p
       JOIN users u ON u.id = p.user_id
       JOIN events e ON e.id = p.event_id
       WHERE p.user_id = ? AND p.event_id = ?
       ORDER BY p.updated_at DESC, p.id DESC`,
    )
    .all(Number(req.user.sub), event.id)

  return res.json({ data: rows.map((row) => serializeProject(row)), meta: { total: rows.length } })
})

app.get('/api/projects/mine/:id', requireAuth, (req, res) => {
  const id = parseProjectId(req.params.id)
  if (!id) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Project id must be a positive integer.' } })
  }
  const row = findProjectById(id)
  if (!row || row.user_id !== Number(req.user.sub)) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } })
  }
  return res.json({ data: serializeProject(row) })
})

app.get('/api/projects/:identifier', (req, res) => {
  const { identifier } = req.params
  const id = parseId(identifier)
  const row = id
    ? db
        .prepare(
          `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
           FROM projects p
           JOIN users u ON u.id = p.user_id
           JOIN events e ON e.id = p.event_id
           WHERE p.id = ? AND p.status = 'published'`,
        )
        .get(id)
    : db
        .prepare(
          `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
           FROM projects p
           JOIN users u ON u.id = p.user_id
           JOIN events e ON e.id = p.event_id
           WHERE p.slug = ? AND p.status = 'published'`,
        )
        .get(identifier)

  if (!row) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Project not found.' } })
  }
  return res.json({ data: serializeProject(row) })
})

app.post('/api/projects', requireAuth, (req, res) => {
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
  const result = db
    .prepare(
      `INSERT INTO projects
        (event_id, user_id, title, slug, tagline, description, category, technologies,
         team_name, repo_url, demo_url, cover_image_url, status, created_at, updated_at, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      event.id,
      Number(req.user.sub),
      data.title,
      uniqueProjectSlug(baseSlug),
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
    )

  return res.status(201).json({ data: serializeProject(findProjectById(Number(result.lastInsertRowid))) })
})

app.patch('/api/projects/:id', requireAuth, (req, res) => {
  const id = parseProjectId(req.params.id)
  if (!id) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Project id must be a positive integer.' } })
  }
  const existing = findProjectById(id)
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
  db.prepare(`UPDATE projects SET ${assignments} WHERE id = ?`).run(
    ...Object.values(columns),
    id,
  )

  return res.json({ data: serializeProject(findProjectById(id)) })
})

app.delete('/api/projects/:id', requireAuth, (req, res) => {
  const id = parseProjectId(req.params.id)
  if (!id) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Project id must be a positive integer.' } })
  }
  const existing = findProjectById(id)
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

  db.prepare('DELETE FROM projects WHERE id = ?').run(id)
  return res.status(204).end()
})

// ------------------------------------------------------------ organizer API

app.post('/api/auth/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!email || !password) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Email and password are required.' },
    })
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email)
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

app.post('/api/auth/signup', (req, res) => {
  const { email, password, errors } = validateSignup(req.body || {})

  if (Object.keys(errors).length) {
    return res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Check the highlighted fields.', fields: errors },
    })
  }

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
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
    const result = db
      .prepare(
        'INSERT INTO users (email, password_hash, role, created_at) VALUES (?, ?, ?, ?)',
      )
      .run(email, hashPassword(password), 'participant', new Date().toISOString())

    return res.status(201).json({
      user: { id: Number(result.lastInsertRowid), email, role: 'participant' },
    })
  } catch (error) {
    if (String(error?.code).startsWith('SQLITE_CONSTRAINT')) {
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

app.get('/api/admin/announcements', requireOrganizer, (req, res) => {
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

  if (status === 'published') where.push('a.is_published = 1')
  if (status === 'draft') where.push('a.is_published = 0')
  if (category) {
    where.push('a.category = ?')
    params.push(category)
  }
  if (search) {
    const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`)
    where.push("(a.title LIKE ? ESCAPE '\\' OR a.content LIKE ? ESCAPE '\\')")
    params.push(`%${escaped}%`, `%${escaped}%`)
  }

  const whereSql = where.join(' AND ')
  const total = db
    .prepare(`SELECT COUNT(*) AS count FROM announcements a WHERE ${whereSql}`)
    .get(...params).count
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = db
    .prepare(
      `SELECT a.*, e.slug AS event_slug, e.name AS event_name
       FROM announcements a
       JOIN events e ON e.id = a.event_id
       WHERE ${whereSql}
       ORDER BY a.updated_at DESC, a.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset)

  const summary = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN is_published = 1 THEN 1 ELSE 0 END), 0) AS published,
         COALESCE(SUM(CASE WHEN is_published = 0 THEN 1 ELSE 0 END), 0) AS drafts
       FROM announcements WHERE event_id = ?`,
    )
    .get(event.id)

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

app.get('/api/admin/announcements/:id', requireOrganizer, (req, res) => {
  const id = parseId(req.params.id)
  if (!id) {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Announcement id must be a positive integer.' },
    })
  }

  const row = findAnnouncementById(id)
  if (!row) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Announcement not found.' } })
  }

  return res.json({ data: serialize(row, { includeContent: true }) })
})

app.post('/api/announcements', requireOrganizer, (req, res) => {
  const { data, errors } = validateAnnouncement(req.body || {})

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

  const slug = uniqueSlug(baseSlug)
  const timestamp = new Date().toISOString()
  const isPublished = data.isPublished ?? false
  const publishedAt = isPublished ? data.publishedAt || timestamp : data.publishedAt || null
  const eventId = data.eventId || event.id

  const result = db
    .prepare(
      `INSERT INTO announcements
        (event_id, title, slug, content, category, published_at, is_published, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      eventId,
      data.title,
      slug,
      data.content,
      data.category,
      publishedAt,
      isPublished ? 1 : 0,
      timestamp,
      timestamp,
    )

  const row = findAnnouncementById(Number(result.lastInsertRowid))
  return res.status(201).json({ data: serialize(row, { includeContent: true }) })
})

app.patch('/api/announcements/:id', requireOrganizer, (req, res) => {
  const id = parseId(req.params.id)
  if (!id) {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Announcement id must be a positive integer.' },
    })
  }

  const existing = findAnnouncementById(id)
  if (!existing) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
    })
  }

  const { data, errors } = validateAnnouncement(req.body || {}, { partial: true })

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
    updates.slug = data.slug === existing.slug ? existing.slug : uniqueSlug(data.slug, id)
  }

  if (data.isPublished !== undefined) {
    updates.is_published = data.isPublished ? 1 : 0
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
  db.prepare(`UPDATE announcements SET ${assignments} WHERE id = ?`).run(
    ...Object.values(updates),
    id,
  )

  res.json({ data: serialize(findAnnouncementById(id), { includeContent: true }) })
})

app.delete('/api/announcements/:id', requireOrganizer, (req, res) => {
  const id = parseId(req.params.id)
  if (!id) {
    return res.status(400).json({
      error: { code: 'INVALID_ID', message: 'Announcement id must be a positive integer.' },
    })
  }

  const result = db.prepare('DELETE FROM announcements WHERE id = ?').run(id)
  if (result.changes === 0) {
    return res.status(404).json({
      error: { code: 'NOT_FOUND', message: 'Announcement not found.' },
    })
  }

  res.status(204).end()
})

app.get('/api/admin/registrations', requireOrganizer, (req, res) => {
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
    where.push('r.campus = ? COLLATE NOCASE')
    params.push(campus)
  }
  if (search) {
    const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`)
    where.push(
      "(r.full_name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\' OR r.campus LIKE ? ESCAPE '\\')",
    )
    params.push(`%${escaped}%`, `%${escaped}%`, `%${escaped}%`)
  }

  const whereSql = where.join(' AND ')
  const total = db
    .prepare(
      `SELECT COUNT(*) AS count FROM registrations r JOIN users u ON u.id = r.user_id WHERE ${whereSql}`,
    )
    .get(...params).count
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = db
    .prepare(
      `SELECT r.*, e.slug AS event_slug, e.name AS event_name, u.email
       FROM registrations r
       JOIN events e ON e.id = r.event_id
       JOIN users u ON u.id = r.user_id
       WHERE ${whereSql}
       ORDER BY r.created_at DESC, r.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset)

  const campuses = db
    .prepare(
      'SELECT DISTINCT campus FROM registrations WHERE event_id = ? ORDER BY campus COLLATE NOCASE',
    )
    .all(event.id)
    .map((row) => row.campus)
  const totalAll = db
    .prepare('SELECT COUNT(*) AS count FROM registrations WHERE event_id = ?')
    .get(event.id).count

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

app.get('/api/admin/projects', requireOrganizer, (req, res) => {
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
    const escaped = search.replace(/[\\%_]/g, (character) => `\\${character}`)
    where.push(
      "(p.title LIKE ? ESCAPE '\\' OR p.tagline LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR p.technologies LIKE ? ESCAPE '\\' OR p.team_name LIKE ? ESCAPE '\\' OR u.email LIKE ? ESCAPE '\\')",
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
  const total = db
    .prepare(
      `SELECT COUNT(*) AS count FROM projects p JOIN users u ON u.id = p.user_id WHERE ${whereSql}`,
    )
    .get(...params).count
  const totalPages = Math.max(1, Math.ceil(total / limit))
  const offset = (page - 1) * limit

  const rows = db
    .prepare(
      `SELECT p.*, u.email AS owner_email, e.slug AS event_slug, e.name AS event_name
       FROM projects p
       JOIN users u ON u.id = p.user_id
       JOIN events e ON e.id = p.event_id
       WHERE ${whereSql}
       ORDER BY p.updated_at DESC, p.id DESC
       LIMIT ? OFFSET ?`,
    )
    .all(...params, limit, offset)

  const summary = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         COALESCE(SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END), 0) AS drafts,
         COALESCE(SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END), 0) AS submitted,
         COALESCE(SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END), 0) AS published,
         COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected
       FROM projects WHERE event_id = ?`,
    )
    .get(event.id)

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

app.patch('/api/admin/projects/:id', requireOrganizer, (req, res) => {
  const id = parseProjectId(req.params.id)
  if (!id) {
    return res.status(400).json({ error: { code: 'INVALID_ID', message: 'Project id must be a positive integer.' } })
  }
  const existing = findProjectById(id)
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
  db.prepare(
    'UPDATE projects SET status = ?, published_at = ?, updated_at = ? WHERE id = ?',
  ).run(status, publishedAt, timestamp, id)

  return res.json({ data: serializeProject(findProjectById(id), { includeOwner: true }) })
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
