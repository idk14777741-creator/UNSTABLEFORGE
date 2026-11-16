import { useEffect, useRef, useState } from 'react'
import { Link, useRoute } from '../../lib/router'
import { useAuth } from '../../context/AuthContext'
import SectionLabel from '../../components/SectionLabel'
import ConfirmDialog from '../../components/ConfirmDialog'
import { CATEGORIES, formatDate } from '../../data/announcements'

const STATUS_FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'published', label: 'PUBLISHED' },
  { id: 'draft', label: 'DRAFTS' },
]

function savedMessage(value) {
  if (value === 'created') {
    return { type: 'success', text: 'DISPATCH CREATED. IT IS NOW IN THE EVENT RECORD.' }
  }
  if (value === 'updated') {
    return { type: 'success', text: 'DISPATCH UPDATED. THE PUBLIC RECORD REFLECTS THE CHANGE.' }
  }
  if (value === '1') {
    return { type: 'success', text: 'DISPATCH SAVED TO THE FORGE.' }
  }
  return null
}

function AdminRowsSkeleton() {
  return Array.from({ length: 4 }, (_, index) => (
    <div className="admin-row admin-row--skeleton" key={index} aria-hidden="true">
      <span className="ann-skeleton admin-skeleton--badge" />
      <span className="admin-row__title">
        <span className="ann-skeleton admin-skeleton--title" />
        <span className="ann-skeleton admin-skeleton--slug" />
      </span>
      <span className="ann-skeleton admin-skeleton--short" />
      <span className="admin-row__dates">
        <span className="ann-skeleton admin-skeleton--short" />
        <span className="ann-skeleton admin-skeleton--tiny" />
      </span>
      <span className="ann-skeleton admin-skeleton--actions" />
    </div>
  ))
}

