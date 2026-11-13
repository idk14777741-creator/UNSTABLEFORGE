export default function Mark({ className = '' }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M25.5 6.8A13 13 0 1 0 25.5 25.2"
        stroke="currentColor"
        strokeWidth="3.2"
        strokeLinecap="round"
      />
      <path
        d="M25.5 6.8A13 13 0 0 1 25.5 25.2"
        stroke="currentColor"
        strokeOpacity="0.22"
        strokeWidth="1"
      />
    </svg>
  )
}
