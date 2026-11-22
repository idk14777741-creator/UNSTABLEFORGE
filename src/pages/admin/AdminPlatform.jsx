import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '../../lib/router'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
import { readElevated, saveElevated } from '../../lib/organizer'
import '../../platform.css'

/**
 * Organizer console for the multi-event platform.
 *
 * Every control here is backed by a real API call. Actions that change money,
 * attendance or certificates need the organizer's personal access code: the
 * server refuses those requests until the session is elevated.
 */

const TABS = [
  { id: 'events', label: 'Events' },
  { id: 'content', label: 'Content' },
  { id: 'payments', label: 'Payments' },
  { id: 'checkin', label: 'Check-in' },
  { id: 'certificates', label: 'Certificates' },
  { id: 'glimpse', label: 'The Glimpse' },
]

function ElevationBar({ token, onElevated }) {
  const [status, setStatus] = useState(null)
  const [code, setCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [message, setMessage] = useState('')

  const load = useCallback(async () => {
    const payload = await apiRequest('/api/auth/organizer/status', { token })
    setStatus(payload.data)
  }, [token])

  useEffect(() => {
    load().catch((error) => setMessage(error.message))
  }, [load])

  const enroll = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      await apiRequest('/api/auth/organizer/code', { method: 'POST', token, body: { code: newCode } })
      setNewCode('')
      await load()
      setMessage('Access code set. Confirm it below to unlock sensitive actions.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const verify = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      const payload = await apiRequest('/api/auth/organizer/verify', {
        method: 'POST',
        token,
        body: { code },
      })
      setCode('')
      onElevated(payload.data)
      setMessage('Verified. Sensitive actions are unlocked for this session.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  if (!status) return <p className="pf-row__meta">{message || 'CHECKING ORGANIZER ACCESS…'}</p>

  if (status.elevated) {
    return (
      <p className="pf-badge" data-tone="good">
        ORGANIZER VERIFIED
      </p>
    )
  }

  return (
    <form className="pf-actions" onSubmit={status.hasCode ? verify : enroll} style={{ marginTop: 0 }}>
      <input
        className="pf-field"
        style={{ padding: '10px 12px', border: '1px solid var(--line)' }}
        type="password"
        value={status.hasCode ? code : newCode}
        onChange={(changeEvent) =>
          status.hasCode ? setCode(changeEvent.target.value) : setNewCode(changeEvent.target.value)
        }
        placeholder={status.hasCode ? 'Organizer access code' : 'Set an access code (8+ characters)'}
        minLength={8}
        required
      />
      <button type="submit" className="pf-btn">
        {status.hasCode ? 'VERIFY' : 'SET CODE'}
      </button>
      {message && <span className="pf-row__meta">{message}</span>}
    </form>
  )
}

function EventSettings({ event, token, onSaved }) {
  const [settings, setSettings] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    apiRequest(`/api/events/${event.slug}`)
      .then((payload) => setSettings(payload.data.settings))
      .catch((error) => setMessage(error.message))
  }, [event.slug])

  if (!settings) return <p className="pf-row__meta">{message || 'LOADING CONFIGURATION…'}</p>

  const save = async (submitEvent) => {
    submitEvent.preventDefault()
    setMessage('')
    try {
      const payload = await apiRequest(`/api/admin/events/${event.id}/settings`, {
        method: 'PUT',
        token,
        body: {
          enabled: settings.enabled,
          isPaid: settings.isPaid,
          feeMinor: Math.round(Number(settings.feeMinor) || 0),
          feeUnit: settings.feeUnit || 'team',
          capacity: settings.capacity === '' || settings.capacity === null ? undefined : Number(settings.capacity),
          registrationMode: settings.registrationMode,
          minTeamSize: Number(settings.minTeamSize) || 1,
          maxTeamSize: Number(settings.maxTeamSize) || 1,
          paymentInstructions: settings.paymentInstructions || '',
        },
      })
      setSettings(payload.data)
      setMessage('Registration configuration saved.')
      onSaved?.()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <form className="pf-form" onSubmit={save} style={{ marginTop: '18px' }}>
      <label className="pf-field">
        <span>Registration enabled</span>
        <select
          value={settings.enabled ? 'yes' : 'no'}
          onChange={(changeEvent) => setSettings({ ...settings, enabled: changeEvent.target.value === 'yes' })}
        >
          <option value="yes">Open</option>
          <option value="no">Closed</option>
        </select>
      </label>
      <label className="pf-field">
        <span>Paid event</span>
        <select
          value={settings.isPaid ? 'yes' : 'no'}
          onChange={(changeEvent) => setSettings({ ...settings, isPaid: changeEvent.target.value === 'yes' })}
        >
          <option value="no">Free</option>
          <option value="yes">Paid</option>
        </select>
      </label>
      <label className="pf-field">
        <span>Fee (paise — 30000 is ₹300)</span>
        <input
          type="number"
          min="0"
          value={settings.feeMinor}
          onChange={(changeEvent) => setSettings({ ...settings, feeMinor: changeEvent.target.value })}
        />
      </label>
      <label className="pf-field">
        <span>Fee charged per</span>
        <select
          value={settings.feeUnit || 'team'}
          onChange={(changeEvent) => setSettings({ ...settings, feeUnit: changeEvent.target.value })}
        >
          <option value="team">Team</option>
          <option value="participant">Participant</option>
        </select>
      </label>
      <label className="pf-field">
        <span>Participant capacity (blank = unlimited)</span>
        <input
          type="number"
          min="1"
          value={settings.capacity ?? ''}
          onChange={(changeEvent) => setSettings({ ...settings, capacity: changeEvent.target.value })}
        />
      </label>
      <label className="pf-field">
        <span>Registration mode</span>
        <select
          value={settings.registrationMode}
          onChange={(changeEvent) => setSettings({ ...settings, registrationMode: changeEvent.target.value })}
        >
          <option value="individual">Individual</option>
          <option value="team">Team</option>
          <option value="both">Both</option>
        </select>
      </label>
      <label className="pf-field">
        <span>Minimum team size</span>
        <input
          type="number"
          min="1"
          value={settings.minTeamSize}
          onChange={(changeEvent) => setSettings({ ...settings, minTeamSize: changeEvent.target.value })}
        />
      </label>
      <label className="pf-field">
        <span>Maximum team size</span>
        <input
          type="number"
          min="1"
          value={settings.maxTeamSize}
          onChange={(changeEvent) => setSettings({ ...settings, maxTeamSize: changeEvent.target.value })}
        />
      </label>
      <label className="pf-field">
        <span>Payment instructions</span>
        <textarea
          rows={3}
          value={settings.paymentInstructions || ''}
          onChange={(changeEvent) =>
            setSettings({ ...settings, paymentInstructions: changeEvent.target.value })
          }
        />
      </label>
      <div className="pf-actions">
        <button type="submit" className="pf-btn">
          SAVE CONFIGURATION
        </button>
        {message && <span className="pf-row__meta">{message}</span>}
      </div>
    </form>
  )
}

