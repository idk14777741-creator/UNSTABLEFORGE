import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from '../lib/router'
import { brand } from '../data/site'
import ConstellationScene from './ConstellationScene'
import '../cinematic.css'

const SCENES = [
  { index: '01', label: 'THE SPARK', from: 0, to: 0.14 },
  { index: '02', label: 'THE RAW IDEA', from: 0.14, to: 0.32 },
  { index: '03', label: 'THE FORGING', from: 0.32, to: 0.6 },
  { index: '04', label: 'THE REVELATION', from: 0.6, to: 1 },
]

const CAPTIONS = [
  {
    from: 0.012,
    to: 0.142,
    lines: ['Before something exists,', 'someone imagines it.'],
  },
  {
    from: 0.198,
    to: 0.33,
    lines: ['Raw material.', 'Weight. Potential.'],
  },
]

const REVEALS = [
  { from: 0.634, to: 0.714, kind: 'count', text: 'C × C × C' },
  { from: 0.718, to: 0.792, kind: 'mark', text: 'C³' },
  { from: 0.798, to: 0.872, kind: 'name', text: 'CRESCENT CODE CLASH' },
  { from: 0.878, to: 1.02, kind: 'line', text: 'CODE. COMPETE. CONQUER.' },
]

const clamp01 = (value) => (value < 0 ? 0 : value > 1 ? 1 : value)
const smooth = (a, b, value) => {
  const t = clamp01((value - a) / (b - a || 1e-6))
  return t * t * (3 - 2 * t)
}

function hasWebgl() {
  try {
    const probe = document.createElement('canvas')
    return Boolean(probe.getContext('webgl2') || probe.getContext('webgl'))
  } catch {
    return false
  }
}

function Ending() {
  return (
    <section className="cine-end" id="cine-end" aria-labelledby="cine-end-title">
      <span className="cine-end__glow" aria-hidden="true" />
      <div className="cine-end__inner">
        <p className="cine-end__tag">
          THE INVITATION <span aria-hidden="true">/</span> C³
        </p>
        <h2 id="cine-end-title" className="cine-end__title">
          The forge is ready.
          <br />
          <em>What will you create?</em>
        </h2>
        <div className="cine-end__actions">
          <Link className="cine-btn cine-btn--solid" to="/register">
            <span>ENTER C³</span>
            <span className="cine-btn__arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
          <Link className="cine-btn cine-btn--ghost" to="/projects">
            <span>EXPLORE CREATIONS</span>
            <span className="cine-btn__arrow" aria-hidden="true">
              ↗
            </span>
          </Link>
        </div>
        <p className="cine-end__meta">
          REGISTRATION IS OPEN <span aria-hidden="true">/</span> EVENT DETAILS TBA
        </p>
      </div>
    </section>
  )
}

function StaticJourney({ reduced }) {
  return (
    <main id="main" className={`cine-main cine-main--static ${reduced ? 'is-reduced' : ''}`}>
      <section className="cine-static__hero" aria-labelledby="cine-static-title">
        <span className="cine-static__glow" aria-hidden="true" />
        <span className="cine-static__anvil" aria-hidden="true" />
        <div className="cine-static__hero-copy">
          <p className="cine-static__kicker">
            {brand.name} <span aria-hidden="true">/</span> C³
          </p>
          <h1 id="cine-static-title" className="cine-static__quote">
            Before something exists,
            <br />
            <em>someone imagines it.</em>
          </h1>
          <p className="cine-static__meta">CRESCENT CODE CLASH — ALTA</p>
        </div>
      </section>

      <section className="cine-static__chapter" aria-labelledby="cine-static-raw">
        <p className="cine-static__tag">THE RAW IDEA</p>
        <h2 id="cine-static-raw" className="cine-static__chapter-title">
          Raw material. <em>Weight. Potential.</em>
        </h2>
      </section>

      <section className="cine-static__chapter cine-static__chapter--identity" aria-labelledby="cine-static-reveal">
        <p className="cine-static__tag">THE REVELATION</p>
        <p className="cine-static__sequence">C × C × C</p>
        <h2 id="cine-static-reveal" className="cine-static__mark">
          C³
        </h2>
        <p className="cine-static__name">CRESCENT CODE CLASH</p>
        <p className="cine-static__line">CODE. COMPETE. CONQUER.</p>
      </section>

      <ConstellationScene staticMode />

      <Ending />
    </main>
  )
}

