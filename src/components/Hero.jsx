import { brand, eventFacts } from '../data/site'
import Mark from './Mark'
import Cta from './Cta'
import CrescentArt from './CrescentArt'

export default function Hero({ onOpenRegistration }) {
  return (
    <section id="top" className="hero" aria-labelledby="hero-title">
      <div className="container hero__grid">
        <div className="hero__content">
          <div className="hero__masthead" data-reveal>
            <Mark className="hero__mark" />
            <span className="hero__brand">{brand.name}</span>
            <span className="hero__masthead-rule" aria-hidden="true" />
            <span className="hero__tagline">{brand.tagline}</span>
          </div>

          <div className="hero__event" data-reveal style={{ '--reveal-delay': '60ms' }}>
            <span className="hero__c3">C³</span>
            <span className="hero__event-copy">
              <span className="hero__event-name">{brand.eventName}</span>
              <span className="hero__event-meta">
                {brand.audience} <span aria-hidden="true">/</span> PRONOUNCED “C CUBE”
              </span>
            </span>
          </div>

          <h1 id="hero-title" className="hero__title" aria-label="Build beyond the expected.">
            <span className="hero__line" data-reveal style={{ '--reveal-delay': '120ms' }}>
              BUILD BEYOND
            </span>{' '}
            <span
              className="hero__line hero__line--second"
              data-reveal
              style={{ '--reveal-delay': '200ms' }}
            >
              THE <em className="serif">EXPECTED.</em>
            </span>
          </h1>

          <div className="hero__lower" data-reveal style={{ '--reveal-delay': '280ms' }}>
            <p className="hero__lede">
              One challenge. Countless possibilities. A space for builders to turn ambitious
              ideas into something real.
            </p>

            <div className="hero__actions">
              <Cta href="#idea" variant="solid">
                EXPLORE THE EVENT
              </Cta>
              <Cta variant="ghost" onClick={onOpenRegistration} opensDialog>
                REGISTRATION DETAILS
              </Cta>
            </div>

            <p className="hero__status">
              <span className="status-dot" aria-hidden="true" />
              <span>REGISTRATION NOT OPEN YET</span>
              <span className="hero__status-sep" aria-hidden="true">
                /
              </span>
              <span>DETAILS TBA</span>
            </p>

            <div className="hero__scroll" aria-hidden="true">
              <span className="hero__scroll-track">
                <span className="hero__scroll-dot" />
              </span>
              <span className="hero__scroll-label">SCROLL TO EXPLORE</span>
            </div>
          </div>
        </div>

        <div className="hero__visual">
          <span className="hero__visual-index" aria-hidden="true">
            01 / 08
          </span>
          <CrescentArt />
        </div>
      </div>

      <div className="event-strip" aria-label="Event information">
        <div className="container event-strip__inner">
          <div className="event-strip__cell event-strip__cell--event">
            <span className="event-strip__label">FEATURED EVENT</span>
            <span className="event-strip__event">
              <span className="event-strip__c3">C³</span>
              <span className="event-strip__name">{brand.eventName}</span>
            </span>
          </div>

          {eventFacts.map((fact) => (
            <div className="event-strip__cell" key={fact.label}>
              <span className="event-strip__label">{fact.label}</span>
              <span className="event-strip__value">
                <span className="event-strip__dot" aria-hidden="true" />
                {fact.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
