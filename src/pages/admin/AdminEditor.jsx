import { useEffect, useRef, useState } from 'react'
import { Link, navigate } from '../../lib/router'
import { useAuth } from '../../context/AuthContext'
import SectionLabel from '../../components/SectionLabel'
import ConfirmDialog from '../../components/ConfirmDialog'
import { CATEGORIES, readingTime } from '../../data/announcements'

const EMPTY = {
  title: '',
  slug: '',
  category: 'General',
  content: '',
  isPublished: false,
}

const VALID_CATEGORIES = CATEGORIES.filter((item) => item !== 'All')

function excerpt(value) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'The dispatch preview will take shape as you write.'
  if (cleaned.length <= 170) return cleaned
  return `${cleaned.slice(0, 170).trimEnd()}…`
}

function EditorLoading() {
  return (
    <main id="main" className="admin-main">
      <section className="admin-hero admin-hero--compact admin-hero--desk">
        <div className="container">
          <SectionLabel number="ORG" tone="light">
            DISPATCH EDITOR
          </SectionLabel>
          <p className="admin-editor__loading">LOADING DISPATCH FROM THE RECORD…</p>
        </div>
      </section>
      <section className="section admin-overview">
        <div className="container admin-editor">
          <div className="admin-desk admin-desk--loading" aria-busy="true">
            <span className="ann-skeleton admin-skeleton--title" />
            <span className="ann-skeleton" />
            <span className="ann-skeleton" />
            <span className="ann-skeleton admin-skeleton--short" />
          </div>
        </div>
      </section>
    </main>
  )
}

