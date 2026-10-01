import { useCallback, type ReactNode } from 'react'
import { Pencil, X } from 'lucide-react'
import { useToast, type ToastKind } from '../context/ToastContext'

export function useFlashMessage() {
  const { showToast } = useToast()
  const show = useCallback(
    (text: string, kind: ToastKind = 'ok') => showToast(text, kind),
    [showToast],
  )
  return { show, Message: null }
}

export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode
  required?: boolean
}) {
  return (
    <label className="field">
      {children}
      {required && (
        <span className="req" aria-hidden="true">
          {' '}
          *
        </span>
      )}
    </label>
  )
}

/** Edit / Cancel controls for locked-by-default admin forms. */
export function FormLockControls({
  editing,
  onEdit,
  onCancel,
  editLabel = 'Edit',
  cancelLabel = 'Cancel',
  disabled,
}: {
  editing: boolean
  onEdit: () => void
  onCancel: () => void
  editLabel?: string
  cancelLabel?: string
  disabled?: boolean
}) {
  if (editing) {
    return (
      <button type="button" className="sec sm form-lock-btn" onClick={onCancel} disabled={disabled}>
        <X size={14} /> {cancelLabel}
      </button>
    )
  }
  return (
    <button type="button" className="sec sm form-lock-btn" onClick={onEdit} disabled={disabled}>
      <Pencil size={14} /> {editLabel}
    </button>
  )
}

/** Wraps fields; when locked, inputs are grayed and non-interactive. */
export function FormLockBody({
  editing,
  children,
  className = '',
}: {
  editing: boolean
  children: ReactNode
  className?: string
}) {
  return (
    <fieldset
      className={`form-lock-body${editing ? ' is-editing' : ' is-locked'}${className ? ` ${className}` : ''}`}
      disabled={!editing}
      aria-disabled={!editing}
    >
      {!editing ? <legend className="form-lock-legend">Locked — press Edit to change</legend> : null}
      {children}
    </fieldset>
  )
}
