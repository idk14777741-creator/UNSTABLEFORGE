import { useEffect, useState } from 'react'
import Nav from './components/Nav'
import ScrollProgress from './components/ScrollProgress'
import ChapterHud from './components/ChapterHud'
import Hero from './components/Hero'
import Idea from './components/Idea'
import Challenge from './components/Challenge'
import Tracks from './components/Tracks'
import Journey from './components/Journey'
import Stakes from './components/Stakes'
import LatestFromForge from './components/LatestFromForge'
import Participate from './components/Participate'
import Faq from './components/Faq'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'
import RegistrationDialog from './components/RegistrationDialog'
import RouteLoader from './components/RouteLoader'
import AnnouncementsPage from './pages/AnnouncementsPage'
import AnnouncementDetail from './pages/AnnouncementDetail'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import UnauthorizedPage from './pages/UnauthorizedPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminAnnouncements from './pages/admin/AdminAnnouncements'
import AdminEditor from './pages/admin/AdminEditor'
import { Link, navigate, useRoute } from './lib/router'
import { roleHome, safeNext, useAuth } from './context/AuthContext'
import { useReveal } from './hooks/useReveal'

function NotFound() {
  useEffect(() => {
    document.title = 'Page not found — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  return (
    <main id="main" className="ann-main">
      <section className="section ann-missing">
        <div className="container">
          <Link className="ann-back ann-back--dark" to="/">
            ← BACK TO THE FORGE
          </Link>
          <span className="ann-state__label">PAGE / 404</span>
          <h1 className="display ann-missing__title">
            THIS PAGE HASN&apos;T BEEN <em className="serif">FORGED.</em>
          </h1>
          <p className="ann-missing__copy">
            The page you are looking for does not exist. The event itself is still here.
          </p>
          <div className="ann-missing__actions">
            <Link className="ann-action" to="/">
              RETURN HOME
            </Link>
            <Link className="ann-action ann-action--ghost" to="/announcements">
              READ THE UPDATES
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}

function Redirect({ to }) {
  useEffect(() => {
    navigate(to, { replace: true })
  }, [to])

  return <RouteLoader label="REDIRECTING" />
}

function GuestOnly({ children }) {
  const { status, user } = useAuth()
  const { search } = useRoute()

  if (status === 'checking') return <RouteLoader />

  if (status === 'authenticated') {
    const next = safeNext(new URLSearchParams(search).get('next'))
    return <Redirect to={next || roleHome(user)} />
  }

  return children
}

function RequireOrganizer({ children }) {
  const { status, isOrganizer, user } = useAuth()
  const { pathname, search } = useRoute()

  if (status === 'checking') return <RouteLoader />

  if (status !== 'authenticated') {
    const target = `${pathname}${search}`
    return <Redirect to={`/login?next=${encodeURIComponent(target)}`} />
  }

  if (!isOrganizer) {
    return <Redirect to="/unauthorized" />
  }

  if (!user) return <RouteLoader />

  return children
}

export default function App() {
  const [registrationOpen, setRegistrationOpen] = useState(false)
  const { pathname, search } = useRoute()
  useReveal(pathname)

  const openRegistration = () => setRegistrationOpen(true)
  const closeRegistration = () => setRegistrationOpen(false)

  const detailMatch = pathname.match(/^\/announcements\/([^/]+)$/)
  const editorMatch = pathname.match(/^\/admin\/announcements\/(\d+)\/edit$/)
  const isHome = pathname === '/'
  const isAnnouncements = pathname === '/announcements'
  const isLogin = pathname === '/login'
  const isSignup = pathname === '/signup'
  const isUnauthorized = pathname === '/unauthorized'
  const isAdminHome = pathname === '/admin'
  const isAdminList = pathname === '/admin/announcements'
  const isAdminNew = pathname === '/admin/announcements/new'
  const isAuthPage = isLogin || isSignup
  const isKnownRoute =
    isHome ||
    isAnnouncements ||
    Boolean(detailMatch) ||
    isLogin ||
    isSignup ||
    isUnauthorized ||
    isAdminHome ||
    isAdminList ||
    isAdminNew ||
    Boolean(editorMatch)

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        SKIP TO CONTENT
      </a>

      {!isAuthPage && <ScrollProgress />}
      {!isAuthPage && <Nav onOpenRegistration={openRegistration} />}

      {isHome && (
        <main id="main">
          <Hero onOpenRegistration={openRegistration} />
          <Idea />
          <Challenge />
          <Tracks />
          <Journey />
          <Stakes />
          <LatestFromForge />
          <Participate onOpenRegistration={openRegistration} />
          <Faq />
          <FinalCta onOpenRegistration={openRegistration} />
        </main>
      )}

      {isHome && <ChapterHud />}

      {isAnnouncements && <AnnouncementsPage />}

      {detailMatch && <AnnouncementDetail slug={decodeURIComponent(detailMatch[1])} />}

      {isLogin && (
        <GuestOnly>
          <LoginPage />
        </GuestOnly>
      )}

      {isSignup && (
        <GuestOnly>
          <SignupPage />
        </GuestOnly>
      )}

      {isUnauthorized && <UnauthorizedPage />}

      {isAdminHome && (
        <RequireOrganizer>
          <AdminDashboard />
        </RequireOrganizer>
      )}

      {isAdminList && (
        <RequireOrganizer>
          <AdminAnnouncements />
        </RequireOrganizer>
      )}

      {isAdminNew && (
        <RequireOrganizer>
          <AdminEditor />
        </RequireOrganizer>
      )}

      {editorMatch && (
        <RequireOrganizer>
          <AdminEditor id={editorMatch[1]} />
        </RequireOrganizer>
      )}

      {!isKnownRoute && <NotFound />}

      {!isAuthPage && <Footer />}
      {!isAuthPage && (
        <RegistrationDialog open={registrationOpen} onClose={closeRegistration} />
      )}
      <div className="grain" aria-hidden="true" />
    </div>
  )
}
