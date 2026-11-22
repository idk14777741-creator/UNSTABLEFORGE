import { useEffect, useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import { Link } from '../lib/router'
import { apiRequest } from '../lib/api'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Forgot password — Unstable Forge'
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setError('')

    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address.')
      return
    }

    setBusy(true)
    try {
      await apiRequest('/api/auth/forgot-password', {
        method: 'POST',
        body: { email: email.trim().toLowerCase() },
      })
      setSent(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      mode="login"
      asideTitle="A WAY BACK IN."
      asideCopy="Reset links are single-use, expire in thirty minutes, and are sent only to the address on the account."
    >
      <div className="auth-head">
        <span className="auth-eyebrow">ACCOUNT / RECOVERY</span>
        <h1 className="display auth-title">
          RESET YOUR <em className="serif">PASSWORD.</em>
        </h1>
        <p className="auth-lede">
          Enter the email address on your account and we will send a single-use reset link.
        </p>
      </div>

      {error && (
        <p className="auth-banner auth-banner--error" role="alert">
          {error}
        </p>
      )}

      {sent ? (
        <>
          <p className="auth-banner auth-banner--success" role="status">
            IF THAT ADDRESS HAS AN ACCOUNT, A RESET LINK IS ON ITS WAY.
          </p>
          <div className="auth-switch">
            <Link to="/login">← BACK TO SIGN IN</Link>
          </div>
        </>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <div className="auth-field">
            <label className="auth-field__label" htmlFor="forgot-email">
              <span>EMAIL</span>
            </label>
            <div className="auth-field__control">
              <input
                id="forgot-email"
                name="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck="false"
              />
            </div>
          </div>

          <button className="auth-submit" type="submit" disabled={busy}>
            <span>{busy ? 'SENDING…' : 'SEND RESET LINK'}</span>
            <span aria-hidden="true">{busy ? '···' : '→'}</span>
          </button>
        </form>
      )}

      <div className="auth-switch">
        <Link to="/login">← BACK TO SIGN IN</Link>
      </div>
    </AuthLayout>
  )
}
