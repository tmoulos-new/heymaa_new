import { useEffect } from 'react'

type NoticePreview = {
  title: string
  body: string
  url?: string
}

type MailPreview = {
  subject: string
  html: string
  loading?: boolean
  error?: string
}

export function ComposerPreview({
  open,
  onClose,
  notice,
  mail,
}: {
  open: boolean
  onClose: () => void
  notice?: NoticePreview | null
  mail?: MailPreview | null
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className={`modal ${mail ? 'preview-modal-mail' : 'preview-modal-note'}`}
        role="dialog"
        aria-modal="true"
        aria-label={mail ? 'Email preview' : 'Notification preview'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2>{mail ? 'Email preview' : 'Notification preview'}</h2>
          <button type="button" className="sec sm" onClick={onClose}>
            Close
          </button>
        </div>
        <div className="modal-body">
          {notice ? <NoticePreviewView notice={notice} /> : null}
          {mail ? <MailPreviewView mail={mail} /> : null}
        </div>
      </div>
    </div>
  )
}

function NoticePreviewView({ notice }: { notice: NoticePreview }) {
  const title = notice.title.trim() || 'Title'
  const body = notice.body.trim() || 'Your message will appear here.'
  return (
    <>
      <p className="card-desc">This is how it looks on a phone lock screen, and inside the HeyMaa bell.</p>
      <div className="preview-phone" aria-hidden="true">
        <div className="preview-phone__time">9:41</div>
        <div className="preview-phone__card">
          <div className="preview-phone__app">HeyMaa</div>
          <strong>{title}</strong>
          <p>{body}</p>
        </div>
      </div>
      <p className="preview-label">Inside the app</p>
      <div className="preview-inbox">
        <span className="preview-inbox__dot" />
        <div>
          <strong>{title}</strong>
          <p>{body}</p>
          {notice.url?.trim() ? <span className="preview-inbox__link">Open</span> : null}
        </div>
      </div>
    </>
  )
}

function MailPreviewView({ mail }: { mail: MailPreview }) {
  return (
    <>
      <p className="card-desc">
        Subject: <strong>{mail.subject || 'Subject'}</strong>
        {' · '}
        {'{name}'} is shown as Maria in this sample.
      </p>
      {mail.error ? <p className="muted">{mail.error}</p> : null}
      {mail.loading && !mail.html ? <p className="muted">Building preview…</p> : null}
      {mail.html ? (
        <iframe className="preview-mail-frame" title="Email preview" sandbox="" srcDoc={mail.html} />
      ) : null}
    </>
  )
}
