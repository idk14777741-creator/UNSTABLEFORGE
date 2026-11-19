import { useEffect, useRef, useState } from 'react'
import { Link, navigate } from '../lib/router'
import { useAuth } from '../context/AuthContext'
import { formatDate } from '../data/announcements'
import { PROJECT_CATEGORIES, projectInitial, statusMeta } from '../data/projects'
import SectionLabel from '../components/SectionLabel'

const EMPTY_FORM = {
  title: '',
  tagline: '',
  description: '',
  category: 'Web',
  technologies: '',
  teamName: '',
  repoUrl: '',
  demoUrl: '',
  coverImageUrl: '',
}

function formFromProject(project) {
  return {
    title: project.title || '',
    tagline: project.tagline || '',
    description: project.description || '',
    category: project.category || 'Web',
    technologies: (project.technologies || []).join(', '),
    teamName: project.teamName || '',
    repoUrl: project.repoUrl || '',
    demoUrl: project.demoUrl || '',
    coverImageUrl: project.coverImageUrl || '',
  }
}

function normalizeUrl(value) {
  return value.trim()
}

function EditorSkeleton() {
  return (
    <main id="main" className="projects-main">
      <section className="projects-hero projects-hero--compact projects-hero--loading">
        <div className="container">
          <span className="ann-skeleton ann-skeleton--short" />
          <span className="ann-skeleton project-detail-skeleton__title" />
        </div>
      </section>
      <section className="section project-editor">
        <div className="container project-editor__grid">
          <div className="project-editor__form">
            <span className="ann-skeleton ann-skeleton--title" />
            <span className="ann-skeleton" />
            <span className="ann-skeleton" />
            <span className="ann-skeleton ann-skeleton--medium" />
          </div>
          <div className="project-editor__preview">
            <span className="ann-skeleton ann-skeleton--title" />
            <span className="ann-skeleton" />
          </div>
        </div>
      </section>
    </main>
  )
}

