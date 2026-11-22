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
  const [customFields, setCustomFields] = useState({})
  const [busy, setBusy] = useState(false)
  const [registration, setRegistration] = useState(null)
  const [transactionRef, setTransactionRef] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [checkout, setCheckout] = useState(null)
  const [gatewayError, setGatewayError] = useState('')
  const [awaitingCapture, setAwaitingCapture] = useState(false)

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

  // A held paid registration asks the backend for (or reuses) a gateway order.
  // When the gateway is not configured the API answers 503 and only the
  // explicitly separate manual fallback is offered.
  useEffect(() => {
    if (!registration?.payment || registration.status === 'confirmed') return undefined
    let active = true

    request(`/api/registrations/${registration.reference}/payment/order`, { method: 'POST' })
      .then((payload) => {
        if (active) setCheckout(payload.data)
      })
      .catch((error) => {
        if (!active) return
        // An earlier payment is authorised and awaiting capture: that is a
        // waiting state, not an error, and it must not offer another payment.
        if (error?.payload?.error?.code === 'PAYMENT_IN_PROGRESS') {
          setAwaitingCapture(true)
          return
        }
        setGatewayError(error.message)
      })

    return () => {
      active = false
    }
  }, [registration?.payment, registration?.reference, registration?.status, request])

  const loadRazorpay = () =>
    new Promise((resolve, reject) => {
      if (window.Razorpay) {
        resolve(window.Razorpay)
        return
      }
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.async = true
      script.onload = () => resolve(window.Razorpay)
      script.onerror = () => reject(new Error('The payment window could not be loaded.'))
      document.body.appendChild(script)
    })

  const payWithGateway = async () => {
    if (awaitingCapture) return
    setBusy(true)
    setGatewayError('')
    try {
      const data =
        checkout ||
        (await request(`/api/registrations/${registration.reference}/payment/order`, {
          method: 'POST',
        })).data
      setCheckout(data)

      const Razorpay = await loadRazorpay()
      const instance = new Razorpay({
        key: data.keyId,
        order_id: data.orderId,
        amount: data.amountMinor,
        currency: data.currency,
        name: 'UNSTABLE FORGE',
        description: data.eventTitle || event.title,
        prefill: { email: user?.email || '', name: user?.displayName || '' },
        theme: { color: '#b4512a' },
        handler: async (response) => {
          try {
            const result = await request(
              `/api/registrations/${registration.reference}/payment/verify`,
              {
                method: 'POST',
                body: {
                  razorpay_order_id: response.razorpay_order_id,
                  razorpay_payment_id: response.razorpay_payment_id,
                  razorpay_signature: response.razorpay_signature,
                },
              },
            )

            // The server confirms only captured payments. An authorised but
            // uncaptured payment comes back unconfirmed, so it must not be
            // shown as a completed registration, and checkout must not reopen.
            if (result?.data?.confirmed === false) {
              setAwaitingCapture(true)
              setCheckout(null)
              return
            }

            setSubmitted(true)
          } catch (failure) {
            setGatewayError(failure.message)
          } finally {
            setBusy(false)
          }
        },
        modal: {
          ondismiss: () => {
            setBusy(false)
            setGatewayError('Checkout was closed before the payment completed.')
          },
        },
      })

      instance.on('payment.failed', (failure) => {
        setGatewayError(failure?.error?.description || 'The payment did not go through.')
        setBusy(false)
      })

      instance.open()
    } catch (failure) {
      setGatewayError(failure.message)
      setBusy(false)
    }
  }

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
  const customFieldDefinitions = event.content?.registrationFields || []
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
          customFields,
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
          <p className="pf-kicker">CHECKOUT / {event.title}</p>
          <h1 className="pf-title">
            ₹{amount} <em>to confirm.</em>
          </h1>
          <p className="pf-lede">
            Registration <strong>{registration.reference}</strong> is held for your team. The
            captain pays once; passes are issued to every teammate after the gateway confirms the
            payment.
          </p>

          <div className="pf-status">
            <p className="pf-status__label">
              STEP 02 / PAYMENT{awaitingCapture ? ' / AWAITING CAPTURE' : ''}
            </p>
            <h2 className="pf-status__title">₹{amount}</h2>
            {awaitingCapture ? (
              <p className="pf-status__copy">
                The gateway has authorised your payment but not captured it yet. Your seat stays
                held and is confirmed automatically once the capture completes. Do not pay again
                — check your dashboard in a few minutes.
              </p>
            ) : checkout ? (
              <>
                <p className="pf-status__copy">
                  Pay securely through the gateway. Choose UPI (including QR), a debit or credit
                  card, net banking or a wallet at checkout.
                </p>
                <ul className="pf-methods">
                  {checkout.methods.map((method) => (
                    <li key={method}>{method}</li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="pf-status__copy">
                {gatewayError || 'PREPARING THE SECURE CHECKOUT…'}
              </p>
            )}

            {gatewayError && checkout && <p className="pf-error">{gatewayError}</p>}

            <div className="pf-actions">
              {awaitingCapture ? (
                <Link className="pf-btn" to="/dashboard">
                  OPEN MY DASHBOARD
                </Link>
              ) : (
                <button
                  type="button"
                  className="pf-btn"
                  onClick={payWithGateway}
                  disabled={busy || !checkout}
                >
                  {busy ? 'OPENING CHECKOUT…' : `PAY ₹${amount}`}
                </button>
              )}
              <Link className="pf-btn pf-btn--ghost" to="/dashboard">
                LATER
              </Link>
            </div>
            <p className="pf-row__meta">
              Your registration is confirmed only after the server verifies the gateway
              signature and payment status. A browser success message alone changes nothing.
            </p>
          </div>

          {!awaitingCapture && (
            <details className="pf-fallback">
            <summary>MANUAL PAYMENT VERIFICATION (FALLBACK)</summary>
            <p className="pf-row__meta">
              Use this only when the organizers ask for a bank or UPI reference directly. An
              organizer verifies it by hand — this is not the primary checkout.
            </p>

            {settings?.paymentQrUrl ? (
              <img
                src={settings.paymentQrUrl}
                alt="Payment QR code supplied by the organizers"
                style={{ width: '200px', height: 'auto', margin: '14px 0' }}
              />
            ) : (
              <p className="pf-status__copy">
                No manual payment QR has been published for this event.
              </p>
            )}
            {settings?.paymentInstructions && (
              <p className="pf-status__copy">{settings.paymentInstructions}</p>
            )}

            <form className="pf-form" onSubmit={submitPayment}>
              <label className="pf-field">
                <span>UPI / bank transaction reference</span>
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
                <button type="submit" className="pf-btn pf-btn--ghost" disabled={busy}>
                  {busy ? 'SUBMITTING…' : 'SUBMIT REFERENCE FOR VERIFICATION'}
                </button>
              </div>
            </form>
          </details>
          )}
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

          {customFieldDefinitions.map((definition) => {
            const value = customFields[definition.key] ?? ''
            const update = (next) => setCustomFields((current) => ({ ...current, [definition.key]: next }))
            const errorKey = `customFields.${definition.key}`
            return (
              <label className="pf-field" key={definition.key}>
                <span>
                  {definition.label}
                  {definition.required ? '' : ' (optional)'}
                </span>
                {definition.type === 'textarea' ? (
                  <textarea rows={3} value={value} onChange={(changeEvent) => update(changeEvent.target.value)} />
                ) : definition.type === 'select' ? (
                  <select value={value} onChange={(changeEvent) => update(changeEvent.target.value)} required={definition.required}>
                    <option value="">Choose…</option>
                    {(Array.isArray(definition.options) ? definition.options : []).map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type={definition.type === 'number' ? 'number' : definition.type === 'email' ? 'email' : definition.type === 'phone' ? 'tel' : 'text'}
                    value={value}
                    required={definition.required}
                    onChange={(changeEvent) => update(changeEvent.target.value)}
                  />
                )}
                {fields[errorKey] && <small className="pf-error">{fields[errorKey]}</small>}
              </label>
            )
          })}

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