function PlatformControls({ token, elevatedToken }) {
  const [status, setStatus] = useState(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    const payload = await apiRequest('/api/admin/platform/settings', { token })
    setStatus(payload.data)
  }, [token])

  useEffect(() => {
    load().catch((error) => setMessage(error.message))
  }, [load])

  const toggle = async () => {
    if (!status) return
    setBusy(true)
    setMessage('')
    try {
      const payload = await apiRequest('/api/admin/platform/settings', {
        method: 'PUT',
        token: elevatedToken || token,
        body: { eventDiscoveryEnabled: !status.eventDiscoveryEnabled },
      })
      setStatus({ ...status, ...payload.data })
      setMessage(
        payload.data.eventDiscoveryEnabled
          ? 'Event discovery is ON. Published events are listed again.'
          : 'Event discovery is OFF. Events, registrations and passes are untouched.',
      )
    } catch (error) {
      setMessage(
        `${error.message}${error.status === 403 ? ' — verify your access code above.' : ''}`,
      )
    } finally {
      setBusy(false)
    }
  }

  if (!status) return <p className="pf-row__meta">{message || 'LOADING PLATFORM CONTROLS…'}</p>

  return (
    <section className="pf-panel" style={{ marginBottom: '28px' }}>
      <div className="pf-controls">
        <div className="pf-control">
          <span className="pf-control__label">EVENT DISCOVERY</span>
          <strong className="pf-control__value">
            {status.eventDiscoveryEnabled ? 'VISIBLE' : 'HIDDEN'}
          </strong>
          <span className="pf-row__meta">
            Hiding discovery never deletes events, registrations, passes or attendance.
          </span>
          <button type="button" className="pf-btn" onClick={toggle} disabled={busy}>
            {busy ? 'SAVING…' : status.eventDiscoveryEnabled ? 'HIDE DISCOVERY' : 'ENABLE DISCOVERY'}
          </button>
        </div>

        <div className="pf-control">
          <span className="pf-control__label">PAYMENTS</span>
          <strong className="pf-control__value">
            {status.payments.configured
              ? `GATEWAY · ${status.payments.mode.toUpperCase()}`
              : 'GATEWAY NOT CONFIGURED'}
          </strong>
          <span className="pf-row__meta">
            {status.payments.configured
              ? status.payments.methods.join(' · ')
              : 'Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET to enable checkout.'}
          </span>
        </div>

        <div className="pf-control">
          <span className="pf-control__label">EMAIL DELIVERY</span>
          <strong className="pf-control__value">
            {status.emailDeliveryConfigured ? 'CONFIGURED' : 'NOT CONFIGURED'}
          </strong>
          <span className="pf-row__meta">
            {status.emailDeliveryConfigured
              ? 'Verification and reset messages are sent through the provider.'
              : 'Set RESEND_API_KEY and EMAIL_FROM to send verification and reset mail.'}
          </span>
        </div>
      </div>
      {message && <p className="pf-row__meta">{message}</p>}
    </section>
  )
}

const LIFECYCLE_OPTIONS = [
  'draft',
  'upcoming',
  'registration_open',
  'registration_closed',
  'ongoing',
  'completed',
  'archived',
]

const EMPTY_EVENT = {
  title: '',
  type: 'hackathon',
  shortDescription: '',
  description: '',
  rules: '',
  venue: '',
  startsAt: '',
  isPaid: false,
  fee: '',
  capacity: '',
  registrationMode: 'individual',
  minTeamSize: 1,
  maxTeamSize: 1,
}

