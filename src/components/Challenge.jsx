import { pillars } from '../data/site'
import SectionLabel from './SectionLabel'
import PillarMark from './PillarMark'

export default function Challenge() {
  return (
    <section
      id="challenge"
      className="section section--dark challenge"
      aria-labelledby="challenge-title"
    >
      <span className="challenge__watermark" aria-hidden="true">
        C³
      </span>

      <div className="container">
        <div className="challenge__head">
          <div className="challenge__label">
            <SectionLabel number="02" tone="light">
              THE CHALLENGE
            </SectionLabel>
            <p className="challenge__aside">
              THREE VERBS.
              <br />
              ONE STANDARD.
            </p>
          </div>

          <div className="challenge__heading">
            <h2 id="challenge-title" className="display challenge__title" data-reveal>
              THINK IT.{' '}
              <br />
              BUILD IT.{' '}
              <br />
              <em className="serif">PROVE IT.</em>
            </h2>
            <p className="challenge__intro" data-reveal style={{ '--reveal-delay': '100ms' }}>
              The work is the point. C³ is built around the distance between an idea and a
              working thing — and the decisions made in between.
            </p>
          </div>
        </div>

        <div className="pillars">
          {pillars.map((pillar, index) => (
            <article
              className="pillar"
              key={pillar.number}
              data-reveal
              style={{ '--reveal-delay': `${index * 90}ms` }}
            >
              <div className="pillar__top">
                <span className="pillar__number">{pillar.number}</span>
                <PillarMark variant={pillar.mark} />
              </div>
              <h3 className="pillar__title">{pillar.title}</h3>
              <p className="pillar__copy">{pillar.copy}</p>
              <span className="pillar__line" aria-hidden="true" />
            </article>
          ))}
        </div>

        <div className="challenge__note">
          <span className="status-dot" aria-hidden="true" />
          <p>CULTURAL THEMES — NOT OFFICIAL COMPETITION TRACKS.</p>
          <a className="text-link" href="#tracks">
            SEE TRACK STATUS <span aria-hidden="true">↗</span>
          </a>
        </div>
      </div>
    </section>
  )
}
