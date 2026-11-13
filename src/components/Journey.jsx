import { journey } from '../data/site'
import SectionLabel from './SectionLabel'

export default function Journey() {
  return (
    <section
      id="journey"
      className="section section--paper journey"
      aria-labelledby="journey-title"
    >
      <div className="container journey__grid">
        <div className="journey__side">
          <SectionLabel number="04">THE JOURNEY</SectionLabel>
          <h2 id="journey-title" className="display journey__title" data-reveal>
            SIX MOMENTS.{' '}
            <br />
            <em className="serif">ONE BUILD.</em>
          </h2>
          <p className="journey__intro" data-reveal style={{ '--reveal-delay': '100ms' }}>
            The sequence is set. The dates are not. Every milestone will be confirmed before
            registration opens.
          </p>
          <div className="journey__legend">
            <span className="status-dot" aria-hidden="true" />
            <span>ALL DATES TBA</span>
          </div>
        </div>

        <div className="journey__timeline">
          <ol className="timeline">
            {journey.map((step, index) => (
              <li
                className="timeline__row"
                key={step.number}
                data-reveal
                style={{ '--reveal-delay': `${index * 70}ms` }}
              >
                <span className="timeline__index" aria-hidden="true">
                  {step.number}
                </span>
                <div className="timeline__body">
                  <div className="timeline__top">
                    <h3 className="timeline__title">{step.title}</h3>
                    <span className="timeline__date">{step.date}</span>
                  </div>
                  <p className="timeline__copy">{step.copy}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className="journey__footnote">SEQUENCE SUBJECT TO ORGANIZER CONFIRMATION.</p>
        </div>
      </div>
    </section>
  )
}
