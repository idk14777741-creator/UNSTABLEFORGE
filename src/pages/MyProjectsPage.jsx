import { useEffect, useState } from 'react'
import { Link, useRoute } from '../lib/router'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../data/announcements'
import { statusMeta } from '../data/projects'
import SectionLabel from '../components/SectionLabel'
import ConfirmDialog from '../components/ConfirmDialog'

const NOTICES = {
  created: 'Project created. It is saved to your private project desk.',
  updated: 'Project updated.',
  submitted: 'Project submitted for organizer review. It is not public yet.',
  draft: 'Project saved as a private draft.',
}

function RowsSkeleton() {
  return Array.from({ length: 3 }, (_, index) => (
    <div className="my-project-row my-project-row--skeleton" key={index} aria-hidden="true">
      <span className="ann-skeleton ann-skeleton--short" />
      <span className="ann-skeleton ann-skeleton--title" />
      <span className="ann-skeleton ann-skeleton--medium" />
    </div>
  ))
}

export default function MyProjectsPage() {
  const { request } = useAuth()
  const { search } = useRoute()
  const [state, setState] = useState({ status: 'loading', items: [], error: null })
  const [reloadKey, setReloadKey] = useState(0)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [actionError, setActionError] = useState(null)
  const [notice, setNotice] = useState(() => NOTICES[new URLSearchParams(search).get('notice')])

  useEffect(() => {
    document.title = 'My projects — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  useEffect(() => {
    let active = true
    const controller = new AbortController()
    setState((current) => ({ ...current, status: 'loading', error: null }))

    request('/api/projects/mine', { signal: controller.signal })
      .then((body) => {
        if (!active) return
        setState({ status: 'success', items: body.data, error: null })
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setState({ status: 'error', items: [], error: error.message })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [request, reloadKey])

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleteBusy(true)
    setActionError(null)
    try {
      await request(`/api/projects/${deleteTarget.id}`, { method: 'DELETE' })
      setDeleteTarget(null)
      setNotice('Project deleted from your desk.')
      setReloadKey((key) => key + 1)
    } catch (error) {
      setDeleteTarget(null)
      setActionError(error.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const items = state.items
  const counts = {
    total: items.length,
    published: items.filter((item) => item.status === 'published').length,
    review: items.filter((item) => item.status === 'submitted').length,
    drafts: items.filter((item) => item.status === 'draft').length,
  }

  return (
    <main id="main" className="projects-main my-projects-main">
      <section className="projects-hero projects-hero--compact" aria-labelledby="my-projects-title">
        <span className="projects-hero__watermark" aria-hidden="true">
          DESK
        </span>
        <div className="container">
          <div className="projects-hero__top">
            <SectionLabel number="C³" tone="light">
              PARTICIPANT PROJECT DESK
            </SectionLabel>
            <span className="projects-hero__state">
              <span className="status-dot" aria-hidden="true" />
              OWNER VIEW / PRIVATE
            </span>
          </div>

          <h1 id="my-projects-title" className="display projects-hero__title projects-hero__title--compact">
            YOUR WORK,
            <br />
            <em className="serif">ON RECORD.</em>
          </h1>

          <div className="projects-hero__foot">
            <p>
              Draft a project, submit it for review, and manage your own submissions. Only
              organizers can publish work into the public showcase.
            </p>
            <Link className="ann-action ann-action--light" to="/projects/submit">
              SUBMIT A PROJECT ↗
            </Link>
          </div>
        </div>
      </section>

      <section className="section my-projects">
        <div className="container">
          <div className="admin-summary my-projects__summary" aria-label="Your project totals">
            <div className="admin-summary__stat">
              <span>ON YOUR DESK</span>
              <strong>{state.status === 'loading' ? '—' : String(counts.total).padStart(2, '0')}</strong>
            </div>
            <div className="admin-summary__stat">
              <span>PUBLISHED</span>
              <strong>
                {state.status === 'loading' ? '—' : String(counts.published).padStart(2, '0')}
              </strong>
            </div>
            <div className="admin-summary__stat">
              <span>IN REVIEW</span>
              <strong>{state.status === 'loading' ? '—' : String(counts.review).padStart(2, '0')}</strong>
            </div>
            <div className="admin-summary__stat">
              <span>DRAFTS</span>
              <strong>{state.status === 'loading' ? '—' : String(counts.drafts).padStart(2, '0')}</strong>
            </div>
            <p className="admin-summary__note">
              REVIEWED BEFORE PUBLIC · YOUR ACCOUNT EMAIL IS NEVER SHOWN PUBLICLY.
            </p>
          </div>

          {notice && (
            <div className="admin-flash my-projects__flash" role="status">
              <span>{notice}</span>
              <button type="button" onClick={() => setNotice(null)}>
                DISMISS
              </button>
            </div>
          )}

          {actionError && (
            <div className="entry-alert my-projects__error" role="alert">
              <span>{actionError}</span>
            </div>
          )}

          <div className="my-projects__head">
            <div>
              <p className="projects-kicker">YOUR RECORD</p>
              <h2 className="display my-projects__title">
                SUBMISSIONS &amp; <em className="serif">DRAFTS.</em>
              </h2>
            </div>
            <Link className="ann-action ann-action--ghost" to="/projects">
              VIEW PUBLIC SHOWCASE ↗
            </Link>
          </div>

          {state.status === 'error' && (
            <div className="admin-state" role="alert">
              <span className="admin-state__label">PROJECT DESK / UNREACHABLE</span>
              <h3>We could not load your projects.</h3>
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

          {state.status === 'loading' && state.items.length === 0 && (
            <div className="my-projects__list">
              <RowsSkeleton />
            </div>
          )}

          {state.status === 'success' && items.length === 0 && (
            <div className="admin-empty-state my-projects__empty">
              <span className="admin-empty-state__label">PROJECT DESK / EMPTY</span>
              <h3 className="display">NOTHING ON THE BENCH YET.</h3>
              <p>
                Create a project record with your title, description, stack and links. You can
                keep it private as a draft until you are ready to submit it for review.
              </p>
              <Link className="ann-action" to="/projects/submit">
                START A PROJECT
              </Link>
            </div>
          )}

          {items.length > 0 && (
            <div className="my-projects__list">
              <div className="my-projects__columns" aria-hidden="true">
                <span>PROJECT</span>
                <span>STATE</span>
                <span>LAST MOVEMENT</span>
                <span>ACTIONS</span>
              </div>

              {items.map((item, index) => {
                const meta = statusMeta(item.status)
                const editable = item.status !== 'published'
                return (
                  <article className="my-project-row" key={item.id}>
                    <div className="my-project-row__project">
                      <span className="my-project-row__index">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <div>
                        <Link className="my-project-row__title" to={editable ? `/projects/${item.id}/edit` : `/projects/${item.slug}`}>
                          {item.title}
                        </Link>
                        <p>{item.tagline}</p>
                        <span className="my-project-row__meta">
                          {item.category} · {item.technologies.length} TECHNOLOG
                          {item.technologies.length === 1 ? 'Y' : 'IES'}
                        </span>
                      </div>
                    </div>

                    <div className="my-project-row__state">
                      <span className={`project-status project-status--${item.status}`}>
                        {meta.ownerLabel}
                      </span>
                      <small>{meta.note}</small>
                    </div>

                    <div className="my-project-row__date">{formatDate(item.updatedAt)}</div>

                    <div className="my-project-row__actions">
                      {editable ? (
                        <Link className="my-project-action" to={`/projects/${item.id}/edit`}>
                          EDIT ↗
                        </Link>
                      ) : (
                        <Link className="my-project-action" to={`/projects/${item.slug}`}>
                          VIEW ↗
                        </Link>
                      )}
                      {item.status === 'published' ? (
                        <span className="my-project-action my-project-action--muted">
                          ORGANIZER MANAGED
                        </span>
                      ) : (
                        <button
                          className="my-project-action my-project-action--danger"
                          type="button"
                          onClick={() => {
                            setActionError(null)
                            setDeleteTarget(item)
                          }}
                        >
                          DELETE
                        </button>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      </section>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        kicker="DELETE PROJECT"
        title={deleteTarget ? `REMOVE “${deleteTarget.title}”?` : 'REMOVE PROJECT?'}
        confirmLabel="DELETE PROJECT"
        busyLabel="DELETING…"
        busy={deleteBusy}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      >
        <p>
          This removes the project record and its links permanently. It cannot be undone. If
          the project is published, ask an organizer to remove it from the showcase.
        </p>
      </ConfirmDialog>
    </main>
  )
}
