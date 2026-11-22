import { useMemo, useState } from 'react'

/**
 * C³ challenge constellation.
 *
 * Every node comes from the event's `event_domains` rows, so the shape of the
 * constellation is content, not code. C³ currently carries eleven domains and
 * the brief lists the same eleven. Positions are deterministic (hand-tuned for
 * the current field, with one reserve position) rather than random, so the field
 * never reshuffles between renders. Any domain beyond the hand-tuned positions
 * gets a deterministic position on a widening spiral instead of being dropped,
 * so the node count always equals the configured domain count the brief shows.
 *
 * The stage is a spatial view; on narrow screens the same state drives a
 * touch-first list so nothing is lost when the field cannot fit.
 */
const POSITIONS = [
  { x: 50, y: 11 },
  { x: 71, y: 15 },
  { x: 88, y: 31 },
  { x: 91, y: 57 },
  { x: 77, y: 82 },
  { x: 55, y: 90 },
  { x: 31, y: 86 },
  { x: 11, y: 67 },
  { x: 9, y: 37 },
  { x: 24, y: 16 },
  { x: 33, y: 51 },
  { x: 67, y: 49 },
]

// The C³ anchor is the visual centre of the field.
const ANCHOR = { x: 50, y: 50 }

function buildEdges(points) {
  const edges = new Map()

  points.forEach((point, index) => {
    const nearest = points
      .map((other, otherIndex) => ({
        index: otherIndex,
        distance: (point.x - other.x) ** 2 + (point.y - other.y) ** 2,
      }))
      .filter((entry) => entry.index !== index)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2)

    for (const entry of nearest) {
      const key = index < entry.index ? `${index}-${entry.index}` : `${entry.index}-${index}`
      edges.set(key, [Math.min(index, entry.index), Math.max(index, entry.index)])
    }
  })

  return [...edges.values()]
}

/**
 * Deterministic position for a domain the hand-tuned field has no slot for.
 * Golden-angle spacing spreads extra nodes around the centre; it never depends
 * on render order or randomness, so a node keeps its place across renders.
 */
function overflowPosition(index) {
  const angle = ((index - POSITIONS.length) * 137.508 * Math.PI) / 180
  return { x: 50 + 34 * Math.cos(angle), y: 50 + 34 * Math.sin(angle) }
}

const label = (index) => String(index + 1).padStart(2, '0')

export default function DomainConstellation({ domains, eventTitle }) {
  const points = useMemo(
    () =>
      domains.map((domain, index) => ({
        ...(POSITIONS[index] ?? overflowPosition(index)),
        index,
        domain,
      })),
    [domains],
  )
  const edges = useMemo(() => buildEdges(points), [points])

  const [activeIndex, setActiveIndex] = useState(0)
  const [selectedIndex, setSelectedIndex] = useState(0)

  if (!points.length) return null

  const focused = points[Math.min(selectedIndex, points.length - 1)]
  const highlighted = activeIndex ?? selectedIndex

  const neighbours = edges
    .filter(([, to]) => to === highlighted)
    .map(([from]) => from)
    .concat(edges.filter(([from]) => from === highlighted).map(([, to]) => to))
    .filter((value, index, list) => value !== highlighted && list.indexOf(value) === index)

  const linkTo = (index) => {
    setActiveIndex(index)
    setSelectedIndex(index)
  }

  return (
    <div className="dc" data-count={points.length}>
      <div className="dc__stage" aria-hidden="false">
        <span className="dc__halo" aria-hidden="true" />

        <svg
          className="dc__threads"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {edges.map(([from, to]) => {
            const hot = from === highlighted || to === highlighted
            return (
              <line
                key={`${from}-${to}`}
                x1={points[from].x}
                y1={points[from].y}
                x2={points[to].x}
                y2={points[to].y}
                className={`dc__thread ${hot ? 'is-hot' : ''}`}
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
          {[0, 3, 6, 9].map((index) => (
            <line
              key={`anchor-${index}`}
              x1={ANCHOR.x}
              y1={ANCHOR.y}
              x2={points[index].x}
              y2={points[index].y}
              className="dc__thread dc__thread--anchor"
              vectorEffect="non-scaling-stroke"
            />
          ))}
        </svg>

        <span className="dc__anchor" style={{ left: `${ANCHOR.x}%`, top: `${ANCHOR.y}%` }}>
          <span className="dc__anchor-mark" aria-hidden="true">
            C³
          </span>
          <span className="dc__anchor-label">{eventTitle || 'THE CHALLENGE'}</span>
        </span>

        {points.map((point) => {
          const isActive = point.index === highlighted
          return (
            <button
              key={point.domain.id ?? point.index}
              type="button"
              className={`dc__node ${isActive ? 'is-active' : ''}`}
              style={{ left: `${point.x}%`, top: `${point.y}%` }}
              onMouseEnter={() => setActiveIndex(point.index)}
              onMouseLeave={() => setActiveIndex(selectedIndex)}
              onFocus={() => setActiveIndex(point.index)}
              onClick={() => linkTo(point.index)}
              aria-pressed={point.index === selectedIndex}
              aria-controls="domain-detail"
            >
              <span className="dc__node-dot" aria-hidden="true" />
              <span className="dc__node-index">{label(point.index)}</span>
              <span className="dc__node-name">{point.domain.title}</span>
            </button>
          )
        })}
      </div>

      <ul className="dc__list" aria-label="Challenge domains">
        {points.map((point) => (
          <li key={point.domain.id ?? point.index}>
            <button
              type="button"
              className={`dc__list-item ${point.index === selectedIndex ? 'is-active' : ''}`}
              onClick={() => linkTo(point.index)}
              aria-pressed={point.index === selectedIndex}
              aria-controls="domain-detail"
            >
              <span className="dc__list-index">{label(point.index)}</span>
              <span className="dc__list-name">{point.domain.title}</span>
            </button>
          </li>
        ))}
      </ul>

      <div className="dc__detail" id="domain-detail" aria-live="polite">
        <span className="dc__detail-kicker">
          DOMAIN {label(focused.index)} / {String(points.length).padStart(2, '0')}
        </span>
        <h3 className="dc__detail-title">{focused.domain.title}</h3>
        <p className="dc__detail-copy">
          {focused.domain.description ||
            'This domain is open. Bring the problem you think is worth solving.'}
        </p>

        {neighbours.length > 0 && (
          <div className="dc__detail-links">
            <span className="dc__detail-label">CONNECTED TO</span>
            <div className="dc__chips">
              {neighbours.map((index) => (
                <button
                  key={index}
                  type="button"
                  className="dc__chip"
                  onClick={() => linkTo(index)}
                >
                  {points[index].domain.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
