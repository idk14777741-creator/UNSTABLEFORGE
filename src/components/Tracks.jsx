import { useEffect, useState } from 'react'
import SectionLabel from './SectionLabel'
import { apiGet } from '../lib/api'
import { challengeDomains } from '../data/challengeDomains'

/**
 * The challenge domains, written as an editorial index.
 *
 * The spatial constellation is the C³ event page experience, driven by the
 * event's configured `event_domains` rows. This is the scannable list for the
 * brief, and it reads the same public event API, so an organizer adding,
 * renaming or removing a domain changes both views at once and the two can no
 * longer disagree. The static list in `data/challengeDomains.js` is only the
 * fallback for an unreachable API, and it mirrors the seeded domains.
 */
const C3_SLUG = 'c3-crescent-code-clash'

/** The platform's shape (title/description) mapped to the brief's (name/note). */
function fromPlatform(domains) {
  return (domains || [])
    .filter((domain) => domain?.title)
    .map((domain) => ({ id: domain.id, name: domain.title, note: domain.description || '' }))
}

export default function Tracks() {
  const [domains, setDomains] = useState(challengeDomains)

  useEffect(() => {
    const controller = new AbortController()

    apiGet(`/api/events/${C3_SLUG}`, { signal: controller.signal })
      .then((body) => {
        const live = fromPlatform(body?.data?.content?.domains)
        // An event with no configured domains keeps the fallback rather than
        // rendering a heading over an empty list.
        if (live.length) setDomains(live)
      })
      .catch(() => {
        // API unreachable or the event is unpublished: the static list stands.
      })

    return () => controller.abort()
  }, [])

  return (
    <section id="tracks" className="section tracks" aria-labelledby="tracks-title">
      <div className="container">
        <div className="tracks__head">
          <div>
            <SectionLabel number="03">DOMAINS</SectionLabel>
            <h2 id="tracks-title" className="display tracks__title" data-reveal>
              THE GROUND{' '}
              <br />
              <em className="serif">YOU BUILD ON.</em>
            </h2>
          </div>
          <p className="tracks__intro" data-reveal style={{ '--reveal-delay': '100ms' }}>
            The challenge domains are areas of possibility, not fixed problem statements —
            choose the one your team can say something real about.
          </p>
        </div>

        <div className="tracks__status" data-reveal>
          <div className="tracks__status-copy">
            <span className="tracks__status-label">STATUS / OPEN</span>
            <p className="tracks__status-title">
              ONE
              <br />
              <em>CONNECTED</em>{' '}
              <br />
              FIELD
            </p>
          </div>

          <div className="tracks__status-body">
            <span className="tracks__status-code">
              C³ / CHALLENGE FIELD / {String(domains.length).padStart(2, '0')}
            </span>
            <p>
              Every domain below is part of the same field. Build inside one, or let two
              connect. The work still has to be real, demonstrable and yours.
            </p>
            <span className="tracks__status-note">DOMAINS ARE NOT OFFICIAL PROBLEM STATEMENTS.</span>
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

        <ol className="track-index">
          {domains.map((domain, index) => (
            <li
              className="track-index__row"
              key={domain.id}
              data-reveal
              style={{ '--reveal-delay': `${Math.min(index, 6) * 40}ms` }}
            >
              <span className="track-index__number">{String(index + 1).padStart(2, '0')}</span>
              <span className="track-index__body">
                <span className="track-index__name">{domain.name}</span>
                {domain.note && <span className="track-index__note">{domain.note}</span>}
              </span>
            </li>
          ))}
        </ol>

        <p className="tracks__disclaimer">
          THE FULL FIELD IS EXPLORED AS A CONSTELLATION ON THE C³ EVENT PAGE.
        </p>
      </div>
    </section>
  )
}
