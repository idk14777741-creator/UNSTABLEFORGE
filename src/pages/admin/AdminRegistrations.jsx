import { useEffect, useState } from 'react'
import { Link, useRoute } from '../../lib/router'
import { useAuth } from '../../context/AuthContext'
import SectionLabel from '../../components/SectionLabel'
import { formatDate } from '../../data/announcements'

function RowsSkeleton() {
  return Array.from({ length: 5 }, (_, index) => (
    <div className="reg-row reg-row--skeleton" key={index} aria-hidden="true">
      <span className="ann-skeleton ann-skeleton--short" />
      <span className="reg-row__person">
        <span className="ann-skeleton ann-skeleton--title" />
        <span className="ann-skeleton ann-skeleton--medium" />
      </span>
      <span className="ann-skeleton ann-skeleton--medium" />
      <span className="ann-skeleton ann-skeleton--short" />
      <span className="ann-skeleton ann-skeleton--short" />
    </div>
  ))
}

export default function AdminRegistrations() {
  const { request } = useAuth()
  const { search } = useRoute()
  const [searchInput, setSearchInput] = useState(new URLSearchParams(search).get('q') || '')
  const [query, setQuery] = useState(new URLSearchParams(search).get('q') || '')
  const [campus, setCampus] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null })

  useEffect(() => {
    document.title = 'Registrations — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(searchInput.trim())
      setPage(1)
    }, 320)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: '10' })
    if (query) params.set('q', query)
    if (campus) params.set('campus', campus)

    setState((current) => ({ ...current, status: 'loading', error: null }))

    request(`/api/admin/registrations?${params.toString()}`, { signal: controller.signal })
      .then((body) => {
        if (!active) return
        setState({ status: 'success', items: body.data, meta: body.meta, error: null })
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ status: 'error', items: [], meta: null, error: error.message })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [request, query, campus, page, reloadKey])

  const meta = state.meta
  const summary = meta?.summary
  const isFiltered = Boolean(query) || Boolean(campus)

  return (
    <main id="main" className="admin-main">
      <section className="admin-hero admin-hero--compact admin-hero--desk" aria-labelledby="reg-title">
        <div className="container">
          <div className="admin-hero__top">
            <SectionLabel number="ORG" tone="light">
              PARTICIPANT REGISTRATIONS
            </SectionLabel>
            <div className="admin-hero__links">
              <Link className="admin-hero__public" to="/register">
                PUBLIC REGISTRATION ↗
              </Link>
              <Link className="admin-hero__public" to="/admin">
                ← CONTROL ROOM
              </Link>
            </div>
          </div>
          <h1 id="reg-title" className="display admin-hero__title">
            THE ENTRY <em className="serif">RECORD.</em>
          </h1>
          <p className="admin-hero__lede">
            Every saved C³ registration, connected to its participant account. Search the record
            or filter by campus. This view is organizer-only.
          </p>
        </div>
      </section>

      <section className="section admin-overview admin-overview--manage">
        <div className="container">
          <div className="admin-summary admin-summary--two" aria-label="Registration totals">
            <div className="admin-summary__stat">
              <span>REGISTERED</span>
              <strong>{summary ? String(summary.total).padStart(2, '0') : '—'}</strong>
            </div>
            <div className="admin-summary__stat">
              <span>CAMPUSES</span>
              <strong>{summary ? String(summary.campuses).padStart(2, '0') : '—'}</strong>
            </div>
            <p className="admin-summary__note">
              REGISTRATIONS ARE SAVED IMMEDIATELY. EVENT LOGISTICS REMAIN TBA.
            </p>
          </div>

          <div className="admin-toolbar">
            <label className="ann-search">
              <span className="ann-search__label">SEARCH REGISTRATIONS</span>
              <span className="ann-search__field">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="M12.8 12.8 17 17" />
                </svg>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search name, email or campus"
                  maxLength={100}
                  aria-label="Search registrations"
                />
              </span>
            </label>

            <div className="admin-toolbar__right">
              <label className="reg-campus-filter">
                <span>CAMPUS</span>
                <select
                  value={campus}
                  onChange={(event) => {
                    setCampus(event.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter registrations by campus"
                >
                  <option value="">ALL CAMPUSES</option>
                  {(meta?.campuses || []).map((item) => (
                    <option key={item} value={item}>
                      {item.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="reg-table" aria-busy={state.status === 'loading'}>
            <div className="reg-table__head">
              <span>REFERENCE</span>
              <span>PARTICIPANT</span>
              <span>CAMPUS</span>
              <span>REGISTERED</span>
              <span>STATUS</span>
            </div>

            {state.status === 'loading' && state.items.length === 0 && <RowsSkeleton />}

            {state.status === 'error' && (
              <div className="admin-state" role="alert">
                <span className="admin-state__label">ENTRY RECORD / UNREACHABLE</span>
                <h3>We could not load the registrations.</h3>
                <p>{state.error}</p>
                <button
                  className="ann-action"
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  TRY AGAIN ↻
                </button>
              </div>
            )}

            {state.status === 'success' && state.items.length === 0 && (
              <div className="admin-empty-state">
                <span className="admin-empty-state__label">ENTRY RECORD / NO MATCH</span>
                <h3>{isFiltered ? 'Nothing matches this view.' : 'No one has registered yet.'}</h3>
                <p>
                  {isFiltered
                    ? 'Clear the search or campus filter to see every registration.'
                    : 'Registrations will appear here as participants complete the public desk.'}
                </p>
                {isFiltered && (
                  <button
                    className="ann-action ann-action--ghost"
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      setQuery('')
                      setCampus('')
                      setPage(1)
                    }}
                  >
                    CLEAR THE VIEW ↺
                  </button>
                )}
              </div>
            )}

            {state.items.map((item) => (
              <article className="reg-row" key={item.id}>
                <span className="reg-row__reference">{item.reference}</span>
                <span className="reg-row__person">
                  <strong>{item.fullName}</strong>
                  <small>{item.email}</small>
                </span>
                <span className="reg-row__campus">{item.campus}</span>
                <span className="reg-row__date">{formatDate(item.createdAt)}</span>
                <span className="reg-row__status">
                  <span className="status-dot" aria-hidden="true" />
                  REGISTERED
                </span>
              </article>
            ))}
          </div>

          {meta && meta.total > 0 && (
            <div className="admin-pagination">
              <button
                type="button"
                className="ann-page"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                ← PREV
              </button>
              <span>
                PAGE {meta.page} OF {meta.totalPages} · {meta.total} REGISTRATION
                {meta.total === 1 ? '' : 'S'}
              </span>
              <button
                type="button"
                className="ann-page"
                onClick={() => setPage((current) => current + 1)}
                disabled={!meta.hasMore}
              >
                NEXT →
              </button>
            </div>
          )}

          <p className="admin-note">
            ORGANIZER VIEW · PARTICIPANT EMAILS ARE NOT EXPOSED ON PUBLIC PAGES.
          </p>
        </div>
      </section>
    </main>
  )
}
