import { useEffect, useState } from 'react'
import { Link } from '../lib/router'
import { apiGet } from '../lib/api'
import '../platform.css'

const STATUS_LABEL = {
  upcoming: 'UPCOMING',
  registration_open: 'REGISTRATION OPEN',
  registration_closed: 'REGISTRATION CLOSED',
  ongoing: 'IN PROGRESS',
  completed: 'COMPLETED',
  archived: 'ARCHIVED',
}

function EventRow({ event, index }) {
  const open = event.lifecycle === 'registration_open'
  return (
    <Link className="pf-event" to={`/events/${event.slug}`}>
      <span className="pf-event__index">{String(index + 1).padStart(2, '0')}</span>
      <span className="pf-event__body">
        {event.coverUrl && <img className="pf-event__cover" src={event.coverUrl} alt="" />}
        <span>
          <span className="pf-event__type">{event.type}</span>
          <h2 className="pf-event__title">{event.title}</h2>
          <p className="pf-event__copy">
            {event.shortDescription || 'Details are being configured by the organizers.'}
          </p>
        </span>
      </span>
      <span className="pf-event__status" data-state={open ? 'open' : 'idle'}>
        {STATUS_LABEL[event.lifecycle] || event.lifecycle.toUpperCase()}
      </span>
    </Link>
  )
}

export default function EventsPage() {
  const [state, setState] = useState({ status: 'loading', upcoming: [], past: [] })
  const [tab, setTab] = useState('upcoming')

  useEffect(() => {
    let cancelled = false
    document.title = 'Events — Unstable Forge'

    Promise.all([apiGet('/api/events'), apiGet('/api/events?scope=past')])
      .then(([upcoming, past]) => {
        if (cancelled) return
        setState({
          status: 'ready',
          upcoming: upcoming?.data || [],
          past: past?.data || [],
        })
      })
      .catch((error) => {
        if (!cancelled) setState({ status: 'error', message: error.message, upcoming: [], past: [] })
      })

    return () => {
      cancelled = true
    }
  }, [])

  const list = tab === 'upcoming' ? state.upcoming : state.past

  return (
    <main id="main" className="pf-main">
      <div className="pf-wrap">
        <p className="pf-kicker">THE UNIVERSE / EVENTS</p>
        <h1 className="pf-title">
          One forge.
          <br />
          <em>Many creations.</em>
        </h1>
        <p className="pf-lede">
          Every published event at ALTA, in one place. Open an event to see what it asks of you, who
          is speaking, and whether its registration desk is open.
        </p>

        <div className="pf-tabs" role="tablist" aria-label="Event lists">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'upcoming'}
            className={`pf-tab ${tab === 'upcoming' ? 'is-active' : ''}`}
            onClick={() => setTab('upcoming')}
          >
            Upcoming &amp; open
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'past'}
            className={`pf-tab ${tab === 'past' ? 'is-active' : ''}`}
            onClick={() => setTab('past')}
          >
            Past events
          </button>
        </div>

        {state.status === 'loading' && <p className="pf-empty">LOADING THE FIELD…</p>}

        {state.status === 'error' && (
          <p className="pf-empty">THE EVENTS COULD NOT BE LOADED. {state.message}</p>
        )}

        {state.status === 'ready' && list.length === 0 && (
          <p className="pf-empty">
            {tab === 'upcoming' ? 'NO EVENTS ARE PUBLISHED YET.' : 'NO PAST EVENTS YET.'}
          </p>
        )}

        {state.status === 'ready' && list.length > 0 && (
          <div className="pf-events">
            {list.map((event, index) => (
              <EventRow key={event.id} event={event} index={index} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
