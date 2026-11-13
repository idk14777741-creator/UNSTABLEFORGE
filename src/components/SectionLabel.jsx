export default function SectionLabel({ number, children, tone = 'ink' }) {
  return (
    <p className={`eyebrow eyebrow--${tone}`}>
      <span className="eyebrow__num">{number}</span>
      <span className="eyebrow__rule" aria-hidden="true" />
      <span className="eyebrow__text">{children}</span>
    </p>
  )
}
