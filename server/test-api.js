import { loadEnv } from './env.js'

loadEnv()

const BASE = process.env.API_URL || 'http://localhost:4000'
let passed = 0
let failed = 0
const created = []

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.error(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function request(path, options = {}) {
  const response = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {}),
    },
  })

  const text = await response.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }

  return { status: response.status, body }
}

async function main() {
  console.log(`\nUnstable Forge API tests → ${BASE}\n`)

  const health = await request('/api/health')
  check('health endpoint returns ok', health.status === 200 && health.body.status === 'ok')

  const firstPage = await request('/api/announcements?page=1&limit=5')
  check('public list returns 200', firstPage.status === 200)
  const meta = firstPage.body.meta
  check('pagination metadata is complete', Boolean(meta) && ['total', 'page', 'limit', 'totalPages', 'hasMore'].every((key) => key in meta))
  check('draft announcements are excluded from the total', meta.total >= 12)
  check('page size is respected', firstPage.body.data.length === 5 && meta.limit === 5)
  check('page 1 reports more results', meta.hasMore === true && meta.page === 1)

  const secondPage = await request('/api/announcements?page=2&limit=5')
  check('page 2 returns a different window', secondPage.body.data[0]?.id !== firstPage.body.data[0]?.id)
  check('announcement is linked to an event', firstPage.body.data[0]?.eventSlug === 'c3-crescent-code-clash')

  const category = await request('/api/announcements?category=Registration&limit=50')
  check('category filter returns 200', category.status === 200)
  check(
    'category filter only returns that category',
    category.body.data.length > 0 && category.body.data.every((item) => item.category === 'Registration'),
  )

  const search = await request('/api/announcements?q=registration&limit=50')
  check('title/content search returns matches', search.status === 200 && search.body.data.length > 0)
  const searchDetails = await Promise.all(
    search.body.data.map((item) => request(`/api/announcements/${item.slug}`)),
  )
  check(
    'search results match in title or content',
    searchDetails.length > 0 &&
      searchDetails.every((response) =>
        `${response.body.data.title} ${response.body.data.content}`
          .toLowerCase()
          .includes('registration'),
      ),
  )

  const contentSearch = await request('/api/announcements?q=approvals&limit=50')
  check(
    'content-only search works',
    contentSearch.status === 200 && contentSearch.body.data.some((item) => item.slug === 'how-the-event-day-is-taking-shape'),
  )

  const wildcard = await request('/api/announcements?q=%25&limit=50')
  check('LIKE wildcards are escaped, not treated as match-all', wildcard.status === 200 && wildcard.body.meta.total === 0)

  for (const query of ['page=0', 'page=abc', 'limit=0', 'limit=999', 'category=Nonsense']) {
    const response = await request(`/api/announcements?${query}`)
    check(`invalid query "${query}" is rejected`, response.status === 400 && Boolean(response.body.error?.code))
  }

  const bySlug = await request('/api/announcements/announcements-are-now-live')
  check('public detail by slug returns 200', bySlug.status === 200 && bySlug.body.data.content.length > 20)
  const byId = await request(`/api/announcements/${firstPage.body.data[0].id}`)
  check('public detail by id returns 200', byId.status === 200)
  const missing = await request('/api/announcements/does-not-exist')
  check('missing announcement returns 404', missing.status === 404)
  const draft = await request('/api/announcements/draft-registration-launch-checklist')
  check('unpublished announcement is not publicly readable', draft.status === 404)

  const noAuth = await request('/api/announcements', {
    method: 'POST',
    body: JSON.stringify({ title: 'No auth', content: 'This request must not be created.' }),
  })
  check('create without a token is rejected', noAuth.status === 401)

  const badAuth = await request('/api/announcements', {
    method: 'POST',
    headers: { Authorization: 'Bearer not-a-real-token' },
    body: JSON.stringify({ title: 'Bad auth', content: 'This request must not be created.' }),
  })
  check('create with an invalid token is rejected', badAuth.status === 401)

  const badLogin = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: 'definitely-wrong' }),
  })
  check('incorrect credentials are rejected', badLogin.status === 401)

  const login = await request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    }),
  })
  check('organizer can log in', login.status === 200 && typeof login.body.token === 'string')
  const auth = { Authorization: `Bearer ${login.body.token}` }

  const validation = await request('/api/announcements', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({ title: 'x', content: 'short', category: 'Nope', isPublished: 'yes' }),
  })
  check(
    'server-side validation reports field errors',
    validation.status === 400 &&
      Boolean(validation.body.error.fields.title) &&
      Boolean(validation.body.error.fields.content) &&
      Boolean(validation.body.error.fields.category) &&
      Boolean(validation.body.error.fields.isPublished),
  )

  const draftCreate = await request('/api/announcements', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      title: `Test draft ${Date.now()}`,
      content: 'A draft created by the automated API test. It must stay out of public results.',
      category: 'Important',
      isPublished: false,
    }),
  })
  check('organizer can create an unpublished announcement', draftCreate.status === 201 && draftCreate.body.data.isPublished === false)
  const draftId = draftCreate.body.data.id
  const draftSlug = draftCreate.body.data.slug
  created.push(draftId)

  const hidden = await request(`/api/announcements/${draftSlug}`)
  check('new draft is hidden publicly', hidden.status === 404)

  const afterDraft = await request('/api/announcements?limit=1')
  check('unpublished announcement does not change the public total', afterDraft.body.meta.total === meta.total)

  const publish = await request(`/api/announcements/${draftId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ isPublished: true, title: 'Test draft published' }),
  })
  check('organizer can publish and update an announcement', publish.status === 200 && publish.body.data.isPublished === true)
  check('publishing sets a publication date', Boolean(publish.body.data.publishedAt))

  const published = await request(`/api/announcements/${draftSlug}`)
  check('published announcement becomes public', published.status === 200 && published.body.data.title === 'Test draft published')

  const patched = await request(`/api/announcements/${draftId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ category: 'General' }),
  })
  check('partial updates persist', patched.status === 200 && patched.body.data.category === 'General')

  const emptyPatch = await request(`/api/announcements/${draftId}`, {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({}),
  })
  check('empty update is rejected', emptyPatch.status === 400)

  const badId = await request('/api/announcements/not-an-id', {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ category: 'General' }),
  })
  check('invalid id is rejected', badId.status === 400)

  const unknownId = await request('/api/announcements/999999', {
    method: 'PATCH',
    headers: auth,
    body: JSON.stringify({ category: 'General' }),
  })
  check('missing record returns 404', unknownId.status === 404)

  const deleted = await request(`/api/announcements/${draftId}`, { method: 'DELETE', headers: auth })
  check('organizer can delete an announcement', deleted.status === 204)
  created.pop()

  const gone = await request(`/api/announcements/${draftSlug}`)
  check('deleted announcement is gone', gone.status === 404)

  const deleteAgain = await request(`/api/announcements/${draftId}`, { method: 'DELETE', headers: auth })
  check('deleting a missing record returns 404', deleteAgain.status === 404)

  const malformed = await request('/api/announcements', {
    method: 'POST',
    headers: auth,
    body: '{not json',
  })
  check('malformed JSON returns a clear 400', malformed.status === 400)

  console.log(`\n${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}

main().catch(async (error) => {
  console.error('Test run crashed:', error)
  for (const id of created) {
    await request(`/api/announcements/${id}`, { method: 'DELETE' }).catch(() => {})
  }
  process.exitCode = 1
})
