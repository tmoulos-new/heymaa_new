import { useEffect, useRef, useState } from 'react'
import { AppDialog } from '../AppDialog'
import { DialogPanel } from '../ui/DialogPanel'
import type { AppMemory } from '../../lib/memoryTypes'
import { MEMORY_EMOJI_OPTIONS } from '../../lib/memoryTypes'
import { displayUppercase } from '../../lib/greekText'

export type MemoryFormValues = {
  emoji: string
  text: string
  description: string
  dateIso: string
  img?: string
  video?: string
}

type Props = {
  open: boolean
  onClose: () => void
  lang: string
  initial?: AppMemory | null
  photoAllowed: boolean
  videoAllowed: boolean
  onSave: (values: MemoryFormValues) => void
  onPickPhoto: () => void
  pendingPhoto?: string | null
  onClearPhoto?: () => void
}

function todayIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function isoFromMemory(m?: AppMemory | null): string {
  if (m?.createdAt) {
    const d = new Date(m.createdAt)
    if (!Number.isNaN(d.getTime())) {
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }
  return todayIso()
}

export function AddMemoryModal({
  open,
  onClose,
  lang,
  initial,
  photoAllowed,
  videoAllowed,
  onSave,
  onPickPhoto,
  pendingPhoto,
  onClearPhoto,
}: Props) {
  const el = lang === 'el'
  const [emoji, setEmoji] = useState('⭐')
  const [text, setText] = useState('')
  const [description, setDescription] = useState('')
  const [dateIso, setDateIso] = useState(todayIso())
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    setEmoji(initial?.emoji || '⭐')
    setText(initial?.text && initial.text !== '📷' && initial.text !== '🎬' ? initial.text : '')
    setDescription(initial?.description || '')
    setDateIso(isoFromMemory(initial))
    const t = window.setTimeout(() => titleRef.current?.focus(), 120)
    return () => window.clearTimeout(t)
  }, [open, initial])

  const canSave = text.trim().length > 0 || !!pendingPhoto || !!initial?.img

  const handleSave = () => {
    if (!canSave) return
    onSave({
      emoji,
      text: text.trim() || (pendingPhoto || initial?.img ? '📷' : '📝'),
      description: description.trim(),
      dateIso,
      img: pendingPhoto || initial?.img,
      video: initial?.video,
    })
    onClose()
  }

  const previewImg = pendingPhoto || initial?.img

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="md"
      align="bottom"
      ariaLabel={el ? 'Νέα ανάμνηση' : 'New memory'}
      panelClassName="hm-memory-modal"
    >
      <DialogPanel variant="white" padding="lg" className="hm-memory-modal__panel">
        <div className="hm-memory-modal__head">
          <h2 className="hm-memory-modal__title">
            {initial ? (el ? '✏️ Επεξεργασία' : '✏️ Edit memory') : (el ? '✨ Νέα ανάμνηση' : '✨ New memory')}
          </h2>
          <button type="button" className="hm-memory-modal__close" onClick={onClose} aria-label={el ? 'Κλείσιμο' : 'Close'}>
            ×
          </button>
        </div>

        <div className="hm-memory-modal__section">
          <span className="hm-memory-modal__label">{displayUppercase(el ? 'Φωτογραφίες / βίντεο' : 'Photos / video', lang)}</span>
          <div className="hm-memory-modal__media-row">
            {previewImg ? (
              <div className="hm-memory-modal__thumb-wrap">
                <img src={previewImg} alt="" className="hm-memory-modal__thumb" />
                {onClearPhoto && (
                  <button type="button" className="hm-memory-modal__thumb-remove" onClick={onClearPhoto} aria-label={el ? 'Αφαίρεση' : 'Remove'}>
                    ×
                  </button>
                )}
              </div>
            ) : (
              <button
                type="button"
                className="hm-memory-modal__add-media"
                onClick={onPickPhoto}
                disabled={!photoAllowed && !videoAllowed}
              >
                <span className="hm-memory-modal__add-media-plus">+</span>
                <span>{el ? 'Πρόσθεσε' : 'Add'}</span>
              </button>
            )}
            {!photoAllowed && !previewImg && (
              <p className="hm-memory-modal__hint">
                {el ? 'Οι φωτογραφίες απαιτούν Πλήρη Μνήμη (Starter+).' : 'Photos require Full Memory (Starter+).'}
              </p>
            )}
          </div>
        </div>

        <div className="hm-memory-modal__section">
          <span className="hm-memory-modal__label">{displayUppercase(el ? 'Εικονίδιο' : 'Icon', lang)}</span>
          <div className="hm-memory-modal__emoji-grid">
            {MEMORY_EMOJI_OPTIONS.map((e) => (
              <button
                key={e}
                type="button"
                className={`hm-memory-modal__emoji${emoji === e ? ' hm-memory-modal__emoji--active' : ''}`}
                onClick={() => setEmoji(e)}
                aria-pressed={emoji === e}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <label className="hm-memory-modal__field">
          <span className="hm-memory-modal__label">{displayUppercase(el ? 'Τίτλος' : 'Title', lang)}</span>
          <input
            ref={titleRef}
            type="text"
            className="hm-memory-modal__input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={el ? 'π.χ. Το 1ο βήμα!' : 'e.g. First steps!'}
          />
        </label>

        <label className="hm-memory-modal__field">
          <span className="hm-memory-modal__label">{displayUppercase(el ? 'Ημερομηνία' : 'Date', lang)}</span>
          <div className="hm-memory-modal__date-wrap">
            <input
              type="date"
              className="hm-memory-modal__input hm-memory-modal__input--date"
              value={dateIso}
              onChange={(e) => setDateIso(e.target.value)}
            />
          </div>
        </label>

        <label className="hm-memory-modal__field">
          <span className="hm-memory-modal__label">
            {displayUppercase(el ? 'Περιγραφή — προαιρετικό' : 'Description — optional', lang)}
          </span>
          <textarea
            className="hm-memory-modal__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={el ? 'Κάποιες λέξεις για τη στιγμή…' : 'A few words about the moment…'}
            rows={3}
          />
        </label>

        <button
          type="button"
          className="hm-memory-modal__save"
          disabled={!canSave}
          onClick={handleSave}
        >
          {initial ? (el ? 'Αποθήκευση αλλαγών' : 'Save changes') : (el ? 'Αποθήκευση ανάμνησης' : 'Save memory')}
        </button>
      </DialogPanel>
    </AppDialog>
  )
}
