import { useState } from 'react'
import Nav from './components/Nav'
import ScrollProgress from './components/ScrollProgress'
import Hero from './components/Hero'
import Idea from './components/Idea'
import Challenge from './components/Challenge'
import Tracks from './components/Tracks'
import Journey from './components/Journey'
import Stakes from './components/Stakes'
import Participate from './components/Participate'
import Faq from './components/Faq'
import FinalCta from './components/FinalCta'
import Footer from './components/Footer'
import RegistrationDialog from './components/RegistrationDialog'
import AnnouncementsPage from './pages/AnnouncementsPage'
import AnnouncementDetail from './pages/AnnouncementDetail'
import { Link, useRoute } from './lib/router'
import { useReveal } from './hooks/useReveal'

function NotFound() {
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

export default function App() {
  const [registrationOpen, setRegistrationOpen] = useState(false)
  const { pathname } = useRoute()
  useReveal(pathname)

  const openRegistration = () => setRegistrationOpen(true)
  const closeRegistration = () => setRegistrationOpen(false)

  const detailMatch = pathname.match(/^\/announcements\/([^/]+)$/)
  const isHome = pathname === '/'
  const isAnnouncements = pathname === '/announcements'

  return (
    <div className="page">
      <a className="skip-link" href="#main">
        SKIP TO CONTENT
      </a>

      <ScrollProgress />
      <Nav onOpenRegistration={openRegistration} />

      {isHome && (
        <main id="main">
          <Hero onOpenRegistration={openRegistration} />
          <Idea />
          <Challenge />
          <Tracks />
          <Journey />
          <Stakes />
          <Participate onOpenRegistration={openRegistration} />
          <Faq />
          <FinalCta onOpenRegistration={openRegistration} />
        </main>
      )}

      {isAnnouncements && <AnnouncementsPage />}

      {detailMatch && <AnnouncementDetail slug={decodeURIComponent(detailMatch[1])} />}

      {!isHome && !isAnnouncements && !detailMatch && <NotFound />}

      <Footer />
      <RegistrationDialog open={registrationOpen} onClose={closeRegistration} />
      <div className="grain" aria-hidden="true" />
    </div>
  )
}
