import SectionLabel from './SectionLabel'

const slots = ['01', '02', '03']

export default function Tracks() {
  return (
    <section id="tracks" className="section tracks" aria-labelledby="tracks-title">
      <div className="container">
        <div className="tracks__head">
          <div>
            <SectionLabel number="03">TRACKS</SectionLabel>
            <h2 id="tracks-title" className="display tracks__title" data-reveal>
              EXPLORE THE{' '}
              <br />
              <em className="serif">TRACKS.</em>
            </h2>
          </div>
          <p className="tracks__intro" data-reveal style={{ '--reveal-delay': '100ms' }}>
            The brief is being forged. Official track themes and problem statements have not
            been released yet.
          </p>
        </div>

        <div className="tracks__status" data-reveal>
          <div className="tracks__status-copy">
            <span className="tracks__status-label">STATUS / UNRELEASED</span>
            <p className="tracks__status-title">
              TRACKS{' '}
              <br />
              <em>TO BE</em>{' '}
              <br />
              ANNOUNCED
            </p>
          </div>

          <div className="tracks__status-body">
            <span className="tracks__status-code">C³ / BRIEF — PENDING</span>
            <p>
              This space is reserved for the official brief. Track themes, problem statements,
              and judging criteria will be published here once they are final.
            </p>
            <span className="tracks__status-note">NO TRACKS HAVE BEEN ANNOUNCED.</span>
          </div>

          <svg className="tracks__orb" viewBox="0 0 220 220" fill="none" aria-hidden="true">
            <circle
              cx="110"
              cy="110"
              r="78"
              stroke="currentColor"
              strokeWidth="1"
              strokeDasharray="1 8"
              opacity="0.5"
            />
            <path
              d="M164 56A76 76 0 1 0 164 164"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.65"
            />
            <circle cx="110" cy="110" r="94" stroke="currentColor" strokeWidth="1" opacity="0.18" />
            <path
              d="M110 32v16M110 172v16M32 110h16M172 110h16"
              stroke="currentColor"
              strokeWidth="1"
              opacity="0.4"
            />
          </svg>
        </div>

        <div className="tracks__slots">
          {slots.map((slot, index) => (
            <article
              className="slot"
              key={slot}
              data-reveal
              style={{ '--reveal-delay': `${index * 90}ms` }}
            >
              <div className="slot__top">
                <span>SLOT / {slot}</span>
                <span className="slot__dot" aria-hidden="true" />
              </div>
              <div className="slot__body">
                <span className="slot__tba">TBA</span>
                <span className="slot__note">AWAITING BRIEF</span>
              </div>
              <div className="slot__foot">
                <span>THEME / PROBLEM</span>
                <span>—</span>
              </div>
            </article>
          ))}
        </div>

        <p className="tracks__disclaimer">
          PLACEHOLDER SLOTS — FINAL TRACK COUNT, THEMES, AND PROBLEM STATEMENTS TO BE
          ANNOUNCED.
        </p>
      </div>
    </section>
  )
}
