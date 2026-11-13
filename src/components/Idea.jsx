import SectionLabel from './SectionLabel'

export default function Idea() {
  return (
    <section id="idea" className="section idea" aria-labelledby="idea-title">
      <div className="container idea__grid">
        <aside className="idea__side">
          <SectionLabel number="01">THE IDEA</SectionLabel>
          <p className="idea__side-note">
            A BUILD-FIRST HACKATHON
            <br />
            FOR ALTA CAMPUS STUDENTS
          </p>
          <span className="idea__ghost" aria-hidden="true">
            01
          </span>
        </aside>

        <div className="idea__main">
          <h2 id="idea-title" className="display idea__title" data-reveal>
            IT STARTS{' '}
            <br />
            WITH AN <em className="serif">IDEA.</em>
          </h2>

          <div className="idea__copy" data-reveal style={{ '--reveal-delay': '100ms' }}>
            <p>
              C³ is a build-first hackathon for students across ALTA campuses. One brief, a
              finite window, and enough room to turn an ambitious idea into something that
              actually runs.
            </p>
            <p>
              Unstable Forge is the event experience around the build — the brief, the format,
              the timeline, and the work. No noise. No filler. Just a clear invitation to make
              something real.
            </p>
            <p className="idea__micro">C³ / CRESCENT CODE CLASH / A STUDY IN BUILDING</p>
          </div>

          <div className="idea__statement" data-reveal style={{ '--reveal-delay': '180ms' }}>
            <span className="idea__statement-mark" aria-hidden="true">
              ↳
            </span>
            <p>
              THE WORK{' '}
              <br />
              IS THE POINT.
            </p>
            <span className="idea__statement-note">BUILD-FIRST / MAKE IT REAL</span>
          </div>
        </div>
      </div>

      <div className="ticker" aria-hidden="true">
        <div className="ticker__track">
          {[0, 1].map((group) => (
            <div className="ticker__group" key={group}>
              <span>IDEA</span>
              <span className="ticker__mark" />
              <span>PROTOTYPE</span>
              <span className="ticker__mark" />
              <span>PROOF</span>
              <span className="ticker__mark" />
              <span>REPEAT</span>
              <span className="ticker__mark" />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
