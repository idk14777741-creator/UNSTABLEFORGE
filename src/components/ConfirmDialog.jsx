import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { lockScroll, releaseScroll } from '../lib/scrollLock'

export default function ConfirmDialog({
  open,
  kicker = 'CONFIRM ACTION',
  title,
  children,
  confirmLabel = 'CONFIRM',
  busyLabel = 'WORKING…',
  busy = false,
  onCancel,
  onConfirm,
}) {
  const panelRef = useRef(null)
  const cancelRef = useRef(null)
  const cancelHandlerRef = useRef(onCancel)
  const busyRef = useRef(busy)

  cancelHandlerRef.current = onCancel
  busyRef.current = busy

  useEffect(() => {
    if (!open) return undefined

    const previousFocus = document.activeElement
    lockScroll()

    const focusTimer = window.setTimeout(() => cancelRef.current?.focus(), 0)

    const onKeyDown = (event) => {
      if (event.key === 'Escape' && !busyRef.current) {
        event.preventDefault()
        cancelHandlerRef.current?.()
        return
      }

      if (event.key !== 'Tab' || !panelRef.current) return

      const focusable = Array.from(
        panelRef.current.querySelectorAll(
          'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null)

      if (!focusable.length) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown)
      releaseScroll()
      if (previousFocus instanceof HTMLElement) {
        window.setTimeout(() => {
          if (previousFocus.isConnected) previousFocus.focus({ preventScroll: true })
        }, 30)
      }
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className="confirm"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel?.()
      }}
    >
      <div
        className="confirm__panel"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-description"
        ref={panelRef}
      >
        <div className="confirm__top">
          <span className="confirm__kicker">
            <span className="status-dot" aria-hidden="true" />
            {kicker}
          </span>
          <span className="confirm__index" aria-hidden="true">
            01 / ACTION
          </span>
        </div>

        <h2 className="confirm__title" id="confirm-title">
          {title}
        </h2>

        <div className="confirm__body" id="confirm-description">
          {children}
        </div>

        <div className="confirm__actions">
          <button
            className="ann-action ann-action--ghost confirm__cancel"
            type="button"
            onClick={onCancel}
            disabled={busy}
            ref={cancelRef}
          >
            KEEP IT
          </button>
          <button
            className="ann-action confirm__confirm"
            type="button"
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? busyLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
