import { useEffect, useRef, useState } from 'react'
import { Link } from '../lib/router'
import { apiGet } from '../lib/api'
import { brand } from '../data/site'
import { PROJECT_CATEGORIES, categorySlug, projectInitial } from '../data/projects'
import SectionLabel from '../components/SectionLabel'

const PAGE_SIZE = 9
const FILTERS = ['All', ...PROJECT_CATEGORIES]

function readInitialFilters() {
  const params = new URLSearchParams(window.location.search)
  const category = params.get('category')
  const page = Number(params.get('page'))
  return {
    search: params.get('q') || '',
    category: FILTERS.includes(category) ? category : 'All',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function ProjectCard({ item, index }) {
  const publication = item.publishedAt
    ? new Date(item.publishedAt).getFullYear()
    : 'C³'

  return (
    <Link
      className={`project-card project-card--${(index % 5) + 1}`}
      to={`/projects/${item.slug}`}
      data-category={categorySlug(item.category)}
    >
      <span className="project-card__visual" aria-hidden="true">
        {item.coverImageUrl ? (
          <img
            src={item.coverImageUrl}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            onError={(event) => {
              event.currentTarget.style.display = 'none'
              event.currentTarget.parentElement.classList.add('is-missing')
            }}
          />
        ) : null}
        <span className="project-card__glyph">{projectInitial(item.title)}</span>
        <span className="project-card__visual-index">
          {String(index).padStart(2, '0')} / {publication}
        </span>
      </span>

      <span className="project-card__body">
        <span className="project-card__top">
          <span className="project-card__category">{item.category}</span>
          <span className="project-card__arrow" aria-hidden="true">
            ↗
          </span>
        </span>
        <strong className="project-card__title">{item.title}</strong>
        <span className="project-card__tagline">{item.tagline}</span>
        <span className="project-card__tech">
          {(item.technologies || []).slice(0, 4).map((technology) => (
            <span key={technology}>{technology}</span>
          ))}
          {(item.technologies || []).length > 4 ? (
            <span>+{item.technologies.length - 4}</span>
          ) : null}
        </span>
        <span className="project-card__foot">
          <span>{item.teamName || 'C³ PARTICIPANT'}</span>
          <span>VIEW PROJECT</span>
        </span>
      </span>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="project-card project-card--skeleton" aria-hidden="true">
      <span className="project-skeleton project-skeleton--visual" />
      <span className="project-card__body">
        <span className="ann-skeleton ann-skeleton--short" />
        <span className="ann-skeleton ann-skeleton--title" />
        <span className="ann-skeleton" />
        <span className="ann-skeleton ann-skeleton--medium" />
      </span>
    </div>
  )
}

export default function ProjectsPage() {
  const initial = useRef(readInitialFilters())
  const [search, setSearch] = useState(initial.current.search)
  const [query, setQuery] = useState(initial.current.search)
  const [category, setCategory] = useState(initial.current.category)
  const [page, setPage] = useState(initial.current.page)
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState({ status: 'loading', items: [], meta: null, error: null })

  useEffect(() => {
    document.title = 'Project Showcase — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setQuery(search.trim())
      setPage(1)
    }, 350)
    return () => window.clearTimeout(timer)
  }, [search])

  useEffect(() => {
    const controller = new AbortController()
    const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) })
    if (query) params.set('q', query)
    if (category !== 'All') params.set('category', category)

    setResult((current) => ({ ...current, status: 'loading', error: null }))

    apiGet(`/api/projects?${params.toString()}`, { signal: controller.signal })
      .then((body) => {
        setResult({ status: 'success', items: body.data, meta: body.meta, error: null })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setResult({ status: 'error', items: [], meta: null, error: error.message })
      })

    return () => controller.abort()
  }, [query, category, page, reloadKey])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category !== 'All') params.set('category', category)
    if (page > 1) params.set('page', String(page))
    const searchString = params.toString()
    window.history.replaceState(null, '', `/projects${searchString ? `?${searchString}` : ''}`)
  }, [query, category, page])

  const meta = result.meta
  const isFiltered = Boolean(query) || category !== 'All'

  return (
    <main id="main" className="projects-main">
      <section className="projects-hero" aria-labelledby="projects-title">
        <span className="projects-hero__watermark" aria-hidden="true">
          IDEAS
        </span>
        <div className="container">
          <div className="projects-hero__top">
            <SectionLabel number="C³" tone="light">
              PROJECT SHOWCASE
            </SectionLabel>
            <span className="projects-hero__state">
              <span className="status-dot" aria-hidden="true" />
              PUBLIC GALLERY / {meta ? String(meta.total).padStart(2, '0') : '—'} LIVE
            </span>
          </div>

          <h1 id="projects-title" className="display projects-hero__title">
            IDEAS,
            <br />
            <em className="serif">MADE REAL.</em>
          </h1>

          <div className="projects-hero__foot">
            <p>
              Work made inside the forge. Every project here was submitted by a C³ participant
              and published after organizer review. Explore what they built, how they built it,
              and where it lives.
            </p>
            <span className="projects-hero__stamp">
              {brand.event}
              <br />
              CURATED / NOT AUTO-PUBLISHED
            </span>
          </div>
        </div>
      </section>

      <section className="section projects-index" aria-labelledby="projects-index-title">
        <div className="container">
          <div className="projects-index__intro">
            <div>
              <p className="projects-kicker">THE EXHIBITION</p>
              <h2 id="projects-index-title" className="display projects-index__title">
                WORK WORTH <em className="serif">A CLOSER LOOK.</em>
              </h2>
            </div>
            <div className="projects-index__aside">
              <p>
                No placeholder exhibits. The gallery grows as participants submit real projects
                and organizers release them for public viewing.
              </p>
              <Link className="text-link projects-submit-link" to="/projects/submit">
                SUBMIT YOUR PROJECT ↗
              </Link>
            </div>
          </div>

          <div className="projects-toolbar">
            <label className="ann-search projects-search">
              <span className="ann-search__label">SEARCH THE EXHIBITION</span>
              <span className="ann-search__field">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="M12.8 12.8 17 17" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search title, team, technology"
                  maxLength={100}
                  aria-label="Search projects"
                />
              </span>
            </label>

            <div className="ann-filters projects-filters" aria-label="Filter by category">
              {FILTERS.map((filter) => (
                <button
                  key={filter}
                  className={`ann-filter ${category === filter ? 'is-active' : ''}`}
                  type="button"
                  onClick={() => {
                    setCategory(filter)
                    setPage(1)
                  }}
                  aria-pressed={category === filter}
                >
                  {filter.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="projects-results" aria-busy={result.status === 'loading'}>
            <div className="projects-results__meta">
              <span>
                {result.status === 'loading'
                  ? 'READING THE WALL…'
                  : `${String(meta?.total ?? 0).padStart(2, '0')} PROJECT${
                      meta?.total === 1 ? '' : 'S'
                    } ON DISPLAY`}
              </span>
              <span>
                {query ? `QUERY / ${query.toUpperCase()}` : 'ALL CATEGORIES'} · PAGE{' '}
                {meta?.page ?? page}
              </span>
            </div>

            {result.status === 'loading' && result.items.length === 0 && (
              <div className="projects-grid">
                {Array.from({ length: 6 }, (_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            )}

            {result.status === 'error' && (
              <div className="projects-state" role="alert">
                <span className="projects-state__label">GALLERY / UNREACHABLE</span>
                <h3 className="display">THE WALL IS OUT OF REACH.</h3>
                <p>{result.error}</p>
                <button
                  className="ann-action"
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  TRY AGAIN ↻
                </button>
              </div>
            )}

            {result.status === 'success' && result.items.length === 0 && (
              <div className="projects-state projects-state--empty">
                <span className="projects-state__label">
                  {isFiltered ? 'GALLERY / NO MATCH' : 'GALLERY / AWAITING WORK'}
                </span>
                <h3 className="display">
                  {isFiltered ? 'NOTHING ON THIS WALL.' : 'THE FIRST EXHIBITS ARE COMING.'}
                </h3>
                <p>
                  {isFiltered
                    ? 'Try another search or category. Only projects released by an organizer appear here.'
                    : 'Participants can submit a project from their project desk. Organizers review every submission before it enters the public showcase.'}
                </p>
                {isFiltered ? (
                  <button
                    className="ann-action ann-action--ghost"
                    type="button"
                    onClick={() => {
                      setSearch('')
                      setQuery('')
                      setCategory('All')
                      setPage(1)
                    }}
                  >
                    CLEAR THE VIEW ↺
                  </button>
                ) : (
                  <div className="projects-state__actions">
                    <Link className="ann-action" to="/projects/submit">
                      SUBMIT A PROJECT
                    </Link>
                    <Link className="ann-action ann-action--ghost" to="/register">
                      REGISTER FOR C³
                    </Link>
                  </div>
                )}
              </div>
            )}

            {result.items.length > 0 && (
              <div
                className={`projects-grid projects-grid--${Math.min(result.items.length, 4)}`}
              >
                {result.items.map((item, index) => (
                  <ProjectCard
                    key={item.id}
                    item={item}
                    index={(page - 1) * PAGE_SIZE + index + 1}
                  />
                ))}
              </div>
            )}
          </div>

          {meta && meta.total > 0 && (
            <div className="ann-pagination projects-pagination">
              <button
                className="ann-page"
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                ← PREV
              </button>
              <span className="ann-pagination__summary">
                PAGE {meta.page} OF {meta.totalPages} · {meta.total} PROJECT
                {meta.total === 1 ? '' : 'S'}
              </span>
              <button
                className="ann-page"
                type="button"
                onClick={() => setPage((current) => current + 1)}
                disabled={!meta.hasMore}
              >
                NEXT →
              </button>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
