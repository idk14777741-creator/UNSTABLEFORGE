import { brand } from '../data/site'
import SectionLabel from './SectionLabel'
import Cta from './Cta'

export default function FinalCta({ onOpenRegistration }) {
  return (
    <section id="register" className="section final" aria-labelledby="final-title">
      <div className="final__art" aria-hidden="true">
        <svg viewBox="0 0 760 760" fill="none" focusable="false">
          <g stroke="currentColor" strokeWidth="1">
            <path d="M585 144A268 268 0 1 0 585 616" opacity="0.75" />
            <path d="M585 206A206 206 0 1 0 585 554" opacity="0.4" />
            <path d="M585 90A322 322 0 1 0 585 670" opacity="0.18" />
            <path d="M380 58v44M380 658v44M58 380h44M658 380h44" opacity="0.35" />
            <circle cx="380" cy="380" r="352" strokeDasharray="1 14" opacity="0.3" />
            <circle cx="585" cy="144" r="3" fill="currentColor" stroke="none" />
          </g>
        </svg>
      </div>

      <div className="container final__inner">
        <div className="final__head" data-reveal>
          <SectionLabel number="08" tone="light">
            REGISTER
          </SectionLabel>
        </div>

        <h2 id="final-title" className="display final__title" data-reveal>
          YOUR NEXT BIG IDEA{' '}
          <br />
          <em className="serif">STARTS HERE.</em>
        </h2>

        <div className="final__lower">
          <div className="final__event" data-reveal style={{ '--reveal-delay': '80ms' }}>
            <span className="final__c3" aria-hidden="true">
              C³
            </span>
            <div>
              <p className="final__event-name">{brand.eventName}</p>
              <p className="final__event-meta">
                {brand.audience} <span aria-hidden="true">/</span> PRONOUNCED “C CUBE”
              </p>
            </div>
          </div>

          <div className="final__actions" data-reveal style={{ '--reveal-delay': '140ms' }}>
            <Cta variant="light" onClick={onOpenRegistration} opensDialog>
              REGISTRATION DETAILS
            </Cta>
            <a className="text-link text-link--light" href="#journey">
              REVIEW THE TIMELINE <span aria-hidden="true">↗</span>
            </a>
          </div>
        </div>

        <div className="final__foot">
          <p className="final__status">
            <span className="status-dot" aria-hidden="true" />
            REGISTRATION IS NOT OPEN YET
          </p>
          <p className="final__footnote">
            DATES, ELIGIBILITY, AND THE OFFICIAL SIGN-UP ROUTE WILL BE ANNOUNCED HERE.
          </p>
        </div>
      </div>
    </section>
  )
}
