import { useEffect, useRef, useState } from 'react'
import { Link } from '../lib/router'
import { apiGet } from '../lib/api'
import { CATEGORIES, PAGE_SIZE, formatDate } from '../data/announcements'
import { brand } from '../data/site'
import SectionLabel from '../components/SectionLabel'

function readInitialFilters() {
  const params = new URLSearchParams(window.location.search)
  const category = params.get('category')
  const page = Number(params.get('page'))
  return {
    search: params.get('q') || '',
    category: CATEGORIES.includes(category) ? category : 'All',
    page: Number.isInteger(page) && page > 0 ? page : 1,
  }
}

function pageList(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1)
  const pages = [1]
  for (let page = current - 1; page <= current + 1; page += 1) {
    if (page > 1 && page < total) pages.push(page)
  }
  pages.push(total)
  return pages
}

function AnnouncementCard({ item, index }) {
  return (
    <Link className="ann-card" to={`/announcements/${item.slug}`}>
      <span className="ann-card__top">
        <span className="ann-card__index">{String(index).padStart(2, '0')}</span>
        <span className="ann-card__category">{item.category}</span>
      </span>
      <time className="ann-card__date" dateTime={item.publishedAt || undefined}>
        {formatDate(item.publishedAt)}
      </time>
      <h3 className="ann-card__title">{item.title}</h3>
      <p className="ann-card__excerpt">{item.excerpt}</p>
      <span className="ann-card__more">
        READ UPDATE <span aria-hidden="true">↗</span>
      </span>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="ann-card ann-card--skeleton" aria-hidden="true">
      <span className="ann-skeleton ann-skeleton--short" />
      <span className="ann-skeleton ann-skeleton--medium" />
      <span className="ann-skeleton ann-skeleton--title" />
      <span className="ann-skeleton" />
      <span className="ann-skeleton ann-skeleton--short" />
    </div>
  )
}

