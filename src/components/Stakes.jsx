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
            C³ carries a prize pool of ₹1,50,000. Award categories and how the pool is split
            have not been published, so no breakdown is claimed here.
          </p>

          <div className="stakes__facts" data-reveal style={{ '--reveal-delay': '160ms' }}>
            <span>PRIZE POOL / ₹1,50,000</span>
            <span>ENTRY / ₹300 PER TEAM</span>
            <span>FIELD / 120 PARTICIPANTS</span>
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
            <span className="seal__kicker">PRIZE POOL / CONFIRMED</span>
            <strong className="seal__amount">₹1,50,000</strong>
            <span className="seal__note">AT STAKE ACROSS C³</span>
          </div>
        </div>
      </div>

      <div className="container">
        <p className="stakes__disclaimer">
          ₹1,50,000 IS THE CONFIRMED PRIZE POOL. AWARD CATEGORIES ARE NOT PUBLISHED.
        </p>
      </div>
    </section>
  )
}
