import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { navLinks, brand, projectsLink, updatesLink } from '../data/site'
import Mark from './Mark'
import Cta from './Cta'
import { Link, useRoute } from '../lib/router'
import { useAuth } from '../context/AuthContext'
import { lockScroll, releaseScroll } from '../lib/scrollLock'

/**
 * Relative luminance of an opaque CSS colour, or null when the colour is
 * transparent enough that whatever sits behind it shows through.
 */
function backgroundLuminance(value) {
  const channels = String(value).match(/[\d.]+/g)
  if (!channels || channels.length < 3) return null

  const [r, g, b] = channels.slice(0, 3).map(Number)
  const alpha = channels.length > 3 ? Number(channels[3]) : 1
  if (!Number.isFinite(alpha) || alpha < 0.9) return null

  const linear = (channel) => {
    const s = channel / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/**
 * Whether the page behind the fixed header is dark.
 *
 * Several pages show a paper band under the header before their dark hero
 * begins, so a hard-coded route list picks the wrong palette in both
 * directions. Measuring what is actually behind the bar keeps the approved
 * over-dark look without ever making the links invisible.
 */
function useBackdropIsDark(pathname) {
  const [dark, setDark] = useState(false)

  useEffect(() => {
    let frame = 0
    let lastValue = null

    const measure = () => {
      frame = 0
      if (typeof document.elementsFromPoint !== 'function') return
      const header = document.querySelector('.nav')
      if (!header) return

      const y = Math.max(1, Math.round(header.getBoundingClientRect().height) - 10)
      const stack = document.elementsFromPoint(Math.round(window.innerWidth / 2), y)
      const backdrop = stack.find((element) => !element.closest('.nav'))
      if (!backdrop) return

      let node = backdrop
      let luminance = null
      while (node) {
        luminance = backgroundLuminance(getComputedStyle(node).backgroundColor)
        if (luminance !== null) break
        node = node.parentElement
      }

      const next = (luminance ?? 1) < 0.2
      if (next !== lastValue) {
        lastValue = next
        setDark(next)
      }
    }

    const request = () => {
      if (!frame) frame = window.requestAnimationFrame(measure)
    }

    request()
    // A loading skeleton can be replaced by the real hero after the first
    // paint, so re-measure whenever content actually changes.
    const observer =
      typeof MutationObserver === 'function' ? new MutationObserver(request) : null
    observer?.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('scroll', request, { passive: true })
    window.addEventListener('resize', request)

    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      observer?.disconnect()
      window.removeEventListener('scroll', request)
      window.removeEventListener('resize', request)
    }
  }, [pathname])

  return dark
}

export default function Nav({ onOpenRegistration }) {
  const { pathname } = useRoute()
  const { status, user, isOrganizer, logout } = useAuth()
  const isHome = pathname === '/'
  const isUpdates = pathname.startsWith('/announcements')
  const isAdmin = pathname.startsWith('/admin')
  const isProjects = pathname.startsWith('/projects')
  const isEvents = pathname.startsWith('/events')
  const isDashboard = pathname.startsWith('/dashboard')
  const SectionTag = Link
  const BrandTag = Link
  const sectionProps = (link) => ({ to: link.href })
  const brandProps = { to: '/' }
  const [scrolled, setScrolled] = useState(false)
  // The palette follows what the bar actually sits on, not the route name.
  const overDark = useBackdropIsDark(pathname) && !isHome
  const [active, setActive] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const menuButtonRef = useRef(null)
  const closeButtonRef = useRef(null)
  const overlayRef = useRef(null)
  const skipFocusRestoreRef = useRef(false)

  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      setScrolled(window.scrollY > 24)
    }
    const request = () => {
      if (!frame) frame = window.requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', request, { passive: true })
    return () => {
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('scroll', request)
    }
  }, [])

  useEffect(() => {
    const sections = navLinks
      .map((link) => document.getElementById(link.id))
      .filter(Boolean)

    if (!sections.length || !('IntersectionObserver' in window)) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(entry.target.id)
        })
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: 0 },
    )

    sections.forEach((section) => observer.observe(section))
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!menuOpen) return undefined

    const previousFocus = document.activeElement
    lockScroll()

    const focusClose = window.requestAnimationFrame(() => closeButtonRef.current?.focus())

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setMenuOpen(false)
        return
      }

      if (event.key !== 'Tab' || !overlayRef.current) return

      const focusable = Array.from(
        overlayRef.current.querySelectorAll('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'),
      ).filter((element) => element.offsetParent !== null)

      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const onResize = () => {
      if (window.innerWidth > 1024) setMenuOpen(false)
    }

    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onResize)

    return () => {
      window.cancelAnimationFrame(focusClose)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onResize)
      releaseScroll()
      if (!skipFocusRestoreRef.current && previousFocus instanceof HTMLElement) {
        window.requestAnimationFrame(() => previousFocus.focus())
      }
      skipFocusRestoreRef.current = false
    }
  }, [menuOpen])

  const handleMenuCta = () => {
    skipFocusRestoreRef.current = true
    setMenuOpen(false)
    onOpenRegistration()
  }

  const handleMenuNavigate = () => {
    skipFocusRestoreRef.current = true
    setMenuOpen(false)
  }
  const handleLogout = () => {
    setMenuOpen(false)
    logout({ redirect: '/' })
  }

  const menu = menuOpen
    ? createPortal(
        <div
          className="menu"
          id="mobile-navigation"
          role="dialog"
          aria-modal="true"
          aria-label="Site navigation"
          ref={overlayRef}
        >
          <div className="menu__top">
            <BrandTag className="menu__brand" {...brandProps} onClick={handleMenuNavigate}>
              <Mark className="menu__mark" />
              <span>{brand.name}</span>
            </BrandTag>
            <button
              className="menu__close"
              type="button"
              onClick={() => setMenuOpen(false)}
              ref={closeButtonRef}
              aria-label="Close menu"
            >
              <span>CLOSE</span>
              <span className="menu__close-x" aria-hidden="true">
                ×
              </span>
            </button>
          </div>

          <nav className="menu__nav" aria-label="Mobile navigation">
            {navLinks.map((link, index) => (
              <SectionTag
                key={link.id}
                className="menu__link"
                {...sectionProps(link)}
                onClick={handleMenuNavigate}
                style={{ '--menu-index': index }}
              >
                <span className="menu__index">0{index + 1}</span>
                <span>{link.label}</span>
                <span className="menu__arrow" aria-hidden="true">
                  ↗
                </span>
              </SectionTag>
            ))}
            <Link
              className="menu__link"
              to={projectsLink.href}
              onClick={handleMenuNavigate}
              style={{ '--menu-index': navLinks.length }}
              aria-current={isProjects ? 'page' : undefined}
            >
              <span className="menu__index">0{navLinks.length + 1}</span>
              <span>{projectsLink.label}</span>
              <span className="menu__arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
            <Link
              className="menu__link"
              to={updatesLink.href}
              onClick={handleMenuNavigate}
              style={{ '--menu-index': navLinks.length + 1 }}
              aria-current={isUpdates ? 'page' : undefined}
            >
              <span className="menu__index">0{navLinks.length + 2}</span>
              <span>{updatesLink.label}</span>
              <span className="menu__arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          </nav>

          <div className="menu__account">
            {status === 'authenticated' ? (
              <>
                <span className="menu__account-id">{user?.email}</span>
                <div className="menu__account-links">
                  <Link to="/register" onClick={handleMenuNavigate}>
                    MY REGISTRATION
                  </Link>
                  <Link to="/projects/mine" onClick={handleMenuNavigate}>
                    MY PROJECTS
                  </Link>
                  {isOrganizer && (
                    <>
                      <Link to="/organizer" onClick={handleMenuNavigate}>
                        ORGANIZER MODE ↗
                      </Link>
                      <Link to="/admin" onClick={handleMenuNavigate}>
                        CONTROL ROOM ↗
                      </Link>
                    </>
                  )}
                  <button type="button" onClick={handleLogout}>
                    LOG OUT
                  </button>
                </div>
              </>
            ) : (
              <div className="menu__account-links">
                <Link to="/login" onClick={handleMenuNavigate}>
                  LOG IN ↗
                </Link>
                <Link to="/signup" onClick={handleMenuNavigate}>
                  CREATE ACCOUNT ↗
                </Link>
              </div>
            )}
          </div>

          <div className="menu__foot">
            <div>
              <p className="menu__event">{brand.event}</p>
              <p className="menu__note">REGISTRATION IS OPEN</p>
            </div>
            <Cta onClick={handleMenuCta} variant="light" opensDialog>
              REGISTRATION DETAILS
            </Cta>
          </div>
        </div>,
        document.body,
      )
    : null

  return (
    <>
      <header
        className={`nav ${scrolled ? 'is-scrolled' : ''} ${overDark ? 'nav--over-dark' : ''} ${isHome ? 'nav--cinematic' : ''}`}
      >
        <BrandTag className="nav__brand" {...brandProps} aria-label="Unstable Forge, back to top">
          <Mark className="nav__mark" />
          <span className="nav__brand-copy">
            <span className="nav__name">{brand.name}</span>
            <span className="nav__tagline">{brand.tagline}</span>
          </span>
        </BrandTag>

        <nav className="nav__links" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <SectionTag
              key={link.id}
              className={`nav__link ${isHome && active === link.id ? 'is-active' : ''}`}
              {...sectionProps(link)}
              aria-current={isHome && active === link.id ? 'location' : undefined}
            >
              {link.label}
            </SectionTag>
          ))}
          <Link
            className={`nav__link ${isEvents ? 'is-active' : ''}`}
            to="/events"
            aria-current={isEvents ? 'page' : undefined}
          >
            EVENTS
          </Link>
          <Link
            className={`nav__link ${isProjects ? 'is-active' : ''}`}
            to={projectsLink.href}
            aria-current={isProjects ? 'page' : undefined}
          >
            {projectsLink.label}
          </Link>
          <Link
            className={`nav__link ${isUpdates ? 'is-active' : ''}`}
            to={updatesLink.href}
            aria-current={isUpdates ? 'page' : undefined}
          >
            {updatesLink.label}
          </Link>
        </nav>

        <div className="nav__actions">
          <span className="nav__event-status">C³ / ₹1.5L AT STAKE</span>
          {status === 'authenticated' ? (
            <div className="nav__account">
                                <Link
                    className={`nav__account-link ${isDashboard ? 'is-active' : ''}`}
                    to="/dashboard"
                    aria-current={isDashboard ? 'page' : undefined}
                  >
                    MY DASHBOARD
                  </Link>
              {isOrganizer && (
                <>
                  <Link className="nav__account-link" to="/organizer">
                    ORGANIZER
                  </Link>
                  <Link
                    className={`nav__account-link ${isAdmin ? 'is-active' : ''}`}
                    to="/admin"
                    aria-current={isAdmin ? 'page' : undefined}
                  >
                    ADMIN
                  </Link>
                </>
              )}
              <button className="nav__auth-button" type="button" onClick={handleLogout}>
                LOG OUT
              </button>
            </div>
          ) : (
            status === 'anonymous' && (
              <Link className="nav__account-link" to="/login">
                LOG IN
              </Link>
            )
          )}
          <Cta
            className="cta--nav"
            variant="outline"
            onClick={onOpenRegistration}
            opensDialog
          >
            REGISTRATION
          </Cta>
          <button
            className="nav__menu-button"
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="mobile-navigation"
            ref={menuButtonRef}
          >
            <span />
            <span />
          </button>
        </div>
      </header>
      {menu}
    </>
  )
}
