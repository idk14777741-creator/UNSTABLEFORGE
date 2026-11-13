import { useEffect, useRef } from 'react'
import { registration, brand } from '../data/site'
import Cta from './Cta'
import Mark from './Mark'
import { lockScroll, releaseScroll } from '../lib/scrollLock'

export default function RegistrationDialog({ open, onClose }) {
  const dialogRef = useRef(null)
  const closeRef = useRef(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog || !open) return undefined

    if (!dialog.open) dialog.showModal()
    lockScroll()

    const focusTimer = window.setTimeout(() => closeRef.current?.focus(), 0)

    const onKeyDown = (event) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      close()
    }
    document.addEventListener('keydown', onKeyDown, true)

    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener('keydown', onKeyDown, true)
      releaseScroll()
    }
  }, [open, onClose])

  const close = () => {
    const dialog = dialogRef.current
    if (dialog?.open) dialog.close()
    onClose()
  }

  const handleBackdrop = (event) => {
    if (event.target === dialogRef.current) close()
  }

  return (
    <dialog
      className="dialog"
      ref={dialogRef}
      onClick={handleBackdrop}
      aria-labelledby="registration-title"
      aria-describedby="registration-note"
    >
      <div className="dialog__panel">
        <div className="dialog__top">
          <span className="dialog__meta">
            <span className="status-dot" aria-hidden="true" />
            C³ / REGISTRATION STATUS
          </span>
          <button
            className="dialog__close"
            type="button"
            onClick={close}
            ref={closeRef}
            aria-label="Close registration details"
          >
            <span>CLOSE</span>
            <span className="dialog__close-x" aria-hidden="true">
              ×
            </span>
          </button>
        </div>

        <div className="dialog__body">
          <p className="dialog__eyebrow">STATUS / NOT OPEN</p>
          <h2 className="dialog__title" id="registration-title">
            DETAILS ARE{' '}
            <br />
            <em className="serif">COMING.</em>
          </h2>
          <p className="dialog__lede" id="registration-note">
            {registration.note}
          </p>

          <dl className="dialog__specs">
            {registration.fields.map((field) => (
              <div className="dialog__row" key={field.label}>
                <dt>{field.label}</dt>
                <dd>{field.value}</dd>
              </div>
            ))}
          </dl>

          <p className="dialog__note">NO DETAILS ARE BEING COLLECTED YET.</p>

          <div className="dialog__actions">
            <Cta variant="light" onClick={close}>
              BACK TO THE EVENT
            </Cta>
            <span className="dialog__event">{brand.event}</span>
          </div>
        </div>

        <Mark className="dialog__mark" />
      </div>
    </dialog>
  )
}
