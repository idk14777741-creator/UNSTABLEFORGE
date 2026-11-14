import { Link } from '../lib/router'
import Mark from './Mark'
import { brand } from '../data/site'

export default function AuthLayout({ mode, children, asideTitle, asideCopy }) {
  return (
    <div className="auth-shell">
      <header className="auth-bar">
        <Link className="auth-bar__brand" to="/" aria-label="Unstable Forge home">
          <Mark className="auth-bar__mark" />
          <span className="auth-bar__brand-copy">
            <span>{brand.name}</span>
            <small>{brand.tagline}</small>
          </span>
        </Link>
        <Link className="auth-bar__back" to="/">
          ← BACK TO THE EVENT
        </Link>
      </header>

      <div className="auth-grid">
        <aside className="auth-art" aria-hidden="true">
          <div className="auth-art__top">
            <span>C³ / CRESCENT CODE CLASH</span>
            <span>{mode === 'login' ? 'ACCESS / 01' : 'ACCESS / 02'}</span>
          </div>

          <div className="auth-art__form">
            <svg viewBox="0 0 620 620" fill="none" focusable="false">
              <defs>
                <linearGradient id="auth-rim" x1="120" y1="90" x2="500" y2="540">
                  <stop offset="0" stopColor="#E7A06B" />
                  <stop offset="0.55" stopColor="#B4512A" />
                  <stop offset="1" stopColor="#5C2B19" />
                </linearGradient>
              </defs>
              <circle cx="310" cy="310" r="288" stroke="#F4EFE5" strokeOpacity="0.08" />
              <circle
                cx="310"
                cy="310"
                r="250"
                stroke="#D07A45"
                strokeOpacity="0.28"
                strokeDasharray="1 12"
              />
              <path
                d="M470 150A212 212 0 1 0 470 470"
                stroke="url(#auth-rim)"
                strokeWidth="1.4"
              />
              <path
                d="M470 196A166 166 0 1 0 470 424"
                stroke="#F4EFE5"
                strokeOpacity="0.22"
              />
              <path d="M310 22v34M310 564v34M22 310h34M564 310h34" stroke="#F4EFE5" strokeOpacity="0.2" />
              <circle cx="470" cy="150" r="3.5" fill="#D07A45" />
            </svg>
          </div>

          <div className="auth-art__copy">
            <span className="auth-art__kicker">{brand.event}</span>
            <p className="display auth-art__title">{asideTitle}</p>
            <p className="auth-art__note">{asideCopy}</p>
          </div>

          <span className="auth-art__watermark">FORGE</span>
        </aside>

        <main id="main" className="auth-panel">
          <div className="auth-panel__inner">{children}</div>
          <p className="auth-panel__foot">
            <span className="status-dot" aria-hidden="true" />
            SECURE SESSION · {brand.initiative}
          </p>
        </main>
      </div>
    </div>
  )
}
