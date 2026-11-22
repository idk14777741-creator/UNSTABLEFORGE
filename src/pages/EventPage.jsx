import { useEffect, useRef, useState } from 'react'
import { Link } from '../lib/router'
import { apiGet } from '../lib/api'
import DomainConstellation from '../components/DomainConstellation'
import '../platform.css'

const STATUS_LABEL = {
  upcoming: 'UPCOMING',
  registration_open: 'REGISTRATION OPEN',
  registration_closed: 'REGISTRATION CLOSED',
  ongoing: 'IN PROGRESS',
  completed: 'COMPLETED',
  archived: 'ARCHIVED',
}

const TYPE_LABEL = {
  hackathon: 'Hackathon',
  debate: 'Debate',
  seminar: 'Seminar',
  workshop: 'Workshop',
  competition: 'Competition',
  other: 'Event',
}

function formatDate(value) {
  if (!value) return null
  return new Date(value).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function Glimpse({ images }) {
  const [visible, setVisible] = useState(() => new Set())
  const refs = useRef([])

  useEffect(() => {
    const nodes = refs.current.filter(Boolean)
    if (!nodes.length) return undefined

    if (!('IntersectionObserver' in window)) {
      setVisible(new Set(images.map((image) => image.id)))
      return undefined
    }

    const observer = new IntersectionObserver(
      (entries) => {
        setVisible((current) => {
          const next = new Set(current)
          for (const entry of entries) {
            if (entry.isIntersecting) next.add(Number(entry.target.dataset.id))
          }
          return next
        })
      },
      { threshold: 0.2 },
    )

    nodes.forEach((node) => observer.observe(node))
    return () => observer.disconnect()
  }, [images])

  if (!images.length) {
    return (
      <section className="pf-section" id="glimpse">
        <div className="pf-section__head">
          <h2 className="pf-section__title">The Glimpse</h2>
          <span className="pf-section__note">EVENT PHOTOGRAPHY</span>
        </div>
        <div className="pf-glimpse">
          <p className="pf-glimpse__empty">Photographs from this event have not been published yet.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="pf-section" id="glimpse">
      <div className="pf-section__head">
        <h2 className="pf-section__title">The Glimpse</h2>
        <span className="pf-section__note">{images.length} FRAME{images.length === 1 ? '' : 'S'}</span>
      </div>
      <div className="pf-glimpse">
        {images.map((image, index) => {
          const variant =
            image.isFeatured || index % 5 === 0
              ? 'pf-glimpse__figure--wide'
              : index % 3 === 0
                ? 'pf-glimpse__figure--tall'
                : ''
          return (
            <figure
              key={image.id}
              data-id={image.id}
              ref={(node) => {
                refs.current[index] = node
              }}
              className={`pf-glimpse__figure ${variant} ${visible.has(image.id) ? 'is-in' : ''}`}
            >
              <img
                className="pf-glimpse__image"
                src={image.url}
                alt={image.alt || image.caption || 'Event photograph'}
                loading="lazy"
                width={image.width || undefined}
                height={image.height || undefined}
              />
              {(image.caption || image.credit) && (
                <figcaption className="pf-glimpse__caption">
                  {image.caption}
                  {image.credit ? ` — ${image.credit}` : ''}
                </figcaption>
              )}
            </figure>
          )
        })}
      </div>
    </section>
  )
}

function Section({ title, note, children, id }) {
  return (
    <section className="pf-section" id={id}>
      <div className="pf-section__head">
        <h2 className="pf-section__title">{title}</h2>
        {note && <span className="pf-section__note">{note}</span>}
      </div>
      {children}
    </section>
  )
}

function Cards({ items, label, getTitle, getCopy }) {
  return (
    <div className="pf-grid">
      {items.map((item, index) => (
        <article className="pf-card" key={item.id ?? index}>
          <span className="pf-card__label">{label(index)}</span>
          <h3 className="pf-card__title">{getTitle(item)}</h3>
          {getCopy(item) ? <p className="pf-card__copy">{getCopy(item)}</p> : null}
        </article>
      ))}
    </div>
  )
}

export default function EventPage({ slug }) {
  const [state, setState] = useState({ status: 'loading' })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading' })

    apiGet(`/api/events/${encodeURIComponent(slug)}`)
      .then((payload) => {
        if (cancelled) return
        document.title = `${payload.data.title} — Unstable Forge`
        setState({ status: 'ready', event: payload.data })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error.message, code: error.status })
      })

    return () => {
      cancelled = true
    }
  }, [slug])

  if (state.status === 'loading') {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-empty">OPENING THE EVENT…</p>
        </div>
      </main>
    )
  }

  if (state.status === 'error') {
    return (
      <main id="main" className="pf-main">
        <div className="pf-wrap">
          <p className="pf-kicker">EVENT</p>
          <h1 className="pf-title">
            Not <em>found.</em>
          </h1>
          <p className="pf-lede">
            This event is not published, or the link is wrong. The rest of the universe is still here.
          </p>
          <div className="pf-actions">
            <Link className="pf-btn" to="/events">
              ALL EVENTS
            </Link>
          </div>
        </div>
      </main>
    )
  }

  const event = state.event
  const content = event.content || {}
  const settings = event.settings
  const canRegister = settings?.enabled && event.lifecycle === 'registration_open'
  const seatsLeft = settings?.seatsRemaining

  return (
    <main id="main" className="pf-main">
      <div className="pf-wrap">
        <Link className="pf-kicker" to="/events" style={{ textDecoration: 'none' }}>
          ← THE UNIVERSE
        </Link>

        {event.heroUrl && (
          <img
            className="pf-event-hero"
            src={event.heroUrl}
            alt={`${event.title} — event artwork`}
          />
        )}

        <div className="pf-hero" style={{ marginTop: '24px' }}>
          <div>
            <p className="pf-event__type">
              {TYPE_LABEL[event.type] || event.type} / {STATUS_LABEL[event.lifecycle] || event.lifecycle}
            </p>
            <h1 className="pf-title">{event.title}</h1>
            {event.tagline && <p className="pf-lede">{event.tagline}</p>}
            {event.shortDescription && <p className="pf-lede">{event.shortDescription}</p>}
          </div>

          <div className="pf-facts">
            {/* A date or venue that has not been confirmed is omitted rather
                than printed as a placeholder. */}
            {formatDate(event.startsAt) && (
              <p className="pf-fact">
                <span>Date</span>
                <span>{formatDate(event.startsAt)}</span>
              </p>
            )}
            {event.venue && (
              <p className="pf-fact">
                <span>Venue</span>
                <span>{event.venue}</span>
              </p>
            )}
            {settings && (
              <>
                <p className="pf-fact">
                  <span>Format</span>
                  <span>
                    {settings.registrationMode === 'individual'
                      ? 'Individual'
                      : `Teams of ${settings.minTeamSize}–${settings.maxTeamSize}`}
                  </span>
                </p>
                <p className="pf-fact">
                  <span>Fee</span>
                  <span>{settings.isPaid ? settings.feeLabel : 'Free'}</span>
                </p>
                <p className="pf-fact">
                  <span>Capacity</span>
                  <span>
                    {settings.capacity === null
                      ? 'Unlimited'
                      : `${seatsLeft} of ${settings.capacity} places left`}
                  </span>
                </p>
              </>
            )}
            <p className="pf-fact">
              <span>Registration</span>
              <span>{canRegister ? 'OPEN' : STATUS_LABEL[event.lifecycle] || 'CLOSED'}</span>
            </p>
          </div>
        </div>

        {canRegister && (
          <div className="pf-actions" style={{ marginTop: '28px' }}>
            <Link className="pf-btn" to={`/events/${event.slug}/register`}>
              REGISTER {settings.isPaid ? `— ${settings.feeLabel}` : ''}
            </Link>
            <Link className="pf-btn pf-btn--ghost" to="/projects">
              SEE CREATIONS
            </Link>
          </div>
        )}

        {!canRegister && (
          <div className="pf-actions" style={{ marginTop: '28px' }}>
            <Link className="pf-btn pf-btn--ghost" to="/events">
              BACK TO ALL EVENTS
            </Link>
          </div>
        )}

        {event.description && (
          <Section title="The brief" note="WHAT THIS EVENT IS">
            <p className="pf-prose" style={{ marginTop: '22px' }}>
              {event.description}
            </p>
          </Section>
        )}

        {content.domains?.length > 0 && (
          <Section
            title="Challenge domains"
            note={`${String(content.domains.length).padStart(2, '0')} CONNECTED DOMAINS`}
            id="domains"
          >
            <DomainConstellation domains={content.domains} eventTitle={event.title} />
          </Section>
        )}

        {content.topics?.length > 0 && (
          <Section title="Debate topics" note="SET BY THE ORGANIZERS">
            <Cards
              items={content.topics}
              label={(index) => `MOTION ${String(index + 1).padStart(2, '0')}`}
              getTitle={(item) => item.title}
              getCopy={(item) => item.description}
            />
          </Section>
        )}

        {content.rules?.length > 0 && (
          <Section title="Format & rules" note="HOW IT RUNS">
            <div className="pf-rules">
              {content.rules.map((rule, index) => (
                <div className="pf-rule" key={rule.id}>
                  <span className="pf-rule__index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="pf-rule__title">{rule.title}</h3>
                    {rule.body && <p className="pf-rule__body">{rule.body}</p>}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {content.speakers?.length > 0 && (
          <Section title="Speakers" note="WHO IS SPEAKING">
            <Cards
              items={content.speakers}
              label={() => 'SPEAKER'}
              getTitle={(item) => item.name}
              getCopy={(item) => item.bio || item.title || item.organization}
            />
          </Section>
        )}

        {content.sessions?.length > 0 && (
          <Section title="Sessions" note="THE RUN OF SHOW">
            <div className="pf-rules">
              {content.sessions.map((session, index) => (
                <div className="pf-rule" key={session.id}>
                  <span className="pf-rule__index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="pf-rule__title">{session.title}</h3>
                    {[session.speakerName, formatDate(session.startsAt), session.venue].filter(
                      Boolean,
                    ).length > 0 && (
                      <p className="pf-rule__body">
                        {[session.speakerName, formatDate(session.startsAt), session.venue]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        {content.criteria?.length > 0 && (
          <Section title="Judging" note="HOW WORK IS WEIGHED">
            <Cards
              items={content.criteria}
              label={(index) => `CRITERION ${String(index + 1).padStart(2, '0')}`}
              getTitle={(item) => item.title}
              getCopy={(item) => item.description}
            />
          </Section>
        )}

        {content.faqs?.length > 0 && (
          <Section title="Questions" note="BEFORE YOU ASK">
            <div className="pf-rules">
              {content.faqs.map((faq, index) => (
                <div className="pf-rule" key={faq.id}>
                  <span className="pf-rule__index">{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <h3 className="pf-rule__title">{faq.question}</h3>
                    <p className="pf-rule__body">{faq.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </Section>
        )}

        <Glimpse images={event.glimpse || []} />
      </div>
    </main>
  )
}
