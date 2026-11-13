import { useEffect, useRef } from 'react'

export default function CrescentArt() {
  const frameRef = useRef(null)
  const stageRef = useRef(null)

  useEffect(() => {
    const frame = frameRef.current
    const stage = stageRef.current
    if (!frame || !stage) return undefined

    const finePointer = window.matchMedia('(pointer: fine)').matches
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!finePointer || reduced) return undefined

    let frameId = 0
    let targetX = 0
    let targetY = 0

    const render = () => {
      frameId = 0
      stage.style.setProperty('--mx', targetX.toFixed(4))
      stage.style.setProperty('--my', targetY.toFixed(4))
    }

    const onPointerMove = (event) => {
      const rect = frame.getBoundingClientRect()
      targetX = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      targetY = ((event.clientY - rect.top) / rect.height - 0.5) * 2
      if (!frameId) frameId = window.requestAnimationFrame(render)
    }

    const onLeave = () => {
      targetX = 0
      targetY = 0
      if (!frameId) frameId = window.requestAnimationFrame(render)
    }

    frame.addEventListener('pointermove', onPointerMove)
    frame.addEventListener('pointerleave', onLeave)

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId)
      frame.removeEventListener('pointermove', onPointerMove)
      frame.removeEventListener('pointerleave', onLeave)
    }
  }, [])

  return (
    <figure className="art" data-reveal>
      <div className="art__frame" ref={frameRef}>
        <span className="art__corner art__corner--tl" aria-hidden="true" />
        <span className="art__corner art__corner--tr" aria-hidden="true" />
        <span className="art__corner art__corner--bl" aria-hidden="true" />
        <span className="art__corner art__corner--br" aria-hidden="true" />

        <div className="art__meta art__meta--top" aria-hidden="true">
          <span>OBJECT / 001</span>
          <span>CRESCENT STUDY</span>
        </div>

        <div className="art__stage" ref={stageRef}>
          <div className="art__float">
            <svg
              className="art__svg"
              viewBox="0 0 640 640"
              role="presentation"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                <linearGradient
                  id="uf-metal"
                  gradientUnits="userSpaceOnUse"
                  x1="120"
                  y1="70"
                  x2="540"
                  y2="610"
                >
                  <stop offset="0" stopColor="#F8DCC0" />
                  <stop offset="0.13" stopColor="#E7A06B" />
                  <stop offset="0.34" stopColor="#C46932" />
                  <stop offset="0.58" stopColor="#8B3E1E" />
                  <stop offset="0.8" stopColor="#432115" />
                  <stop offset="1" stopColor="#1A110C" />
                </linearGradient>

                <linearGradient
                  id="uf-rim"
                  gradientUnits="userSpaceOnUse"
                  x1="100"
                  y1="120"
                  x2="560"
                  y2="560"
                >
                  <stop offset="0" stopColor="#FFE0C5" />
                  <stop offset="0.42" stopColor="#E59A66" />
                  <stop offset="0.72" stopColor="#A64E24" />
                  <stop offset="1" stopColor="#5C2B19" />
                </linearGradient>

                <radialGradient
                  id="uf-glow"
                  gradientUnits="userSpaceOnUse"
                  cx="312"
                  cy="320"
                  r="330"
                >
                  <stop offset="0" stopColor="#C3622C" stopOpacity="0.3" />
                  <stop offset="0.5" stopColor="#C3622C" stopOpacity="0.1" />
                  <stop offset="1" stopColor="#C3622C" stopOpacity="0" />
                </radialGradient>

                <pattern
                  id="uf-brush"
                  width="5"
                  height="5"
                  patternUnits="userSpaceOnUse"
                  patternTransform="rotate(32)"
                >
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="5"
                    stroke="#FFE4CA"
                    strokeWidth="0.45"
                    opacity="0.18"
                  />
                </pattern>

                <mask
                  id="uf-crescent-mask"
                  maskUnits="userSpaceOnUse"
                  x="0"
                  y="0"
                  width="640"
                  height="640"
                >
                  <rect width="640" height="640" fill="#000" />
                  <circle cx="312" cy="330" r="232" fill="#fff" />
                  <circle cx="430" cy="244" r="218" fill="#000" />
                </mask>

                <filter
                  id="uf-shadow"
                  x="-35%"
                  y="-35%"
                  width="170%"
                  height="170%"
                  colorInterpolationFilters="sRGB"
                >
                  <feDropShadow
                    dx="16"
                    dy="26"
                    stdDeviation="26"
                    floodColor="#1A0903"
                    floodOpacity="0.55"
                  />
                </filter>

                <filter
                  id="uf-blur"
                  x="-80%"
                  y="-80%"
                  width="260%"
                  height="260%"
                  colorInterpolationFilters="sRGB"
                >
                  <feGaussianBlur stdDeviation="18" />
                </filter>
              </defs>

              <circle cx="312" cy="330" r="318" fill="url(#uf-glow)" />

              <g className="crescent-orbit">
                <circle
                  cx="312"
                  cy="330"
                  r="286"
                  fill="none"
                  stroke="#B65424"
                  strokeOpacity="0.26"
                  strokeWidth="1"
                  strokeDasharray="1 11"
                />
                <circle
                  cx="312"
                  cy="330"
                  r="304"
                  fill="none"
                  stroke="#15120E"
                  strokeOpacity="0.1"
                  strokeWidth="1"
                />
                <g className="crescent-dot">
                  <circle cx="312" cy="44" r="2.6" fill="#B65424" />
                  <circle cx="312" cy="44" r="7" fill="none" stroke="#B65424" strokeOpacity="0.25" />
                </g>
              </g>

              <g stroke="#15120E" strokeOpacity="0.16" strokeWidth="1">
                <path d="M58 330h30M552 330h30M312 60v28M312 572v28" />
                <circle cx="312" cy="330" r="322" fill="none" strokeOpacity="0.08" />
              </g>

              <g
                opacity="0.3"
                transform="translate(26 18) rotate(-7 312 330)"
                mask="url(#uf-crescent-mask)"
              >
                <circle
                  cx="312"
                  cy="330"
                  r="232"
                  fill="none"
                  stroke="#C4632D"
                  strokeWidth="1.2"
                  strokeOpacity="0.5"
                />
              </g>

              <g filter="url(#uf-shadow)" className="crescent-form">
                <g transform="rotate(-8 312 330)" mask="url(#uf-crescent-mask)">
                  <circle cx="312" cy="330" r="232" fill="url(#uf-metal)" />
                  <circle cx="312" cy="330" r="232" fill="url(#uf-brush)" />

                  <ellipse
                    cx="158"
                    cy="294"
                    rx="46"
                    ry="148"
                    fill="#FFDDC0"
                    opacity="0.22"
                    filter="url(#uf-blur)"
                    transform="rotate(-24 158 294)"
                  />

                  <g fill="none" stroke="#FFE0C6" strokeOpacity="0.12" strokeWidth="0.8">
                    <circle cx="312" cy="330" r="210" />
                    <circle cx="312" cy="330" r="192" />
                    <circle cx="312" cy="330" r="174" />
                    <circle cx="312" cy="330" r="156" />
                    <circle cx="312" cy="330" r="138" />
                    <circle cx="312" cy="330" r="120" />
                  </g>

                  <circle
                    cx="312"
                    cy="330"
                    r="232"
                    fill="none"
                    stroke="url(#uf-rim)"
                    strokeWidth="2"
                    opacity="0.9"
                  />
                  <circle
                    cx="430"
                    cy="244"
                    r="218"
                    fill="none"
                    stroke="#28140A"
                    strokeWidth="10"
                    opacity="0.38"
                  />
                  <circle
                    cx="430"
                    cy="244"
                    r="218"
                    fill="none"
                    stroke="#F4B58C"
                    strokeWidth="1.2"
                    opacity="0.78"
                  />
                  <path
                    d="M96 378c8 94 96 162 206 164"
                    fill="none"
                    stroke="#FFE7D1"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    opacity="0.55"
                  />
                </g>
              </g>

              <g fill="none" stroke="#15120E" strokeOpacity="0.28" strokeWidth="1">
                <path d="M60 606h38M60 606v-38M570 606h-38M570 606v-38" />
              </g>
            </svg>
          </div>
        </div>

        <div className="art__meta art__meta--bottom" aria-hidden="true">
          <span>FORGED FORM / NO. 01</span>
          <span>MATERIAL / IDEA + PRESSURE</span>
        </div>
      </div>

      <span className="art__side" aria-hidden="true">
        C³ / CRESCENT — EXHIBIT A
      </span>

      <figcaption className="sr-only">
        An abstract forged-metal crescent, a sculptural mark for C³ — Crescent Code Clash.
      </figcaption>
    </figure>
  )
}
