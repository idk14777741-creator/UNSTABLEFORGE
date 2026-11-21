import { useEffect, useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import GoogleAuthButton from '../components/GoogleAuthButton'
import { Link, navigate, useRoute } from '../lib/router'
import { roleHome, safeNext, useAuth } from '../context/AuthContext'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginPage() {
  const { search } = useRoute()
  const { login, loginWithGoogle, expired } = useAuth()
  const params = new URLSearchParams(search)
  const next = safeNext(params.get('next'))
  const registered = params.get('registered') === '1'
  const reason = params.get('reason')
  const presetEmail = params.get('email') || ''
  const googleCode = params.get('google_code')
  const googleError = params.get('google_error')

  const [email, setEmail] = useState(presetEmail)
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [googlePending, setGooglePending] = useState(Boolean(googleCode))

  useEffect(() => {
    document.title = 'Sign in — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  // The OAuth callback hands back a short-lived, single-use code. It is
  // exchanged here for a session; the token never appears in the URL.
  useEffect(() => {
    if (!googleCode) return undefined

    let active = true
    setGooglePending(true)

    loginWithGoogle(googleCode)
      .then((user) => {
        if (active) navigate(next || roleHome(user), { replace: true })
      })
      .catch((error) => {
        if (!active) return
        setFormError(error.message || 'Google sign-in failed. Try again.')
        setGooglePending(false)
      })

    return () => {
      active = false
    }
  }, [googleCode, loginWithGoogle, next])

  const validate = () => {
    const errors = {}
    const trimmed = email.trim()

    if (!trimmed) errors.email = 'Email is required.'
    else if (!EMAIL_PATTERN.test(trimmed)) errors.email = 'Enter a valid email address.'
    if (!password) errors.password = 'Password is required.'

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
      const user = await login(email.trim(), password)
      navigate(next || roleHome(user), { replace: true })
    } catch (error) {
      const serverFields = error.payload?.error?.fields
      if (serverFields) setFieldErrors(serverFields)
      setFormError(error.message || 'Sign in failed. Try again.')
      setSubmitting(false)
    }
  }

  return (
    <AuthLayout
      mode="login"
      asideTitle="THE WORK STARTS HERE."
      asideCopy="Sign in to manage C³ dispatches, announcements and event updates from one controlled place."
    >
      <div className="auth-head">
        <span className="auth-eyebrow">C³ / SIGN IN</span>
        <h1 className="display auth-title">
          WELCOME <em className="serif">BACK.</em>
        </h1>
        <p className="auth-lede">
          Organizers and registered participants can sign in here. Browsing the event never
          requires an account.
        </p>
      </div>

      {registered && (
        <p className="auth-banner auth-banner--success" role="status">
          ACCOUNT CREATED. SIGN IN TO CONTINUE.
        </p>
      )}

      {(reason === 'expired' || expired) && (
        <p className="auth-banner auth-banner--warning" role="status">
          YOUR SESSION EXPIRED. SIGN IN AGAIN.
        </p>
      )}

      {googleError && !formError && (
        <p className="auth-banner auth-banner--warning" role="status">
          {googleError === 'cancelled'
            ? 'GOOGLE SIGN-IN WAS CANCELLED.'
            : 'GOOGLE SIGN-IN COULD NOT BE COMPLETED. TRY AGAIN.'}
        </p>
      )}

      {googlePending && !formError && (
        <p className="auth-banner auth-banner--success" role="status">
          COMPLETING GOOGLE SIGN-IN…
        </p>
      )}

      {formError && (
        <p className="auth-banner auth-banner--error" role="alert">
          {formError}
        </p>
      )}

      <form className="auth-form" onSubmit={handleSubmit} noValidate>
        <div className={`auth-field ${fieldErrors.email ? 'has-error' : ''}`}>
          <label className="auth-field__label" htmlFor="login-email">
            <span>EMAIL</span>
          </label>
          <div className="auth-field__control">
            <input
              id="login-email"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck="false"
              aria-invalid={fieldErrors.email ? 'true' : undefined}
              aria-describedby={fieldErrors.email ? 'login-email-error' : undefined}
            />
          </div>
          {fieldErrors.email && (
            <p className="auth-field__error" id="login-email-error" role="alert">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <PasswordField
          label="PASSWORD"
          name="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
          autoComplete="current-password"
        />

        <button className="auth-submit" type="submit" disabled={submitting || googlePending}>
          <span>{submitting ? 'OPENING THE FORGE…' : 'ENTER THE FORGE'}</span>
          <span aria-hidden="true">{submitting ? '···' : '→'}</span>
        </button>
      </form>

      <GoogleAuthButton next={next} />

      <div className="auth-switch">
        <p>
          New to the forge?{' '}
          <Link to={`/signup${next ? `?next=${encodeURIComponent(next)}` : ''}`}>
            CREATE AN ACCOUNT
          </Link>
        </p>
        <Link className="auth-return" to="/">
          ← RETURN TO THE EVENT
        </Link>
      </div>

      <p className="auth-fineprint">
        Protected operations are authorized by the backend on every request. Signing in
        does not grant organizer access unless the account holds that role.
      </p>
    </AuthLayout>
  )
}
