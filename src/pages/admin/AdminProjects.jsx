import { useEffect, useState } from 'react'
import { Link } from '../../lib/router'
import { useAuth } from '../../context/AuthContext'
import { formatDate } from '../../data/announcements'
import {
  PROJECT_CATEGORIES,
  descriptionParagraphs,
  projectHost,
  statusMeta,
} from '../../data/projects'
import SectionLabel from '../../components/SectionLabel'

const STATUS_FILTERS = [
  { id: 'all', label: 'ALL' },
  { id: 'submitted', label: 'IN REVIEW' },
  { id: 'published', label: 'PUBLISHED' },
  { id: 'draft', label: 'DRAFTS' },
  { id: 'rejected', label: 'REJECTED' },
]

const ACTIONS = {
  submitted: [
    { label: 'PUBLISH', status: 'published', tone: 'primary' },
    { label: 'REJECT', status: 'rejected', tone: 'danger' },
  ],
  published: [{ label: 'UNPUBLISH', status: 'submitted', tone: 'ghost' }],
  rejected: [{ label: 'RETURN TO REVIEW', status: 'submitted', tone: 'ghost' }],
  draft: [],
}

function RowsSkeleton() {
  return Array.from({ length: 4 }, (_, index) => (
    <div className="admin-project-row admin-project-row--skeleton" key={index} aria-hidden="true">
      <span className="ann-skeleton ann-skeleton--short" />
      <span className="ann-skeleton ann-skeleton--title" />
      <span className="ann-skeleton ann-skeleton--medium" />
      <span className="ann-skeleton ann-skeleton--short" />
    </div>
  ))
}

