import SectionLabel from './SectionLabel'

export default function Stakes() {
  return (
    <section
      id="stakes"
      className="section section--dark stakes"
      aria-labelledby="stakes-title"
    >
      <div className="container stakes__grid">
        <div className="stakes__copy">
          <SectionLabel number="05" tone="light">
            THE STAKES
          </SectionLabel>
          <h2 id="stakes-title" className="display stakes__title" data-reveal>
            WHAT’S{' '}
            <br />
            <em className="serif">AT STAKE.</em>
          </h2>
          <p className="stakes__intro" data-reveal style={{ '--reveal-delay': '100ms' }}>
            The prize and recognition structure is still being confirmed. Amounts, sponsor
            commitments, and award categories have not been announced — so none are shown here.
          </p>

          <div className="stakes__facts" data-reveal style={{ '--reveal-delay': '160ms' }}>
            <span>PRIZE POOL / TBA</span>
            <span>SPONSORS / TBA</span>
            <span>AWARDS / TBA</span>
          </div>
        </div>

        <div className="seal" data-reveal style={{ '--reveal-delay': '140ms' }}>
          <div className="seal__rings" aria-hidden="true">
            <span className="seal__ring seal__ring--outer" />
            <span className="seal__ring seal__ring--dashed" />
            <span className="seal__ring seal__ring--inner" />
          </div>
          <div className="seal__cross seal__cross--top" aria-hidden="true" />
          <div className="seal__cross seal__cross--bottom" aria-hidden="true" />
          <div className="seal__inner">
            <span className="seal__kicker">PRIZE DETAILS COMING SOON</span>
            <strong className="seal__tba">TBA</strong>
            <span className="seal__note">AMOUNTS · SPONSORS · AWARDS</span>
          </div>
        </div>
      </div>

      <div className="container">
        <p className="stakes__disclaimer">
          NO PRIZE AMOUNTS, SPONSOR COMMITMENTS, OR AWARD CATEGORIES HAVE BEEN CONFIRMED.
        </p>
      </div>
    </section>
  )
}
