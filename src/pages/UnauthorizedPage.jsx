import { useEffect } from 'react'
import { Link } from '../lib/router'
import { useAuth } from '../context/AuthContext'

export default function UnauthorizedPage() {
  const { user, logout } = useAuth()

  useEffect(() => {
    document.title = 'Not authorized — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  return (
    <main id="main" className="admin-main">
      <section className="section admin-locked">
        <div className="container">
          <span className="admin-state__label">ACCESS / 403</span>
          <h1 className="display admin-locked__title">
            NOT YOUR <em className="serif">FORGE.</em>
          </h1>
          <p className="admin-locked__copy">
            {user
              ? `You are signed in as ${user.email} with the participant role. The control room is limited to organizer accounts.`
              : 'This area requires an organizer account.'}
          </p>
          <p className="admin-locked__note">
            Backend authorization decides access on every request; hiding a link is never the
            only protection.
          </p>
          <div className="admin-locked__actions">
            <Link className="ann-action" to="/">
              RETURN TO THE EVENT
            </Link>
            <Link className="ann-action ann-action--ghost" to="/announcements">
              READ PUBLIC UPDATES
            </Link>
            <button
              type="button"
              className="ann-action ann-action--ghost"
              onClick={() => logout({ redirect: '/' })}
            >
              SIGN OUT
            </button>
          </div>
        </div>
      </section>
    </main>
  )
}
