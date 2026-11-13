import { useState } from 'react'
import { faqs } from '../data/site'
import SectionLabel from './SectionLabel'

export default function Faq() {
  const [openIndex, setOpenIndex] = useState(0)

  const toggle = (index) => {
    setOpenIndex((current) => (current === index ? -1 : index))
  }

  return (
    <section id="faq" className="section section--paper faq" aria-labelledby="faq-title">
      <div className="container faq__grid">
        <div className="faq__side">
          <SectionLabel number="07">FAQ</SectionLabel>
          <h2 id="faq-title" className="display faq__title" data-reveal>
            QUESTIONS{' '}
            <br />
            <em className="serif">BEFORE THE FORGE.</em>
          </h2>
          <p className="faq__intro" data-reveal style={{ '--reveal-delay': '100ms' }}>
            Some answers are still being forged. Anything not yet confirmed is marked as such.
          </p>
          <a className="text-link" href="#participate">
            PARTICIPATION DETAILS <span aria-hidden="true">↗</span>
          </a>
        </div>

        <div className="faq__list">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index
            const buttonId = `faq-button-${index}`
            const panelId = `faq-panel-${index}`

            return (
              <div
                className={`faq__item ${isOpen ? 'is-open' : ''}`}
                key={item.question}
                data-reveal
                style={{ '--reveal-delay': `${index * 50}ms` }}
              >
                <h3 className="faq__heading">
                  <button
                    className="faq__button"
                    type="button"
                    id={buttonId}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggle(index)}
                  >
                    <span className="faq__number">0{index + 1}</span>
                    <span className="faq__question">{item.question}</span>
                    <span className="faq__icon" aria-hidden="true">
                      <span />
                      <span />
                    </span>
                  </button>
                </h3>
                <div
                  className="faq__panel"
                  id={panelId}
                  role="region"
                  aria-labelledby={buttonId}
                  aria-hidden={!isOpen}
                >
                  <div className="faq__panel-inner">
                    <p>{item.answer}</p>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
