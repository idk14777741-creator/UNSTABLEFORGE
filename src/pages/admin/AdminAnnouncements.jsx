import { useEffect, useRef, useState } from 'react'
import { Link, navigate, useRoute } from '../../lib/router'
import { useAuth } from '../../context/AuthContext'
import SectionLabel from '../../components/SectionLabel'
import { CATEGORIES, formatDate } from '../../data/announcements'

const STATUS_FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'published', label: 'PUBLISHED' },
  { id: 'draft', label: 'DRAFTS' },
]

export default function AdminAnnouncements() {
  const { request } = useAuth()
  const { search } = useRoute()
  const saved = new URLSearchParams(search).get('saved') === '1'
  const initial = useRef({
    search: new URLSearchParams(search).get('q') || '',
    status: 'all',
    page: 1,
  })

  const [searchInput, setSearchInput] = useState(initial.current.search)
  const [query, setQuery] = useState(initial.current.search)
  const [status, setStatus] = useState(initial.current.status)
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null })
  const [busyId, setBusyId] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    document.title = 'Manage updates — Unstable Forge'
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
    const params = new URLSearchParams({ page: String(page), limit: '8', status })
    if (query) params.set('q', query)

    setState((current) => ({ ...current, status: 'loading', error: null }))

    request(`/api/admin/announcements?${params.toString()}`, { signal: controller.signal })
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
  }, [request, query, status, page, reloadKey])

  const togglePublished = async (item) => {
    setBusyId(item.id)
    setActionError(null)
    try {
      await request(`/api/announcements/${item.id}`, {
        method: 'PATCH',
        body: { isPublished: !item.isPublished },
      })
      setReloadKey((key) => key + 1)
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (item) => {
    if (confirmId !== item.id) {
      setConfirmId(item.id)
      return
    }

    setBusyId(item.id)
    setActionError(null)
    try {
      await request(`/api/announcements/${item.id}`, { method: 'DELETE' })
      setConfirmId(null)
      setReloadKey((key) => key + 1)
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusyId(null)
    }
  }

  const meta = state.meta
  const totalPages = meta?.totalPages ?? 1

  return (
    <main id="main" className="admin-main">
      <section className="admin-hero admin-hero--compact" aria-labelledby="manage-title">
        <div className="container">
          <div className="admin-hero__top">
            <SectionLabel number="ORG" tone="light">
              DISPATCH MANAGEMENT
            </SectionLabel>
            <Link className="admin-hero__public" to="/admin">
              ← CONTROL ROOM
            </Link>
          </div>
          <h1 id="manage-title" className="display admin-hero__title">
            MANAGE THE <em className="serif">RECORD.</em>
          </h1>
          <p className="admin-hero__lede">
            Publish, draft, edit and retire the announcements that appear on the public event
            site.
          </p>
        </div>
      </section>

      <section className="section admin-overview">
        <div className="container">
          {saved && (
            <p className="admin-flash" role="status">
              UPDATE SAVED TO THE FORGE.
            </p>
          )}

          {actionError && (
            <p className="admin-flash admin-flash--error" role="alert">
              {actionError}
            </p>
          )}

          <div className="admin-toolbar">
            <label className="ann-search">
              <span className="ann-search__label">SEARCH ALL ANNOUNCEMENTS</span>
              <span className="ann-search__field">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="M12.8 12.8 17 17" />
                </svg>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search drafts and published updates"
                  maxLength={100}
                  aria-label="Search all announcements"
                />
              </span>
            </label>

            <div className="admin-toolbar__right">
              <div className="ann-filters" role="group" aria-label="Filter by publication status">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    type="button"
                    className={`ann-filter ${status === filter.id ? 'is-active' : ''}`}
                    aria-pressed={status === filter.id}
                    onClick={() => {
                      setStatus(filter.id)
                      setPage(1)
                    }}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
              <Link className="ann-action admin-new" to="/admin/announcements/new">
                NEW DISPATCH <span aria-hidden="true">+</span>
              </Link>
            </div>
          </div>

          <div className="admin-table" aria-busy={state.status === 'loading'}>
            <div className="admin-table__head">
              <span>STATUS</span>
              <span>UPDATE</span>
              <span>CATEGORY</span>
              <span>UPDATED</span>
              <span>ACTIONS</span>
            </div>

            {state.status === 'loading' && state.items.length === 0 && (
              <p className="admin-empty">Loading the announcement record…</p>
            )}

            {state.status === 'error' && (
              <div className="admin-state" role="alert">
                <span className="admin-state__label">RECORD / UNREACHABLE</span>
                <h3>We could not load the announcements.</h3>
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
              <p className="admin-empty">
                {query || status !== 'all'
                  ? 'No announcements match this filter.'
                  : 'No announcements exist yet.'}
              </p>
            )}

            {state.items.map((item) => (
              <article className="admin-row" key={item.id}>
                <span>
                  <span className={`admin-status ${item.isPublished ? 'is-public' : 'is-draft'}`}>
                    {item.isPublished ? 'PUBLIC' : 'DRAFT'}
                  </span>
                </span>
                <span className="admin-row__title">
                  <Link
                    to={
                      item.isPublished
                        ? `/announcements/${item.slug}`
                        : `/admin/announcements/${item.id}/edit`
                    }
                  >
                    {item.title}
                  </Link>
                  <small>/{item.slug}</small>
                </span>
                <span className="admin-row__category">{item.category}</span>
                <span className="admin-row__date">
                  {formatDate(item.updatedAt || item.publishedAt)}
                </span>
                <span className="admin-row__actions">
                  <button
                    type="button"
                    className="admin-row__action"
                    onClick={() => togglePublished(item)}
                    disabled={busyId === item.id}
                  >
                    {busyId === item.id
                      ? 'SAVING…'
                      : item.isPublished
                        ? 'UNPUBLISH'
                        : 'PUBLISH'}
                  </button>
                  <button
                    type="button"
                    className="admin-row__action"
                    onClick={() => {
                      navigate(`/admin/announcements/${item.id}/edit`)
                    }}
                  >
                    EDIT
                  </button>
                  <button
                    type="button"
                    className={`admin-row__action admin-row__action--danger ${
                      confirmId === item.id ? 'is-confirming' : ''
                    }`}
                    onClick={() => remove(item)}
                    onBlur={() => setConfirmId(null)}
                    disabled={busyId === item.id}
                  >
                    {confirmId === item.id ? 'CONFIRM?' : 'DELETE'}
                  </button>
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
                PAGE {meta.page} OF {meta.totalPages} · {meta.total} UPDATES
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
            CATEGORIES: {CATEGORIES.filter((item) => item !== 'All').join(' · ').toUpperCase()}
          </p>
        </div>
      </section>
    </main>
  )
}