export default function AdminEditor({ id }) {
  const { request } = useAuth()
  const isEdit = Boolean(id)
  const initialRef = useRef(EMPTY)
  const savingRef = useRef(false)

  const [form, setForm] = useState(EMPTY)
  const [itemMeta, setItemMeta] = useState(null)
  const [status, setStatus] = useState(isEdit ? 'loading' : 'ready')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [discardOpen, setDiscardOpen] = useState(false)

  useEffect(() => {
    document.title = isEdit ? 'Edit update — Unstable Forge' : 'New update — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [isEdit])

  useEffect(() => {
    if (!isEdit) return undefined
    let active = true
    setStatus('loading')

    request(`/api/admin/announcements/${id}`)
      .then((body) => {
        if (!active) return
        const item = body.data
        const next = {
          title: item.title,
          slug: item.slug,
          category: item.category,
          content: item.content,
          isPublished: item.isPublished,
        }
        initialRef.current = next
        setForm(next)
        setItemMeta(item)
        setDirty(false)
        setStatus('ready')
      })
      .catch((error) => {
        if (!active) return
        setFormError(error.message)
        setStatus(error.status === 404 ? 'missing' : 'error')
      })

    return () => {
      active = false
    }
  }, [id, isEdit, request])

  useEffect(() => {
    if (!dirty || saving) return undefined

    const warn = (event) => {
      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty, saving])

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
    setFieldErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
    setFormError(null)
    setDirty(true)
  }

  const validate = () => {
    const errors = {}
    const title = form.title.trim()
    const content = form.content.trim()
    const slug = form.slug.trim()

    if (title.length < 3 || title.length > 180) {
      errors.title = 'Title must be between 3 and 180 characters.'
    }
    if (content.length < 20 || content.length > 20000) {
      errors.content = 'Content must be between 20 and 20,000 characters.'
    }
    if (!VALID_CATEGORIES.includes(form.category)) {
      errors.category = 'Choose a valid category.'
    }
    if (slug && (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3 || slug.length > 80)) {
      errors.slug = 'Use 3–80 lowercase letters, numbers, or single hyphens.'
    }

    return errors
  }

  const focusFirstError = (errors) => {
    const first = ['title', 'content', 'category', 'slug'].find((key) => errors[key])
    if (!first) return
    window.requestAnimationFrame(() => {
      document.getElementById(`dispatch-${first}`)?.focus()
    })
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    if (savingRef.current) return

    const errors = validate()
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length) {
      focusFirstError(errors)
      return
    }

    savingRef.current = true
    setSaving(true)
    const payload = {
      title: form.title.trim(),
      category: form.category,
      content: form.content.trim(),
      isPublished: form.isPublished,
    }
    if (form.slug.trim()) payload.slug = form.slug.trim().toLowerCase()

    try {
      if (isEdit) {
        await request(`/api/announcements/${id}`, { method: 'PATCH', body: payload })
      } else {
        await request('/api/announcements', { method: 'POST', body: payload })
      }
      setDirty(false)
      navigate(`/admin/announcements?saved=${isEdit ? 'updated' : 'created'}`, {
        replace: true,
      })
    } catch (error) {
      const serverFields = error.payload?.error?.fields
      if (serverFields) {
        setFieldErrors(serverFields)
        focusFirstError(serverFields)
      }
      setFormError(error.message || 'Could not save the dispatch.')
      savingRef.current = false
      setSaving(false)
    }
  }

  if (status === 'loading') return <EditorLoading />

  if (status === 'missing' || status === 'error') {
    return (
      <main id="main" className="admin-main">
        <section className="admin-hero admin-hero--compact admin-hero--desk">
          <div className="container">
            <SectionLabel number="ORG" tone="light">
              DISPATCH EDITOR
            </SectionLabel>
            <h1 className="display admin-hero__title">
              DISPATCH <em className="serif">UNREADABLE.</em>
            </h1>
          </div>
        </section>
        <section className="section admin-overview">
          <div className="container">
            <Link className="ann-back ann-back--dark" to="/admin/announcements">
              ← ALL DISPATCHES
            </Link>
            <div className="admin-state" role="alert">
              <span className="admin-state__label">DISPATCH / UNREADABLE</span>
              <h3>
                {status === 'missing'
                  ? 'That announcement does not exist.'
                  : 'The editor is unavailable.'}
              </h3>
              <p>{formError}</p>
              <Link className="ann-action" to="/admin/announcements">
                BACK TO MANAGEMENT
              </Link>
            </div>
          </div>
        </section>
      </main>
    )
  }

  const words = form.content.trim() ? form.content.trim().split(/\s+/).length : 0
  const minutes = readingTime(form.content)
  const isDirty = dirty && JSON.stringify(form) !== JSON.stringify(initialRef.current)

  return (
    <main id="main" className="admin-main">
      <section className="admin-hero admin-hero--compact admin-hero--desk">
        <div className="container">
          <div className="admin-hero__top">
            <SectionLabel number="ORG" tone="light">
              {isEdit ? 'EDIT DISPATCH' : 'NEW DISPATCH'}
            </SectionLabel>
            <Link className="admin-hero__public" to="/admin/announcements">
              ← ALL DISPATCHES
            </Link>
          </div>
          <h1 className="display admin-hero__title">
            {isEdit ? 'REFINE THE' : 'WRITE THE'}{' '}
            <em className="serif">{isEdit ? 'RECORD.' : 'DISPATCH.'}</em>
          </h1>
          <p className="admin-hero__lede">
            Only published dispatches appear on the public site. Drafts remain visible to
            organizers only. Publication state is saved with the dispatch.
          </p>
        </div>
      </section>

      <section className="section admin-overview admin-overview--editor">
        <div className="container admin-editor">
          {formError && (
            <div className="admin-flash admin-flash--error" role="alert">
              <span>{formError}</span>
            </div>
          )}

          <form className="admin-desk" onSubmit={handleSubmit} noValidate>
            <div className="admin-desk__main">
              <section className="admin-panel admin-panel--headline" aria-labelledby="headline-label">
                <div className="admin-panel__head">
                  <span className="admin-panel__step" id="headline-label">
                    01 / HEADLINE
                  </span>
                  <span className="admin-panel__note">THE LINE VISITORS SEE FIRST</span>
                </div>
                <div className={`admin-form__field ${fieldErrors.title ? 'has-error' : ''}`}>
                  <label htmlFor="dispatch-title">TITLE</label>
                  <input
                    id="dispatch-title"
                    value={form.title}
                    onChange={(event) => update('title', event.target.value)}
                    maxLength={180}
                    autoFocus={!isEdit}
                    aria-invalid={fieldErrors.title ? 'true' : undefined}
                    aria-describedby={fieldErrors.title ? 'dispatch-title-error' : undefined}
                    placeholder="A clear, specific dispatch headline"
                  />
                  <div className="admin-form__meta">
                    <span>{form.title.trim().length} / 180</span>
                    <span>3–180 CHARACTERS</span>
                  </div>
                  {fieldErrors.title && (
                    <p className="auth-field__error" id="dispatch-title-error">
                      {fieldErrors.title}
                    </p>
                  )}
                </div>
              </section>

              <section className="admin-panel admin-panel--body" aria-labelledby="body-label">
                <div className="admin-panel__head">
                  <span className="admin-panel__step" id="body-label">
                    02 / BODY
                  </span>
                  <span className="admin-panel__note">PLAIN TEXT · BLANK LINE = PARAGRAPH</span>
                </div>
                <div className={`admin-form__field ${fieldErrors.content ? 'has-error' : ''}`}>
                  <label htmlFor="dispatch-content">CONTENT</label>
                  <textarea
                    id="dispatch-content"
                    value={form.content}
                    onChange={(event) => update('content', event.target.value)}
                    rows={16}
                    maxLength={20000}
                    aria-invalid={fieldErrors.content ? 'true' : undefined}
                    aria-describedby={fieldErrors.content ? 'dispatch-content-error' : undefined}
                    placeholder="Write the confirmed update. Use blank lines between paragraphs."
                  />
                  <div className="admin-form__meta">
                    <span>
                      {words} WORDS · {form.content.trim().length} / 20000 CHARACTERS
                    </span>
                    <span>READ / {minutes} MIN</span>
                  </div>
                  {fieldErrors.content && (
                    <p className="auth-field__error" id="dispatch-content-error">
                      {fieldErrors.content}
                    </p>
                  )}
                </div>
              </section>
            </div>

            <aside className="admin-desk__side">
              <section className="admin-panel admin-publish" aria-labelledby="publish-label">
                <div className="admin-panel__head admin-panel__head--publish">
                  <span className="admin-panel__step" id="publish-label">
                    PUBLICATION
                  </span>
                  <span className={`admin-publish__state ${form.isPublished ? 'is-live' : ''}`}>
                    <span className="status-dot" aria-hidden="true" />
                    {form.isPublished ? 'PUBLIC' : 'DRAFT'}
                  </span>
                </div>

                <div className="admin-publish__toggle" role="group" aria-label="Publication status">
                  <button
                    type="button"
                    className={!form.isPublished ? 'is-active' : ''}
                    aria-pressed={!form.isPublished}
                    onClick={() => update('isPublished', false)}
                  >
                    <span>DRAFT</span>
                    <small>PRIVATE TO ORGANIZERS</small>
                  </button>
                  <button
                    type="button"
                    className={form.isPublished ? 'is-active' : ''}
                    aria-pressed={form.isPublished}
                    onClick={() => update('isPublished', true)}
                  >
                    <span>PUBLIC</span>
                    <small>VISIBLE ON THE EVENT SITE</small>
                  </button>
                </div>

                <p className="admin-publish__copy">
                  {form.isPublished
                    ? 'Saving will publish this dispatch immediately. It will appear on the homepage wire and the public archive.'
                    : 'Saving keeps this dispatch private. Only signed-in organizers can read it.'}
                </p>

                <button className="admin-desk__save" type="submit" disabled={saving}>
                  <span>{saving ? 'SAVING TO THE FORGE…' : isEdit ? 'SAVE CHANGES' : 'CREATE DISPATCH'}</span>
                  <span aria-hidden="true">{saving ? '…' : '↗'}</span>
                </button>

                <button
                  className="admin-desk__cancel"
                  type="button"
                  onClick={() => {
                    if (isDirty) setDiscardOpen(true)
                    else navigate('/admin/announcements')
                  }}
                >
                  CANCEL AND RETURN
                </button>

                {isEdit && itemMeta?.isPublished && (
                  <Link className="admin-desk__view" to={`/announcements/${itemMeta.slug}`}>
                    VIEW PUBLIC PAGE <span aria-hidden="true">↗</span>
                  </Link>
                )}

                {isDirty && (
                  <span className="admin-desk__dirty">
                    <span aria-hidden="true">●</span> UNSAVED CHANGES
                  </span>
                )}
              </section>

              <section className="admin-panel" aria-labelledby="metadata-label">
                <div className="admin-panel__head">
                  <span className="admin-panel__step" id="metadata-label">
                    METADATA
                  </span>
                  <span className="admin-panel__note">FILING DETAILS</span>
                </div>

                <div className={`admin-form__field ${fieldErrors.category ? 'has-error' : ''}`}>
                  <label htmlFor="dispatch-category">CATEGORY</label>
                  <select
                    id="dispatch-category"
                    value={form.category}
                    onChange={(event) => update('category', event.target.value)}
                    aria-invalid={fieldErrors.category ? 'true' : undefined}
                  >
                    {VALID_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.category && (
                    <p className="auth-field__error">{fieldErrors.category}</p>
                  )}
                </div>

                <div className={`admin-form__field ${fieldErrors.slug ? 'has-error' : ''}`}>
                  <label htmlFor="dispatch-slug">SLUG / OPTIONAL</label>
                  <input
                    id="dispatch-slug"
                    value={form.slug}
                    onChange={(event) => update('slug', event.target.value)}
                    placeholder="generated-from-title"
                    maxLength={80}
                    aria-invalid={fieldErrors.slug ? 'true' : undefined}
                  />
                  <p className="admin-field__hint">
                    {form.slug
                      ? `/announcements/${form.slug.trim().toLowerCase()}`
                      : 'Generated from the title if left empty.'}
                  </p>
                  {fieldErrors.slug && <p className="auth-field__error">{fieldErrors.slug}</p>}
                </div>

                <div className="admin-meta-line">
                  <span>{isEdit ? `DISPATCH / ${String(id).padStart(3, '0')}` : 'DISPATCH / NEW'}</span>
                  <span>{isEdit && itemMeta ? `UPDATED / ${new Date(itemMeta.updatedAt).toLocaleDateString('en-GB')}` : 'NOT YET FILED'}</span>
                </div>
              </section>

              <section className="admin-panel admin-preview" aria-labelledby="preview-label">
                <div className="admin-panel__head">
                  <span className="admin-panel__step" id="preview-label">
                    LIVE PREVIEW
                  </span>
                  <span className="admin-panel__note">LOCAL ONLY</span>
                </div>
                <article className={`admin-preview__card ${form.isPublished ? 'is-public' : ''}`}>
                  <div className="admin-preview__top">
                    <span>{form.category.toUpperCase()}</span>
                    <span>{form.isPublished ? 'PUBLIC' : 'DRAFT'}</span>
                  </div>
                  <h3>{form.title.trim() || 'Untitled dispatch'}</h3>
                  <p>{excerpt(form.content)}</p>
                  <span className="admin-preview__foot">
                    READ / {minutes} MIN <span aria-hidden="true">↗</span>
                  </span>
                </article>
              </section>
            </aside>
          </form>
        </div>
      </section>

      <ConfirmDialog
        open={discardOpen}
        kicker="EDITOR / UNSAVED"
        title={
          <>
            LEAVE THIS <em className="serif">DRAFT?</em>
          </>
        }
        confirmLabel="DISCARD CHANGES"
        onCancel={() => setDiscardOpen(false)}
        onConfirm={() => {
          setDiscardOpen(false)
          setDirty(false)
          navigate('/admin/announcements')
        }}
      >
        <p>
          Your unsaved title, body and publication changes will be lost. The dispatch already in
          the record will not be changed.
        </p>
        <p className="confirm__warning">THIS DOES NOT DELETE THE DISPATCH.</p>
      </ConfirmDialog>
    </main>
  )
}
