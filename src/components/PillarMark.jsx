export default function PillarMark({ variant }) {
  if (variant === 'grid') {
    return (
      <svg className="pillar__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <rect x="8" y="8" width="32" height="32" stroke="currentColor" strokeWidth="1.2" />
        <path d="M8 24h32M24 8v32" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="24" cy="24" r="2.6" fill="currentColor" />
      </svg>
    )
  }

  if (variant === 'form') {
    return (
      <svg className="pillar__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <path d="M10 36 24 10l14 26" stroke="currentColor" strokeWidth="1.2" />
        <path d="M17 40h20" stroke="currentColor" strokeWidth="1.2" />
        <circle cx="24" cy="25" r="2.2" fill="currentColor" />
      </svg>
    )
  }

  return (
    <svg className="pillar__mark" viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path
        d="M38 8A22 22 0 1 0 38 40"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path d="M38 16A14 14 0 0 1 38 32" stroke="currentColor" strokeWidth="1.2" opacity="0.4" />
      <path d="M9 24h11" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  )
}
