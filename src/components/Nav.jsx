import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { navLinks, brand, updatesLink } from '../data/site'
import Mark from './Mark'
import Cta from './Cta'
import { Link, useRoute } from '../lib/router'
import { lockScroll, releaseScroll } from '../lib/scrollLock'

export default function Nav({ onOpenRegistration }) {
  const { pathname } = useRoute()
  const isHome = pathname === '/'
  const isUpdates = pathname.startsWith('/announcements')
  const sectionHref = (link) => (isHome ? link.href : `/${link.href}`)
  const homeHref = isHome ? '#top' : '/'
  const [scrolled, setScrolled] = useState(false)
  const overDark = isUpdates && !scrolled
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

  const handleMenuNavigate = () => setMenuOpen(false)

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
            <a className="menu__brand" href={homeHref} onClick={handleMenuNavigate}>
              <Mark className="menu__mark" />
              <span>{brand.name}</span>
            </a>
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
              <a
                key={link.id}
                className="menu__link"
                href={sectionHref(link)}
                onClick={handleMenuNavigate}
                style={{ '--menu-index': index }}
              >
                <span className="menu__index">0{index + 1}</span>
                <span>{link.label}</span>
                <span className="menu__arrow" aria-hidden="true">
                  ↗
                </span>
              </a>
                          ))}
            <Link
              className="menu__link"
              to={updatesLink.href}
              onClick={handleMenuNavigate}
              style={{ '--menu-index': navLinks.length }}
              aria-current={isUpdates ? 'page' : undefined}
            >
              <span className="menu__index">0{navLinks.length + 1}</span>
              <span>{updatesLink.label}</span>
              <span className="menu__arrow" aria-hidden="true">
                ↗
              </span>
            </Link>
          </nav>

          <div className="menu__foot">
            <div>
              <p className="menu__event">{brand.event}</p>
              <p className="menu__note">REGISTRATION DETAILS · TBA</p>
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
        className={`nav ${scrolled ? 'is-scrolled' : ''} ${overDark ? 'nav--over-dark' : ''}`}
      >
        <a className="nav__brand" href={homeHref} aria-label="Unstable Forge, back to top">
          <Mark className="nav__mark" />
          <span className="nav__brand-copy">
            <span className="nav__name">{brand.name}</span>
            <span className="nav__tagline">{brand.tagline}</span>
          </span>
        </a>

        <nav className="nav__links" aria-label="Primary navigation">
          {navLinks.map((link) => (
            <a
              key={link.id}
              className={`nav__link ${isHome && active === link.id ? 'is-active' : ''}`}
              href={sectionHref(link)}
              aria-current={isHome && active === link.id ? 'location' : undefined}
            >
              {link.label}
            </a>
          ))}
          <Link
            className={`nav__link ${isUpdates ? 'is-active' : ''}`}
            to={updatesLink.href}
            aria-current={isUpdates ? 'page' : undefined}
          >
            {updatesLink.label}
          </Link>
        </nav>

        <div className="nav__actions">
          <span className="nav__event-status">C³ / TBA</span>
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
