import { useEffect, useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { Link, navigate, useRoute } from '../lib/router'
import { safeNext, useAuth } from '../context/AuthContext'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignupPage() {
  const { search } = useRoute()
  const { signup } = useAuth()
  const next = safeNext(new URLSearchParams(search).get('next'))

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    document.title = 'Create account — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  const validate = () => {
    const errors = {}
    const trimmed = email.trim()

    if (!trimmed) errors.email = 'Email is required.'
    else if (!EMAIL_PATTERN.test(trimmed)) errors.email = 'Enter a valid email address.'

    if (!password) errors.password = 'Password is required.'
    else if (password.length < 8) errors.password = 'Use at least 8 characters.'
    else if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password = 'Include at least one letter and one number.'
    }

    if (!confirm) errors.confirm = 'Confirm your password.'
    else if (confirm !== password) errors.confirm = 'Passwords do not match.'

    return errors
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const errors = validate()
    setFieldErrors(errors)
    setFormError(null)
    if (Object.keys(errors).length) return

    setSubmitting(true)
    try {
      await signup(email.trim(), password)
      const params = new URLSearchParams({ registered: '1', email: email.trim().toLowerCase() })
      if (next) params.set('next', next)
      navigate(`/login?${params.toString()}`, { replace: true })
    } catch (error) {
      const serverFields = error.payload?.error?.fields
      if (serverFields) setFieldErrors(serverFields)
      setFormError(error.message || 'Could not create the account. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      mode="signup"
      asideTitle="MAKE YOUR MARK."
      asideCopy="A participant account keeps you connected to C³ updates. Organizer access is issued separately and cannot be self-assigned."
    >
      <div className="auth-head">
        <span className="auth-eyebrow">C³ / CREATE ACCOUNT</span>
        <h1 className="display auth-title">
          JOIN THE <em className="serif">FORGE.</em>
        </h1>
        <p className="auth-lede">
          Create a participant account with an email and password. Registration for C³ is open;
          you can add your event details from the registration desk after signing in.
        </p>
      </div>

      {formError && (
        <p className="auth-banner auth-banner--error" role="alert">
          {formError}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className={`auth-field ${fieldErrors.email ? 'has-error' : ''}`}>
          <label className="auth-field__label" htmlFor="signup-email">
            <span>EMAIL</span>
          </label>
          <div className="auth-field__control">
            <input
              id="signup-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
              aria-invalid={fieldErrors.email ? 'true' : undefined}
              aria-describedby={fieldErrors.email ? 'signup-email-error' : undefined}
            />
          </div>
          {fieldErrors.email && (
            <p className="auth-field__error" id="signup-email-error" role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <PasswordField
          label="PASSWORD"
          name="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          autoComplete="new-password"
          hint="8+ characters · letter + number"
        />

        <PasswordField
          label="CONFIRM PASSWORD"
          name="confirm-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          error={fieldErrors.confirm}
          autoComplete="new-password"
        />

        <button className="auth-submit" type="submit" disabled={submitting}>
          <span>{submitting ? 'FORGING ACCOUNT…' : 'CREATE ACCOUNT'}</span>
          <span aria-hidden="true">{submitting ? '···' : '→'}</span>
        </button>
      </form>

      <div className="auth-switch">
        <p>
          Already have an account?{' '}
          <Link to={`/login${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
            SIGN IN
          </Link>
        </p>
        <Link className="auth-return" to="/">
          ← RETURN TO THE EVENT
        </Link>
      </div>

      <p className="auth-fineprint">
        New accounts are participants. Organizer and admin access are assigned by the
        platform, never selected on this form.
      </p>
    </AuthLayout>
  )
}
