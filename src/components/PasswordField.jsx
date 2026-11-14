import { useId, useState } from 'react'

export default function PasswordField({
  label,
  value,
  onChange,
  error,
  autoComplete = 'current-password',
  hint,
  name = 'password',
}) {
  const [visible, setVisible] = useState(false)
  const id = useId()
  const errorId = `${id}-error`
  const hintId = `${id}-hint`

  return (
    <div className={`auth-field ${error ? 'has-error' : ''}`}>
      <label className="auth-field__label" htmlFor={id}>
        <span>{label}</span>
      </label>
      <div className="auth-field__control">
        <input
          id={id}
          name={name}
          type={visible ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={autoComplete}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? errorId : hint ? hintId : undefined}
        />
        <button
          className="auth-field__reveal"
          type="button"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
        >
          {visible ? 'HIDE' : 'SHOW'}
        </button>
      </div>
      {error ? (
        <p className="auth-field__error" id={errorId} role="alert">
          {error}
        </p>
      ) : (
        hint && (
          <p className="auth-field__hint-text" id={hintId}>
            {hint}
          </p>
        )
      )}
    </div>
  )
}
