import { useEffect, useRef, useState } from 'react'
import { Link } from '../lib/router'
import { useAuth } from '../context/AuthContext'
import SectionLabel from '../components/SectionLabel'
import { brand, eventFacts } from '../data/site'
import { formatDate } from '../data/announcements'

const EMPTY_FORM = { fullName: '', campus: '' }

function EntrySkeleton() {
  return (
    <main id="main" className="entry-main">
      <section className="entry-hero entry-hero--compact">
        <div className="container">
          <SectionLabel number="C³" tone="light">
            REGISTRATION
          </SectionLabel>
          <h1 className="display entry-hero__title">
            ENTER THE <em className="serif">FORGE.</em>
          </h1>
        </div>
      </section>
      <section className="section entry-section">
        <div className="container entry-grid">
          <div className="entry-brief">
            <span className="ann-skeleton ann-skeleton--title" />
            <span className="ann-skeleton" />
            <span className="ann-skeleton" />
          </div>
          <div className="entry-desk entry-desk--loading" aria-busy="true">
            <span className="ann-skeleton ann-skeleton--short" />
            <span className="ann-skeleton ann-skeleton--title" />
            <span className="ann-skeleton" />
            <span className="ann-skeleton" />
          </div>
        </div>
      </section>
    </main>
  )
}

