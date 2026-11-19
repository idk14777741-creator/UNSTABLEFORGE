import { useEffect, useState } from 'react'
import { Link } from '../../lib/router'
import { useAuth } from '../../context/AuthContext'
import SectionLabel from '../../components/SectionLabel'
import { formatDate } from '../../data/announcements'

function Stat({ label, value, note }) {
  return (
    <article className="admin-stat">
      <span className="admin-stat__label">{label}</span>
      <strong className="admin-stat__value">
        {typeof value === 'number' ? String(value).padStart(2, '0') : value}
      </strong>
      <span className="admin-stat__note">{note}</span>
    </article>
  )
}

export default function AdminDashboard() {
  const { user, request } = useAuth()
  const [state, setState] = useState({ status: 'loading', items: [], summary: null, error: null })
  const [registrationCount, setRegistrationCount] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    document.title = 'Control Room — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  useEffect(() => {
    let active = true
    setState((current) => ({ ...current, status: 'loading', error: null }))

    request('/api/admin/announcements?limit=5')
      .then((body) => {
        if (!active) return
        setState({
          status: 'success',
          items: body.data,
          summary: body.meta.summary,
          error: null,
        })
      })
      .catch((error) => {
        if (!active) return
        setState({ status: 'error', items: [], summary: null, error: error.message })
      })

    return () => {
      active = false
    }
  }, [request, reloadKey])

  useEffect(() => {
    let active = true
    request('/api/admin/registrations?limit=1')
      .then((body) => {
        if (active) setRegistrationCount(body.meta?.summary?.total ?? 0)
      })
      .catch(() => {
        if (active) setRegistrationCount(null)
      })
    return () => {
      active = false
    }
  }, [request, reloadKey])

  const summary = state.summary || { total: 0, published: 0, drafts: 0 }

  return (
    <main id="main" className="admin-main">
      <section className="admin-hero" aria-labelledby="admin-title">
        <span className="admin-hero__watermark" aria-hidden="true">
          ORG
        </span>
        <div className="container">
          <div className="admin-hero__top">
            <SectionLabel number="ORG" tone="light">
              ORGANIZER ACCESS
            </SectionLabel>
            <span className="admin-hero__session">
              <span className="status-dot" aria-hidden="true" />
              SESSION / {String(user?.role || '').toUpperCase()}
            </span>
          </div>

          <h1 id="admin-title" className="display admin-hero__title">
            THE CONTROL <em className="serif">ROOM.</em>
          </h1>

          <div className="admin-hero__foot">
            <p>
              Signed in as <strong>{user?.email}</strong>. This area publishes the record of
              what is confirmed for C³. Drafts stay private until you publish them.
            </p>
            <Link className="admin-hero__public" to="/announcements">
              VIEW PUBLIC DISPATCHES <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </section>

      <section className="section admin-overview" aria-labelledby="admin-overview-title">
        <div className="container">
          <div className="admin-overview__head">
            <div>
              <p className="admin-kicker">THE EVENT RECORD</p>
              <h2 id="admin-overview-title" className="display admin-title">
                STATE OF THE <em className="serif">FORGE.</em>
              </h2>
            </div>
            <p className="admin-overview__aside">
              Announcements are the only source of truth shown to visitors. Anything still
              being decided should remain a draft.
            </p>
          </div>

          {state.status === 'error' ? (
            <div className="admin-state" role="alert">
              <span className="admin-state__label">CONTROL ROOM / UNREACHABLE</span>
              <h3>We could not load the announcement record.</h3>
              <p>{state.error}</p>
              <button
                className="ann-action"
                type="button"
                onClick={() => setReloadKey((key) => key + 1)}
              >
                TRY AGAIN ↻
              </button>
            </div>
          ) : (
            <>
              <div className="admin-stats admin-stats--four">
                <Stat label="TOTAL DISPATCHES" value={summary.total} note="All statuses" />
                <Stat label="PUBLIC" value={summary.published} note="Visible on the event site" />
                <Stat label="DRAFTS" value={summary.drafts} note="Private until published" />
                <Stat
                  label="REGISTRATIONS"
                  value={registrationCount ?? '—'}
                  note="Participants in the record"
                />
              </div>

              <div className="admin-actions">
                <Link className="ann-action" to="/admin/announcements">
                  MANAGE UPDATES
                </Link>
                <Link className="ann-action" to="/admin/registrations">
                  VIEW REGISTRATIONS
                </Link>
                <Link className="ann-action ann-action--ghost" to="/admin/announcements/new">
                  NEW DISPATCH
                </Link>
              </div>

              <div className="admin-recent">
                <div className="admin-recent__head">
                  <span>RECENT ACTIVITY</span>
                  <span>{state.status === 'loading' ? 'LOADING…' : 'LAST UPDATED'}</span>
                </div>

                {state.status === 'success' && state.items.length === 0 && (
                  <p className="admin-empty">No announcements have been created yet.</p>
                )}

                {state.items.map((item) => (
                  <article className="admin-recent__row" key={item.id}>
                    <span className="admin-recent__date">
                      {formatDate(item.updatedAt || item.publishedAt)}
                    </span>
                    <span className="admin-recent__title">{item.title}</span>
                    <span className="admin-recent__category">{item.category}</span>
                    <span
                      className={`admin-status ${item.isPublished ? 'is-public' : 'is-draft'}`}
                    >
                      {item.isPublished ? 'PUBLIC' : 'DRAFT'}
                    </span>
                    <Link
                      className="admin-recent__link"
                      to={`/admin/announcements/${item.id}/edit`}
                    >
                      EDIT ↗
                    </Link>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </main>
  )
}