export default function AnnouncementsPage() {
  const initial = useRef(readInitialFilters())
  const [search, setSearch] = useState(initial.current.search)
  const [query, setQuery] = useState(initial.current.search)
  const [category, setCategory] = useState(initial.current.category)
  const [page, setPage] = useState(initial.current.page)
  const [reloadKey, setReloadKey] = useState(0)
  const [result, setResult] = useState({
    status: 'loading',
    items: [],
    meta: null,
    error: null,
  })

  useEffect(() => {
    window.document.title = 'Updates — Unstable Forge'
    return () => {
      window.document.title = 'Unstable Forge — C³ Crescent Code Clash'
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

    apiGet(`/api/announcements?${params.toString()}`, { signal: controller.signal })
      .then((body) => {
        setResult({
          status: 'success',
          items: body.data,
          meta: body.meta,
          error: null,
        })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setResult({
          status: 'error',
          items: [],
          meta: null,
          error: error.message,
        })
      })

    return () => controller.abort()
  }, [query, category, page, reloadKey])

  useEffect(() => {
    const params = new URLSearchParams()
    if (query) params.set('q', query)
    if (category !== 'All') params.set('category', category)
    if (page > 1) params.set('page', String(page))
    const searchString = params.toString()
    window.history.replaceState(
      null,
      '',
      `/announcements${searchString ? `?${searchString}` : ''}`,
    )
  }, [query, category, page])

  const meta = result.meta
  const totalPages = meta?.totalPages ?? 1
  const hasMore = meta?.hasMore ?? false
  const offset = meta ? (meta.page - 1) * meta.limit : 0
  const isFiltered = Boolean(query) || category !== 'All'

  const clearFilters = () => {
    setSearch('')
    setQuery('')
    setCategory('All')
    setPage(1)
  }

  return (
    <main id="main" className="ann-main">
      <section className="ann-hero" aria-labelledby="ann-hero-title">
        <span className="ann-hero__watermark" aria-hidden="true">
          DISPATCH
        </span>
        <div className="container ann-hero__inner">
          <div className="ann-hero__top" data-reveal>
            <SectionLabel number="C³" tone="light">
              EVENT UPDATES
            </SectionLabel>
            <span className="ann-hero__status">
              <span className="status-dot" aria-hidden="true" />
              PUBLISHED BY THE ORGANIZERS
            </span>
          </div>

          <h1 id="ann-hero-title" className="display ann-hero__title">
            FROM THE <em className="serif">FORGE.</em>
          </h1>

          <div className="ann-hero__foot">
            <p className="ann-hero__intro">
              Every confirmed decision about C³ — Crescent Code Clash will be published here
              first. Search the archive, follow a category, or start with the latest dispatch.
            </p>
            <p className="ann-hero__stamp">
              {brand.event}
              <br />
              {brand.audience}
            </p>
          </div>
        </div>
      </section>

      <section className="section ann-index" aria-labelledby="ann-index-title">
        <div className="container">
          <div className="ann-index__head">
            <div>
              <p className="ann-index__kicker">THE DISPATCH ARCHIVE</p>
              <h2 id="ann-index-title" className="display ann-index__title">
                LATEST <em className="serif">UPDATES.</em>
              </h2>
            </div>
            <p className="ann-index__aside">
              Only published announcements appear here. If something is still being decided,
              it will say so.
            </p>
          </div>

          <div className="ann-toolbar">
            <label className="ann-search">
              <span className="ann-search__label">SEARCH UPDATES</span>
              <span className="ann-search__field">
                <svg viewBox="0 0 20 20" aria-hidden="true" focusable="false">
                  <circle cx="8.5" cy="8.5" r="5.5" />
                  <path d="M12.8 12.8 17 17" />
                </svg>
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Try “registration”, “tracks”, or “venue”"
                  maxLength={100}
                  aria-label="Search announcements by title or content"
                />
              </span>
            </label>

            <div className="ann-filters" role="group" aria-label="Filter announcements by category">
              {CATEGORIES.map((item) => {
                const active = category === item
                return (
                  <button
                    key={item}
                    type="button"
                    className={`ann-filter ${active ? 'is-active' : ''}`}
                    aria-pressed={active}
                    onClick={() => {
                      setCategory(item)
                      setPage(1)
                    }}
                  >
                    {item.toUpperCase()}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="ann-results" aria-busy={result.status === 'loading'}>
            <div className="ann-results__meta">
              <span>
                {result.status === 'success'
                  ? `${meta.total} ${meta.total === 1 ? 'UPDATE' : 'UPDATES'}`
                  : result.status === 'error'
                    ? 'UNAVAILABLE'
                    : 'LOADING UPDATES'}
              </span>
              <span>
                {query
                  ? `SEARCH / ${query.toUpperCase()}`
                  : category !== 'All'
                    ? `FILTER / ${category.toUpperCase()}`
                    : 'ALL CATEGORIES'}
              </span>
            </div>

            {result.status === 'loading' && (
              <div className="ann-grid" aria-label="Loading announcements">
                {Array.from({ length: 3 }, (_, index) => (
                  <SkeletonCard key={index} />
                ))}
              </div>
            )}

            {result.status === 'error' && (
              <div className="ann-state" role="alert">
                <span className="ann-state__label">CONNECTION / FAILED</span>
                <h3 className="ann-state__title">THE DISPATCH DESK IS UNREACHABLE.</h3>
                <p>{result.error}</p>
                <button
                  className="ann-action"
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  TRY AGAIN <span aria-hidden="true">↻</span>
                </button>
              </div>
            )}

            {result.status === 'success' && result.items.length === 0 && (
              <div className="ann-state">
                <span className="ann-state__label">NO RESULTS</span>
                <h3 className="ann-state__title">NOTHING MATCHES THAT YET.</h3>
                <p>
                  Try a broader search term, or clear the filters to see every published
                  update.
                </p>
                {isFiltered && (
                  <button className="ann-action" type="button" onClick={clearFilters}>
                    CLEAR FILTERS <span aria-hidden="true">↺</span>
                  </button>
                )}
              </div>
            )}

            {result.status === 'success' && result.items.length > 0 && (
              <div className="ann-grid">
                {result.items.map((item, index) => (
                  <AnnouncementCard key={item.id} item={item} index={offset + index + 1} />
                ))}
              </div>
            )}
          </div>

          {result.status === 'success' && meta && meta.total > 0 && (
            <nav className="ann-pagination" aria-label="Announcement pages">
              <button
                type="button"
                className="ann-page ann-page--arrow"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page <= 1}
              >
                <span aria-hidden="true">←</span> PREV
              </button>

              <span className="ann-pagination__summary">
                PAGE {meta.page} OF {meta.totalPages} · SHOWING {offset + 1}–
                {Math.min(offset + meta.limit, meta.total)} OF {meta.total}
              </span>

              <div className="ann-pagination__pages">
                {pageList(meta.page, totalPages).map((item, index, list) => {
                  const previous = list[index - 1]
                  return (
                    <span key={item} className="ann-pagination__slot">
                      {previous && item - previous > 1 && (
                        <span className="ann-pagination__gap" aria-hidden="true">
                          …
                        </span>
                      )}
                      <button
                        type="button"
                        className={`ann-page ${item === meta.page ? 'is-active' : ''}`}
                        aria-label={`Page ${item}`}
                        aria-current={item === meta.page ? 'page' : undefined}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    </span>
                  )
                })}
              </div>

              <button
                type="button"
                className="ann-page ann-page--arrow"
                onClick={() => setPage((current) => current + 1)}
                disabled={!hasMore}
              >
                NEXT <span aria-hidden="true">→</span>
              </button>
            </nav>
          )}
        </div>
      </section>
    </main>
  )
}
