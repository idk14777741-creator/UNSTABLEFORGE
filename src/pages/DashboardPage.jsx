import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { useAuth } from '../context/AuthContext'
import '../platform.css'

const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'events', label: 'My events' },
  { id: 'passes', label: 'My passes' },
  { id: 'certificates', label: 'My certificates' },
  { id: 'profile', label: 'My profile' },
]

const STATUS_LABEL = {
  registered: 'RECORDED',
  pending_payment: 'PAYMENT DUE',
  payment_submitted: 'PAYMENT SUBMITTED',
  verification_pending: 'VERIFICATION PENDING',
  confirmed: 'CONFIRMED',
  cancelled: 'CANCELLED',
  rejected: 'REJECTED',
  refunded: 'REFUNDED',
}

function PassCard({ pass }) {
  const [qr, setQr] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then(({ default: QRCode }) => QRCode.toDataURL(pass.token, { margin: 1, width: 336 }))
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [pass.token])

  return (
    <article className="pf-pass">
      {qr ? (
        <img src={qr} alt={`Entry pass for ${pass.eventTitle}`} />
      ) : (
        <p className="pf-pass__meta">{failed ? 'QR UNAVAILABLE — SHOW THE REFERENCE' : 'DRAWING PASS…'}</p>
      )}
      <p className="pf-pass__event">{pass.eventTitle}</p>
      <p className="pf-pass__meta">{pass.reference}</p>
      <p className="pf-pass__meta">SCAN AT THE ENTRANCE</p>
      {qr && (
        <a className="pf-btn pf-btn--ghost" href={qr} download={`${pass.reference}-pass.png`}>
          DOWNLOAD PASS
        </a>
      )}
    </article>
  )
}

export default function DashboardPage() {
  const { request } = useAuth()
  const [tab, setTab] = useState('overview')
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    document.title = 'My dashboard — Unstable Forge'

    request('/api/me/dashboard')
      .then((payload) => {
        if (!cancelled) setState({ status: 'ready', data: payload.data })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error.message })
      })

    return () => {
      cancelled = true
    }
  }, [request])

  if (state.status === 'loading') {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-empty">OPENING YOUR RECORD…</p>
        </div>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-empty">{state.message}</p>
        </div>
      </main>
    )
  }

  const { profile, registrations, passes, certificates } = state.data
  const confirmed = registrations.filter((item) => item.status === 'confirmed')
  const pending = registrations.filter((item) =>
    ['pending_payment', 'verification_pending', 'payment_submitted'].includes(item.status),
  )

  return (
    <main id="main" className="pf-main">
      <div className="pf-wrap">
        <p className="pf-kicker">MY RECORD</p>
        <h1 className="pf-title">
          Your <em>journey.</em>
        </h1>
        <p className="pf-lede">
          {profile?.displayName || profile?.email} — participation is kept here even after an event
          closes or archived.
        </p>

        <div className="pf-tabs" role="tablist" aria-label="Dashboard sections">
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

        {tab === 'overview' && (
          <section className="pf-section" style={{ marginTop: '26px' }}>
            <div className="pf-grid">
              <article className="pf-card">
                <span className="pf-card__label">CONFIRMED</span>
                <h3 className="pf-card__title">{confirmed.length}</h3>
                <p className="pf-card__copy">Events you are confirmed for.</p>
              </article>
              <article className="pf-card">
                <span className="pf-card__label">PENDING</span>
                <h3 className="pf-card__title">{pending.length}</h3>
                <p className="pf-card__copy">Registrations awaiting payment or verification.</p>
              </article>
              <article className="pf-card">
                <span className="pf-card__label">PASSES</span>
                <h3 className="pf-card__title">{passes.length}</h3>
                <p className="pf-card__copy">Ready to scan at an entrance.</p>
              </article>
              <article className="pf-card">
                <span className="pf-card__label">CERTIFICATES</span>
                <h3 className="pf-card__title">
                  {certificates.filter((certificate) => !certificate.revoked).length}
                </h3>
                <p className="pf-card__copy">Issued by the organizers.</p>
              </article>
            </div>
          </section>
        )}

        {tab === 'events' && (
          <section className="pf-section" style={{ marginTop: '26px' }}>
            {registrations.length === 0 ? (
              <p className="pf-empty">
                NO REGISTRATIONS YET. <Link to="/events">EXPLORE THE EVENTS</Link>
              </p>
            ) : (
              <div className="pf-rows">
                {registrations.map((registration) => (
                  <div className="pf-row" key={registration.id}>
                    <span>
                      <h3 className="pf-row__title">
                        <Link to={`/events/${registration.eventSlug}`}>{registration.eventTitle}</Link>
                      </h3>
                      <span className="pf-row__meta">
                        {registration.reference}
                        {registration.teamName ? ` · ${registration.teamName}` : ''}
                        {registration.isCaptain ? ' · CAPTAIN' : ''}
                      </span>
                    </span>
                    <span className="pf-badge" data-tone={registration.status === 'confirmed' ? 'good' : 'idle'}>
                      {STATUS_LABEL[registration.status] || registration.status}
                    </span>
                    <span className="pf-row__meta">
                      {registration.checkedIn ? 'CHECKED IN' : 'NOT CHECKED IN'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'passes' && (
          <section className="pf-section" style={{ marginTop: '26px' }}>
            <div className="pf-section__head">
              <h2 className="pf-section__title">Entry passes</h2>
              <span className="pf-section__note">ONE PASS PER PARTICIPANT</span>
            </div>
            {passes.length === 0 ? (
              <p className="pf-empty">
                PASSES APPEAR HERE ONCE A REGISTRATION IS CONFIRMED.
              </p>
            ) : (
              <div className="pf-qr">
                {passes.map((pass) => (
                  <PassCard key={pass.id} pass={pass} />
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'certificates' && (
          <section className="pf-section" style={{ marginTop: '26px' }}>
            {certificates.length === 0 ? (
              <p className="pf-empty">NO CERTIFICATES HAVE BEEN ISSUED TO YOU YET.</p>
            ) : (
              <div className="pf-rows">
                {certificates.map((certificate) => (
                  <div className="pf-row" key={certificate.id}>
                    <span>
                      <h3 className="pf-row__title">{certificate.title}</h3>
                      <span className="pf-row__meta">
                        {certificate.eventTitle} · {certificate.certificateNo}
                      </span>
                    </span>
                    <span
                      className="pf-badge"
                      data-tone={certificate.revoked ? 'idle' : 'good'}
                    >
                      {certificate.revoked ? 'REVOKED' : 'VALID'}
                    </span>
                    <a
                      className="pf-btn pf-btn--ghost"
                      href={`/api/certificates/${certificate.code}/pdf`}
                    >
                      DOWNLOAD PDF
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === 'profile' && (
          <section className="pf-section" style={{ marginTop: '26px' }}>
            <div className="pf-facts">
              <p className="pf-fact">
                <span>Email</span>
                <span>{profile?.email}</span>
              </p>
              <p className="pf-fact">
                <span>Email verified</span>
                <span>{profile?.emailVerified ? 'YES' : 'NO'}</span>
              </p>
              <p className="pf-fact">
                <span>Role</span>
                <span>{(profile?.role || 'participant').toUpperCase()}</span>
              </p>
              <p className="pf-fact">
                <span>Member since</span>
                <span>{profile?.memberSince ? new Date(profile.memberSince).toLocaleDateString() : '—'}</span>
              </p>
            </div>
            <p className="pf-lede">
              Participation records are linked to your verified email. Sign in with Google to claim
              records a team captain created for you.
            </p>
          </section>
        )}
      </div>
    </main>
  )
}
