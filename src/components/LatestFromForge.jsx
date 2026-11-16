import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { apiGet } from '../lib/api'
import { formatDate } from '../data/announcements'
import SectionLabel from './SectionLabel'

const LATEST_LIMIT = 3

function LatestSkeleton() {
  return (
    <div className="latest__grid" aria-busy="true" aria-label="Loading latest announcements">
      <div className="latest-feature latest-feature--skeleton" aria-hidden="true">
        <div className="latest-skeleton__top">
          <span className="ann-skeleton latest-skeleton--short" />
          <span className="ann-skeleton latest-skeleton--tiny" />
        </div>
        <span className="ann-skeleton latest-skeleton--date" />
        <span className="ann-skeleton latest-skeleton--title" />
        <span className="ann-skeleton latest-skeleton--title latest-skeleton--title-short" />
        <span className="ann-skeleton latest-skeleton--copy" />
      </div>
      <div className="latest-side" aria-hidden="true">
        {[0, 1].map((item) => (
          <div className="latest-side__skeleton" key={item}>
            <span className="ann-skeleton latest-skeleton--tiny" />
            <span className="ann-skeleton latest-skeleton--row-title" />
            <span className="ann-skeleton latest-skeleton--tiny" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LatestFromForge() {
  const [state, setState] = useState({ status: 'loading', items: [], error: null })
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setState((current) => ({ ...current, status: 'loading', error: null }))

    apiGet(`/api/announcements?limit=${LATEST_LIMIT}`, { signal: controller.signal })
      .then((body) => {
        setState({ status: 'success', items: body.data, error: null })
      })
      .catch((error) => {
        if (error.name === 'AbortError') return
        setState({ status: 'error', items: [], error: error.message })
      })

    return () => controller.abort()
  }, [reloadKey])

  const [featured, ...rest] = state.items

  return (
    <section id="latest" className="section latest" aria-labelledby="latest-title">
      <div className="container">
        <div className="latest__head">
          <div>
            <SectionLabel number="06">FROM THE FORGE</SectionLabel>
            <h2 id="latest-title" className="display latest__title" data-reveal>
              LATEST FROM THE <em className="serif">FORGE.</em>
            </h2>
          </div>
          <div className="latest__aside">
            <p>
              Confirmed decisions, published first. These are the newest dispatches from the
              C³ organizers — direct from the event record.
            </p>
            <Link className="latest__all" to="/announcements">
              EXPLORE ALL UPDATES <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>

        {state.status === 'loading' && <LatestSkeleton />}

        {state.status === 'error' && (
          <div className="latest__state" role="alert">
            <span className="latest__state-label">THE WIRE / UNREACHABLE</span>
            <div className="latest__state-body">
              <h3 className="display latest__state-title">
                THE DISPATCH DESK IS <em className="serif">QUIET.</em>
              </h3>
              <p>{state.error}</p>
              <div className="latest__state-actions">
                <button
                  className="ann-action"
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  TRY AGAIN <span aria-hidden="true">↻</span>
                </button>
                <Link className="ann-action ann-action--ghost" to="/announcements">
                  OPEN THE ARCHIVE
                </Link>
              </div>
            </div>
          </div>
        )}

        {state.status === 'success' && state.items.length === 0 && (
          <div className="latest__state">
            <span className="latest__state-label">THE WIRE / STANDING BY</span>
            <div className="latest__state-body">
              <h3 className="display latest__state-title">
                NO DISPATCHES <em className="serif">YET.</em>
              </h3>
              <p>
                The organizers have not published an update yet. The first confirmed dispatch
                will appear here — nothing is being invented in the meantime.
              </p>
              <div className="latest__state-actions">
                <Link className="ann-action" to="/announcements">
                  VISIT THE DISPATCH ARCHIVE
                </Link>
              </div>
            </div>
          </div>
        )}

        {state.status === 'success' && featured && (
          <div className={`latest__grid ${rest.length === 0 ? 'is-solo' : ''}`}>
            <Link
              className="latest-feature"
              to={`/announcements/${featured.slug}`}
              data-category={featured.category.toLowerCase()}
            >
              <span className="latest-feature__index" aria-hidden="true">
                01
              </span>
              <span className="latest-feature__top">
                <span className="latest-feature__flag">
                  <span className="status-dot" aria-hidden="true" />
                  LATEST DISPATCH
                </span>
                <span className="latest-feature__category">{featured.category}</span>
              </span>
              <time className="latest-feature__date" dateTime={featured.publishedAt || undefined}>
                {formatDate(featured.publishedAt)}
              </time>
              <h3 className="display latest-feature__title">{featured.title}</h3>
              <p className="latest-feature__excerpt">{featured.excerpt}</p>
              <span className="latest-feature__foot">
                <span>READ THE FULL DISPATCH</span>
                <span className="latest-feature__arrow" aria-hidden="true">
                  ↗
                </span>
              </span>
            </Link>

            {rest.length > 0 && (
              <div className="latest-side">
                {rest.map((item, index) => (
                  <Link
                    className="latest-side__item"
                    to={`/announcements/${item.slug}`}
                    key={item.id}
                  >
                    <span className="latest-side__index" aria-hidden="true">
                      {String(index + 2).padStart(2, '0')}
                    </span>
                    <span className="latest-side__body">
                      <span className="latest-side__meta">
                        <span>{item.category}</span>
                        <time dateTime={item.publishedAt || undefined}>
                          {formatDate(item.publishedAt)}
                        </time>
                      </span>
                      <span className="latest-side__title">{item.title}</span>
                    </span>
                    <span className="latest-side__arrow" aria-hidden="true">
                      ↗
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
