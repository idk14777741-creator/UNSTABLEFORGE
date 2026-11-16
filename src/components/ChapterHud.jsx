import { useEffect, useRef, useState } from 'react'

const chapters = [
  { id: 'idea', number: '01', label: 'THE IDEA' },
  { id: 'challenge', number: '02', label: 'CHALLENGE' },
  { id: 'tracks', number: '03', label: 'TRACKS' },
  { id: 'journey', number: '04', label: 'JOURNEY' },
  { id: 'stakes', number: '05', label: 'STAKES' },
  { id: 'latest', number: '06', label: 'THE WIRE' },
  { id: 'participate', number: '07', label: 'PARTICIPATE' },
  { id: 'faq', number: '08', label: 'FAQ' },
  { id: 'register', number: '09', label: 'REGISTER' },
]

export default function ChapterHud() {
  const [active, setActive] = useState(chapters[0])
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const frameRef = useRef(0)

  useEffect(() => {
    const sections = chapters
      .map((chapter) => ({ ...chapter, element: document.getElementById(chapter.id) }))
      .filter((chapter) => chapter.element)

    if (!sections.length) return undefined

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return
          const match = sections.find((chapter) => chapter.element === entry.target)
          if (match) setActive(match)
        })
      },
      { rootMargin: '-38% 0px -52% 0px', threshold: 0 },
    )

    sections.forEach((chapter) => observer.observe(chapter.element))

    const updateProgress = () => {
      frameRef.current = 0
      const first = sections[0].element.offsetTop
      const lastChapter = sections[sections.length - 1].element
      const end = lastChapter.offsetTop + lastChapter.offsetHeight
      const total = Math.max(1, end - first)
      const value = Math.min(1, Math.max(0, (window.scrollY + window.innerHeight * 0.45 - first) / total))
      setProgress(value)

      const hero = document.getElementById('top')
      const heroEnd = hero ? hero.offsetTop + hero.offsetHeight * 0.5 : 0
      const documentEnd = document.documentElement.scrollHeight - window.innerHeight - 120
      setVisible(window.scrollY > heroEnd && window.scrollY < documentEnd)
    }

    const requestUpdate = () => {
      if (frameRef.current) return
      frameRef.current = window.requestAnimationFrame(updateProgress)
    }

    updateProgress()
    window.addEventListener('scroll', requestUpdate, { passive: true })
    window.addEventListener('resize', requestUpdate)

    return () => {
      observer.disconnect()
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current)
      window.removeEventListener('scroll', requestUpdate)
      window.removeEventListener('resize', requestUpdate)
    }
  }, [])

  return (
    <aside
      className={`chapter-hud ${visible ? 'is-visible' : ''}`}
      aria-label={`Current chapter: ${active.label}`}
    >
      <span className="chapter-hud__number" aria-hidden="true">
        {active.number}
      </span>
      <span className="chapter-hud__body">
        <span className="chapter-hud__meta">CHAPTER / {active.number} OF 09</span>
        <span className="chapter-hud__label">{active.label}</span>
        <span className="chapter-hud__track" aria-hidden="true">
          <span
            className="chapter-hud__bar"
            style={{ transform: `scaleX(${progress})` }}
          />
        </span>
      </span>
    </aside>
  )
}