export default function ProjectEditor({ id }) {
  const { request } = useAuth()
  const editing = Boolean(id)
  const [load, setLoad] = useState({
    status: editing ? 'loading' : 'ready',
    project: null,
    error: null,
  })
  const [reloadKey, setReloadKey] = useState(0)
  const [form, setForm] = useState(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(null)
  const savingRef = useRef(false)

  useEffect(() => {
    document.title = editing ? 'Edit project — Unstable Forge' : 'Submit a project — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [editing])

  useEffect(() => {
    if (!editing) return undefined
    let active = true
    const controller = new AbortController()
    setLoad({ status: 'loading', project: null, error: null })

    request(`/api/projects/mine/${id}`, { signal: controller.signal })
      .then((body) => {
        if (!active) return
        setLoad({ status: 'ready', project: body.data, error: null })
        setForm(formFromProject(body.data))
      })
      .catch((error) => {
        if (!active || error.name === 'AbortError') return
        setLoad({
          status: error.status === 404 ? 'missing' : 'error',
          project: null,
          error: error.message,
        })
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [editing, id, request, reloadKey])

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setFormError(null)
  }

  const parseTechnologies = () =>
    form.technologies
      .split(',')
      .map((item) => item.trim().replace(/\s+/g, ' '))
      .filter(Boolean)

  const validate = () => {
    const errors = {}
    const title = form.title.trim()
    const tagline = form.tagline.trim()
    const description = form.description.trim()
    const technologies = parseTechnologies()
    const teamName = form.teamName.trim().replace(/\s+/g, ' ')
    const repoUrl = normalizeUrl(form.repoUrl)
    const demoUrl = normalizeUrl(form.demoUrl)
    const coverImageUrl = normalizeUrl(form.coverImageUrl)

    if (title.length < 3 || title.length > 120) {
      errors.title = 'Use a project title between 3 and 120 characters.'
    }
    if (tagline.length < 8 || tagline.length > 160) {
      errors.tagline = 'Use a short tagline between 8 and 160 characters.'
    }
    if (description.length < 40 || description.length > 12000) {
      errors.description = 'Describe the project in 40–12,000 characters.'
    }
    if (!PROJECT_CATEGORIES.includes(form.category)) {
      errors.category = 'Choose a project category.'
    }
    if (technologies.length < 1 || technologies.length > 12) {
      errors.technologies = 'List between 1 and 12 technologies.'
    } else if (technologies.some((technology) => technology.length > 40)) {
      errors.technologies = 'Each technology must be 40 characters or fewer.'
    }
    if (teamName && (teamName.length < 2 || teamName.length > 120)) {
      errors.teamName = 'Team or creator name must be 2–120 characters.'
    }

    const validateUrl = (value, key, label, github = false) => {
      if (!value) return
      let url
      try {
        url = new URL(value)
      } catch {
        errors[key] = `${label} must be a full http or https URL.`
        return
      }
      if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) {
        errors[key] = `${label} must be a full http or https URL.`
        return
      }
      if (
        github &&
        (url.protocol !== 'https:' ||
          !['github.com', 'www.github.com'].includes(url.hostname.toLowerCase()))
      ) {
        errors[key] = 'Repository URL must be an https://github.com URL.'
      }
    }

    validateUrl(repoUrl, 'repoUrl', 'Repository URL', true)
    validateUrl(demoUrl, 'demoUrl', 'Live demo URL')
    validateUrl(coverImageUrl, 'coverImageUrl', 'Cover image URL')

    return { errors, technologies }
  }

  const focusFirstError = (errors) => {
    const first = [
      'title',
      'tagline',
      'description',
      'category',
      'technologies',
      'teamName',
      'repoUrl',
      'demoUrl',
      'coverImageUrl',
    ].find((key) => errors[key])
    if (!first) return
    window.requestAnimationFrame(() => document.getElementById(`project-${first}`)?.focus())
  }

  const save = async (status) => {
    if (savingRef.current) return
    const { errors, technologies } = validate()
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length) {
      focusFirstError(errors)
      return
    }

    savingRef.current = true
    setSaving(status)
    const payload = {
      title: form.title.trim(),
      tagline: form.tagline.trim(),
      description: form.description.trim(),
      category: form.category,
      technologies,
      teamName: form.teamName.trim().replace(/\s+/g, ' ') || null,
      repoUrl: normalizeUrl(form.repoUrl) || null,
      demoUrl: normalizeUrl(form.demoUrl) || null,
      coverImageUrl: normalizeUrl(form.coverImageUrl) || null,
      status,
    }

    try {
      if (editing) {
        await request(`/api/projects/${id}`, { method: 'PATCH', body: payload })
      } else {
        await request('/api/projects', { method: 'POST', body: payload })
      }
      navigate(`/projects/mine?notice=${status === 'submitted' ? 'submitted' : 'updated'}`)
    } catch (error) {
      const serverFields = error.payload?.error?.fields
      if (serverFields) {
        setFieldErrors(serverFields)
        focusFirstError(serverFields)
      }
      setFormError(error.message || 'Could not save this project.')
    } finally {
      savingRef.current = false
      setSaving(null)
    }
  }

  if (load.status === 'loading') return <EditorSkeleton />

  if (load.status === 'missing' || load.status === 'error') {
    return (
      <main id="main" className="projects-main">
        <section className="section project-missing">
          <div className="container">
            <Link className="ann-back ann-back--dark" to="/projects/mine">
              ← BACK TO YOUR PROJECT DESK
            </Link>
            <span className="projects-state__label">
              {load.status === 'missing' ? 'PROJECT / NOT FOUND' : 'PROJECT / UNREACHABLE'}
            </span>
            <h1 className="display project-missing__title">
              {load.status === 'missing' ? (
                <>
                  THIS ISN&apos;T <em className="serif">YOUR RECORD.</em>
                </>
              ) : (
                <>
                  THE DESK IS <em className="serif">UNREACHABLE.</em>
                </>
              )}
            </h1>
            <p>
              {load.status === 'missing'
                ? 'This project does not exist or does not belong to your account.'
                : load.error}
            </p>
            <div className="project-missing__actions">
              <Link className="ann-action" to="/projects/mine">
                OPEN YOUR PROJECTS
              </Link>
              {load.status === 'error' && (
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

  const project = load.project
  const locked = project?.status === 'published'
  const meta = project ? statusMeta(project.status) : statusMeta('draft')
  const technologies = parseTechnologies()

  if (locked) {
    return (
      <main id="main" className="projects-main">
        <section className="projects-hero projects-hero--compact">
          <div className="container">
            <div className="projects-hero__top">
              <SectionLabel number="C³" tone="light">
                PROJECT / PUBLISHED
              </SectionLabel>
              <span className="projects-hero__state">
                <span className="status-dot" aria-hidden="true" />
                PUBLIC / ORGANIZER MANAGED
              </span>
            </div>
            <h1 className="display projects-hero__title projects-hero__title--compact">
              THIS WORK IS <em className="serif">LIVE.</em>
            </h1>
            <p className="projects-hero__foot">
              Published projects can only be changed by an organizer. Contact the organizer if
              the public record needs a correction.
            </p>
          </div>
        </section>
        <section className="section project-editor">
          <div className="container project-locked">
            <span className="projects-state__label">PROJECT / LOCKED</span>
            <h2 className="display project-locked__title">{project.title}</h2>
            <p className="project-locked__tagline">{project.tagline}</p>
            <dl>
              <div>
                <dt>STATUS</dt>
                <dd>{meta.label}</dd>
              </div>
              <div>
                <dt>PUBLISHED</dt>
                <dd>{formatDate(project.publishedAt)}</dd>
              </div>
              <div>
                <dt>CATEGORY</dt>
                <dd>{project.category}</dd>
              </div>
            </dl>
            <div className="project-locked__actions">
              <Link className="ann-action" to={`/projects/${project.slug}`}>
                VIEW PUBLIC PROJECT ↗
              </Link>
              <Link className="ann-action ann-action--ghost" to="/projects/mine">
                BACK TO YOUR PROJECTS
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  return (
    <main id="main" className="projects-main">
      <section className="projects-hero projects-hero--compact" aria-labelledby="editor-title">
        <span className="projects-hero__watermark" aria-hidden="true">
          {editing ? 'EDIT' : 'NEW'}
        </span>
        <div className="container">
          <div className="projects-hero__top">
            <SectionLabel number="C³" tone="light">
              {editing ? 'PROJECT / EDIT' : 'PROJECT / NEW SUBMISSION'}
            </SectionLabel>
            <span className="projects-hero__state">
              <span className="status-dot" aria-hidden="true" />
              {meta.ownerLabel} / PRIVATE UNTIL REVIEWED
            </span>
          </div>

          <h1 id="editor-title" className="display projects-hero__title projects-hero__title--compact">
            {editing ? (
              <>
                SHAPE THE <em className="serif">RECORD.</em>
              </>
            ) : (
              <>
                PUT IT ON <em className="serif">THE BENCH.</em>
              </>
            )}
          </h1>

          <div className="projects-hero__foot">
            <p>
              Strong submissions explain the problem, the build and the working result. Keep
              it honest, specific and useful to someone discovering the work for the first time.
            </p>
            <Link className="ann-action ann-action--light" to="/projects/mine">
              YOUR PROJECT DESK ↗
            </Link>
          </div>
        </div>
      </section>

      <section className="section project-editor">
        <div className="container project-editor__grid">
          <form
            className="project-editor__form"
            onSubmit={(event) => event.preventDefault()}
            noValidate
          >
            <div className="project-editor__form-head">
              <div>
                <p className="projects-kicker">THE SUBMISSION</p>
                <h2 className="display project-editor__title">
                  PROJECT <em className="serif">NOTES.</em>
                </h2>
              </div>
              {editing && (
                <span className="project-editor__saved">
                  LAST SAVED
                  <strong>{formatDate(project.updatedAt)}</strong>
                </span>
              )}
            </div>

            {formError && (
              <div className="entry-alert project-editor__alert" role="alert">
                {formError}
              </div>
            )}

            <div className={`project-field ${fieldErrors.title ? 'has-error' : ''}`}>
              <div className="project-field__label">
                <label htmlFor="project-title">PROJECT TITLE</label>
                <span>{form.title.length}/120</span>
              </div>
              <input
                id="project-title"
                value={form.title}
                onChange={(event) => update('title', event.target.value)}
                maxLength={120}
                placeholder="Name the thing you built"
                aria-invalid={fieldErrors.title ? 'true' : undefined}
              />
              <span className="project-field__meta">
                {fieldErrors.title || '3–120 CHARACTERS · SHOWN AS THE EXHIBIT TITLE'}
              </span>
            </div>

            <div className={`project-field ${fieldErrors.tagline ? 'has-error' : ''}`}>
              <div className="project-field__label">
                <label htmlFor="project-tagline">SHORT TAGLINE</label>
                <span>{form.tagline.length}/160</span>
              </div>
              <input
                id="project-tagline"
                value={form.tagline}
                onChange={(event) => update('tagline', event.target.value)}
                maxLength={160}
                placeholder="One line that makes someone want to look closer"
                aria-invalid={fieldErrors.tagline ? 'true' : undefined}
              />
              <span className="project-field__meta">
                {fieldErrors.tagline || '8–160 CHARACTERS · THE CARD LINE'}
              </span>
            </div>

            <div className={`project-field ${fieldErrors.description ? 'has-error' : ''}`}>
              <div className="project-field__label">
                <label htmlFor="project-description">FULL DESCRIPTION</label>
                <span>{form.description.length}/12000</span>
              </div>
              <textarea
                id="project-description"
                value={form.description}
                onChange={(event) => update('description', event.target.value)}
                maxLength={12000}
                rows={10}
                placeholder="What problem does it solve? How does it work? What did you learn or ship? Separate paragraphs with a blank line."
                aria-invalid={fieldErrors.description ? 'true' : undefined}
              />
              <span className="project-field__meta">
                {fieldErrors.description || '40–12,000 CHARACTERS · BLANK LINES BECOME PARAGRAPHS'}
              </span>
            </div>

            <div className="project-field-row">
              <div className={`project-field ${fieldErrors.category ? 'has-error' : ''}`}>
                <label htmlFor="project-category">CATEGORY</label>
                <select
                  id="project-category"
                  value={form.category}
                  onChange={(event) => update('category', event.target.value)}
                  aria-invalid={fieldErrors.category ? 'true' : undefined}
                >
                  {PROJECT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category.toUpperCase()}
                    </option>
                  ))}
                </select>
                <span className="project-field__meta">
                  {fieldErrors.category || 'ONE PUBLIC CATEGORY'}
                </span>
              </div>

              <div className={`project-field ${fieldErrors.teamName ? 'has-error' : ''}`}>
                <label htmlFor="project-teamName">TEAM / CREATOR NAME <span>OPTIONAL</span></label>
                <input
                  id="project-teamName"
                  value={form.teamName}
                  onChange={(event) => update('teamName', event.target.value)}
                  maxLength={120}
                  placeholder="Public attribution for the work"
                  aria-invalid={fieldErrors.teamName ? 'true' : undefined}
                />
                <span className="project-field__meta">
                  {fieldErrors.teamName || '2–120 CHARACTERS · YOUR EMAIL IS NEVER PUBLIC'}
                </span>
              </div>
            </div>

            <div className={`project-field ${fieldErrors.technologies ? 'has-error' : ''}`}>
              <div className="project-field__label">
                <label htmlFor="project-technologies">TECHNOLOGIES</label>
                <span>{technologies.length}/12</span>
              </div>
              <input
                id="project-technologies"
                value={form.technologies}
                onChange={(event) => update('technologies', event.target.value)}
                placeholder="React, Node.js, SQLite"
                aria-invalid={fieldErrors.technologies ? 'true' : undefined}
              />
              <span className="project-field__meta">
                {fieldErrors.technologies || 'COMMA-SEPARATED · 1–12 TECHNOLOGIES'}
              </span>
            </div>

            <div className="project-editor__links">
              <p className="projects-kicker">PUBLIC LINKS / OPTIONAL</p>

              <div className={`project-field ${fieldErrors.repoUrl ? 'has-error' : ''}`}>
                <label htmlFor="project-repoUrl">GITHUB REPOSITORY</label>
                <input
                  id="project-repoUrl"
                  type="url"
                  value={form.repoUrl}
                  onChange={(event) => update('repoUrl', event.target.value)}
                  placeholder="https://github.com/your-name/your-project"
                  aria-invalid={fieldErrors.repoUrl ? 'true' : undefined}
                />
                <span className="project-field__meta">
                  {fieldErrors.repoUrl || 'OPTIONAL · GITHUB HTTPS URL ONLY'}
                </span>
              </div>

              <div className={`project-field ${fieldErrors.demoUrl ? 'has-error' : ''}`}>
                <label htmlFor="project-demoUrl">LIVE DEMO</label>
                <input
                  id="project-demoUrl"
                  type="url"
                  value={form.demoUrl}
                  onChange={(event) => update('demoUrl', event.target.value)}
                  placeholder="https://your-project.example.com"
                  aria-invalid={fieldErrors.demoUrl ? 'true' : undefined}
                />
                <span className="project-field__meta">
                  {fieldErrors.demoUrl || 'OPTIONAL · HTTP OR HTTPS'}
                </span>
              </div>

              <div className={`project-field ${fieldErrors.coverImageUrl ? 'has-error' : ''}`}>
                <label htmlFor="project-coverImageUrl">COVER IMAGE URL</label>
                <input
                  id="project-coverImageUrl"
                  type="url"
                  value={form.coverImageUrl}
                  onChange={(event) => update('coverImageUrl', event.target.value)}
                  placeholder="https://…/project-cover.jpg"
                  aria-invalid={fieldErrors.coverImageUrl ? 'true' : undefined}
                />
                <span className="project-field__meta">
                  {fieldErrors.coverImageUrl || 'OPTIONAL · DIRECT HTTP OR HTTPS IMAGE URL'}
                </span>
              </div>
            </div>

            <div className="project-editor__actions">
              <button
                className="entry-submit project-editor__submit"
                type="button"
                onClick={() => save('submitted')}
                disabled={Boolean(saving)}
              >
                <span>
                  {saving === 'submitted'
                    ? 'SUBMITTING FOR REVIEW…'
                    : editing && project.status === 'submitted'
                      ? 'KEEP IN REVIEW'
                      : 'SUBMIT FOR REVIEW'}
                </span>
                <span aria-hidden="true">{saving === 'submitted' ? '···' : '↗'}</span>
              </button>
              <button
                className="ann-action ann-action--ghost"
                type="button"
                onClick={() => save('draft')}
                disabled={Boolean(saving)}
              >
                {saving === 'draft' ? 'SAVING…' : 'SAVE AS DRAFT'}
              </button>
            </div>

            <p className="project-editor__note">
              SUBMITTING DOES NOT PUBLISH THE PROJECT. AN ORGANIZER REVIEWS EVERY SUBMISSION
              BEFORE IT APPEARS IN THE PUBLIC SHOWCASE.
            </p>
          </form>

          <aside className="project-editor__preview" aria-label="Project card preview">
            <div className="project-preview">
              <div className="project-preview__top">
                <span>LIVE CARD / PREVIEW</span>
                <span>{(editing ? meta.label : 'DRAFT')}</span>
              </div>
              <div className="project-preview__visual" aria-hidden="true">
                {form.coverImageUrl ? (
                  <img
                    src={form.coverImageUrl}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={(event) => {
                      event.currentTarget.style.display = 'none'
                    }}
                  />
                ) : null}
                <span>{projectInitial(form.title)}</span>
              </div>
              <div className="project-preview__body">
                <span className="project-preview__category">{form.category}</span>
                <strong>{form.title.trim() || 'UNTITLED PROJECT'}</strong>
                <p>{form.tagline.trim() || 'Your tagline will appear here.'}</p>
                <div className="project-preview__tech">
                  {technologies.slice(0, 4).map((technology) => (
                    <span key={technology}>{technology}</span>
                  ))}
                </div>
                <span className="project-preview__foot">
                  {form.teamName.trim() || 'C³ PARTICIPANT'}
                </span>
              </div>
            </div>

            <div className="project-editor__guidance">
              <span className="projects-kicker">BEFORE YOU SUBMIT</span>
              <ol>
                <li>
                  <span>01</span>
                  <p>Explain what actually works, not what is planned.</p>
                </li>
                <li>
                  <span>02</span>
                  <p>Use a repository or demo link that opens without an account.</p>
                </li>
                <li>
                  <span>03</span>
                  <p>Keep private participant details out of public descriptions.</p>
                </li>
              </ol>
            </div>
          </aside>
        </div>
      </section>
    </main>
  )
}
