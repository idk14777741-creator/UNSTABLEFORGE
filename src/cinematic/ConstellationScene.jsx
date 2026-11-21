import { useEffect, useRef, useState } from 'react'
import { Link, navigate } from '../lib/router'
import '../constellation.css'

/**
 * Scenes 05–08 — the passage, the constellation, the possibilities and the
 * invitation. The WebGL field is driven by scroll; every domain node is a real
 * button anchored to its light, so the interaction is keyboard and touch
 * accessible without raycasting.
 */

const SCENES = [
  { index: '05', label: 'THE PORTAL', to: 0.16 },
  { index: '06', label: 'THE CONSTELLATION', to: 0.86 },
  { index: '07', label: 'THE INVITATION', to: 1.01 },
]

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value)
const smooth = (a, b, value) => {
  const t = clamp01((value - a) / (b - a || 1e-6))
  return t * t * (3 - 2 * t)
}

function StaticField({ nodes }) {
  return (
    <section className="cone-static" id="possibilities" aria-labelledby="cone-static-title">
      <div className="cone-static__inner">
        <p className="cone-static__tag">THE UNIVERSE</p>
        <h2 id="cone-static-title" className="cone-static__title">
          A universe of <em>events.</em>
        </h2>
        <p className="cone-static__lede">
          Points of light, each one an event. Choose one to step closer.
        </p>
        <ul className="cone-static__list">
          {nodes.map((node, index) => (
            <li key={node.id} className="cone-static__item">
              <span className="cone-static__index">{String(index + 1).padStart(2, '0')}</span>
              <h3 className="cone-static__name">
                <Link to={node.href}>{node.label}</Link>
              </h3>
              <p className="cone-static__note">{node.note}</p>
              <p className="cone-static__disclaimer">{node.meta}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

export default function ConstellationScene({ staticMode = false, nodes = [] }) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const nodeRefs = useRef([])
  const captionRef = useRef(null)
  const panelRef = useRef(null)
  const hudLabelRef = useRef(null)
  const hudBarRef = useRef(null)
  const introRef = useRef(null)
  const worldRef = useRef(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(true)
  const focusRef = useRef(-1)

  const [focus, setFocus] = useState(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const target = focus === null ? -1 : focus
    focusRef.current = target
    worldRef.current?.setFocus(target)
  }, [focus])

  useEffect(() => {
    // The field is built once the event list arrives: the node count is data,
    // and rebuilding for every count change is cheaper than an empty field.
    if (staticMode || nodes.length === 0) return undefined

    let world = null
    let frame = 0
    let disposed = false
    let firstFrame = true
    let observer = null
    let resizeObserver = null

    const readProgress = () => {
      const wrap = wrapRef.current
      if (!wrap) return 0
      const total = wrap.offsetHeight - window.innerHeight
      if (total <= 0) return 0
      return clamp01(-wrap.getBoundingClientRect().top / total)
    }

    const onPointerMove = (event) => {
      pointerRef.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      }
    }

    const paint = (progress) => {
      if (captionRef.current) {
        const intro = smooth(0.008, 0.05, progress)
        const outro = 1 - smooth(0.1, 0.15, progress)
        const opacity = Math.max(0, Math.min(intro, outro))
        captionRef.current.style.opacity = opacity.toFixed(3)
        captionRef.current.style.visibility = opacity < 0.01 ? 'hidden' : 'visible'
        captionRef.current.style.transform = `translateY(${((1 - intro) * 24).toFixed(1)}px)`
      }

      if (panelRef.current) {
        const appear = smooth(0.2, 0.3, progress) * (1 - smooth(0.85, 0.92, progress))
        panelRef.current.style.opacity = appear.toFixed(3)
        panelRef.current.style.visibility = appear < 0.01 ? 'hidden' : 'visible'
      }

      if (introRef.current) {
        const appear = smooth(0.3, 0.4, progress) * (1 - smooth(0.48, 0.56, progress))
        introRef.current.style.opacity = appear.toFixed(3)
      }

      let scene = SCENES[SCENES.length - 1]
      for (let index = 0; index < SCENES.length; index += 1) {
        if (progress < SCENES[index].to) {
          scene = SCENES[index]
          break
        }
      }
      if (hudLabelRef.current && hudLabelRef.current.textContent !== scene.label) {
        hudLabelRef.current.textContent = scene.label
      }
      if (hudBarRef.current) hudBarRef.current.style.transform = `scaleX(${progress.toFixed(4)})`
    }

    import('./constellationWorld')
      .then(({ createConstellationWorld }) => {
        if (disposed) return
        const canvas = canvasRef.current
        if (!canvas) return

        try {
          world = createConstellationWorld({
            canvas,
            nodeCount: nodes.length,
            mobile: window.matchMedia('(max-width: 860px)').matches,
          })
        } catch {
          return
        }

        worldRef.current = world
        world.setFocus(focusRef.current)

        const loop = (now) => {
          frame = window.requestAnimationFrame(loop)
          if (!world || !visibleRef.current) return
          const progress = readProgress()
          world.update(progress, pointerRef.current, now / 1000)
          paint(progress)

          const projected = world.screenNodes()
          const width = canvas.clientWidth || 1
          const height = canvas.clientHeight || 1
          // keep the field readable: no label may collide with another label
          // or drift under the editorial panel
          const panelSafe = width > 860 ? Math.min(380, width * 0.34) : 0
          const placed = []
          nodeRefs.current.forEach((node, index) => {
            const point = projected[index]
            if (!node || !point) return
            node.style.transform = `translate3d(${point.x.toFixed(1)}px, ${point.y.toFixed(1)}px, 0) translate(-50%, -50%)`
            const interactive = point.visible && progress > 0.24 && progress < 0.9
            node.style.opacity = interactive ? '1' : '0'
            node.style.pointerEvents = interactive ? 'auto' : 'none'

            let muted = !interactive || point.x > width - panelSafe
            if (!muted) {
              for (const other of placed) {
                if (Math.abs(other.x - point.x) < 168 && Math.abs(other.y - point.y) < 22) {
                  muted = true
                  break
                }
              }
            }
            if (!muted) placed.push(point)
            node.classList.toggle('is-muted', muted)
          })

          if (firstFrame) {
            firstFrame = false
            setEntered(true)
          }
        }
        frame = window.requestAnimationFrame(loop)

        if ('ResizeObserver' in window) {
          resizeObserver = new ResizeObserver(() => world?.resize())
          if (wrapRef.current) resizeObserver.observe(wrapRef.current)
        } else {
          window.addEventListener('resize', () => world?.resize())
        }

        if ('IntersectionObserver' in window && wrapRef.current) {
          observer = new IntersectionObserver(
            (entries) => {
              visibleRef.current = entries.some((entry) => entry.isIntersecting)
              if (visibleRef.current) paint(readProgress())
            },
            { threshold: 0 },
          )
          observer.observe(wrapRef.current)
        }

        window.addEventListener('pointermove', onPointerMove, { passive: true })
      })
      .catch(() => {})

    return () => {
      disposed = true
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      observer?.disconnect()
      resizeObserver?.disconnect()
      world?.dispose()
      world = null
      worldRef.current = null
    }
  }, [staticMode, nodes.length])

  if (staticMode) {
    return <StaticField nodes={nodes} />
  }

  // No published events means no constellation: the field is never padded with
  // invented nodes just to look populated.
  if (nodes.length === 0) {
    return (
      <section className="cone-static" id="possibilities" aria-labelledby="cone-empty-title">
        <div className="cone-static__inner">
          <p className="cone-static__tag">THE UNIVERSE</p>
          <h2 id="cone-empty-title" className="cone-static__title">
            The forge is <em>heating.</em>
          </h2>
          <p className="cone-static__lede">
            Events appear in this constellation the moment an organizer publishes them.
          </p>
          <Link className="ann-action" to="/events">
            VIEW ALL EVENTS
          </Link>
        </div>
      </section>
    )
  }

  const focused = focus === null ? null : nodes[focus]

  const skip = () => {
    document.getElementById('cine-end')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <section className="cone" ref={wrapRef} aria-labelledby="cone-title">
      <div className="cone__sticky">
        <canvas ref={canvasRef} className="cone__canvas" aria-hidden="true" />
        <span className="cone__grade" aria-hidden="true" />
        <span className="cone__scrim" aria-hidden="true" />

        <h2 id="cone-title" className="sr-only">
          The event universe — explore events across ALTA
        </h2>

        <p className="cone__caption" ref={captionRef}>
          The emblem becomes
          <br />
          <em>a passage.</em>
        </p>

        <div
          className={`cone__nodes ${entered ? 'is-entered' : ''}`}
          role="group"
          aria-label="Events"
        >
          {nodes.map((node, index) => (
            <button
              key={node.id}
              type="button"
              className={`cone-node ${focus === index ? 'is-focus' : ''}`}
              ref={(element) => {
                nodeRefs.current[index] = element
              }}
              onPointerEnter={() => setFocus(index)}
              onFocus={() => setFocus(index)}
              onClick={() => {
                setFocus(index)
                if (node.href) navigate(node.href)
              }}
              aria-pressed={focus === index}
            >
              <span className="cone-node__dot" aria-hidden="true" />
              <span className="cone-node__label">{node.label}</span>
            </button>
          ))}
        </div>

        <p className="cone__intro" ref={introRef} aria-hidden="true">
          Every point of light
          <br />
          is a place to begin.
        </p>

        <aside className="cone__panel" ref={panelRef} aria-live="polite">
          <span className="cone__panel-rule" aria-hidden="true" />
          {focused ? (
            <>
              <p className="cone__panel-index">
                EVENT {String((focus ?? 0) + 1).padStart(2, '0')} / {nodes.length}
              </p>
              <h3 className="cone__panel-title">{focused.label}</h3>
              <p className="cone__panel-note">{focused.note}</p>
              <p className="cone__panel-hint">SELECT TO OPEN THE EVENT</p>
            </>
          ) : (
            <>
              <p className="cone__panel-index">THE UNIVERSE</p>
              <h3 className="cone__panel-title">
                {nodes.length} {nodes.length === 1 ? 'event' : 'events'}
                <br />
                to step into.
              </h3>
              <p className="cone__panel-note">
                Move through the field and choose where you want to begin.
              </p>
              <p className="cone__panel-hint">HOVER, TAP OR TAB BETWEEN EVENTS</p>
            </>
          )}
          <p className="cone__panel-disclaimer">{focused?.meta || 'SET BY THE ORGANIZERS'}</p>
        </aside>

        <div className="cone-hud" aria-hidden="true">
          <span className="cone-hud__label" ref={hudLabelRef}>
            THE PORTAL
          </span>
          <span className="cone-hud__rail">
            <span className="cone-hud__bar" ref={hudBarRef} />
          </span>
          <span className="cone-hud__count">SCENES 05 — 08</span>
        </div>

        <button className="cine-skip cone__skip" type="button" onClick={skip}>
          CONTINUE TO THE INVITATION
        </button>

        <div className={`cone__veil ${entered ? 'is-lifted' : ''}`} aria-hidden="true" />
      </div>
    </section>
  )
}
