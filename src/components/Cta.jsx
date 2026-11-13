import ArrowIcon from './ArrowIcon'

export default function Cta({
  children,
  href,
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