function RegistrationPass({ registration, email }) {
  return (
    <div className="entry-pass-card">
      <div className="entry-pass-card__top">
        <span>C³ / ENTRY RECORD</span>
        <span className="entry-pass-card__status">
          <span className="status-dot" aria-hidden="true" />
          REGISTERED
        </span>
      </div>

      <div className="entry-pass-card__body">
        <div className="entry-pass-card__identity">
          <span className="entry-pass-card__kicker">ADMISSION</span>
          <strong className="entry-pass-card__name">{registration.fullName}</strong>
          <span className="entry-pass-card__campus">{registration.campus}</span>
        </div>
        <div className="entry-pass-card__stub">
          <span>REFERENCE</span>
          <strong>{registration.reference}</strong>
          <span>FILED {formatDate(registration.createdAt)}</span>
        </div>
      </div>

      <dl className="entry-pass-card__specs">
        <div>
          <dt>ACCOUNT</dt>
          <dd>{email}</dd>
        </div>
        <div>
          <dt>STATUS</dt>
          <dd>REGISTERED / RECORDED</dd>
        </div>
        <div>
          <dt>EVENT</dt>
          <dd>{registration.eventName || brand.event}</dd>
        </div>
      </dl>

      <div className="entry-pass-card__foot">
        <span>THIS CONFIRMS YOUR RECORD WAS SAVED. EVENT LOGISTICS REMAIN TBA.</span>
        <Link to="/announcements">FOLLOW UPDATES ↗</Link>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const { user, request } = useAuth()
  const [state, setState] = useState({ status: 'loading', registration: null, error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const submittingRef = useRef(false)

  useEffect(() => {
    document.title = 'Registration — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setState((current) => ({ ...current, status: 'loading', error: null }))

    request('/api/registrations/me', { signal: controller.signal })
      .then((body) => {
        if (!active) return
        setState({
          status: body.data ? 'success' : 'ready',
          registration: body.data,
          error: null,
        })
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ status: 'error', registration: null, error: error.message })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [request, reloadKey])

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setFormError(null)
  }

  const validate = () => {
    const errors = {}
    const fullName = form.fullName.trim().replace(/\s+/g, ' ')
    const campus = form.campus.trim().replace(/\s+/g, ' ')

    if (fullName.length < 2 || fullName.length > 120) {
      errors.fullName = 'Enter your full name (2–120 characters).'
    }
    if (campus.length < 2 || campus.length > 120) {
      errors.campus = 'Enter your campus or institution (2–120 characters).'
    }
    return errors
  }

  const focusFirstError = (errors) => {
    const first = ['fullName', 'campus'].find((key) => errors[key])
    if (!first) return
    window.requestAnimationFrame(() => document.getElementById(`entry-${first}`)?.focus())
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (submittingRef.current) return

    const errors = validate()
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length) {
      focusFirstError(errors)
      return
    }

    submittingRef.current = true
    setSubmitting(true)
    try {
      const body = await request('/api/registrations', {
        method: 'POST',
        body: {
          fullName: form.fullName.trim().replace(/\s+/g, ' '),
          campus: form.campus.trim().replace(/\s+/g, ' '),
        },
      })
      setState({ status: 'success', registration: body.data, error: null })
      setForm(EMPTY_FORM)
    } catch (error) {
      if (error.status === 409) {
        try {
          const existing = await request('/api/registrations/me')
          if (existing.data) {
            setState({ status: 'success', registration: existing.data, error: null })
            return
          }
        } catch {
          // Fall through to the duplicate message.
        }
      }
      const serverFields = error.payload?.error?.fields
      if (serverFields) {
        setFieldErrors(serverFields)
        focusFirstError(serverFields)
      }
      setFormError(error.message || 'Could not complete registration.')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (state.status === 'loading') return <EntrySkeleton />

  return (
    <main id="main" className="entry-main">
      <section className="entry-hero" aria-labelledby="entry-title">
        <span className="entry-hero__watermark" aria-hidden="true">
          ENTRY
        </span>
        <div className="container">
          <div className="entry-hero__top">
            <SectionLabel number="C³" tone="light">
              PARTICIPANT REGISTRATION
            </SectionLabel>
            <span className="entry-hero__state">
              <span className="status-dot" aria-hidden="true" />
              DESK / OPEN
            </span>
          </div>

          <h1 id="entry-title" className="display entry-hero__title">
            ENTER THE <em className="serif">FORGE.</em>
          </h1>

          <div className="entry-hero__foot">
            <p>
              Registration for C³ is open. Add your name and campus to the event record, then
              keep your reference. Event date, venue, format and final eligibility rules remain
              TBA.
            </p>
            <span className="entry-hero__stamp">
              {brand.event}
              <br />
              {brand.audience}
            </span>
          </div>
        </div>
      </section>

      <section className="section entry-section">
        <div className="container entry-grid">
          <aside className="entry-brief" aria-labelledby="entry-brief-title">
            <SectionLabel number="01">THE ENTRY</SectionLabel>
            <h2 id="entry-brief-title" className="display entry-brief__title">
              ONE DESK. <em className="serif">ONE RECORD.</em>
            </h2>
            <p className="entry-brief__copy">
              Registration stores only what the event record needs: your name, account email and
              campus. No payment, team or project details are collected here.
            </p>

            <ol className="entry-steps">
              <li>
                <span>01</span>
                <div>
                  <strong>IDENTIFY</strong>
                  <p>Your participant account connects this registration to you.</p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <strong>REGISTER</strong>
                  <p>Add your full name and campus to the C³ record.</p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <strong>KEEP THE REFERENCE</strong>
                  <p>The reference confirms your registration was saved.</p>
                </div>
              </li>
            </ol>

            <dl className="entry-facts">
              {eventFacts.map((fact) => (
                <div key={fact.label}>
                  <dt>{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>

            <p className="entry-brief__note">
              FINAL ELIGIBILITY, TEAM SIZE AND EVENT LOGISTICS ARE STILL BEING CONFIRMED.
            </p>
          </aside>

          <section className="entry-desk" aria-labelledby="entry-desk-title">
            <div className="entry-desk__head">
              <span>{state.status === 'success' ? 'ENTRY / RECORDED' : 'ENTRY FORM / OPEN'}</span>
              <span className="entry-desk__status">
                <span className="status-dot" aria-hidden="true" />
                {state.status === 'success' ? 'REGISTERED' : 'AWAITING DETAILS'}
              </span>
            </div>

            {state.status === 'error' && (
              <div className="entry-state" role="alert">
                <span className="ann-state__label">REGISTRATION / UNREACHABLE</span>
                <h2 id="entry-desk-title" className="display entry-state__title">
                  THE DESK IS <em className="serif">UNREACHABLE.</em>
                </h2>
                <p>{state.error}</p>
                <button
                  className="ann-action"
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  TRY AGAIN <span aria-hidden="true">↻</span>
                </button>
              </div>
            )}

            {state.status === 'success' && state.registration && (
              <>
                <h2 id="entry-desk-title" className="display entry-desk__title">
                  YOU&apos;RE IN THE <em className="serif">RECORD.</em>
                </h2>
                <p className="entry-desk__lede">
                  Your registration is saved. Keep this reference for the event record.
                </p>
                <RegistrationPass registration={state.registration} email={user?.email || ''} />
                <div className="entry-desk__actions">
                  <Link className="ann-action" to="/announcements">
                    FOLLOW EVENT UPDATES
                  </Link>
                  <Link className="ann-action ann-action--ghost" to="/">
                    BACK TO THE EVENT
                  </Link>
                </div>
              </>
            )}

            {state.status === 'ready' && (
              <>
                <h2 id="entry-desk-title" className="display entry-desk__title">
                  YOUR <em className="serif">DETAILS.</em>
                </h2>
                <p className="entry-desk__lede">
                  Signed in as {user?.email}. This registration belongs to your account.
                </p>

                {formError && (
                  <div className="entry-alert" role="alert">
                    <span>{formError}</span>
                  </div>
                )}

                <form className="entry-form" onSubmit={handleSubmit} noValidate>
                  <div className={`entry-field ${fieldErrors.fullName ? 'has-error' : ''}`}>
                    <label htmlFor="entry-fullName">FULL NAME</label>
                    <input
                      id="entry-fullName"
                      name="fullName"
                      value={form.fullName}
                      onChange={(event) => update('fullName', event.target.value)}
                      autoComplete="name"
                      maxLength={120}
                      placeholder="Name for the event record"
                      aria-invalid={fieldErrors.fullName ? 'true' : undefined}
                      aria-describedby={fieldErrors.fullName ? 'entry-fullName-error' : undefined}
                    />
                    <span className="entry-field__meta">
                      {fieldErrors.fullName ? (
                        <em id="entry-fullName-error">{fieldErrors.fullName}</em>
                      ) : (
                        '2–120 CHARACTERS'
                      )}
                    </span>
                  </div>

                  <div className={`entry-field ${fieldErrors.campus ? 'has-error' : ''}`}>
                    <label htmlFor="entry-campus">CAMPUS / INSTITUTION</label>
                    <input
                      id="entry-campus"
                      name="campus"
                      value={form.campus}
                      onChange={(event) => update('campus', event.target.value)}
                      autoComplete="organization"
                      maxLength={120}
                      placeholder="Your ALTA campus or institution"
                      aria-invalid={fieldErrors.campus ? 'true' : undefined}
                      aria-describedby={fieldErrors.campus ? 'entry-campus-error' : undefined}
                    />
                    <span className="entry-field__meta">
                      {fieldErrors.campus ? (
                        <em id="entry-campus-error">{fieldErrors.campus}</em>
                      ) : (
                        'USED FOR THE EVENT RECORD ONLY'
                      )}
                    </span>
                  </div>

                  <div className="entry-field entry-field--readonly">
                    <label htmlFor="entry-email">ACCOUNT EMAIL</label>
                    <input id="entry-email" value={user?.email || ''} readOnly tabIndex={-1} />
                    <span className="entry-field__meta">TIED TO YOUR SIGNED-IN ACCOUNT</span>
                  </div>

                  <button className="entry-submit" type="submit" disabled={submitting}>
                    <span>{submitting ? 'WRITING TO THE RECORD…' : 'REGISTER FOR C³'}</span>
                    <span aria-hidden="true">{submitting ? '···' : '↗'}</span>
                  </button>

                  <p className="entry-form__note">
                    By registering you add these details to the C³ event record. This does not
                    confirm event logistics that are still TBA.
                  </p>
                </form>
              </>
            )}
          </section>
        </div>
      </section>
    </main>
  )
}
