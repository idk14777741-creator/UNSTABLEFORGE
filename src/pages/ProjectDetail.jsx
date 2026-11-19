import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { apiGet } from '../lib/api'
import { formatDate } from '../data/announcements'
import {
  descriptionParagraphs,
  projectHost,
  projectInitial,
  statusMeta,
} from '../data/projects'
import SectionLabel from '../components/SectionLabel'

function DetailSkeleton() {
  return (
    <main id="main" className="project-detail-main">
      <section className="project-detail-hero project-detail-hero--loading">
        <div className="container">
          <span className="ann-skeleton ann-skeleton--short" />
          <span className="ann-skeleton project-detail-skeleton__title" />
          <span className="ann-skeleton ann-skeleton--medium" />
        </div>
      </section>
      <section className="section project-detail">
        <div className="container project-detail__grid">
          <div className="project-detail__copy">
            <span className="ann-skeleton" />
            <span className="ann-skeleton" />
            <span className="ann-skeleton ann-skeleton--medium" />
          </div>
          <div className="project-detail__rail">
            <span className="ann-skeleton ann-skeleton--short" />
            <span className="ann-skeleton" />
            <span className="ann-skeleton" />
          </div>
        </div>
      </section>
    </main>
  )
}

function ExternalLink({ href, label, note }) {
  if (!href) return null
  return (
    <a className="project-link" href={href} target="_blank" rel="noopener noreferrer">
      <span>
        <small>{label}</small>
        <strong>{projectHost(href)}</strong>
      </span>
      <span aria-hidden="true">↗</span>
      <span className="sr-only">{note}</span>
    </a>
  )
}

export default function ProjectDetail({ slug }) {
  const [state, setState] = useState({ status: 'loading', item: null, error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const [coverVisible, setCoverVisible] = useState(true)

  useEffect(() => {
    document.title = 'Project — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setState((current) => ({ ...current, status: 'loading', error: null }))

    apiGet(`/api/projects/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then((body) => {
        if (!active) return
        setState({ status: 'success', item: body.data, error: null })
        setCoverVisible(true)
        document.title = `${body.data.title} — Unstable Forge`
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({
          status: error.status === 404 ? 'missing' : 'error',
          item: null,
          error: error.message,
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [slug, reloadKey])

  if (state.status === 'loading') return <DetailSkeleton />

  if (state.status === 'missing' || state.status === 'error') {
    return (
      <main id="main" className="project-detail-main">
        <section className="section project-missing">
          <div className="container">
            <Link className="ann-back ann-back--dark" to="/projects">
              ← BACK TO THE SHOWCASE
            </Link>
            <span className="projects-state__label">
              {state.status === 'missing' ? 'PROJECT / 404' : 'PROJECT / UNREACHABLE'}
            </span>
            <h1 className="display project-missing__title">
              {state.status === 'missing' ? (
                <>
                  THIS WORK ISN&apos;T <em className="serif">ON THE WALL.</em>
                </>
              ) : (
                <>
                  THE WALL IS <em className="serif">OUT OF REACH.</em>
                </>
              )}
            </h1>
            <p>
              {state.status === 'missing'
                ? 'The project may not exist, may still be in review, or may have been removed from the public showcase.'
                : state.error}
            </p>
            <div className="project-missing__actions">
              <Link className="ann-action" to="/projects">
                OPEN THE SHOWCASE
              </Link>
              {state.status === 'error' && (
                <button
                  className="ann-action ann-action--ghost"
                  type="button"
                  onClick={() => setReloadKey((key) => key + 1)}
                >
                  TRY AGAIN ↻
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
    )
  }

  const project = state.item
  const paragraphs = descriptionParagraphs(project.description)
  const meta = statusMeta(project.status)

  return (
    <main id="main" className="project-detail-main">
      <section className="project-detail-hero" aria-labelledby="project-title">
        <span className="project-detail-hero__watermark" aria-hidden="true">
          {projectInitial(project.title)}
        </span>
        <div className="container">
          <div className="project-detail-hero__top">
            <Link className="ann-back ann-back--dark" to="/projects">
              ← THE SHOWCASE
            </Link>
            <span className="project-detail-hero__status">
              <span className="status-dot" aria-hidden="true" />
              {meta.label} / C³
            </span>
          </div>

          <div className="project-detail-hero__meta">
            <span>{project.category}</span>
            <span>{project.teamName || 'C³ PARTICIPANT'}</span>
            <span>
              {project.publishedAt
                ? `PUBLISHED ${formatDate(project.publishedAt)}`
                : `FILED ${formatDate(project.updatedAt)}`}
            </span>
          </div>

          <h1 id="project-title" className="display project-detail-hero__title">
            {project.title}
          </h1>
          <p className="project-detail-hero__tagline">{project.tagline}</p>
        </div>
      </section>

      <section className="section project-detail">
        <div className="container">
          {project.coverImageUrl && coverVisible && (
            <figure className="project-detail__cover">
              <img
                src={project.coverImageUrl}
                alt={`${project.title} project cover`}
                referrerPolicy="no-referrer"
                onError={() => setCoverVisible(false)}
              />
              <figcaption>
                COVER / {project.title} · SUPPLIED BY THE PROJECT OWNER
              </figcaption>
            </figure>
          )}

          <div className="project-detail__grid">
            <article className="project-detail__copy" aria-labelledby="project-about">
              <SectionLabel number="01">THE PROJECT</SectionLabel>
              <h2 id="project-about" className="display project-detail__heading">
                ABOUT THE <em className="serif">WORK.</em>
              </h2>
              <div className="project-detail__prose">
                {paragraphs.map((paragraph, index) => (
                  <p key={index}>{paragraph}</p>
                ))}
              </div>

              <div className="project-detail__stack">
                <span className="project-detail__label">BUILT WITH</span>
                <ul>
                  {project.technologies.map((technology) => (
                    <li key={technology}>{technology}</li>
                  ))}
                </ul>
              </div>
            </article>

            <aside className="project-detail__rail" aria-label="Project record">
              <div className="project-record">
                <div className="project-record__head">
                  <span>EXHIBIT RECORD</span>
                  <span>{meta.label}</span>
                </div>
                <dl>
                  <div>
                    <dt>CATEGORY</dt>
                    <dd>{project.category}</dd>
                  </div>
                  <div>
                    <dt>ATTRIBUTION</dt>
                    <dd>{project.teamName || 'C³ participant'}</dd>
                  </div>
                  <div>
                    <dt>PUBLISHED</dt>
                    <dd>{formatDate(project.publishedAt)}</dd>
                  </div>
                  <div>
                    <dt>EVENT</dt>
                    <dd>{project.eventName}</dd>
                  </div>
                </dl>
                <div className="project-record__links">
                  <ExternalLink
                    href={project.repoUrl}
                    label="REPOSITORY"
                    note="opens the project repository in a new tab"
                  />
                  <ExternalLink
                    href={project.demoUrl}
                    label="LIVE PROJECT"
                    note="opens the live project in a new tab"
                  />
                  {!project.repoUrl && !project.demoUrl && (
                    <p className="project-record__note">
                      NO EXTERNAL LINKS WERE SUPPLIED FOR THIS PROJECT.
                    </p>
                  )}
                </div>
              </div>

              <p className="project-detail__privacy">
                PUBLIC RECORD · PARTICIPANT ACCOUNT DETAILS ARE NOT EXPOSED.
              </p>

              <Link className="ann-action ann-action--ghost" to="/projects">
                BACK TO THE EXHIBITION
              </Link>
            </aside>
          </div>
        </div>
      </section>
    </main>
  )
}
