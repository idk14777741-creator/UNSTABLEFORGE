import ArrowIcon from './ArrowIcon'
import { Link } from '../lib/router'

export default function Cta({
  children,
  href,
  to,
  onClick,
  variant = 'solid',
  opensDialog = false,
  className = '',
}) {
  const classes = `cta cta--${variant} ${className}`.trim()
  const content = (
    <>
      <span>{children}</span>
      <ArrowIcon className="cta__arrow" />
    </>
  )

  if (to) {
    return (
      <Link
        className={classes}
        to={to}
        onClick={onClick}
        aria-haspopup={opensDialog ? 'dialog' : undefined}
      >
        {content}
      </Link>
    )
  }

  if (href) {
    return (
      <a
        className={classes}
        href={href}
        onClick={onClick}
        aria-haspopup={opensDialog ? 'dialog' : undefined}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      className={classes}
      type="button"
      onClick={onClick}
      aria-haspopup={opensDialog ? 'dialog' : undefined}
    >
      {content}
    </button>
  )
}
