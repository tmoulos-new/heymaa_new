import { AppDialog } from './AppDialog'

type Props = {
  open: boolean
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  variant?: 'danger' | 'default'
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel,
  cancelLabel,
  variant = 'default',
  loading = false,
  onConfirm,
  onCancel,
}: Props) {
  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      title={title}
      size="sm"
      closeOnBackdrop={!loading}
    >
      <div className="hm-confirm-dialog">
        <div className="hm-confirm-dialog__title">{title}</div>
        <p className="hm-confirm-dialog__message">{message}</p>
        <div className="hm-confirm-dialog__actions">
          <button
            type="button"
            className={variant === 'danger' ? 'hm-btn hm-btn--destructive' : 'hm-btn hm-btn--primary'}
            onClick={onConfirm}
            disabled={loading}
          >
            {confirmLabel}
          </button>
          <button
            type="button"
            className="hm-btn hm-btn--secondary"
            onClick={onCancel}
            disabled={loading}
          >
            {cancelLabel}
          </button>
        </div>
      </div>
    </AppDialog>
  )
}