export default function AdminAnnouncements() {
  const { request } = useAuth()
  const { search } = useRoute()
  const initial = useRef({
    search: new URLSearchParams(search).get('q') || '',
  })

  const [searchInput, setSearchInput] = useState(initial.current.search)
  const [query, setQuery] = useState(initial.current.search)
  const [status, setStatus] = useState('all')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null })
  const [busyId, setBusyId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(() =>
    savedMessage(new URLSearchParams(search).get('saved')),
  )
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
    setNotice(null)
    try {
      await request(`/api/announcements/${item.id}`, {
        method: 'PATCH',
        body: { isPublished: !item.isPublished },
      })
      setNotice({
        type: 'success',
        text: item.isPublished
          ? `“${item.title}” IS NOW A PRIVATE DRAFT.`
          : `“${item.title}” IS NOW PUBLIC ON THE EVENT SITE.`,
      })
      setReloadKey((key) => key + 1)
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusyId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    setActionError(null)
    try {
      await request(`/api/announcements/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      setNotice({ type: 'success', text: 'DISPATCH DELETED FROM THE RECORD.' })
      if (state.items.length === 1 && page > 1) setPage((current) => current - 1)
      else setReloadKey((key) => key + 1)
    } catch (error) {
      setDeleteTarget(null)
      setActionError(error.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const meta = state.meta
  const summary = meta?.summary || null

  return (
    <main id="main" className="admin-main">
      <section
        className="admin-hero admin-hero--compact admin-hero--desk"
        aria-labelledby="manage-title"
      >
        <div className="container">
          <div className="admin-hero__top">
            <SectionLabel number="ORG" tone="light">
              DISPATCH MANAGEMENT
            </SectionLabel>
            <div className="admin-hero__links">
              <Link className="admin-hero__public" to="/announcements">
                PUBLIC ARCHIVE <span aria-hidden="true">↗</span>
              </Link>
              <Link className="admin-hero__public" to="/admin">
                ← CONTROL ROOM
              </Link>
            </div>
          </div>
          <h1 id="manage-title" className="display admin-hero__title">
            MANAGE THE <em className="serif">RECORD.</em>
          </h1>
          <p className="admin-hero__lede">
            Publish, draft, edit and retire the announcements that appear on the public event
            site. Every action writes to the live event record.
          </p>
        </div>
      </section>

      <section className="section admin-overview admin-overview--manage">
        <div className="container">
          {notice && (
            <div className={`admin-flash admin-flash--${notice.type}`} role="status">
              <span>{notice.text}</span>
              <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss message">
                DISMISS ×
              </button>
            </div>
          )}

          {actionError && (
            <div className="admin-flash admin-flash--error" role="alert">
              <span>{actionError}</span>
              <button
                type="button"
                onClick={() => setActionError(null)}
                aria-label="Dismiss error"
              >
                DISMISS ×
              </button>
            </div>
          )}

          <div className="admin-summary" aria-label="Announcement totals">
            <div className="admin-summary__stat">
              <span>ALL DISPATCHES</span>
              <strong>{summary ? String(summary.total).padStart(2, '0') : '—'}</strong>
            </div>
            <div className="admin-summary__stat">
              <span>PUBLIC</span>
              <strong>{summary ? String(summary.published).padStart(2, '0') : '—'}</strong>
            </div>
            <div className="admin-summary__stat">
              <span>DRAFTS</span>
              <strong>{summary ? String(summary.drafts).padStart(2, '0') : '—'}</strong>
            </div>
            <p className="admin-summary__note">
              PUBLICATION IS THE SWITCH BETWEEN THE PRIVATE DESK AND THE PUBLIC FORGE.
            </p>
          </div>

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
              <span>PUBLICATION</span>
              <span>ACTIONS</span>
            </div>

            {state.status === 'loading' && state.items.length === 0 && <AdminRowsSkeleton />}

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
              <div className="admin-empty-state">
                <span className="admin-empty-state__label">RECORD / NO MATCH</span>
                <h3>
                  {query || status !== 'all'
                    ? 'Nothing matches this view.'
                    : 'The record is still empty.'}
                </h3>
                <p>
                  {query || status !== 'all'
                    ? 'Clear the search or status filter to see every dispatch.'
                    : 'Create the first dispatch to start publishing the event record.'}
                </p>
                {query || status !== 'all' ? (
                  <button
                    className="ann-action ann-action--ghost"
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      setQuery('')
                      setStatus('all')
                      setPage(1)
                    }}
                  >
                    CLEAR THE VIEW <span aria-hidden="true">↺</span>
                  </button>
                ) : (
                  <Link className="ann-action" to="/admin/announcements/new">
                    WRITE THE FIRST DISPATCH
                  </Link>
                )}
              </div>
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
                <span className="admin-row__dates">
                  <span>
                    <small>PUBLISHED</small>
                    {item.publishedAt ? formatDate(item.publishedAt) : '—'}
                  </span>
                  <span>
                    <small>EDITED</small>
                    {formatDate(item.updatedAt)}
                  </span>
                </span>
                <span className="admin-row__actions">
                  <button
                    type="button"
                    className="admin-row__action"
                    onClick={() => togglePublished(item)}
                    disabled={busyId === item.id}
                    aria-label={`${item.isPublished ? 'Unpublish' : 'Publish'} ${item.title}`}
                  >
                    {busyId === item.id
                      ? 'SAVING…'
                      : item.isPublished
                        ? 'UNPUBLISH'
                        : 'PUBLISH'}
                  </button>
                  <Link
                    className="admin-row__action"
                    to={`/admin/announcements/${item.id}/edit`}
                    aria-label={`Edit ${item.title}`}
                  >
                    EDIT
                  </Link>
                  <button
                    type="button"
                    className="admin-row__action admin-row__action--danger"
                    onClick={() => {
                      setActionError(null)
                      setDeleteTarget(item)
                    }}
                    disabled={busyId === item.id}
                    aria-label={`Delete ${item.title}`}
                  >
                    DELETE
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
                PAGE {meta.page} OF {meta.totalPages} · {meta.total} DISPATCH
                {meta.total === 1 ? '' : 'ES'}
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

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        kicker="DELETE / IRREVERSIBLE"
        title={
          <>
            RETIRE THIS <em className="serif">DISPATCH?</em>
          </>
        }
        confirmLabel="DELETE DISPATCH"
        busyLabel="DELETING…"
        busy={deleteBusy}
        onCancel={() => {
          if (!deleteBusy) setDeleteTarget(null)
        }}
        onConfirm={confirmDelete}
      >
        {deleteTarget && (
          <>
            <p>
              <strong>{deleteTarget.title}</strong> will be removed from the event record. If it
              is published, it will disappear from the public site immediately.
            </p>
            <p className="confirm__meta">
              /{deleteTarget.slug} · {deleteTarget.isPublished ? 'PUBLIC' : 'DRAFT'} ·{' '}
              {deleteTarget.category.toUpperCase()}
            </p>
            <p className="confirm__warning">THIS ACTION CANNOT BE UNDONE.</p>
          </>
        )}
      </ConfirmDialog>
    </main>
  )
}
