import { useEffect, useRef, useState } from 'react'
import AuthLayout from '../components/AuthLayout'
import { Link, useRoute } from '../lib/router'
import { apiRequest } from '../lib/api'

export default function VerifyEmailPage() {
  const { search } = useRoute()
  const token = new URLSearchParams(search).get('token') || ''
  const [state, setState] = useState({ status: token ? 'checking' : 'missing', message: '' })
  const startedRef = useRef(false)

  useEffect(() => {
    document.title = 'Confirm email — Unstable Forge'
  }, [])

  useEffect(() => {
    if (!token || startedRef.current) return
    startedRef.current = true

    let active = true
    apiRequest('/api/auth/verify-email/confirm', { method: 'POST', body: { token } })
      .then((payload) => {
        if (!active) return
        setState({
          status: 'verified',
          message:
            payload?.data?.claimed > 0
              ? `${payload.data.claimed} existing participation record(s) are now linked to your account.`
              : '',
        })
      })
      .catch((error) => {
        if (active) setState({ status: 'failed', message: error.message })
      })

    return () => {
      active = false
    }
  }, [token])

  const copy = {
    missing: 'This page needs the link from your verification email.',
    checking: 'CONFIRMING YOUR EMAIL ADDRESS…',
    verified: 'YOUR EMAIL ADDRESS IS CONFIRMED.',
    failed: state.message,
  }[state.status]

  return (
    <AuthLayout
      mode="login"
      asideTitle="A CONFIRMED ADDRESS."
      asideCopy="Verification links expire after twenty-four hours and can be used once."
    >
      <div className="auth-head">
        <span className="auth-eyebrow">ACCOUNT / VERIFICATION</span>
        <h1 className="display auth-title">
          {state.status === 'verified' ? (
            <>
              YOU&apos;RE <em className="serif">CONFIRMED.</em>
            </>
          ) : (
            <>
              CONFIRM YOUR <em className="serif">EMAIL.</em>
            </>
          )}
        </h1>
      </div>

      <p
        className={`auth-banner ${
          state.status === 'verified'
            ? 'auth-banner--success'
            : state.status === 'failed'
              ? 'auth-banner--error'
              : 'auth-banner--warning'
        }`}
        role="status"
      >
        {copy}
      </p>

      {state.message && state.status === 'verified' && (
        <p className="auth-lede">{state.message}</p>
      )}

      <div className="auth-switch">
        <Link to={state.status === 'verified' ? '/dashboard' : '/login'}>
          {state.status === 'verified' ? 'OPEN MY DASHBOARD →' : '← BACK TO SIGN IN'}
        </Link>
      </div>
    </AuthLayout>
  )
}
