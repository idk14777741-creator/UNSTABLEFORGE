import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { apiGet, ApiError } from '../lib/api'
import { formatDate } from '../data/announcements'
import { brand } from '../data/site'

export default function AnnouncementDetail({ slug }) {
  const [status, setStatus] = useState('loading')
  const [announcement, setAnnouncement] = useState(null)
  const [error, setError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setStatus('loading')
    setError(null)

    apiGet(`/api/announcements/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((body) => {
        setAnnouncement(body.data)
        setStatus('success')
        window.document.title = `${body.data.title} — Unstable Forge`
      })
      .catch((requestError) => {
        if (requestError.name === 'AbortError') return
        setError(requestError)
        setStatus(requestError instanceof ApiError && requestError.status === 404 ? 'missing' : 'error')
      })

    return () => controller.abort()
  }, [slug, reloadKey])

  useEffect(() => {
    return () => {
      window.document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  if (status === 'loading') {
    return (
      <main id="main" className="ann-main">
        <section className="ann-detail-hero ann-detail-hero--loading">
          <div className="container">
            <Link className="ann-back" to="/announcements">
              ← ALL UPDATES
            </Link>
            <div className="ann-detail-skeleton" aria-busy="true">
              <span className="ann-skeleton ann-skeleton--short" />
              <span className="ann-skeleton ann-skeleton--title" />
              <span className="ann-skeleton ann-skeleton--title" />
            </div>
          </div>
        </section>
        <div className="container ann-detail-loading">
          <span className="ann-skeleton" />
          <span className="ann-skeleton" />
          <span className="ann-skeleton ann-skeleton--short" />
        </div>
      </main>
    )
  }

  if (status === 'error' || status === 'missing') {
    return (
      <main id="main" className="ann-main">
        <section className="section ann-missing">
          <div className="container">
            <Link className="ann-back ann-back--dark" to="/announcements">
              ← ALL UPDATES
            </Link>
            <span className="ann-state__label">
              {status === 'missing' ? 'DISPATCH / 404' : 'DISPATCH / UNAVAILABLE'}
            </span>
            <h1 className="display ann-missing__title">
              {status === 'missing' ? (
                <>
                  THIS UPDATE IS NOT <em className="serif">PUBLISHED.</em>
                </>
              ) : (
                <>
                  THE DISPATCH DESK IS <em className="serif">UNREACHABLE.</em>
                </>
              )}
            </h1>
            <p className="ann-missing__copy">
              {status === 'missing'
                ? 'The link may be wrong, or the announcement has not been published yet.'
                : error?.message || 'The updates service did not respond.'}
            </p>
            <div className="ann-missing__actions">
              <Link className="ann-action" to="/announcements">
                BACK TO ALL UPDATES
              </Link>
              {status === 'error' && (
                <button
                  className="ann-action ann-action--ghost"
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  TRY AGAIN <span aria-hidden="true">↻</span>
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    )
  }

  const paragraphs = announcement.content.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean)

  return (
    <main id="main" className="ann-main">
      <article className="ann-detail">
        <header className="ann-detail-hero">
          <div className="container">
            <Link className="ann-back" to="/announcements">
              ← ALL UPDATES
            </Link>

            <div className="ann-detail-meta">
              <span className="ann-detail-category">{announcement.category}</span>
              <time dateTime={announcement.publishedAt || undefined}>
                {formatDate(announcement.publishedAt)}
              </time>
              <span>DISPATCH / {String(announcement.id).padStart(3, '0')}</span>
            </div>

            <h1 className="display ann-detail-title">{announcement.title}</h1>

            <p className="ann-detail-event">
              {brand.event} <span aria-hidden="true">/</span> {brand.audience}
            </p>
          </div>
        </header>

        <div className="container ann-detail-body">
          <aside className="ann-detail-rail">
            <span>FROM THE FORGE</span>
            <span>CATEGORY / {announcement.category.toUpperCase()}</span>
            <span>UPDATED / {formatDate(announcement.updatedAt)}</span>
          </aside>

          <div className="ann-detail-content">
            {paragraphs.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>

        <div className="container ann-detail-foot">
          <Link className="ann-detail-next" to="/announcements">
            <span>MORE DISPATCHES</span>
            <span aria-hidden="true">↗</span>
          </Link>
          <p>Published updates only. Unconfirmed event details remain marked as TBA.</p>
        </div>
      </article>
    </main>
  )
}
