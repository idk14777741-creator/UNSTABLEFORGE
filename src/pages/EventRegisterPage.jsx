import { useEffect, useState } from 'react'
import { Link, navigate } from '../lib/router'
import { apiGet } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import '../platform.css'

/**
 * Captain-led registration. The signed-in account is the captain and supplies
 * every teammate's details, so teammates never need an account of their own.
 */
export default function EventRegisterPage({ slug }) {
  const { request, user } = useAuth()
  const [event, setEvent] = useState(null)
  const [loadError, setLoadError] = useState('')
  const [members, setMembers] = useState([{ fullName: '', email: '', campus: '' }])
  const [teamName, setTeamName] = useState('')
  const [error, setError] = useState('')
  const [fields, setFields] = useState({})
  const [busy, setBusy] = useState(false)
  const [registration, setRegistration] = useState(null)
  const [transactionRef, setTransactionRef] = useState('')
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    let cancelled = false
    apiGet(`/api/events/${encodeURIComponent(slug)}`)
      .then((payload) => {
        if (cancelled) return
        const detail = payload.data
        setEvent(detail)
        document.title = `Register — ${detail.title}`
        setMembers([
          {
            fullName: user?.displayName || '',
            email: detail ? String(user?.email || '') : '',
            campus: '',
          },
        ])
      })
      .catch((loadFailure) => {
        if (!cancelled) setLoadError(loadFailure.message)
      })
    return () => {
      cancelled = true
    }
  }, [slug, user?.email, user?.displayName])

  if (loadError) {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-empty">{loadError}</p>
        </div>
      </main>
    )
  }

  if (!event) {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-empty">LOADING THE REGISTRATION DESK…</p>
        </div>
      </main>
    )
  }

  const settings = event.settings
  const isTeam = settings && settings.registrationMode !== 'individual'
  const min = settings?.minTeamSize ?? 1
  const max = settings?.maxTeamSize ?? 1

  const updateMember = (index, key, value) => {
    setMembers((current) =>
      current.map((member, position) => (position === index ? { ...member, [key]: value } : member)),
    )
  }

  const addMember = () => {
    if (members.length >= max) return
    setMembers((current) => [...current, { fullName: '', email: '', campus: '' }])
  }

  const removeMember = (index) => {
    if (members.length <= min) return
    setMembers((current) => current.filter((_, position) => position !== index))
  }

  const submit = async (submitEvent) => {
    submitEvent.preventDefault()
    setError('')
    setFields({})
    setBusy(true)

    try {
      const payload = await request(`/api/events/${event.slug}/register`, {
        method: 'POST',
        body: {
          teamName: isTeam ? teamName : undefined,
          members,
        },
      })
      setRegistration(payload.data)
    } catch (failure) {
      setError(failure.message)
      setFields(failure.payload?.error?.fields || {})
    } finally {
      setBusy(false)
    }
  }

  const submitPayment = async (paymentEvent) => {
    paymentEvent.preventDefault()
    setError('')
    setBusy(true)
    try {
      await request(`/api/registrations/${registration.reference}/payment`, {
        method: 'POST',
        body: { transactionRef },
      })
      setSubmitted(true)
    } catch (failure) {
      setError(failure.message)
    } finally {
      setBusy(false)
    }
  }

  if (registration && (!registration.payment || submitted || registration.status === 'confirmed')) {
    const paid = Boolean(registration.payment)
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-kicker">REGISTRATION / {event.title}</p>
          <h1 className="pf-title">
            You are <em>in.</em>
          </h1>

          <div className="pf-status">
            <p className="pf-status__label">
              {paid ? 'PAYMENT UNDER REVIEW' : 'REGISTRATION CONFIRMED'}
            </p>
            <h2 className="pf-status__title">{registration.reference}</h2>
            <p className="pf-status__copy">
              {paid
                ? 'An organizer will verify your UPI reference. Your entry passes appear in your dashboard as soon as the payment is confirmed.'
                : 'Your place is confirmed. Your entry pass is available in your dashboard.'}
            </p>
            <div className="pf-actions">
              <Link className="pf-btn" to="/dashboard">
                OPEN MY DASHBOARD
              </Link>
              <Link className="pf-btn pf-btn--ghost" to={`/events/${event.slug}`}>
                BACK TO THE EVENT
              </Link>
            </div>
          </div>

          {registration.members?.length > 1 && (
            <div className="pf-rows">
              {registration.members.map((member) => (
                <div className="pf-row" key={member.reference}>
                  <span className="pf-row__title">{member.reference}</span>
                  <span className="pf-row__meta">ONE PASS PER PARTICIPANT</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    )
  }

  if (registration?.payment) {
    const amount = (registration.payment.amountMinor / 100).toLocaleString('en-IN')
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-kicker">PAYMENT / {event.title}</p>
          <h1 className="pf-title">
            ₹{amount} <em>to confirm.</em>
          </h1>
          <p className="pf-lede">
            Registration <strong>{registration.reference}</strong> is held. Pay by UPI, then submit
            the transaction reference below.
          </p>

          <div className="pf-status">
            <p className="pf-status__label">STEP 02 / PAYMENT</p>
            <h2 className="pf-status__title">₹{amount}</h2>
            {settings?.paymentQrUrl ? (
              <img
                src={settings.paymentQrUrl}
                alt="Payment QR code supplied by the organizers"
                style={{ width: '220px', height: 'auto', marginTop: '12px' }}
              />
            ) : (
              <p className="pf-status__copy">
                The organizers have not uploaded a payment QR yet. Do not pay until it appears here.
              </p>
            )}
            {settings?.paymentInstructions && (
              <p className="pf-status__copy" style={{ marginTop: '14px' }}>
                {settings.paymentInstructions}
              </p>
            )}
          </div>

          <form className="pf-form" onSubmit={submitPayment}>
            <label className="pf-field">
              <span>UPI transaction reference</span>
              <input
                value={transactionRef}
                onChange={(inputEvent) => setTransactionRef(inputEvent.target.value)}
                required
                minLength={4}
                maxLength={80}
                placeholder="e.g. 4023xxxxxx"
              />
            </label>
            {error && <p className="pf-error">{error}</p>}
            <div className="pf-actions">
              <button type="submit" className="pf-btn" disabled={busy || !settings?.paymentQrUrl}>
                {busy ? 'SUBMITTING…' : 'SUBMIT PAYMENT REFERENCE'}
              </button>
              <Link className="pf-btn pf-btn--ghost" to="/dashboard">
                LATER
              </Link>
            </div>
            <p className="pf-row__meta">
              Submitting a reference does not confirm the payment. An organizer verifies it.
            </p>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main id="main" className="pf-main">
      <div className="pf-wrap">
        <Link className="pf-kicker" to={`/events/${event.slug}`} style={{ textDecoration: 'none' }}>
          ← {event.title}
        </Link>
        <h1 className="pf-title" style={{ marginTop: '18px' }}>
          Registration
        </h1>
        <p className="pf-lede">
          {isTeam
            ? `You are registering a team of ${min}–${max}. You are the captain: add every teammate's name and email, and they receive their own pass.`
            : 'Register for this event.'}
          {settings?.isPaid ? ` The fee is ${settings.feeLabel}.` : ' This event is free.'}
        </p>

        <form className="pf-form" onSubmit={submit}>
          {isTeam && (
            <label className="pf-field">
              <span>Team name</span>
              <input
                value={teamName}
                onChange={(changeEvent) => setTeamName(changeEvent.target.value)}
                required
                maxLength={80}
                placeholder="Name your team"
              />
              {fields.teamName && <small className="pf-error">{fields.teamName}</small>}
            </label>
          )}

          <div className="pf-members">
            {members.map((member, index) => (
              <div className="pf-member" key={index}>
                <label className="pf-field">
                  <span>{index === 0 ? 'Your full name' : `Teammate ${index + 1}`}</span>
                  <input
                    value={member.fullName}
                    onChange={(changeEvent) => updateMember(index, 'fullName', changeEvent.target.value)}
                    required
                    maxLength={120}
                  />
                  {fields[`members.${index}.fullName`] && (
                    <small className="pf-error">{fields[`members.${index}.fullName`]}</small>
                  )}
                </label>
                <label className="pf-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={member.email}
                    onChange={(changeEvent) => updateMember(index, 'email', changeEvent.target.value)}
                    required
                    readOnly={index === 0}
                  />
                  {fields[`members.${index}.email`] && (
                    <small className="pf-error">{fields[`members.${index}.email`]}</small>
                  )}
                </label>
                <label className="pf-field">
                  <span>Campus</span>
                  <input
                    value={member.campus}
                    onChange={(changeEvent) => updateMember(index, 'campus', changeEvent.target.value)}
                    maxLength={120}
                  />
                </label>
                <button
                  type="button"
                  className="pf-btn pf-btn--ghost"
                  onClick={() => removeMember(index)}
                  disabled={members.length <= min}
                >
                  REMOVE
                </button>
              </div>
            ))}
          </div>

          {isTeam && members.length < max && (
            <div className="pf-actions">
              <button type="button" className="pf-btn pf-btn--ghost" onClick={addMember}>
                ADD TEAMMATE
              </button>
            </div>
          )}

          {error && <p className="pf-error">{error}</p>}

          <div className="pf-actions">
            <button type="submit" className="pf-btn" disabled={busy}>
              {busy ? 'RESERVING…' : settings?.isPaid ? 'RESERVE & CONTINUE TO PAYMENT' : 'CONFIRM REGISTRATION'}
            </button>
          </div>
        </form>
      </div>
    </main>
  )
}