function EventsTab({ token, elevatedToken }) {
  const [events, setEvents] = useState([])
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(null)
  const [advanced, setAdvanced] = useState(false)
  const [form, setForm] = useState(EMPTY_EVENT)

  const reload = useCallback(async () => {
    const payload = await apiRequest('/api/admin/events', { token })
    setEvents(payload.data)
  }, [token])

  useEffect(() => {
    reload().catch((error) => setMessage(error.message))
  }, [reload])

  const call = async (path, options) => {
    setMessage('')
    try {
      await apiRequest(path, { ...options, token: elevatedToken || token })
      await reload()
    } catch (error) {
      setMessage(`${error.message}${error.status === 403 ? ' — verify your access code above.' : ''}`)
    }
  }

  const create = async (submitEvent) => {
    submitEvent.preventDefault()
    setMessage('')

    if (form.title.trim().length < 3) {
      setMessage('Give the event a name of at least three characters.')
      return
    }
    if (form.shortDescription.trim().length < 10) {
      setMessage('Add a short description so participants know what the event is.')
      return
    }
    const rules = form.rules
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
    if (!rules.length) {
      setMessage('Add at least one rule, one per line.')
      return
    }

    try {
      await apiRequest('/api/admin/events', {
        method: 'POST',
        token,
        body: {
          title: form.title.trim(),
          type: form.type,
          shortDescription: form.shortDescription.trim(),
          description: form.description.trim() || undefined,
          venue: form.venue.trim() || undefined,
          startsAt: form.startsAt || undefined,
          rules,
          registration: {
            enabled: false,
            isPaid: form.isPaid,
            feeMinor: form.isPaid ? Math.round(Number(form.fee || 0) * 100) : 0,
            capacity: form.capacity === '' ? null : Number(form.capacity),
            registrationMode: form.registrationMode,
            minTeamSize: Number(form.minTeamSize) || 1,
            maxTeamSize: Number(form.maxTeamSize) || 1,
          },
        },
      })
      setForm(EMPTY_EVENT)
      setAdvanced(false)
      await reload()
      setMessage('Event created as a draft. Open it, add content, then publish when ready.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <>
      <form className="pf-form" onSubmit={create}>
        <div className="pf-form__head">
          <span className="pf-control__label">NEW EVENT</span>
          <span className="pf-row__meta">NAME · SHORT DESCRIPTION · RULES ARE ENOUGH TO START</span>
        </div>
        <label className="pf-field">
          <span>Event name</span>
          <input
            value={form.title}
            onChange={(changeEvent) => setForm({ ...form, title: changeEvent.target.value })}
            required
            minLength={3}
            maxLength={160}
          />
        </label>
        <label className="pf-field">
          <span>Short description</span>
          <textarea
            rows={2}
            maxLength={400}
            value={form.shortDescription}
            onChange={(changeEvent) => setForm({ ...form, shortDescription: changeEvent.target.value })}
            required
          />
        </label>
        <label className="pf-field">
          <span>Rules — one per line</span>
          <textarea
            rows={4}
            value={form.rules}
            onChange={(changeEvent) => setForm({ ...form, rules: changeEvent.target.value })}
            placeholder={'Teams of one to four\nOriginal work built during the event\nOne submission per team'}
            required
          />
        </label>
        <label className="pf-field">
          <span>Type</span>
          <select
            value={form.type}
            onChange={(changeEvent) => setForm({ ...form, type: changeEvent.target.value })}
          >
            {['hackathon', 'debate', 'seminar', 'workshop', 'competition', 'other'].map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        <details
          className="pf-advanced"
          open={advanced}
          onToggle={(toggleEvent) => setAdvanced(toggleEvent.currentTarget.open)}
        >
          <summary>ADVANCED CONFIGURATION (OPTIONAL)</summary>
          <div className="pf-advanced__body">
            <label className="pf-field">
              <span>Full description</span>
              <textarea
                rows={3}
                value={form.description}
                onChange={(changeEvent) => setForm({ ...form, description: changeEvent.target.value })}
              />
            </label>
            <label className="pf-field">
              <span>Date and time</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(changeEvent) => setForm({ ...form, startsAt: changeEvent.target.value })}
              />
            </label>
            <label className="pf-field">
              <span>Venue</span>
              <input
                value={form.venue}
                onChange={(changeEvent) => setForm({ ...form, venue: changeEvent.target.value })}
                maxLength={200}
              />
            </label>
            <label className="pf-field">
              <span>Registration mode</span>
              <select
                value={form.registrationMode}
                onChange={(changeEvent) => setForm({ ...form, registrationMode: changeEvent.target.value })}
              >
                <option value="individual">Individual</option>
                <option value="team">Team</option>
                <option value="both">Both</option>
              </select>
            </label>
            <label className="pf-field">
              <span>Minimum team size</span>
              <input
                type="number"
                min="1"
                value={form.minTeamSize}
                onChange={(changeEvent) => setForm({ ...form, minTeamSize: changeEvent.target.value })}
              />
            </label>
            <label className="pf-field">
              <span>Maximum team size</span>
              <input
                type="number"
                min="1"
                value={form.maxTeamSize}
                onChange={(changeEvent) => setForm({ ...form, maxTeamSize: changeEvent.target.value })}
              />
            </label>
            <label className="pf-field">
              <span>Participant capacity (blank = unlimited)</span>
              <input
                type="number"
                min="1"
                value={form.capacity}
                onChange={(changeEvent) => setForm({ ...form, capacity: changeEvent.target.value })}
              />
            </label>
            <label className="pf-field">
              <span>Entry fee (₹ per team, 0 = free)</span>
              <input
                type="number"
                min="0"
                value={form.fee}
                onChange={(changeEvent) =>
                  setForm({
                    ...form,
                    fee: changeEvent.target.value,
                    isPaid: Number(changeEvent.target.value) > 0,
                  })
                }
              />
            </label>
          </div>
        </details>

        <div className="pf-actions">
          <button type="submit" className="pf-btn">
            CREATE DRAFT
          </button>
        </div>
      </form>

      {message && <p className="pf-row__meta">{message}</p>}

      <div className="pf-rows">
        {events.map((event) => (
          <div className="pf-row" key={event.id}>
            <span>
              <h3 className="pf-row__title">{event.title}</h3>
              <span className="pf-row__meta">
                {event.type} · {event.lifecycle.replace(/_/g, ' ')} ·{' '}
                {event.isPublished ? 'PUBLISHED' : 'UNPUBLISHED'} · {event.seatsTaken} SEATS
              </span>
            </span>
            <span className="pf-badge">{event.slug}</span>
            <span className="pf-actions" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="pf-btn pf-btn--ghost"
                onClick={() =>
                  call(`/api/admin/events/${event.id}/publish`, {
                    method: 'POST',
                    body: { published: !event.isPublished },
                  })
                }
              >
                {event.isPublished ? 'UNPUBLISH' : 'PUBLISH'}
              </button>
              <button
                type="button"
                className="pf-btn pf-btn--ghost"
                onClick={() => setEditing(editing === event.id ? null : event.id)}
              >
                CONFIGURE
              </button>
              <label className="pf-mini-select">
                <span className="pf-row__meta">LIFECYCLE</span>
                <select
                  value={event.lifecycle}
                  onChange={(changeEvent) =>
                    call(`/api/admin/events/${event.id}/lifecycle`, {
                      method: 'POST',
                      body: { lifecycle: changeEvent.target.value },
                    })
                  }
                >
                  {LIFECYCLE_OPTIONS.map((lifecycle) => (
                    <option key={lifecycle} value={lifecycle}>
                      {lifecycle.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                className="pf-btn pf-btn--ghost"
                onClick={() =>
                  call(`/api/admin/events/${event.id}/lifecycle`, {
                    method: 'POST',
                    body: { lifecycle: event.lifecycle === 'archived' ? 'completed' : 'archived' },
                  })
                }
              >
                {event.lifecycle === 'archived' ? 'RESTORE' : 'ARCHIVE'}
              </button>
              <Link className="pf-btn pf-btn--ghost" to={`/events/${event.slug}`}>
                VIEW
              </Link>
            </span>
            {editing === event.id && (
              <div style={{ gridColumn: '1 / -1' }}>
                <EventSettings event={event} token={elevatedToken || token} onSaved={reload} />
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  )
}

function PaymentsTab({ token }) {
  const [payments, setPayments] = useState([])
  const [message, setMessage] = useState('')

  const reload = useCallback(async () => {
    const payload = await apiRequest('/api/admin/payments', { token })
    setPayments(payload.data)
  }, [token])

  useEffect(() => {
    reload().catch((error) => setMessage(error.message))
  }, [reload])

  const act = async (payment, action) => {
    setMessage('')
    try {
      const body = action === 'reject' ? { reason: 'Payment could not be matched' } : {}
      await apiRequest(`/api/admin/payments/${payment.id}/${action}`, { method: 'POST', token, body })
      await reload()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <>
      {message && <p className="pf-row__meta">{message}</p>}
      {payments.length === 0 ? (
        <p className="pf-empty">NO PAYMENTS YET.</p>
      ) : (
        <div className="pf-rows">
          {payments.map((payment) => (
            <div className="pf-row" key={payment.id}>
              <span>
                <h3 className="pf-row__title">
                  {payment.teamName || payment.captainName || `Payment ${payment.id}`}
                </h3>
                <span className="pf-row__meta">
                  {payment.eventTitle} · ₹{(payment.amountMinor / 100).toLocaleString('en-IN')} ·{' '}
                  {payment.transactionRef || 'NO REFERENCE'} · {payment.memberCount} MEMBER(S)
                </span>
              </span>
              <span className="pf-badge" data-tone={payment.status === 'verified' ? 'good' : 'idle'}>
                {payment.status}
              </span>
              <span className="pf-actions" style={{ marginTop: 0 }}>
                {payment.status === 'submitted' && (
                  <>
                    <button type="button" className="pf-btn" onClick={() => act(payment, 'verify')}>
                      VERIFY
                    </button>
                    <button
                      type="button"
                      className="pf-btn pf-btn--ghost"
                      onClick={() => act(payment, 'reject')}
                    >
                      REJECT
                    </button>
                  </>
                )}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function CheckinTab({ token }) {
  const [eventId, setEventId] = useState('')
  const [events, setEvents] = useState([])
  const [result, setResult] = useState(null)
  const [message, setMessage] = useState('')
  const [reference, setReference] = useState('')
  const [scanning, setScanning] = useState(false)
  const [checkins, setCheckins] = useState([])
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    apiRequest('/api/admin/events', { token })
      .then((payload) => {
        setEvents(payload.data)
        if (payload.data[0]) setEventId(String(payload.data[0].id))
      })
      .catch((error) => setMessage(error.message))
  }, [token])

  const loadCheckins = useCallback(async () => {
    if (!eventId) return
    const payload = await apiRequest(`/api/admin/events/${eventId}/checkins`, { token })
    setCheckins(payload.data)
  }, [eventId, token])

  useEffect(() => {
    loadCheckins().catch(() => {})
  }, [loadCheckins])

  const scan = async (rawToken) => {
    setMessage('')
    try {
      const payload = await apiRequest('/api/admin/checkins/scan', {
        method: 'POST',
        token,
        body: { eventId: Number(eventId), token: rawToken.trim() },
      })
      setResult(payload.data)
      await loadCheckins()
    } catch (error) {
      setResult({ status: 'rejected', reason: error.message, code: error.payload?.error?.code })
    }
  }

  const manual = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      const payload = await apiRequest('/api/admin/checkins/manual', {
        method: 'POST',
        token,
        body: { eventId: Number(eventId), reference },
      })
      setResult(payload.data)
      setReference('')
      await loadCheckins()
    } catch (error) {
      setResult({ status: 'rejected', reason: error.message, code: error.payload?.error?.code })
    }
  }

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setScanning(false)
  }, [])

  const startCamera = async () => {
    setMessage('')
    if (!('BarcodeDetector' in window)) {
      setMessage('This browser cannot scan barcodes. Use the reference lookup below.')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      streamRef.current = stream
      setScanning(true)
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const tick = async () => {
        if (!streamRef.current || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes[0]?.rawValue) {
            const value = codes[0].rawValue
            stopCamera()
            await scan(value)
            return
          }
        } catch {
          // A single failed frame is not a failed scan; keep looking.
        }
        window.setTimeout(tick, 350)
      }
      tick()
    } catch {
      setMessage('The camera could not be opened. Use the reference lookup below.')
      stopCamera()
    }
  }

  useEffect(() => stopCamera, [stopCamera])

  return (
    <>
      <div className="pf-actions">
        <label className="pf-field">
          <span>Event</span>
          <select value={eventId} onChange={(changeEvent) => setEventId(changeEvent.target.value)}>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>
        {scanning ? (
          <button type="button" className="pf-btn pf-btn--ghost" onClick={stopCamera}>
            STOP CAMERA
          </button>
        ) : (
          <button type="button" className="pf-btn" onClick={startCamera}>
            START CAMERA SCAN
          </button>
        )}
      </div>

      <video
        ref={videoRef}
        muted
        playsInline
        style={{ display: scanning ? 'block' : 'none', width: '100%', maxWidth: '420px', marginTop: '16px' }}
      />

      <form className="pf-actions" onSubmit={manual}>
        <input
          style={{ padding: '10px 12px', border: '1px solid var(--line)' }}
          value={reference}
          onChange={(changeEvent) => setReference(changeEvent.target.value)}
          placeholder="Registration reference (manual lookup)"
          required
        />
        <button type="submit" className="pf-btn pf-btn--ghost">
          CHECK IN BY REFERENCE
        </button>
      </form>

      {message && <p className="pf-row__meta">{message}</p>}

      {result && (
        <div className="pf-status">
          <p className="pf-status__label">
            {result.status === 'checked_in'
              ? 'ENTRY CONFIRMED'
              : result.status === 'already_checked_in'
                ? 'ALREADY CHECKED IN'
                : 'PASS REFUSED'}
          </p>
          <h2 className="pf-status__title">{result.participant || result.reason}</h2>
          <p className="pf-status__copy">
            {result.reference || result.code || ''}
            {result.checkedInAt ? ` · first scanned ${new Date(result.checkedInAt).toLocaleTimeString()}` : ''}
          </p>
        </div>
      )}

      <div className="pf-rows">
        {checkins.map((entry) => (
          <div className="pf-row" key={entry.id}>
            <span>
              <h3 className="pf-row__title">{entry.fullName}</h3>
              <span className="pf-row__meta">
                {entry.reference} · {entry.method} · {new Date(entry.checkedInAt).toLocaleString()}
                {entry.revertedAt ? ' · REVERTED' : ''}
              </span>
            </span>
            <span className="pf-badge" data-tone={entry.revertedAt ? 'idle' : 'good'}>
              {entry.revertedAt ? 'REVERTED' : 'IN'}
            </span>
            <span />
          </div>
        ))}
      </div>
    </>
  )
}

function CertificatesTab({ token }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [title, setTitle] = useState('Certificate of Participation')
  const [kind, setKind] = useState('participation')
  const [onlyAttended, setOnlyAttended] = useState(true)
  const [issued, setIssued] = useState([])
  const [message, setMessage] = useState('')
  const [participants, setParticipants] = useState([])
  const [ranks, setRanks] = useState({})

  useEffect(() => {
    apiRequest('/api/admin/events', { token })
      .then((payload) => {
        setEvents(payload.data)
        if (payload.data[0]) setEventId(String(payload.data[0].id))
      })
      .catch((error) => setMessage(error.message))
  }, [token])

  useEffect(() => {
    if (kind !== 'rank' || !eventId) return
    apiRequest(`/api/admin/events/${eventId}/registrations`, { token })
      .then((payload) => setParticipants(payload.data.filter((row) => row.status === 'confirmed')))
      .catch((error) => setMessage(error.message))
  }, [kind, eventId, token])

  const issue = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      const rankPositions = Object.fromEntries(
        Object.entries(ranks)
          .filter(([, value]) => Number(value) > 0)
          .map(([registrationId, value]) => [registrationId, Number(value)]),
      )
      const payload = await apiRequest('/api/admin/certificates/issue', {
        method: 'POST',
        token,
        body: { eventId: Number(eventId), title, kind, onlyAttended, rankPositions },
      })
      setIssued(payload.data)
      setMessage(`${payload.data.length} certificate(s) issued.`)
    } catch (error) {
      setMessage(error.message)
    }
  }

  const revoke = async (certificate) => {
    setMessage('')
    try {
      await apiRequest(`/api/admin/certificates/${certificate.id}/revoke`, {
        method: 'POST',
        token,
        body: { reason: 'Revoked by an organizer' },
      })
      setMessage('Certificate revoked. It no longer verifies publicly.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <>
      <form className="pf-form" onSubmit={issue}>
        <label className="pf-field">
          <span>Event</span>
          <select value={eventId} onChange={(changeEvent) => setEventId(changeEvent.target.value)}>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>
        <label className="pf-field">
          <span>Certificate title</span>
          <input value={title} onChange={(changeEvent) => setTitle(changeEvent.target.value)} required />
        </label>
        <label className="pf-field">
          <span>Kind</span>
          <select value={kind} onChange={(changeEvent) => setKind(changeEvent.target.value)}>
            <option value="participation">Participation</option>
            <option value="rank">Rank</option>
            <option value="special">Special</option>
          </select>
        </label>
        <label className="pf-field">
          <span>Eligibility</span>
          <select
            value={onlyAttended ? 'attended' : 'confirmed'}
            onChange={(changeEvent) => setOnlyAttended(changeEvent.target.value === 'attended')}
          >
            <option value="attended">Attended participants only</option>
            <option value="confirmed">Every confirmed registration</option>
          </select>
        </label>
        {kind === 'rank' && (
          <div style={{ gridColumn: '1 / -1' }}>
            <p className="pf-row__meta">Set each participant's rank position. Leave blank for no rank.</p>
            {participants.length === 0 && <p className="pf-empty">NO CONFIRMED PARTICIPANTS.</p>}
            <div className="pf-rows">
              {participants.map((participant) => (
                <div className="pf-row" key={participant.id}>
                  <span>
                    <h3 className="pf-row__title">{participant.fullName}</h3>
                    <span className="pf-row__meta">
                      {participant.reference}
                      {participant.teamName ? ` · ${participant.teamName}` : ''}
                    </span>
                  </span>
                  <label className="pf-field" style={{ margin: 0, minWidth: '140px' }}>
                    <span>Rank position</span>
                    <input
                      type="number"
                      min="1"
                      value={ranks[participant.id] ?? ''}
                      onChange={(changeEvent) =>
                        setRanks((current) => ({ ...current, [participant.id]: changeEvent.target.value }))
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>
        )}
        <div className="pf-actions">
          <button type="submit" className="pf-btn">
            ISSUE CERTIFICATES
          </button>
        </div>
      </form>

      {message && <p className="pf-row__meta">{message}</p>}

      <div className="pf-rows">
        {issued.map((certificate) => (
          <div className="pf-row" key={certificate.id}>
            <span>
              <h3 className="pf-row__title">{certificate.code}</h3>
              <span className="pf-row__meta">REGISTRATION {certificate.registrationId}</span>
            </span>
            <Link className="pf-btn pf-btn--ghost" to={`/certificates/${certificate.code}`}>
              VERIFY
            </Link>
            <button type="button" className="pf-btn pf-btn--ghost" onClick={() => revoke(certificate)}>
              REVOKE
            </button>
          </div>
        ))}
      </div>
    </>
  )
}

function GlimpseTab({ token }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [media, setMedia] = useState([])
  const [message, setMessage] = useState('')
  const [caption, setCaption] = useState('')
  const [credit, setCredit] = useState('')

  const reload = useCallback(async () => {
    const payload = await apiRequest('/api/admin/events', { token })
    setEvents(payload.data)
    const id = eventId || (payload.data[0] ? String(payload.data[0].id) : '')
    if (!eventId && id) setEventId(id)
    if (id) {
      const assets = await apiRequest(`/api/admin/media?event=${id}`, { token })
      setMedia(assets.data)
    }
  }, [token, eventId])

  useEffect(() => {
    reload().catch((error) => setMessage(error.message))
  }, [reload])

  const upload = async (event) => {
    event.preventDefault()
    setMessage('')
    const file = event.target.elements.photo.files[0]
    if (!file) return

    const query = new URLSearchParams({ event: eventId, placement: 'glimpse', caption, credit })
    try {
      const response = await fetch(`/api/admin/media?${query.toString()}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': file.type },
        body: file,
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error?.message || 'The upload failed.')
      setCaption('')
      setCredit('')
      event.target.reset()
      await reload()
      setMessage('Photograph uploaded. Publish it when you are ready for it to appear.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const patch = async (asset, body) => {
    setMessage('')
    try {
      await apiRequest(`/api/admin/media/${asset.id}`, { method: 'PATCH', token, body })
      await reload()
    } catch (error) {
      setMessage(error.message)
    }
  }

  const remove = async (asset) => {
    setMessage('')
    try {
      await apiRequest(`/api/admin/media/${asset.id}`, { method: 'DELETE', token })
      await reload()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <>
      <form className="pf-form" onSubmit={upload}>
        <label className="pf-field">
          <span>Event</span>
          <select value={eventId} onChange={(changeEvent) => setEventId(changeEvent.target.value)}>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </label>
        <label className="pf-field">
          <span>Photograph (JPEG, PNG, WebP or AVIF — max 8 MB)</span>
          <input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/avif" required />
        </label>
        <label className="pf-field">
          <span>Caption</span>
          <input value={caption} onChange={(changeEvent) => setCaption(changeEvent.target.value)} maxLength={500} />
        </label>
        <label className="pf-field">
          <span>Photographer credit</span>
          <input value={credit} onChange={(changeEvent) => setCredit(changeEvent.target.value)} maxLength={200} />
        </label>
        <div className="pf-actions">
          <button type="submit" className="pf-btn">
            UPLOAD
          </button>
        </div>
      </form>

      {message && <p className="pf-row__meta">{message}</p>}

      <div className="pf-rows">
        {media.map((asset) => (
          <div className="pf-row" key={asset.id}>
            <span>
              <h3 className="pf-row__title">{asset.caption || asset.url.split('/').pop()}</h3>
              <span className="pf-row__meta">
                {asset.placement} · {Math.round(asset.byteSize / 1024)} KB ·{' '}
                {asset.credit || 'NO CREDIT'}
              </span>
            </span>
            <span className="pf-badge" data-tone={asset.isPublished ? 'good' : 'idle'}>
              {asset.isPublished ? 'PUBLISHED' : 'DRAFT'}
            </span>
            <span className="pf-actions" style={{ marginTop: 0 }}>
              <button
                type="button"
                className="pf-btn pf-btn--ghost"
                onClick={() => patch(asset, { isPublished: !asset.isPublished })}
              >
                {asset.isPublished ? 'UNPUBLISH' : 'PUBLISH'}
              </button>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => remove(asset)}>
                DELETE
              </button>
            </span>
          </div>
        ))}
      </div>
    </>
  )
}

const CONTENT_SECTIONS = {
  domains: {
    label: 'Challenge domains',
    hint: 'Each domain becomes a numbered card on the event page.',
    titleKey: 'title',
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  topics: {
    label: 'Topics / motions',
    hint: 'Used by debate events; harmless on any other event.',
    titleKey: 'title',
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
    ],
  },
  rules: {
    label: 'Format & rules',
    hint: 'Section groups related rules together on the event page.',
    titleKey: 'title',
    fields: [
      { key: 'section', label: 'Section' },
      { key: 'title', label: 'Title', required: true },
      { key: 'body', label: 'Body', type: 'textarea' },
    ],
  },
  criteria: {
    label: 'Judging criteria',
    hint: 'Weight is optional and shown only in the organizer console.',
    titleKey: 'title',
    fields: [
      { key: 'title', label: 'Title', required: true },
      { key: 'description', label: 'Description', type: 'textarea' },
      { key: 'weight', label: 'Weight', type: 'number' },
    ],
  },
  faqs: {
    label: 'Questions',
    hint: 'Published answers appear on the public event page.',
    titleKey: 'question',
    fields: [
      { key: 'question', label: 'Question', required: true },
      { key: 'answer', label: 'Answer', type: 'textarea' },
    ],
  },
}

function ContentInput({ field, value, onChange }) {
  if (field.type === 'textarea') {
    return (
      <textarea
        rows={3}
        value={value ?? ''}
        required={field.required}
        onChange={(changeEvent) => onChange(changeEvent.target.value)}
      />
    )
  }
  return (
    <input
      type={field.type === 'number' ? 'number' : 'text'}
      value={value ?? ''}
      required={field.required}
      onChange={(changeEvent) => onChange(changeEvent.target.value)}
    />
  )
}

function ContentKindSection({ kind, token, eventId, items, onChanged }) {
  const spec = CONTENT_SECTIONS[kind]
  const blank = Object.fromEntries(spec.fields.map((field) => [field.key, field.key === 'section' ? 'rules' : '']))
  const [draft, setDraft] = useState(blank)
  const [editingId, setEditingId] = useState(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  const edit = (item) => {
    setDraft(Object.fromEntries(spec.fields.map((field) => [field.key, item[field.key] ?? ''])))
    setEditingId(item.id)
    setOpen(true)
    setMessage('')
  }

  const save = async (submitEvent) => {
    submitEvent.preventDefault()
    setMessage('')
    try {
      await apiRequest(
        editingId ? `/api/admin/content/${kind}/${editingId}` : `/api/admin/events/${eventId}/content/${kind}`,
        { method: editingId ? 'PATCH' : 'POST', token, body: draft },
      )
      setOpen(false)
      setEditingId(null)
      setDraft(blank)
      await onChanged()
      setMessage('Saved.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item[spec.titleKey]}"?`)) return
    setMessage('')
    try {
      await apiRequest(`/api/admin/content/${kind}/${item.id}`, { method: 'DELETE', token })
      await onChanged()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <section className="pf-panel" style={{ marginTop: '26px' }}>
      <div className="pf-panel__head">
        <h2 className="pf-panel__title">{spec.label}</h2>
        <button
          type="button"
          className="pf-btn pf-btn--ghost"
          onClick={() => {
            setDraft(blank)
            setEditingId(null)
            setOpen((current) => !current)
            setMessage('')
          }}
        >
          {open ? 'CANCEL' : 'ADD'}
        </button>
      </div>
      <p className="pf-row__meta">{spec.hint}</p>

      {open && (
        <form className="pf-form" onSubmit={save} style={{ marginTop: '14px' }}>
          {spec.fields.map((field) => (
            <label className="pf-field" key={field.key}>
              <span>{field.label}</span>
              <ContentInput
                field={field}
                value={draft[field.key]}
                onChange={(value) => setDraft((current) => ({ ...current, [field.key]: value }))}
              />
            </label>
          ))}
          <div className="pf-actions">
            <button type="submit" className="pf-btn">
              {editingId ? 'SAVE CHANGES' : 'ADD'}
            </button>
          </div>
        </form>
      )}

      {message && <p className="pf-row__meta">{message}</p>}

      <div className="pf-rows" style={{ marginTop: '14px' }}>
        {items.length === 0 && <p className="pf-empty">NOTHING HERE YET.</p>}
        {items.map((item) => (
          <div className="pf-row" key={item.id}>
            <span>
              <h3 className="pf-row__title">{item[spec.titleKey]}</h3>
              <span className="pf-row__meta">
                {item.description || item.body || item.answer || 'NO DESCRIPTION'}
              </span>
            </span>
            <span className="pf-actions" style={{ marginTop: 0 }}>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => edit(item)}>
                EDIT
              </button>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => remove(item)}>
                DELETE
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

const EMPTY_SPEAKER = { name: '', title: '', organization: '', bio: '', profileUrl: '' }

function SpeakersSection({ token, eventId, speakers, onChanged }) {
  const [draft, setDraft] = useState(EMPTY_SPEAKER)
  const [editingId, setEditingId] = useState(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  const edit = (speaker) => {
    setDraft({
      name: speaker.name || '',
      title: speaker.title || '',
      organization: speaker.organization || '',
      bio: speaker.bio || '',
      profileUrl: speaker.profileUrl || '',
    })
    setEditingId(speaker.id)
    setOpen(true)
    setMessage('')
  }

  const save = async (submitEvent) => {
    submitEvent.preventDefault()
    setMessage('')
    try {
      if (editingId) {
        await apiRequest(`/api/admin/speakers/${editingId}`, { method: 'PATCH', token, body: draft })
      } else {
        const created = await apiRequest('/api/admin/speakers', { method: 'POST', token, body: draft })
        await apiRequest(`/api/admin/events/${eventId}/speakers`, {
          method: 'POST',
          token,
          body: { speakerId: created.data.id },
        })
      }
      setDraft(EMPTY_SPEAKER)
      setEditingId(null)
      setOpen(false)
      await onChanged()
      setMessage('Saved.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const unlink = async (speaker) => {
    if (!window.confirm(`Remove ${speaker.name} from this event? The speaker record stays available.`)) return
    setMessage('')
    try {
      await apiRequest(`/api/admin/events/${eventId}/speakers/${speaker.id}`, { method: 'DELETE', token })
      await onChanged()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <section className="pf-panel" style={{ marginTop: '26px' }}>
      <div className="pf-panel__head">
        <h2 className="pf-panel__title">Speakers</h2>
        <button
          type="button"
          className="pf-btn pf-btn--ghost"
          onClick={() => {
            setDraft(EMPTY_SPEAKER)
            setEditingId(null)
            setOpen((current) => !current)
            setMessage('')
          }}
        >
          {open ? 'CANCEL' : 'ADD'}
        </button>
      </div>
      <p className="pf-row__meta">New speakers are created and attached to this event in one step.</p>

      {open && (
        <form className="pf-form" onSubmit={save} style={{ marginTop: '14px' }}>
          <label className="pf-field">
            <span>Name</span>
            <input
              value={draft.name}
              required
              minLength={2}
              onChange={(changeEvent) => setDraft({ ...draft, name: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Role / title</span>
            <input
              value={draft.title}
              onChange={(changeEvent) => setDraft({ ...draft, title: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Organization</span>
            <input
              value={draft.organization}
              onChange={(changeEvent) => setDraft({ ...draft, organization: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Profile URL</span>
            <input
              value={draft.profileUrl}
              onChange={(changeEvent) => setDraft({ ...draft, profileUrl: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Short bio</span>
            <textarea
              rows={3}
              value={draft.bio}
              onChange={(changeEvent) => setDraft({ ...draft, bio: changeEvent.target.value })}
            />
          </label>
          <div className="pf-actions">
            <button type="submit" className="pf-btn">
              {editingId ? 'SAVE CHANGES' : 'ADD SPEAKER'}
            </button>
          </div>
        </form>
      )}

      {message && <p className="pf-row__meta">{message}</p>}

      <div className="pf-rows" style={{ marginTop: '14px' }}>
        {speakers.length === 0 && <p className="pf-empty">NO SPEAKERS YET.</p>}
        {speakers.map((speaker) => (
          <div className="pf-row" key={speaker.id}>
            <span>
              <h3 className="pf-row__title">{speaker.name}</h3>
              <span className="pf-row__meta">
                {[speaker.title, speaker.organization].filter(Boolean).join(' · ') || 'NO DETAILS'}
              </span>
            </span>
            <span className="pf-actions" style={{ marginTop: 0 }}>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => edit(speaker)}>
                EDIT
              </button>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => unlink(speaker)}>
                REMOVE
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

const EMPTY_SESSION = { title: '', description: '', speakerId: '', startsAt: '', endsAt: '', venue: '' }

const toInputTime = (value) => (value ? String(value).slice(0, 16) : '')

function SessionsSection({ token, eventId, sessions, speakers, onChanged }) {
  const [draft, setDraft] = useState(EMPTY_SESSION)
  const [editingId, setEditingId] = useState(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  const edit = (session) => {
    setDraft({
      title: session.title || '',
      description: session.description || '',
      speakerId: session.speakerId || '',
      startsAt: toInputTime(session.startsAt),
      endsAt: toInputTime(session.endsAt),
      venue: session.venue || '',
    })
    setEditingId(session.id)
    setOpen(true)
    setMessage('')
  }

  const save = async (submitEvent) => {
    submitEvent.preventDefault()
    setMessage('')
    try {
      const body = {
        ...draft,
        speakerId: draft.speakerId ? Number(draft.speakerId) : null,
        startsAt: draft.startsAt || null,
        endsAt: draft.endsAt || null,
      }
      await apiRequest(editingId ? `/api/admin/sessions/${editingId}` : `/api/admin/events/${eventId}/sessions`, {
        method: editingId ? 'PATCH' : 'POST',
        token,
        body,
      })
      setDraft(EMPTY_SESSION)
      setEditingId(null)
      setOpen(false)
      await onChanged()
      setMessage('Saved.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const remove = async (session) => {
    if (!window.confirm(`Delete "${session.title}"?`)) return
    setMessage('')
    try {
      await apiRequest(`/api/admin/sessions/${session.id}`, { method: 'DELETE', token })
      await onChanged()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <section className="pf-panel" style={{ marginTop: '26px' }}>
      <div className="pf-panel__head">
        <h2 className="pf-panel__title">Sessions</h2>
        <button
          type="button"
          className="pf-btn pf-btn--ghost"
          onClick={() => {
            setDraft(EMPTY_SESSION)
            setEditingId(null)
            setOpen((current) => !current)
            setMessage('')
          }}
        >
          {open ? 'CANCEL' : 'ADD'}
        </button>
      </div>
      <p className="pf-row__meta">The run of show. Times are shown on the public event page once set.</p>

      {open && (
        <form className="pf-form" onSubmit={save} style={{ marginTop: '14px' }}>
          <label className="pf-field">
            <span>Title</span>
            <input
              value={draft.title}
              required
              minLength={2}
              onChange={(changeEvent) => setDraft({ ...draft, title: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Description</span>
            <textarea
              rows={3}
              value={draft.description}
              onChange={(changeEvent) => setDraft({ ...draft, description: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Speaker</span>
            <select
              value={draft.speakerId}
              onChange={(changeEvent) => setDraft({ ...draft, speakerId: changeEvent.target.value })}
            >
              <option value="">No speaker</option>
              {speakers.map((speaker) => (
                <option key={speaker.id} value={speaker.id}>
                  {speaker.name}
                </option>
              ))}
            </select>
          </label>
          <label className="pf-field">
            <span>Starts</span>
            <input
              type="datetime-local"
              value={draft.startsAt}
              onChange={(changeEvent) => setDraft({ ...draft, startsAt: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Ends</span>
            <input
              type="datetime-local"
              value={draft.endsAt}
              onChange={(changeEvent) => setDraft({ ...draft, endsAt: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Venue</span>
            <input
              value={draft.venue}
              onChange={(changeEvent) => setDraft({ ...draft, venue: changeEvent.target.value })}
            />
          </label>
          <div className="pf-actions">
            <button type="submit" className="pf-btn">
              {editingId ? 'SAVE CHANGES' : 'ADD SESSION'}
            </button>
          </div>
        </form>
      )}

      {message && <p className="pf-row__meta">{message}</p>}

      <div className="pf-rows" style={{ marginTop: '14px' }}>
        {sessions.length === 0 && <p className="pf-empty">NO SESSIONS YET.</p>}
        {sessions.map((session) => (
          <div className="pf-row" key={session.id}>
            <span>
              <h3 className="pf-row__title">{session.title}</h3>
              <span className="pf-row__meta">
                {[session.startsAt, session.venue].filter(Boolean).join(' · ') || 'NO TIME OR VENUE SET'}
              </span>
            </span>
            <span className="pf-actions" style={{ marginTop: 0 }}>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => edit(session)}>
                EDIT
              </button>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => remove(session)}>
                DELETE
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function RegistrationFieldsSection({ token, eventId, fields, onChanged }) {
  const [draft, setDraft] = useState({ key: '', label: '', type: 'text', options: '', required: false })
  const [editingId, setEditingId] = useState(null)
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')

  const edit = (field) => {
    setDraft({
      key: field.key,
      label: field.label,
      type: field.type,
      options: Array.isArray(field.options) ? field.options.join(', ') : '',
      required: field.required,
    })
    setEditingId(field.id)
    setOpen(true)
    setMessage('')
  }

  const save = async (submitEvent) => {
    submitEvent.preventDefault()
    setMessage('')
    try {
      await apiRequest(
        editingId ? `/api/admin/fields/${editingId}` : `/api/admin/events/${eventId}/fields`,
        { method: editingId ? 'PATCH' : 'POST', token, body: draft },
      )
      setDraft({ key: '', label: '', type: 'text', options: '', required: false })
      setEditingId(null)
      setOpen(false)
      await onChanged()
      setMessage('Saved.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  const remove = async (field) => {
    if (!window.confirm(`Delete the "${field.label}" question?`)) return
    setMessage('')
    try {
      await apiRequest(`/api/admin/fields/${field.id}`, { method: 'DELETE', token })
      await onChanged()
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <section className="pf-panel" style={{ marginTop: '26px' }}>
      <div className="pf-panel__head">
        <h2 className="pf-panel__title">Registration questions</h2>
        <button
          type="button"
          className="pf-btn pf-btn--ghost"
          onClick={() => {
            setDraft({ key: '', label: '', type: 'text', options: '', required: false })
            setEditingId(null)
            setOpen((current) => !current)
            setMessage('')
          }}
        >
          {open ? 'CANCEL' : 'ADD'}
        </button>
      </div>
      <p className="pf-row__meta">
        Extra questions appear on the registration form. Required answers are enforced by the server.
      </p>

      {open && (
        <form className="pf-form" onSubmit={save} style={{ marginTop: '14px' }}>
          <label className="pf-field">
            <span>Label</span>
            <input
              value={draft.label}
              required
              minLength={2}
              onChange={(changeEvent) => setDraft({ ...draft, label: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Key (blank to derive from the label)</span>
            <input
              value={draft.key}
              readOnly={Boolean(editingId)}
              onChange={(changeEvent) => setDraft({ ...draft, key: changeEvent.target.value })}
            />
          </label>
          <label className="pf-field">
            <span>Type</span>
            <select
              value={draft.type}
              onChange={(changeEvent) => setDraft({ ...draft, type: changeEvent.target.value })}
            >
              {['text', 'textarea', 'select', 'number', 'email', 'phone'].map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          {draft.type === 'select' && (
            <label className="pf-field">
              <span>Options (comma separated)</span>
              <input
                value={draft.options}
                onChange={(changeEvent) => setDraft({ ...draft, options: changeEvent.target.value })}
              />
            </label>
          )}
          <label className="pf-field">
            <span>Required</span>
            <select
              value={draft.required ? 'yes' : 'no'}
              onChange={(changeEvent) => setDraft({ ...draft, required: changeEvent.target.value === 'yes' })}
            >
              <option value="no">Optional</option>
              <option value="yes">Required</option>
            </select>
          </label>
          <div className="pf-actions">
            <button type="submit" className="pf-btn">
              {editingId ? 'SAVE CHANGES' : 'ADD QUESTION'}
            </button>
          </div>
        </form>
      )}

      {message && <p className="pf-row__meta">{message}</p>}

      <div className="pf-rows" style={{ marginTop: '14px' }}>
        {fields.length === 0 && <p className="pf-empty">NO EXTRA QUESTIONS.</p>}
        {fields.map((field) => (
          <div className="pf-row" key={field.id}>
            <span>
              <h3 className="pf-row__title">{field.label}</h3>
              <span className="pf-row__meta">
                {field.key} · {field.type} · {field.required ? 'REQUIRED' : 'OPTIONAL'}
              </span>
            </span>
            <span className="pf-actions" style={{ marginTop: 0 }}>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => edit(field)}>
                EDIT
              </button>
              <button type="button" className="pf-btn pf-btn--ghost" onClick={() => remove(field)}>
                DELETE
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ImagerySection({ token, eventId, event, media, onChanged }) {
  const [coverId, setCoverId] = useState('')
  const [heroId, setHeroId] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    setCoverId(String(media.find((asset) => asset.url === event.coverUrl)?.id || ''))
    setHeroId(String(media.find((asset) => asset.url === event.heroUrl)?.id || ''))
  }, [event.coverUrl, event.heroUrl, media])

  const save = async (submitEvent) => {
    submitEvent.preventDefault()
    setMessage('')
    try {
      await apiRequest(`/api/admin/events/${eventId}`, {
        method: 'PATCH',
        token,
        body: { coverAssetId: coverId || null, heroAssetId: heroId || null },
      })
      await onChanged()
      setMessage('Imagery saved.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <section className="pf-panel" style={{ marginTop: '26px' }}>
      <h2 className="pf-panel__title">Imagery</h2>
      <p className="pf-row__meta">
        Upload images in The Glimpse first, then choose them here. The hero fills the event page; the
        cover appears beside the event in the list.
      </p>
      <form className="pf-form" onSubmit={save} style={{ marginTop: '14px' }}>
        <label className="pf-field">
          <span>Cover image</span>
          <select value={coverId} onChange={(changeEvent) => setCoverId(changeEvent.target.value)}>
            <option value="">No cover</option>
            {media.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.caption || asset.url.split('/').pop()}
              </option>
            ))}
          </select>
        </label>
        <label className="pf-field">
          <span>Hero image</span>
          <select value={heroId} onChange={(changeEvent) => setHeroId(changeEvent.target.value)}>
            <option value="">No hero</option>
            {media.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.caption || asset.url.split('/').pop()}
              </option>
            ))}
          </select>
        </label>
        <div className="pf-actions">
          <button type="submit" className="pf-btn">
            SAVE IMAGERY
          </button>
          {message && <span className="pf-row__meta">{message}</span>}
        </div>
      </form>
    </section>
  )
}

function ContentTab({ token }) {
  const [events, setEvents] = useState([])
  const [eventId, setEventId] = useState('')
  const [detail, setDetail] = useState(null)
  const [message, setMessage] = useState('')

  useEffect(() => {
    apiRequest('/api/admin/events', { token })
      .then((payload) => {
        setEvents(payload.data)
        setEventId((current) => current || String(payload.data[0]?.id || ''))
      })
      .catch((error) => setMessage(error.message))
  }, [token])

  const reload = useCallback(async () => {
    if (!eventId) return
    const payload = await apiRequest(`/api/admin/events/${eventId}/content`, { token })
    setDetail(payload.data)
  }, [eventId, token])

  useEffect(() => {
    reload().catch((error) => setMessage(error.message))
  }, [reload])

  const onChanged = useCallback(async () => {
    await reload()
  }, [reload])

  return (
    <>
      <label className="pf-field" style={{ marginTop: '20px' }}>
        <span>Event</span>
        <select value={eventId} onChange={(changeEvent) => setEventId(changeEvent.target.value)}>
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </label>

      {message && <p className="pf-row__meta">{message}</p>}
      {!detail && !message && <p className="pf-empty">LOADING CONTENT…</p>}

      {detail && (
        <>
          <ImagerySection
            token={token}
            eventId={eventId}
            event={detail.event}
            media={detail.media}
            onChanged={onChanged}
          />
          {Object.keys(CONTENT_SECTIONS).map((kind) => (
            <ContentKindSection
              key={kind}
              kind={kind}
              token={token}
              eventId={eventId}
              items={detail.content[kind] || []}
              onChanged={onChanged}
            />
          ))}
          <SpeakersSection
            token={token}
            eventId={eventId}
            speakers={detail.speakers}
            onChanged={onChanged}
          />
          <SessionsSection
            token={token}
            eventId={eventId}
            sessions={detail.sessions}
            speakers={detail.speakers}
            onChanged={onChanged}
          />
          <RegistrationFieldsSection
            token={token}
            eventId={eventId}
            fields={detail.registrationFields}
            onChanged={onChanged}
          />
        </>
      )}
    </>
  )
}

export default function AdminPlatform() {
  const { token } = useAuth()
  const [tab, setTab] = useState('events')
  const [elevatedToken, setElevatedToken] = useState(() => readElevated()?.token ?? null)

  useEffect(() => {
    document.title = 'Organizer console — Unstable Forge'
  }, [])

  if (!token) {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-empty">SIGN IN AS AN ORGANIZER.</p>
        </div>
      </main>
    )
  }

  const activeToken = elevatedToken || token

  return (
    <main id="main" className="pf-main">
      <div className="pf-wrap">
        <p className="pf-kicker">CONTROL ROOM / PLATFORM</p>
        <h1 className="pf-title">
          Run the <em>forge.</em>
        </h1>
        <p className="pf-lede">
          Events, payments, entry and certificates for every event on the platform.
        </p>

        <div className="pf-actions" style={{ marginTop: '22px' }}>
          <ElevationBar
            token={token}
            onElevated={(session) => {
              saveElevated({ token: session.token, expiresAt: session.expiresAt })
              setElevatedToken(session.token)
            }}
          />
        </div>

        <PlatformControls token={token} elevatedToken={elevatedToken} />

        <div className="pf-tabs" role="tablist" aria-label="Organizer sections">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={tab === entry.id}
              className={`pf-tab ${tab === entry.id ? 'is-active' : ''}`}
              onClick={() => setTab(entry.id)}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {tab === 'events' && <EventsTab token={token} elevatedToken={elevatedToken} />}
        {tab === 'content' && <ContentTab token={activeToken} />}
        {tab === 'payments' && <PaymentsTab token={activeToken} />}
        {tab === 'checkin' && <CheckinTab token={activeToken} />}
        {tab === 'certificates' && <CertificatesTab token={activeToken} />}
        {tab === 'glimpse' && <GlimpseTab token={token} />}

        <div className="pf-actions" style={{ marginTop: '32px' }}>
          <Link className="pf-btn pf-btn--ghost" to="/admin">
            ANNOUNCEMENTS &amp; PROJECTS
          </Link>
        </div>
      </div>
    </main>
  )
}