export default function AdminProjects() {
  const { request } = useAuth()
  const [searchInput, setSearchInput] = useState('')
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [state, setState] = useState({ status: 'loading', items: [], meta: null, error: null })
  const [busyId, setBusyId] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(null)

  useEffect(() => {
    document.title = 'Moderate projects — Unstable Forge'
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
    if (category) params.set('category', category)

    setState((current) => ({ ...current, status: 'loading', error: null }))

    request(`/api/admin/projects?${params.toString()}`, { signal: controller.signal })
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
  }, [request, query, status, category, page, reloadKey])

  const moderate = async (item, nextStatus) => {
    setBusyId(item.id)
    setActionError(null)
    setNotice(null)
    try {
      await request(`/api/admin/projects/${item.id}`, {
        method: 'PATCH',
        body: { status: nextStatus },
      })
      setNotice(
        nextStatus === 'published'
          ? `“${item.title}” IS NOW PUBLIC IN THE SHOWCASE.`
          : nextStatus === 'rejected'
            ? `“${item.title}” WAS NOT PUBLISHED.`
            : `“${item.title}” RETURNED TO REVIEW.`,
      )
      setReloadKey((key) => key + 1)
    } catch (error) {
      setActionError(error.message)
    } finally {
      setBusyId(null)
    }
  }

  const summary = state.meta?.summary
  const isFiltered = Boolean(query) || status !== 'all' || Boolean(category)

  return (
    <main id="main" className="admin-main">
      <section className="admin-hero admin-hero--compact admin-hero--desk" aria-labelledby="admin-projects-title">
        <div className="container">
          <div className="admin-hero__top">
            <SectionLabel number="ORG" tone="light">
              PROJECT MODERATION
            </SectionLabel>
            <div className="admin-hero__links">
              <Link className="admin-hero__public" to="/projects">
                PUBLIC SHOWCASE ↗
              </Link>
              <Link className="admin-hero__public" to="/admin">
                ← CONTROL ROOM
              </Link>
            </div>
          </div>
          <h1 id="admin-projects-title" className="display admin-hero__title">
            THE CURATOR&apos;S <em className="serif">WALL.</em>
          </h1>
          <p className="admin-hero__lede">
            Review participant submissions and decide what enters the public exhibition. A
            project stays private until it is published here.
          </p>
        </div>
      </section>

      <section className="section admin-overview admin-overview--manage">
        <div className="container">
          <div className="admin-summary admin-summary--projects" aria-label="Project totals">
            <div className="admin-summary__stat">
              <span>ALL PROJECTS</span>
              <strong>{summary ? String(summary.total).padStart(2, '0') : '—'}</strong>
            </div>
            <div className="admin-summary__stat">
              <span>IN REVIEW</span>
              <strong>{summary ? String(summary.submitted).padStart(2, '0') : '—'}</strong>
            </div>
            <div className="admin-summary__stat">
              <span>PUBLISHED</span>
              <strong>{summary ? String(summary.published).padStart(2, '0') : '—'}</strong>
            </div>
            <div className="admin-summary__stat">
              <span>REJECTED</span>
              <strong>{summary ? String(summary.rejected).padStart(2, '0') : '—'}</strong>
            </div>
            <p className="admin-summary__note">
              PUBLICATION IS MANUAL · OWNER EMAILS NEVER APPEAR ON PUBLIC PAGES.
            </p>
          </div>

          <div className="admin-toolbar">
            <label className="ann-search">
              <span className="ann-search__label">SEARCH SUBMISSIONS</span>
              <span className="ann-search__field">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="M12.8 12.8 17 17" />
                </svg>
                <input
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Search title, team, stack or owner"
                  maxLength={100}
                  aria-label="Search project submissions"
                />
              </span>
            </label>

            <div className="admin-toolbar__right project-admin-filters">
              <label className="reg-campus-filter">
                <span>CATEGORY</span>
                <select
                  value={category}
                  onChange={(event) => {
                    setCategory(event.target.value)
                    setPage(1)
                  }}
                  aria-label="Filter projects by category"
                >
                  <option value="">ALL CATEGORIES</option>
                  {PROJECT_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item.toUpperCase()}
                    </option>
                  ))}
                </select>
              </label>
              <div className="ann-filters">
                {STATUS_FILTERS.map((filter) => (
                  <button
                    key={filter.id}
                    className={`ann-filter ${status === filter.id ? 'is-active' : ''}`}
                    type="button"
                    onClick={() => {
                      setStatus(filter.id)
                      setPage(1)
                    }}
                    aria-pressed={status === filter.id}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {notice && (
            <div className="admin-flash" role="status">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)}>
                DISMISS
              </button>
            </div>
          )}

          {actionError && (
            <div className="entry-alert project-admin-error" role="alert">
              {actionError}
            </div>
          )}

          <div className="admin-projects" aria-busy={state.status === 'loading'}>
            <div className="admin-project-row__head" aria-hidden="true">
              <span>PROJECT</span>
              <span>OWNER</span>
              <span>STATE</span>
              <span>UPDATED</span>
              <span>MODERATION</span>
            </div>

            {state.status === 'loading' && state.items.length === 0 && <RowsSkeleton />}

            {state.status === 'error' && (
              <div className="admin-state" role="alert">
                <span className="admin-state__label">PROJECT RECORD / UNREACHABLE</span>
                <h3>We could not load the project record.</h3>
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
                <span className="admin-empty-state__label">
                  {isFiltered ? 'PROJECT RECORD / NO MATCH' : 'PROJECT RECORD / EMPTY'}
                </span>
                <h3>{isFiltered ? 'Nothing matches this view.' : 'No projects have been submitted yet.'}</h3>
                <p>
                  {isFiltered
                    ? 'Clear the search or filters to see the full moderation record.'
                    : 'Participant drafts and submissions will appear here when they are created.'}
                </p>
                {isFiltered && (
                  <button
                    className="ann-action ann-action--ghost"
                    type="button"
                    onClick={() => {
                      setSearchInput('')
                      setQuery('')
                      setStatus('all')
                      setCategory('')
                      setPage(1)
                    }}
                  >
                    CLEAR THE VIEW ↺
                  </button>
                )}
              </div>
            )}

            {state.items.map((item) => {
              const meta = statusMeta(item.status)
              const actions = ACTIONS[item.status] || []
              const expanded = expandedId === item.id
              return (
                <article className={`admin-project-row ${expanded ? 'is-expanded' : ''}`} key={item.id}>
                  <div className="admin-project-row__main">
                    <div className="admin-project-row__project">
                      <button
                        className="admin-project-row__toggle"
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : item.id)}
                        aria-expanded={expanded}
                      >
                        <span>{expanded ? '−' : '+'}</span>
                        <span>
                          <strong>{item.title}</strong>
                          <small>{item.category}</small>
                        </span>
                      </button>
                    </div>

                    <div className="admin-project-row__owner">
                      <strong>{item.teamName || 'C³ participant'}</strong>
                      <small>{item.ownerEmail}</small>
                    </div>

                    <span className={`project-status project-status--${item.status}`}>
                      {meta.label}
                    </span>

                    <span className="admin-project-row__date">{formatDate(item.updatedAt)}</span>

                    <div className="admin-project-row__actions">
                      {actions.map((action) => (
                        <button
                          key={action.status}
                          className={`admin-project-action admin-project-action--${action.tone}`}
                          type="button"
                          onClick={() => moderate(item, action.status)}
                          disabled={busyId === item.id}
                        >
                          {busyId === item.id ? '…' : action.label}
                        </button>
                      ))}
                      {item.status === 'published' && (
                        <Link className="admin-project-action admin-project-action--link" to={`/projects/${item.slug}`}>
                          VIEW ↗
                        </Link>
                      )}
                      {!actions.length && (
                        <span className="admin-project-row__waiting">AWAITING OWNER</span>
                      )}
                    </div>
                  </div>

                  {expanded && (
                    <div className="admin-project-detail">
                      <div className="admin-project-detail__copy">
                        <span className="projects-kicker">SUBMISSION DETAIL</span>
                        <h4>{item.tagline}</h4>
                        {descriptionParagraphs(item.description).map((paragraph, index) => (
                          <p key={index}>{paragraph}</p>
                        ))}
                      </div>
                      <dl className="admin-project-detail__facts">
                        <div>
                          <dt>TECHNOLOGIES</dt>
                          <dd>{item.technologies.join(' · ')}</dd>
                        </div>
                        <div>
                          <dt>CREATED</dt>
                          <dd>{formatDate(item.createdAt)}</dd>
                        </div>
                        <div>
                          <dt>PUBLISHED</dt>
                          <dd>{formatDate(item.publishedAt)}</dd>
                        </div>
                        {item.repoUrl && (
                          <div>
                            <dt>REPOSITORY</dt>
                            <dd>
                              <a href={item.repoUrl} target="_blank" rel="noopener noreferrer">
                                {projectHost(item.repoUrl)} ↗
                              </a>
                            </dd>
                          </div>
                        )}
                        {item.demoUrl && (
                          <div>
                            <dt>LIVE DEMO</dt>
                            <dd>
                              <a href={item.demoUrl} target="_blank" rel="noopener noreferrer">
                                {projectHost(item.demoUrl)} ↗
                              </a>
                            </dd>
                          </div>
                        )}
                      </dl>
                    </div>
                  )}
                </article>
              )
            })}
          </div>

          {state.meta && state.meta.total > 0 && (
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
                PAGE {state.meta.page} OF {state.meta.totalPages} · {state.meta.total} PROJECT
                {state.meta.total === 1 ? '' : 'S'}
              </span>
              <button
                type="button"
                className="ann-page"
                onClick={() => setPage((current) => current + 1)}
                disabled={!state.meta.hasMore}
              >
                NEXT →
              </button>
            </div>
          )}

          <p className="admin-note">
            ORGANIZER VIEW · MODERATION WRITES THROUGH THE AUTHENTICATED API.
          </p>
        </div>
      </section>
    </main>
  )
}
