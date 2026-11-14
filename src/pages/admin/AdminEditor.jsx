import { useEffect, useState } from 'react'
import { Link, navigate } from '../../lib/router'
import { useAuth } from '../../context/AuthContext'
import SectionLabel from '../../components/SectionLabel'
import { CATEGORIES } from '../../data/announcements'

const EMPTY = {
  title: '',
  slug: '',
  category: 'General',
  content: '',
  isPublished: false,
}

export default function AdminEditor({ id }) {
  const { request } = useAuth()
  const isEdit = Boolean(id)
  const [form, setForm] = useState(EMPTY)
  const [status, setStatus] = useState(isEdit ? 'loading' : 'ready')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [saving, setSaving] = useState(false)

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
        setForm({
          title: item.title,
          slug: item.slug,
          category: item.category,
          content: item.content,
          isPublished: item.isPublished,
        })
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

  const update = (key, value) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  const validate = () => {
    const errors = {}
    if (form.title.trim().length < 3) errors.title = 'Title must be at least 3 characters.'
    if (form.content.trim().length < 20) {
      errors.content = 'Content must be at least 20 characters.'
    }
    if (form.slug.trim() && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug.trim())) {
      errors.slug = 'Use lowercase letters, numbers and hyphens only.'
    }
    return errors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length) return

    setSaving(true)
    const payload = {
      title: form.title.trim(),
      category: form.category,
      content: form.content.trim(),
      isPublished: form.isPublished,
    }
    if (form.slug.trim()) payload.slug = form.slug.trim()

    try {
      if (isEdit) {
        await request(`/api/announcements/${id}`, { method: 'PATCH', body: payload })
      } else {
        await request('/api/announcements', { method: 'POST', body: payload })
      }
      navigate('/admin/announcements?saved=1', { replace: true })
    } catch (error) {
      const serverFields = error.payload?.error?.fields
      if (serverFields) setFieldErrors(serverFields)
      setFormError(error.message || 'Could not save the update.')
      setSaving(false)
    }
  }

  if (status === 'loading') {
    return (
      <main id="main" className="admin-main">
        <section className="admin-hero admin-hero--compact">
          <div className="container">
            <SectionLabel number="ORG" tone="light">
              DISPATCH EDITOR
            </SectionLabel>
            <p className="admin-editor__loading">LOADING DISPATCH…</p>
          </div>
        </section>
      </main>
    )
  }

  if (status === 'missing' || status === 'error') {
    return (
      <main id="main" className="admin-main">
        <section className="section admin-overview">
          <div className="container">
            <Link className="ann-back ann-back--dark" to="/admin/announcements">
              ← ALL DISPATCHES
            </Link>
            <div className="admin-state" role="alert">
              <span className="admin-state__label">DISPATCH / UNREADABLE</span>
              <h3>{status === 'missing' ? 'That announcement does not exist.' : 'The editor is unavailable.'}</h3>
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

  return (
    <main id="main" className="admin-main">
      <section className="admin-hero admin-hero--compact">
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
            organizers only.
          </p>
        </div>
      </section>

      <section className="section admin-overview">
        <div className="container admin-editor">
          {formError && (
            <p className="admin-flash admin-flash--error" role="alert">
              {formError}
            </p>
          )}

          <form className="admin-form" onSubmit={handleSubmit} noValidate>
            <div className={`admin-form__field ${fieldErrors.title ? 'has-error' : ''}`}>
              <label htmlFor="dispatch-title">TITLE</label>
              <input
                id="dispatch-title"
                value={form.title}
                onChange={(event) => update('title', event.target.value)}
                maxLength={180}
                aria-invalid={fieldErrors.title ? 'true' : undefined}
              />
              {fieldErrors.title && <p className="auth-field__error">{fieldErrors.title}</p>}
            </div>

            <div className="admin-form__row">
              <div className="admin-form__field">
                <label htmlFor="dispatch-category">CATEGORY</label>
                <select
                  id="dispatch-category"
                  value={form.category}
                  onChange={(event) => update('category', event.target.value)}
                >
                  {CATEGORIES.filter((item) => item !== 'All').map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>

              <div className={`admin-form__field ${fieldErrors.slug ? 'has-error' : ''}`}>
                <label htmlFor="dispatch-slug">SLUG (OPTIONAL)</label>
                <input
                  id="dispatch-slug"
                  value={form.slug}
                  onChange={(event) => update('slug', event.target.value)}
                  placeholder="generated-from-title"
                  aria-invalid={fieldErrors.slug ? 'true' : undefined}
                />
                {fieldErrors.slug && <p className="auth-field__error">{fieldErrors.slug}</p>}
              </div>
            </div>

            <div className={`admin-form__field ${fieldErrors.content ? 'has-error' : ''}`}>
              <label htmlFor="dispatch-content">CONTENT</label>
              <textarea
                id="dispatch-content"
                value={form.content}
                onChange={(event) => update('content', event.target.value)}
                rows={12}
                maxLength={20000}
                aria-invalid={fieldErrors.content ? 'true' : undefined}
              />
              <div className="admin-form__meta">
                <span>{form.content.trim().length} / 20000</span>
                <span>PLAIN TEXT · BLANK LINE = NEW PARAGRAPH</span>
              </div>
              {fieldErrors.content && <p className="auth-field__error">{fieldErrors.content}</p>}
            </div>

            <label className="admin-form__toggle">
              <input
                type="checkbox"
                checked={form.isPublished}
                onChange={(event) => update('isPublished', event.target.checked)}
              />
              <span className="admin-form__toggle-box" aria-hidden="true" />
              <span>
                PUBLISH THIS DISPATCH
                <small>Visible on /announcements immediately after saving.</small>
              </span>
            </label>

            <div className="admin-form__actions">
              <button className="ann-action" type="submit" disabled={saving}>
                {saving ? 'SAVING…' : isEdit ? 'SAVE CHANGES' : 'CREATE DISPATCH'}
              </button>
              <Link className="ann-action ann-action--ghost" to="/admin/announcements">
                CANCEL
              </Link>
            </div>
          </form>
        </div>
      </section>
    </main>
  )
}
