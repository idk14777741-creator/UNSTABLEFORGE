import { participation } from '../data/site'
import SectionLabel from './SectionLabel'
import Cta from './Cta'
import { Link } from '../lib/router'

export default function Participate({ onOpenRegistration }) {
  return (
    <section
      id="participate"
      className="section participate"
      aria-labelledby="participate-title"
    >
      <div className="container participate__grid">
        <div className="participate__intro">
          <SectionLabel number="07">PARTICIPATE</SectionLabel>
          <h2 id="participate-title" className="display participate__title" data-reveal>
            MAKE{' '}
            <br />
            <em className="serif">YOUR MOVE.</em>
          </h2>
          <p className="participate__copy" data-reveal style={{ '--reveal-delay': '100ms' }}>
            C³ is open to students across ALTA campuses. Register a team of one to four, pay
            ₹300 once as captain, and every teammate receives their own entry pass.
          </p>

          <div className="participate__status" data-reveal style={{ '--reveal-delay': '160ms' }}>
            <span className="status-dot" aria-hidden="true" />
            <span>REGISTRATION / OPEN</span>
          </div>

          <div className="participate__actions" data-reveal style={{ '--reveal-delay': '200ms' }}>
            <Cta to="/register">REGISTER FOR C³</Cta>
            <a className="text-link" href="#faq">
              READ THE FAQ <span aria-hidden="true">↓</span>
            </a>
          </div>

          <p className="participate__note">
            Register with a participant account. ₹1,50,000 is at stake across a field of 120
            participants.
          </p>
        </div>

        <div
          className="entry-pass"
          data-reveal
          style={{ '--reveal-delay': '120ms' }}
          role="group"
          aria-label="Participation pass — registration open"
        >
          <div className="entry-pass__head">
            <span>C³ / ENTRY PASS</span>
            <span className="entry-pass__state">
              <span className="status-dot" aria-hidden="true" />
              REGISTRATION OPEN
            </span>
          </div>

          <div className="entry-pass__body">
            <div className="entry-pass__identity">
              <span className="entry-pass__kicker">ADMISSION</span>
              <strong className="entry-pass__title">
                BUILD
                <br />
                <em className="serif">PASS.</em>
              </strong>
              <span className="entry-pass__audience">ALTA CAMPUS STUDENTS</span>
            </div>

            <div className="entry-pass__stub">
              <span>PASS NO.</span>
              <strong>—</strong>
              <span>ISSUED AFTER REGISTRATION</span>
            </div>
          </div>

          <dl className="entry-pass__specs">
            {participation.map((row) => (
              <div className="entry-pass__row" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.value}</dd>
              </div>
            ))}
          </dl>

          <div className="entry-pass__foot">
            <span>TEAMS OF 1–4 · ₹300 PER TEAM.</span>
            <Link to="/register">
              OPEN THE REGISTRATION DESK <span aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
