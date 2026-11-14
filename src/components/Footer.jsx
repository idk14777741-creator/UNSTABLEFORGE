import { brand, navLinks, socials, updatesLink } from '../data/site'
import Mark from './Mark'
import { Link, useRoute } from '../lib/router'

const footerLinks = [
  ...navLinks,
  { id: 'stakes', label: 'PRIZE STATUS', href: '#stakes' },
  { id: 'participate', label: 'PARTICIPATE', href: '#participate' },
  { id: updatesLink.id, label: updatesLink.label, href: updatesLink.href },
]

export default function Footer() {
  const { pathname } = useRoute()
  const isHome = pathname === '/'
  const SectionTag = isHome ? 'a' : Link
  const BrandTag = isHome ? 'a' : Link
  const brandProps = isHome ? { href: '#top' } : { to: '/' }
  const sectionProps = (href) => (isHome ? { href } : { to: `/${href}` })

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
                  <span>DATE</span>
                  <span>TBA</span>
                </li>
                <li>
                  <span>VENUE</span>
                  <span>TBA</span>
                </li>
                <li>
                  <span>FORMAT</span>
                  <span>TBA</span>
                </li>
              </ul>
            </div>

            <div className="footer__col">
              <h2 className="footer__col-title">FOLLOW</h2>
              <ul>
                {socials.map((social) =>
                  social.url ? (
                    <li key={social.label}>
                      <a href={social.url} target="_blank" rel="noreferrer noopener">
                        {social.label} <span aria-hidden="true">↗</span>
                      </a>
                    </li>
                  ) : (
                    <li key={social.label}>
                      <span className="footer__pending" title="Link to be added">
                        {social.label}
                        <span className="footer__pending-tag">TBA</span>
                      </span>
                    </li>
                  ),
                )}
              </ul>
              <p className="footer__social-note">SOCIAL LINKS WILL BE ADDED WHEN FINAL.</p>
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
