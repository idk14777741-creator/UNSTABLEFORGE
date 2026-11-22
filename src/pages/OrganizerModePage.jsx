import { useCallback, useEffect, useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import PasswordField from '../components/PasswordField'
import { Link, navigate } from '../lib/router'
import { apiRequest } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { readElevated, saveElevated } from '../lib/organizer'

/**
 * Dedicated organizer-mode entry point.
 *
 * The access code is a second factor, never the authorization itself: the API
 * only answers this account when it already holds an active organizer grant.
 * A successful verification returns a short-lived elevated token.
 */
export default function OrganizerModePage() {
  const { user, token, isOrganizer } = useAuth()
  const [status, setStatus] = useState(null)
  const [code, setCode] = useState('')
  const [newCode, setNewCode] = useState('')
  const [confirmCode, setConfirmCode] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    document.title = 'Organizer mode — Unstable Forge'
  }, [])

  const load = useCallback(async () => {
    const payload = await apiRequest('/api/auth/organizer/status', { token })
    setStatus(payload.data)
  }, [token])

  useEffect(() => {
    if (!token || !isOrganizer) return
    load().catch((loadError) => setError(loadError.message))
  }, [load, token, isOrganizer])

  if (!token) {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-kicker">ORGANIZER MODE</p>
          <h1 className="pf-title">
            Sign in <em>first.</em>
          </h1>
          <p className="pf-lede">Organizer mode is available to authorized organizer accounts.</p>
          <div className="pf-actions">
            <Link className="pf-btn" to="/login?next=%2Forganizer">
              SIGN IN
            </Link>
          </div>
        </div>
      </main>
    )
  }

  if (!isOrganizer) {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-kicker">ORGANIZER MODE</p>
          <h1 className="pf-title">
            Not <em>authorized.</em>
          </h1>
          <p className="pf-lede">
            You are signed in as {user?.email} with a participant account. Organizer mode is
            granted by the platform, not by the access code.
          </p>
          <div className="pf-actions">
            <Link className="pf-btn pf-btn--ghost" to="/dashboard">
              MY DASHBOARD
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const verify = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')
    try {
      const payload = await apiRequest('/api/auth/organizer/verify', {
        method: 'POST',
        token,
        body: { code },
      })
      saveElevated({ token: payload.data.token, expiresAt: payload.data.expiresAt })
      setCode('')
      navigate('/admin/platform', { replace: true })
    } catch (verifyError) {
      setError(verifyError.message)
      setBusy(false)
    }
  }

  const enroll = async (event) => {
    event.preventDefault()
    setError('')
    setMessage('')

    if (newCode.length < 8) {
      setError('Use at least 8 characters.')
      return
    }
    if (newCode !== confirmCode) {
      setError('The two codes do not match.')
      return
    }

    setBusy(true)
    try {
      await apiRequest('/api/auth/organizer/code', {
        method: 'POST',
        token,
        body: { code: newCode },
      })
      setNewCode('')
      setConfirmCode('')
      await load()
      setMessage('Access code set. Enter it below to unlock organizer mode.')
    } catch (enrollError) {
      setError(enrollError.message)
    } finally {
      setBusy(false)
    }
  }

  const elevated = readElevated()

  return (
    <AuthLayout
      mode="login"
      asideTitle="THE CONTROL ROOM IS LOCKED TWICE."
      asideCopy="Your organizer role authorizes the console. The personal access code unlocks the actions that move money, attendance and certificates."
    >
      <div className="auth-head">
        <span className="auth-eyebrow">ORGANIZER MODE</span>
        <h1 className="display auth-title">
          UNLOCK THE <em className="serif">FORGE.</em>
        </h1>
        <p className="auth-lede">
          Signed in as {user?.email}. The code is verified on the server and stored only as a
          hash.
        </p>
      </div>

      {error && (
        <p className="auth-banner auth-banner--error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="auth-banner auth-banner--success" role="status">
          {message}
        </p>
      )}

      {!status && !error && <p className="pf-row__meta">CHECKING ORGANIZER ACCESS…</p>}

      {status?.elevated && (
        <div className="auth-form">
          <p className="auth-banner auth-banner--success" role="status">
            ORGANIZER MODE IS UNLOCKED FOR THIS SESSION.
          </p>
          <Link className="auth-submit" to="/admin/platform">
            <span>OPEN THE PLATFORM CONSOLE</span>
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      )}

      {status && !status.elevated && status.hasCode && (
        <form className="auth-form" onSubmit={verify} noValidate>
          <PasswordField
            label="ORGANIZER ACCESS CODE"
            name="organizer-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            autoComplete="one-time-code"
          />
          <button className="auth-submit" type="submit" disabled={busy}>
            <span>{busy ? 'VERIFYING…' : 'ENTER ORGANIZER MODE'}</span>
            <span aria-hidden="true">{busy ? '···' : '→'}</span>
          </button>
        </form>
      )}

      {status && !status.hasCode && (
        <form className="auth-form" onSubmit={enroll} noValidate>
          <p className="auth-lede">
            This organizer account has no access code yet. Set one now — it is required before
            sensitive actions unlock.
          </p>
          <PasswordField
            label="NEW ACCESS CODE"
            name="new-organizer-code"
            value={newCode}
            onChange={(event) => setNewCode(event.target.value)}
            autoComplete="new-password"
            hint="8+ characters"
          />
          <PasswordField
            label="CONFIRM ACCESS CODE"
            name="confirm-organizer-code"
            value={confirmCode}
            onChange={(event) => setConfirmCode(event.target.value)}
            autoComplete="new-password"
          />
          <button className="auth-submit" type="submit" disabled={busy}>
            <span>{busy ? 'SETTING…' : 'SET ACCESS CODE'}</span>
            <span aria-hidden="true">{busy ? '···' : '→'}</span>
          </button>
        </form>
      )}

      <div className="auth-switch">
        <Link to="/admin">← BACK TO THE CONSOLE</Link>
      </div>
      <p className="auth-fineprint">
        {elevated
          ? 'Organizer mode is already unlocked in this tab. Opening the console uses the current session.'
          : 'The elevated session expires with the normal organizer session. Close the tab to end it sooner.'}
      </p>
    </AuthLayout>
  )
}
