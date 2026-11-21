import { useEffect, useState } from 'react'
import { apiGet } from '../lib/api'

/**
 * Rendered only when the API reports Google sign-in as configured, so the
 * button is never decorative. The flow is a full-page redirect; identity is
 * verified server-side before a session is issued.
 */
export default function GoogleAuthButton({ next }) {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    let active = true
    apiGet('/api/auth/providers')
      .then((body) => {
        if (active) setEnabled(Boolean(body?.google))
      })
      .catch(() => {
        // Unreachable API: simply do not offer the option.
      })
    return () => {
      active = false
    }
  }, [])

  if (!enabled) return null

  const href = `/api/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ''}`

  return (
    <div className="auth-oauth">
      <span className="auth-oauth__divider">
        <span>OR</span>
      </span>
      <a className="auth-oauth__button" href={href}>
        <span className="auth-oauth__mark" aria-hidden="true">
          G
        </span>
        <span>CONTINUE WITH GOOGLE</span>
        <span aria-hidden="true">→</span>
      </a>
    </div>
  )
}
