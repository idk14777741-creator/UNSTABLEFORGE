import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '../../lib/router'
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../context/AuthContext'
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
      onElevated(payload.data.token)
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

function EventsTab({ token, elevatedToken }) {
  const [events, setEvents] = useState([])
  const [message, setMessage] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ title: '', type: 'hackathon', shortDescription: '' })

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

  const create = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      await apiRequest('/api/admin/events', { method: 'POST', token, body: form })
      setForm({ title: '', type: 'hackathon', shortDescription: '' })
      await reload()
      setMessage('Event created as a draft. Configure it, then publish when it is ready.')
    } catch (error) {
      setMessage(error.message)
    }
  }

  return (
    <>
      <form className="pf-form" onSubmit={create}>
        <label className="pf-field">
          <span>New event title</span>
          <input
            value={form.title}
            onChange={(changeEvent) => setForm({ ...form, title: changeEvent.target.value })}
            required
            minLength={3}
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
        <label className="pf-field">
          <span>Short description</span>
          <input
            value={form.shortDescription}
            onChange={(changeEvent) => setForm({ ...form, shortDescription: changeEvent.target.value })}
          />
        </label>
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

  useEffect(() => {
    apiRequest('/api/admin/events', { token })
      .then((payload) => {
        setEvents(payload.data)
        if (payload.data[0]) setEventId(String(payload.data[0].id))
      })
      .catch((error) => setMessage(error.message))
  }, [token])

  const issue = async (event) => {
    event.preventDefault()
    setMessage('')
    try {
      const payload = await apiRequest('/api/admin/certificates/issue', {
        method: 'POST',
        token,
        body: { eventId: Number(eventId), title, kind, onlyAttended },
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

export default function AdminPlatform() {
  const { token } = useAuth()
  const [tab, setTab] = useState('events')
  const [elevatedToken, setElevatedToken] = useState(null)

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
          <ElevationBar token={token} onElevated={setElevatedToken} />
        </div>

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
