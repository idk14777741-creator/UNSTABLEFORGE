import { participation } from '../data/site'
import SectionLabel from './SectionLabel'
import Cta from './Cta'

export default function Participate({ onOpenRegistration }) {
  return (
    <section
      id="participate"
      className="section participate"
      aria-labelledby="participate-title"
    >
      <div className="container participate__grid">
        <div className="participate__intro">
          <SectionLabel number="06">PARTICIPATE</SectionLabel>
          <h2 id="participate-title" className="display participate__title" data-reveal>
            MAKE{' '}
            <br />
            <em className="serif">YOUR MOVE.</em>
          </h2>
          <p className="participate__copy" data-reveal style={{ '--reveal-delay': '100ms' }}>
            C³ is designed for students across ALTA campuses. Final eligibility, team rules,
            and the participation format will be published with registration details.
          </p>

          <div className="participate__status" data-reveal style={{ '--reveal-delay': '160ms' }}>
            <span className="status-dot" aria-hidden="true" />
            <span>REGISTRATION / NOT YET OPEN</span>
          </div>

          <div className="participate__actions" data-reveal style={{ '--reveal-delay': '200ms' }}>
            <Cta onClick={onOpenRegistration} opensDialog>
              REGISTRATION DETAILS
            </Cta>
            <a className="text-link" href="#faq">
              READ THE FAQ <span aria-hidden="true">↓</span>
            </a>
          </div>

          <p className="participate__note">
            No sign-up is open on this page. Details will be posted when they are final.
          </p>
        </div>

        <div className="specs" data-reveal style={{ '--reveal-delay': '120ms' }}>
          <div className="specs__head">
            <span>PARTICIPATION / SPECS</span>
            <span>STATUS</span>
          </div>
          <dl>
            {participation.map((row) => (
              <div className="specs__row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>
          <p className="specs__foot">FINAL DETAILS SUBJECT TO ORGANIZER CONFIRMATION.</p>
        </div>
      </div>
    </section>
  )
}
