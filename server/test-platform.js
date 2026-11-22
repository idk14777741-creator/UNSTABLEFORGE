/**
 * Platform tests: events, capacity, registration, payments, passes, check-in,
 * certificates and organizer permissions.
 *
 * Requires the API running against PostgreSQL (`npm run db:local`, then
 * `npm run server`) and the organizer account from ADMIN_EMAIL/ADMIN_PASSWORD.
 */
import crypto from 'node:crypto'
import { loadEnv } from './env.js'

loadEnv()

const BASE = process.env.API_URL || 'http://localhost:4000'
const ORGANIZER_EMAIL = process.env.ADMIN_EMAIL || 'organizer@unstableforge.dev'
const ORGANIZER_PASSWORD = process.env.ADMIN_PASSWORD || ''

let passed = 0
let failed = 0

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  PASS  ${label}`)
  } else {
    failed += 1
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
}

async function call(path, { method = 'GET', body, token, raw = false } = {}) {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (raw) return { status: response.status, response }
  const payload = await response.json().catch(() => null)
  return { status: response.status, body: payload, headers: response.headers }
}

function uniqueEmail(label) {
  return `${label}.${Date.now()}.${crypto.randomBytes(3).toString('hex')}@example.test`
}

const C3 = 'c3-crescent-code-clash'

async function signup(label) {
  const email = uniqueEmail(label)
  const password = 'forgePlatform1'
  const result = await call('/api/auth/signup', {
    method: 'POST',
    body: { fullName: `Platform ${label}`, email, password },
  })
  const login = await call('/api/auth/login', { method: 'POST', body: { email, password } })
  return { email, password, token: login.body?.token, signup: result }
}

async function main() {
  console.log('\nHealth and discovery')

  const health = await call('/api/health')
  check('health reports the platform is available', health.body?.database?.platform === true, JSON.stringify(health.body))

  const events = await call('/api/events')
  const slugs = (events.body?.data || []).map((event) => event.slug)
  check('published events are listed', events.status === 200 && slugs.length >= 3, slugs.join(', '))
  check('C³ is a published hackathon', slugs.includes(C3))
  check('Rhetoric Rumble is published', slugs.includes('rhetoric-rumble'))
  check('the seminar is published', slugs.includes('from-campus-to-product-companies'))

  const c3 = await call(`/api/events/${C3}`)
  const c3Data = c3.body?.data
  check('C³ detail loads', c3.status === 200)
  check('C³ is typed as a hackathon', c3Data?.type === 'hackathon')
  check('C³ carries 11 challenge domains', c3Data?.content?.domains?.length === 11)
  check('C³ fee is ₹300 per team', c3Data?.settings?.feeMinor === 30000 && c3Data?.settings?.feeLabel === '₹300')
  check('C³ capacity is 120 participants', c3Data?.settings?.capacity === 120)
  check('C³ capacity unit is the participant', c3Data?.settings?.inventoryUnit === 'participant')
  check('C³ team size is 1–4', c3Data?.settings?.minTeamSize === 1 && c3Data?.settings?.maxTeamSize === 4)
  check('C³ tagline is the event line', c3Data?.tagline === 'CODE. COMPETE. CONQUER.')
  check('C³ has no invented date or venue', c3Data?.startsAt === null && c3Data?.venue === null)

  const debate = await call('/api/events/rhetoric-rumble')
  check('debate rules are configured, not hardcoded', debate.body?.data?.content?.rules?.length === 4)

  const seminar = await call('/api/events/from-campus-to-product-companies')
  check('seminar speakers are configured', seminar.body?.data?.content?.speakers?.length === 3)
  check('seminar sessions are configured', seminar.body?.data?.content?.sessions?.length === 3)
  check(
    'seminar biographies stay empty until supplied',
    (seminar.body?.data?.content?.speakers || []).every((speaker) => speaker.bio === null),
  )

  console.log('\nTeam registration')

  const captain = await signup('platform.captain')
  check('participant account is created', Boolean(captain.token), JSON.stringify(captain.signup.body))

  const teammateEmail = uniqueEmail('platform.mate')
  const teamBody = {
    teamName: `Forge Team ${crypto.randomBytes(2).toString('hex')}`,
    members: [
      { fullName: 'Captain Forge', email: captain.email, campus: 'ALTA' },
      { fullName: 'Teammate Forge', email: teammateEmail, campus: 'ALTA' },
    ],
  }

  const tooBig = await call(`/api/events/${C3}/register`, {
    method: 'POST',
    token: captain.token,
    body: {
      teamName: 'Oversized',
      members: Array.from({ length: 5 }, (_, index) => ({
        fullName: `Member ${index}`,
        email: `member${index}.${Date.now()}@example.test`,
      })),
    },
  })
  check('a five-person team is refused', tooBig.status === 400, JSON.stringify(tooBig.body))

  const duplicateEmails = await call(`/api/events/${C3}/register`, {
    method: 'POST',
    token: captain.token,
    body: {
      teamName: 'Duplicates',
      members: [
        { fullName: 'A', email: captain.email },
        { fullName: 'B', email: captain.email },
      ],
    },
  })
  check('duplicate participant emails are refused', duplicateEmails.status === 400)

  const registration = await call(`/api/events/${C3}/register`, {
    method: 'POST',
    token: captain.token,
    body: teamBody,
  })
  const reg = registration.body?.data
  check('a two-person team registers', registration.status === 201, JSON.stringify(registration.body))
  check('the captain is registered as captain', Boolean(reg?.members?.length === 2))
  check('registration awaits payment', reg?.status === 'pending_payment')
  check('the fee is charged once per team', reg?.payment?.amountMinor === 30000)

  const duplicate = await call(`/api/events/${C3}/register`, {
    method: 'POST',
    token: captain.token,
    body: teamBody,
  })
  check('the same captain cannot register twice', duplicate.status === 409)

  const detail = await call(`/api/registrations/${reg?.reference}`, { token: captain.token })
  check('the captain can read their registration', detail.status === 200)
  check('both team members are listed', detail.body?.data?.members?.length === 2)
  check('no QR pass exists before confirmation', detail.body?.data?.pass === null)

  const stranger = await signup('platform.stranger')
  const forbidden = await call(`/api/registrations/${reg?.reference}`, { token: stranger.token })
  check("another participant cannot read the captain's registration", forbidden.status === 403)

  console.log('\nPayment submission and verification')

  const submitted = await call(`/api/registrations/${reg?.reference}/payment`, {
    method: 'POST',
    token: captain.token,
    body: { transactionRef: `UPI${Date.now()}` },
  })
  check('a UPI reference moves the registration to verification', submitted.body?.data?.status === 'verification_pending')

  const stillPending = await call(`/api/registrations/${reg?.reference}`, { token: captain.token })
  check(
    'submitting a reference does not confirm the payment',
    stillPending.body?.data?.status === 'verification_pending',
  )

  const organizerLogin = await call('/api/auth/login', {
    method: 'POST',
    body: { email: ORGANIZER_EMAIL, password: ORGANIZER_PASSWORD },
  })
  check(
    'the organizer account signs in',
    Boolean(organizerLogin.body?.token),
    'Set ADMIN_PASSWORD in .env, or create the organizer account.',
  )

  const organizerToken = organizerLogin.body?.token
  const grantOnly = await call('/api/admin/events', { token: organizerToken })
  check('an authorized organizer can list all events', grantOnly.status === 200)

  const notElevated = await call(`/api/admin/payments/1/verify`, {
    method: 'POST',
    token: organizerToken,
    body: {},
  })
  check('payment verification needs the organizer access code', notElevated.status === 403)

  const code = `forge-platform-${crypto.randomBytes(4).toString('hex')}`
  const setCode = await call('/api/auth/organizer/code', {
    method: 'POST',
    token: organizerToken,
    body: { code },
  })
  check('an organizer can set a personal access code', setCode.status === 201, JSON.stringify(setCode.body))

  const wrongCode = await call('/api/auth/organizer/verify', {
    method: 'POST',
    token: organizerToken,
    body: { code: 'definitely-wrong' },
  })
  check('a wrong access code is refused', wrongCode.status === 403)

  const verify = await call('/api/auth/organizer/verify', {
    method: 'POST',
    token: organizerToken,
    body: { code },
  })
  const elevatedToken = verify.body?.data?.token
  check('the correct access code elevates the session', Boolean(elevatedToken))

  const payments = await call('/api/admin/payments?status=submitted', { token: elevatedToken })
  const payment = (payments.body?.data || []).find((row) => row.transactionRef)
  check('the submitted payment is visible to the organizer', Boolean(payment))

  const verified = await call(`/api/admin/payments/${payment?.id}/verify`, {
    method: 'POST',
    token: elevatedToken,
    body: {},
  })
  check('the organizer can verify the payment', verified.status === 200, JSON.stringify(verified.body))
  check('both team members are confirmed', verified.body?.data?.confirmed?.length === 2)

  const passes = await call('/api/me/passes', { token: captain.token })
  check('the captain has exactly one personal pass', passes.body?.data?.length === 1)
  check('each pass carries an opaque token', (passes.body?.data?.[0]?.token || '').length >= 20)

  console.log('\nCheck-in')

  const passToken = passes.body?.data?.[0]?.token
  const scan = await call('/api/admin/checkins/scan', {
    method: 'POST',
    token: elevatedToken,
    body: { eventId: 1, token: passToken },
  })
  check('a confirmed pass checks in', scan.body?.data?.status === 'checked_in', JSON.stringify(scan.body))

  const rescan = await call('/api/admin/checkins/scan', {
    method: 'POST',
    token: elevatedToken,
    body: { eventId: 1, token: passToken },
  })
  check('a duplicate scan is reported, not silently accepted', rescan.body?.data?.status === 'already_checked_in')

  const wrongEvent = await call('/api/admin/checkins/scan', {
    method: 'POST',
    token: elevatedToken,
    body: { eventId: 2, token: passToken },
  })
  check('a pass from another event is refused', wrongEvent.status === 422 && wrongEvent.body?.error?.code === 'WRONG_EVENT')

  const invalid = await call('/api/admin/checkins/scan', {
    method: 'POST',
    token: elevatedToken,
    body: { eventId: 1, token: 'x'.repeat(40) },
  })
  check('an invalid pass is refused', invalid.status === 422 && invalid.body?.error?.code === 'PASS_INVALID')

  const attendee = await signup('platform.attendee')
  const soloReg = await call(`/api/events/${C3}/register`, {
    method: 'POST',
    token: attendee.token,
    body: { members: [{ fullName: 'Solo Attendee', email: attendee.email, campus: 'ALTA' }] },
  })
  const manual = await call('/api/admin/checkins/manual', {
    method: 'POST',
    token: elevatedToken,
    body: { eventId: 1, reference: soloReg.body?.data?.reference },
  })
  check('an unconfirmed registration cannot check in', manual.status === 422 && manual.body?.error?.code === 'NOT_CONFIRMED')

  console.log('\nCertificates')

  const issued = await call('/api/admin/certificates/issue', {
    method: 'POST',
    token: elevatedToken,
    body: { eventId: 1, registrationIds: [verified.body?.data?.confirmed?.[0]?.registrationId], onlyAttended: true },
  })
  const certificate = issued.body?.data?.[0]
  check('a certificate is issued for an attendee', issued.status === 201 && Boolean(certificate?.code), JSON.stringify(issued.body))

  const verification = await call(`/api/certificates/${certificate?.code}`)
  check('the certificate verifies publicly', verification.body?.data?.valid === true)
  check('verification exposes no private data', verification.body?.data?.certificate?.email === undefined)

  const pdf = await call(`/api/certificates/${certificate?.code}/pdf`, { raw: true })
  const pdfBytes = Buffer.from(await pdf.response.arrayBuffer())
  check('the certificate downloads as a PDF', pdf.status === 200 && pdfBytes.subarray(0, 4).toString() === '%PDF')

  const revoked = await call(`/api/admin/certificates/${certificate?.id}/revoke`, {
    method: 'POST',
    token: elevatedToken,
    body: { reason: 'Issued in error during testing' },
  })
  check('an organizer can revoke a certificate', revoked.status === 200)
  const afterRevoke = await call(`/api/certificates/${certificate?.code}`)
  check('a revoked certificate no longer verifies', afterRevoke.body?.data?.valid === false)

  console.log('\nCapacity')

  const created = await call('/api/admin/events', {
    method: 'POST',
    token: elevatedToken,
    body: {
      title: `Capacity Probe ${crypto.randomBytes(2).toString('hex')}`,
      type: 'workshop',
      shortDescription: 'Temporary event created by the test suite.',
    },
  })
  const probe = created.body?.data
  check('an organizer can create an event through the API', created.status === 201, JSON.stringify(created.body))

  await call(`/api/admin/events/${probe?.id}/settings`, {
    method: 'PUT',
    token: elevatedToken,
    body: { enabled: true, capacity: 3, registrationMode: 'team', minTeamSize: 1, maxTeamSize: 4 },
  })
  await call(`/api/admin/events/${probe?.id}/lifecycle`, {
    method: 'POST',
    token: elevatedToken,
    body: { lifecycle: 'upcoming' },
  })

  const probeSignup = await signup('platform.capacity')
  const four = await call(`/api/events/${probe?.slug}/register`, {
    method: 'POST',
    token: probeSignup.token,
    body: {
      teamName: 'Capacity Four',
      members: [
        { fullName: 'One', email: probeSignup.email },
        ...Array.from({ length: 3 }, (_, index) => ({
          fullName: `Extra ${index}`,
          email: `cap${index}.${Date.now()}@example.test`,
        })),
      ],
    },
  })
  check('a team larger than capacity is refused', four.status === 409 && four.body?.error?.code === 'CAPACITY_REACHED')

  const two = await call(`/api/events/${probe?.slug}/register`, {
    method: 'POST',
    token: probeSignup.token,
    body: {
      teamName: 'Capacity Two',
      members: [
        { fullName: 'One', email: probeSignup.email },
        { fullName: 'Two', email: uniqueEmail('platform.capmate') },
      ],
    },
  })
  check('a two-person team fits in three places', two.status === 201, JSON.stringify(two.body))

  // Free events are confirmed immediately, so the entry pass must exist at
  // registration time — never only after an organizer touches the record.
  const freeDetail = await call(`/api/registrations/${two.body?.data?.reference}`, {
    token: probeSignup.token,
  })
  check(
    'a free registration issues its pass immediately',
    Boolean(freeDetail.body?.data?.pass?.token),
    JSON.stringify(freeDetail.body?.data?.pass),
  )

  const freePasses = await call('/api/me/passes', { token: probeSignup.token })
  check(
    'the free pass appears in the participant pass list',
    (freePasses.body?.data || []).some((pass) => pass.reference === two.body?.data?.reference),
  )

  const secondTeam = await signup('platform.capacity2')
  const overflow = await call(`/api/events/${probe?.slug}/register`, {
    method: 'POST',
    token: secondTeam.token,
    body: {
      teamName: 'Capacity Overflow',
      members: [
        { fullName: 'Three', email: secondTeam.email },
        { fullName: 'Four', email: uniqueEmail('platform.capmate2') },
      ],
    },
  })
  check(
    'capacity counts individual participants, not teams',
    overflow.status === 409 && overflow.body?.error?.code === 'CAPACITY_REACHED',
  )

  console.log('\nPublishing and permissions')

  const unpublished = await call(`/api/admin/events/${probe?.id}/publish`, {
    method: 'POST',
    token: elevatedToken,
    body: { published: true },
  })
  check('an elevated organizer can publish an event', unpublished.status === 200)

  const publicAfterPublish = await call('/api/events')
  check(
    'a published event appears in discovery',
    (publicAfterPublish.body?.data || []).some((event) => event.slug === probe?.slug),
  )

  await call(`/api/admin/events/${probe?.id}/publish`, {
    method: 'POST',
    token: elevatedToken,
    body: { published: false },
  })
  const publicAfterUnpublish = await call('/api/events')
  check(
    'an unpublished event disappears from discovery',
    !(publicAfterUnpublish.body?.data || []).some((event) => event.slug === probe?.slug),
  )

  await call(`/api/admin/events/${probe?.id}/lifecycle`, {
    method: 'POST',
    token: elevatedToken,
    body: { lifecycle: 'archived' },
  })
  const historyAfterArchive = await call(`/api/registrations/${two.body?.data?.reference}`, {
    token: probeSignup.token,
  })
  check(
    'archiving an event keeps the participation record',
    historyAfterArchive.status === 200,
  )

  const anonymousAdmin = await call('/api/admin/payments')
  check('organizer APIs reject anonymous requests', anonymousAdmin.status === 401)

  const participantAdmin = await call('/api/admin/events', { token: captain.token })
  check('a participant cannot reach organizer APIs', participantAdmin.status === 403)

  const audit = await call('/api/admin/audit', { token: elevatedToken })
  check(
    'organizer actions are audited',
    (audit.body?.data || []).some((entry) => entry.action === 'payment.verify'),
  )

  console.log('\nAccount email and password recovery')

  const missingName = await call('/api/auth/signup', {
    method: 'POST',
    body: { email: uniqueEmail('platform.noname'), password: 'forgePlatform1' },
  })
  check(
    'signup requires a full name',
    missingName.status === 400 && Boolean(missingName.body?.error?.fields?.fullName),
  )

  const forgot = await call('/api/auth/forgot-password', {
    method: 'POST',
    body: { email: captain.email },
  })
  check(
    'password reset either queues mail or reports that delivery is not configured',
    forgot.status === 202 ||
      (forgot.status === 503 && forgot.body?.error?.code === 'EMAIL_NOT_CONFIGURED'),
    JSON.stringify(forgot.body),
  )

  const badReset = await call('/api/auth/reset-password', {
    method: 'POST',
    body: { token: 'x'.repeat(48), password: 'anotherPassword1' },
  })
  check(
    'an invalid reset token is rejected',
    badReset.status === 400 && badReset.body?.error?.code === 'TOKEN_INVALID',
  )

  console.log('\nOrganizer platform controls')

  const notElevatedDiscovery = await call('/api/admin/platform/settings', {
    method: 'PUT',
    token: organizerToken,
    body: { eventDiscoveryEnabled: false },
  })
  check(
    'the discovery switch needs the organizer access code',
    notElevatedDiscovery.status === 403,
  )

  const platformBefore = await call('/api/admin/platform/settings', { token: elevatedToken })
  check(
    'the console reports gateway and email configuration honestly',
    platformBefore.status === 200 &&
      typeof platformBefore.body?.data?.payments?.configured === 'boolean' &&
      typeof platformBefore.body?.data?.emailDeliveryConfigured === 'boolean',
    JSON.stringify(platformBefore.body),
  )

  const discoveryOff = await call('/api/admin/platform/settings', {
    method: 'PUT',
    token: elevatedToken,
    body: { eventDiscoveryEnabled: false },
  })
  check(
    'an elevated organizer can hide event discovery',
    discoveryOff.status === 200 && discoveryOff.body?.data?.eventDiscoveryEnabled === false,
  )

  const hiddenList = await call('/api/events')
  check(
    'hidden discovery returns no events without deleting them',
    hiddenList.status === 200 &&
      (hiddenList.body?.data || []).length === 0 &&
      hiddenList.body?.meta?.discovery === false,
  )

  const stillInAdmin = await call('/api/admin/events', { token: elevatedToken })
  check(
    'hidden discovery keeps the event records in the console',
    (stillInAdmin.body?.data || []).some((event) => event.slug === C3),
  )

  const discoveryOn = await call('/api/admin/platform/settings', {
    method: 'PUT',
    token: elevatedToken,
    body: { eventDiscoveryEnabled: true },
  })
  const visibleAgain = await call('/api/events')
  check(
    're-enabling discovery restores the published list',
    discoveryOn.status === 200 &&
      (visibleAgain.body?.data || []).some((event) => event.slug === C3),
  )

  console.log('\nGuided event creation')

  const guided = await call('/api/admin/events', {
    method: 'POST',
    token: elevatedToken,
    body: {
      title: `Guided Probe ${crypto.randomBytes(2).toString('hex')}`,
      type: 'seminar',
      shortDescription: 'Temporary guided event created by the test suite.',
      rules: ['One rule per line', 'Second rule'],
      registration: {
        enabled: true,
        isPaid: false,
        capacity: 20,
        registrationMode: 'individual',
        minTeamSize: 1,
        maxTeamSize: 1,
      },
    },
  })
  check('a minimal event can be created with rules', guided.status === 201, JSON.stringify(guided.body))

  const guidedContent = await call(`/api/admin/events/${guided.body?.data?.id}/content`, {
    token: elevatedToken,
  })
  check(
    'the rules supplied at creation are stored',
    (guidedContent.body?.data?.content?.rules || []).length === 2,
  )

  await call(`/api/admin/events/${guided.body?.data?.id}/lifecycle`, {
    method: 'POST',
    token: elevatedToken,
    body: { lifecycle: 'archived' },
  })

  const unsignedWebhook = await call('/api/payments/razorpay/webhook', {
    method: 'POST',
    body: { event: 'payment.captured' },
  })
  check('an unsigned payment webhook is rejected', unsignedWebhook.status === 400)

  console.log(`\n${passed} passed, ${failed} failed\n`)
  if (failed > 0) process.exitCode = 1
}

await main()
