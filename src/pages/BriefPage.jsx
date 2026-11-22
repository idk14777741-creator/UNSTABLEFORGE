import { useEffect } from 'react'
import ChapterHud from '../components/ChapterHud'
import Idea from '../components/Idea'
import Challenge from '../components/Challenge'
import Tracks from '../components/Tracks'
import Journey from '../components/Journey'
import Stakes from '../components/Stakes'
import LatestFromForge from '../components/LatestFromForge'
import Participate from '../components/Participate'
import Faq from '../components/Faq'
import FinalCta from '../components/FinalCta'
import { brand, eventFacts } from '../data/site'

export default function BriefPage({ onOpenRegistration }) {
  useEffect(() => {
    document.title = 'The Brief — Unstable Forge'
    return () => {
      document.title = 'Unstable Forge — C³ Crescent Code Clash'
    }
  }, [])

  return (
    <main id="main">
      <header className="brief-hero">
        <div className="brief-hero__inner">
          <p className="eyebrow eyebrow--light">
            <span className="eyebrow__num">00</span>
            <span className="eyebrow__rule" aria-hidden="true" />
            <span className="eyebrow__text">THE BRIEF</span>
          </p>
          <h1 className="display brief-hero__title">
            THE DETAILS,
            <br />
            <em className="serif">ON THE RECORD.</em>
          </h1>
          <p className="brief-hero__lede">
            {brand.event} at {brand.audience.toLowerCase()}. The brief, the challenge domains,
            the run of show and what is at stake all live here.
          </p>
          <div className="brief-hero__facts">
            {eventFacts.map((fact) => (
              <span key={fact.label}>
                {fact.label} / {fact.value}
              </span>
            ))}
            <span>REGISTRATION / OPEN</span>
          </div>
        </div>
      </header>

      <Idea />
      <Challenge />
      <Tracks />
      <Journey />
      <Stakes />
      <LatestFromForge />
      <Participate onOpenRegistration={onOpenRegistration} />
      <Faq />
      <FinalCta onOpenRegistration={onOpenRegistration} />
      <ChapterHud />
    </main>
  )
}