export default function ForgedExperience() {
  const wrapRef = useRef(null)
  const stickyRef = useRef(null)
  const canvasRef = useRef(null)
  const captionRefs = useRef([])
  const revealRefs = useRef([])
  const hudLabelRef = useRef(null)
  const hudBarRef = useRef(null)
  const hudCountRef = useRef(null)
  const hintRef = useRef(null)
  const pointerRef = useRef({ x: 0, y: 0 })
  const visibleRef = useRef(true)

  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  const [fallback, setFallback] = useState(false)
  const [ready, setReady] = useState(false)

  const staticMode = reduced || fallback

  useEffect(() => {
    document.body.classList.add('is-cinematic')
    return () => document.body.classList.remove('is-cinematic')
  }, [])

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = (event) => setReduced(event.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])

  const readProgress = useCallback(() => {
    const wrap = wrapRef.current
    if (!wrap) return 0
    const total = wrap.offsetHeight - window.innerHeight
    if (total <= 0) return 0
    return clamp01(-wrap.getBoundingClientRect().top / total)
  }, [])

  const paint = useCallback((progress) => {
    const paintBand = (node, from, to, fade) => {
      if (!node) return
      const intro = smooth(from, from + fade, progress)
      const outro = 1 - smooth(to - fade, to, progress)
      const opacity = Math.max(0, Math.min(intro, outro))
      node.style.opacity = opacity.toFixed(3)
      node.style.setProperty('--shift', `${((1 - intro) * 26).toFixed(1)}px`)
      node.style.visibility = opacity < 0.006 ? 'hidden' : 'visible'
    }

    CAPTIONS.forEach((caption, index) => paintBand(captionRefs.current[index], caption.from, caption.to, 0.022))
    REVEALS.forEach((reveal, index) => paintBand(revealRefs.current[index], reveal.from, reveal.to, 0.014))

    if (hintRef.current) {
      hintRef.current.style.opacity = (1 - smooth(0.004, 0.05, progress)).toFixed(3)
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
      hudCountRef.current.textContent = `${scene.index} / 0${SCENES.length}`
      if (stickyRef.current) stickyRef.current.dataset.scene = scene.index
    }
    if (hudBarRef.current) hudBarRef.current.style.transform = `scaleX(${progress.toFixed(4)})`
  }, [])

  useEffect(() => {
    if (staticMode) return undefined

    if (!hasWebgl()) {
      setFallback(true)
      return undefined
    }

    let world = null
    let frame = 0
    let disposed = false
    let firstFrame = true
    let resizeObserver = null
    let intersection = null

    const onPointerMove = (event) => {
      pointerRef.current = {
        x: (event.clientX / window.innerWidth) * 2 - 1,
        y: (event.clientY / window.innerHeight) * 2 - 1,
      }
    }

    import('./forgeWorld')
      .then(({ createForgeWorld }) => {
        if (disposed) return
        const canvas = canvasRef.current
        if (!canvas) return
        try {
          world = createForgeWorld({
            canvas,
            mobile: window.matchMedia('(max-width: 860px)').matches,
          })
        } catch {
          setFallback(true)
          return
        }

        const loop = (now) => {
          frame = window.requestAnimationFrame(loop)
          if (!visibleRef.current || !world) return
          const progress = readProgress()
          world.update(progress, pointerRef.current, now / 1000)
          paint(progress)
          if (firstFrame) {
            firstFrame = false
            setReady(true)
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
          intersection = new IntersectionObserver(
            (entries) => {
              visibleRef.current = entries.some((entry) => entry.isIntersecting)
              if (visibleRef.current) paint(readProgress())
            },
            { threshold: 0 },
          )
          intersection.observe(wrapRef.current)
        }

        window.addEventListener('pointermove', onPointerMove, { passive: true })
      })
      .catch(() => {
        if (!disposed) setFallback(true)
      })

    return () => {
      disposed = true
      if (frame) window.cancelAnimationFrame(frame)
      window.removeEventListener('pointermove', onPointerMove)
      resizeObserver?.disconnect()
      intersection?.disconnect()
      world?.dispose()
      world = null
    }
  }, [staticMode, paint, readProgress])

  const skip = () => {
    document.getElementById('cine-end')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (staticMode) {
    return <StaticJourney reduced={reduced} />
  }

  return (
    <main id="main" className="cine-main">
      <section className="cine" ref={wrapRef} aria-labelledby="cine-title">
        <div className="cine__sticky" ref={stickyRef}>
          <canvas ref={canvasRef} className="cine__canvas" aria-hidden="true" />
          <span className="cine__grade" aria-hidden="true" />
          <h1 id="cine-title" className="sr-only">
            {brand.name} — C³ Crescent Code Clash. The idea is forged.
          </h1>

          <div className="cine__captions" aria-hidden="true">
            {CAPTIONS.map((caption, index) => (
              <p
                key={caption.lines[0]}
                className="cine-caption"
                ref={(node) => {
                  captionRefs.current[index] = node
                }}
              >
                {caption.lines[0]}
                <br />
                <em>{caption.lines[1]}</em>
              </p>
            ))}
          </div>

          <div className="cine__reveals" aria-hidden="true">
            {REVEALS.map((reveal, index) => (
              <span
                key={reveal.kind}
                className={`cine-reveal cine-reveal--${reveal.kind}`}
                ref={(node) => {
                  revealRefs.current[index] = node
                }}
              >
                {reveal.text}
              </span>
            ))}
          </div>

          <div className="cine-hud" aria-hidden="true">
            <span className="cine-hud__label" ref={hudLabelRef}>
              THE SPARK
            </span>
            <span className="cine-hud__rail">
              <span className="cine-hud__bar" ref={hudBarRef} />
            </span>
            <span className="cine-hud__count" ref={hudCountRef}>
              01 / 04
            </span>
          </div>

          <p className="cine-hint" ref={hintRef} aria-hidden="true">
            SCROLL TO BEGIN
          </p>

          <button className="cine-skip" type="button" onClick={skip}>
            SKIP THE SEQUENCE
          </button>

          <div className={`cine-loader ${ready ? 'is-done' : ''}`} aria-hidden="true">
            <span className="cine-loader__ember" />
            <span className="cine-loader__mark">C³</span>
            <span className="cine-loader__label">FIRING THE FORGE</span>
          </div>
        </div>
      </section>

      <ConstellationScene />

      <Ending />
    </main>
  )
}
