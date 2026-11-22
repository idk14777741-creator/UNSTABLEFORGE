import { brand, navLinks, projectsLink, updatesLink } from '../data/site'
import Mark from './Mark'
import { Link } from '../lib/router'

const footerLinks = [
  ...navLinks,
  { id: 'stakes', label: 'PRIZE STATUS', href: '/brief#stakes' },
  { id: 'participate', label: 'PARTICIPATE', href: '/brief#participate' },
  { id: projectsLink.id, label: 'PROJECT SHOWCASE', href: projectsLink.href },
  { id: updatesLink.id, label: updatesLink.label, href: updatesLink.href },
]

export default function Footer() {
  const SectionTag = Link
  const BrandTag = Link
  const brandProps = { to: '/' }
  const sectionProps = (href) => ({ to: href.startsWith('/') ? href : `/${href}` })

  return (
    <footer className="footer">
      <div className="container footer__inner">
        <div className="footer__top">
          <div className="footer__brand">
            <BrandTag
              className="footer__brand-link"
              {...brandProps}
              aria-label="Unstable Forge, back to top"
            >
              <Mark className="footer__mark" />
              <span>{brand.name}</span>
            </BrandTag>
            <p className="footer__tagline">
              WHERE IDEAS{' '}
              <br />
              <em className="serif">TAKE SHAPE.</em>
            </p>
            <p className="footer__event">{brand.event}</p>
          </div>

          <div className="footer__cols">
            <nav className="footer__col" aria-label="Footer navigation">
              <h2 className="footer__col-title">EXPLORE</h2>
              <ul>
                {footerLinks.map((link) => (
                  <li key={link.id}>
                    {link.href.startsWith('/') ? (
                      <Link to={link.href}>{link.label}</Link>
                    ) : (
                      <SectionTag {...sectionProps(link.href)}>{link.label}</SectionTag>
                    )}
                  </li>
                ))}
              </ul>
            </nav>

            <div className="footer__col">
              <h2 className="footer__col-title">EVENT</h2>
              <ul className="footer__facts">
                <li>
                  <span>EVENT</span>
                  <span>C³</span>
                </li>
                <li>
                  <span>AT STAKE</span>
                  <span>₹1,50,000</span>
                </li>
                <li>
                  <span>ENTRY</span>
                  <span>₹300 / TEAM</span>
                </li>
                <li>
                  <span>TEAM SIZE</span>
                  <span>1–4</span>
                </li>
              </ul>
            </div>

            <div className="footer__col">
              <h2 className="footer__col-title">UPDATES</h2>
              <ul>
                <li>
                  <Link to={updatesLink.href}>ANNOUNCEMENTS</Link>
                </li>
                <li>
                  <Link to="/events">ALL EVENTS</Link>
                </li>
                <li>
                  <Link to="/brief#faq">EVENT FAQ</Link>
                </li>
              </ul>
              <p className="footer__social-note">
                ORGANIZER DISPATCHES ARE PUBLISHED IN THE ARCHIVE FIRST.
              </p>
            </div>
          </div>
        </div>

        <div className="footer__bottom">
          <span>© UNSTABLE FORGE — CONCEPT EVENT EXPERIENCE</span>
          <span>{brand.initiative}</span>
          <BrandTag {...brandProps} className="footer__back">
            BACK TO TOP <span aria-hidden="true">↑</span>
          </BrandTag>
        </div>
      </div>

      <span className="footer__watermark" aria-hidden="true">
        FORGE
      </span>
    </footer>
  )
}
