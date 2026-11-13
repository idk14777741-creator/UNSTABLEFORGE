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
const { signToken, verifyToken, verifyPassword, requireOrganizer } = await import('./auth.js')

const CATEGORIES = ['Important', 'Registration', 'Schedule', 'Competition', 'General']
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
