import { useEffect, useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { Link, useRoute } from '../lib/router'
import { apiRequest } from '../lib/api'

export default function ResetPasswordPage() {
  const { search } = useRoute()
  const token = new URLSearchParams(search).get('token') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Choose a new password — Unstable Forge'
  }, [])

  const submit = async (event) => {
    event.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
      setError('Include at least one letter and one number.')
      return
    }
    if (password !== confirm) {
      setError('Passwords do not match.')
      return
    }

    setBusy(true)
    try {
      await apiRequest('/api/auth/reset-password', {
        method: 'POST',
        body: { token, password },
      })
      setDone(true)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      mode="login"
      asideTitle="ONE LINK. ONE NEW KEY."
      asideCopy="The reset link works once. Your existing password stops working the moment the new one is saved."
    >
      <div className="auth-head">
        <span className="auth-eyebrow">ACCOUNT / RESET</span>
        <h1 className="display auth-title">
          CHOOSE A <em className="serif">NEW PASSWORD.</em>
        </h1>
      </div>

      {error && (
        <p className="auth-banner auth-banner--error" role="alert">
          {error}
        </p>
      )}

      {!token && (
        <p className="auth-banner auth-banner--warning" role="alert">
          THIS PAGE NEEDS THE LINK FROM YOUR RESET EMAIL.
        </p>
      )}

      {done ? (
        <>
          <p className="auth-banner auth-banner--success" role="status">
            PASSWORD UPDATED. SIGN IN WITH THE NEW PASSWORD.
          </p>
          <div className="auth-switch">
            <Link className="auth-submit" to="/login">
              <span>SIGN IN</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </>
      ) : (
        <form className="auth-form" onSubmit={submit} noValidate>
          <PasswordField
            label="NEW PASSWORD"
            name="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            hint="8+ characters · letter + number"
          />
          <PasswordField
            label="CONFIRM NEW PASSWORD"
            name="confirm-password"
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            autoComplete="new-password"
          />
          <button className="auth-submit" type="submit" disabled={busy || !token}>
            <span>{busy ? 'SAVING…' : 'SAVE NEW PASSWORD'}</span>
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
