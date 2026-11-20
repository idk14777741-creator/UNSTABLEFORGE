import { useEffect, useState } from 'react'
import Nav from './components/Nav'
import ScrollProgress from './components/ScrollProgress'
import Footer from './components/Footer'
import ForgedExperience from './cinematic/ForgedExperience'
import BriefPage from './pages/BriefPage'
import RegistrationDialog from './components/RegistrationDialog'
import RouteLoader from './components/RouteLoader'
import AnnouncementsPage from './pages/AnnouncementsPage'
import AnnouncementDetail from './pages/AnnouncementDetail'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import RegisterPage from './pages/RegisterPage'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetail from './pages/ProjectDetail'
import MyProjectsPage from './pages/MyProjectsPage'
import ProjectEditor from './pages/ProjectEditor'
import UnauthorizedPage from './pages/UnauthorizedPage'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminAnnouncements from './pages/admin/AdminAnnouncements'
import AdminEditor from './pages/admin/AdminEditor'
import AdminRegistrations from './pages/admin/AdminRegistrations'
import AdminProjects from './pages/admin/AdminProjects'
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

function RequireAuth({ children }) {
  const { status } = useAuth()
  const { pathname, search } = useRoute()

  if (status === 'checking') return <RouteLoader />

  if (status !== 'authenticated') {
    const target = `${pathname}${search}`
    return <Redirect to={`/login?next=${encodeURIComponent(target)}`} />
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
  const projectDetailMatch = pathname.match(/^\/projects\/(?!mine$|submit$)([^/]+)$/)
  const projectEditMatch = pathname.match(/^\/projects\/(\d+)\/edit$/)
  const isHome = pathname === '/'
  const isBrief = pathname === '/brief'
  const isAnnouncements = pathname === '/announcements'
  const isLogin = pathname === '/login'
  const isSignup = pathname === '/signup'
  const isRegister = pathname === '/register'
  const isProjects = pathname === '/projects'
  const isMyProjects = pathname === '/projects/mine'
  const isProjectSubmit = pathname === '/projects/submit'
  const isUnauthorized = pathname === '/unauthorized'
  const isAdminHome = pathname === '/admin'
  const isAdminList = pathname === '/admin/announcements'
  const isAdminNew = pathname === '/admin/announcements/new'
  const isAdminRegistrations = pathname === '/admin/registrations'
  const isAdminProjects = pathname === '/admin/projects'
  const isAuthPage = isLogin || isSignup
  const isKnownRoute =
    isHome ||
    isBrief ||
    isAnnouncements ||
    Boolean(detailMatch) ||
    isLogin ||
    isSignup ||
    isRegister ||
    isProjects ||
    Boolean(projectDetailMatch) ||
    isMyProjects ||
    isProjectSubmit ||
    Boolean(projectEditMatch) ||
    isUnauthorized ||
    isAdminHome ||
    isAdminList ||
    isAdminNew ||
    isAdminRegistrations ||
    isAdminProjects ||
    Boolean(editorMatch)

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        SKIP TO CONTENT
      </a>

      {!isAuthPage && !isHome && <ScrollProgress />}
      {!isAuthPage && <Nav onOpenRegistration={openRegistration} />}

      {isHome && <ForgedExperience />}

      {isBrief && <BriefPage onOpenRegistration={openRegistration} />}

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

      {isRegister && (
        <RequireAuth>
          <RegisterPage />
        </RequireAuth>
      )}

      {isProjects && <ProjectsPage />}

      {projectDetailMatch && <ProjectDetail slug={decodeURIComponent(projectDetailMatch[1])} />}

      {isMyProjects && (
        <RequireAuth>
          <MyProjectsPage />
        </RequireAuth>
      )}

      {isProjectSubmit && (
        <RequireAuth>
          <ProjectEditor />
        </RequireAuth>
      )}

      {projectEditMatch && (
        <RequireAuth>
          <ProjectEditor id={projectEditMatch[1]} />
        </RequireAuth>
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

      {isAdminRegistrations && (
        <RequireOrganizer>
          <AdminRegistrations />
        </RequireOrganizer>
      )}

      {isAdminProjects && (
        <RequireOrganizer>
          <AdminProjects />
        </RequireOrganizer>
      )}

      {editorMatch && (
        <RequireOrganizer>
          <AdminEditor id={editorMatch[1]} />
        </RequireOrganizer>
      )}

      {!isKnownRoute && <NotFound />}

      {!isAuthPage && !isHome && <Footer />}
      {!isAuthPage && (
        <RegistrationDialog open={registrationOpen} onClose={closeRegistration} />
      )}
      <div className="grain" aria-hidden="true" />
    </div>
  )
}
