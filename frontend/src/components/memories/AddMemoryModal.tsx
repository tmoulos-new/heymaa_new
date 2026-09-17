import { useEffect, useRef, useState } from 'react'
import { AppDialog } from '../AppDialog'
import { DialogPanel } from '../ui/DialogPanel'
import { FeatureUpgradeGate } from '../FeatureUpgradeGate'
import type { AppMemory } from '../../lib/memoryTypes'
import { MEMORY_EMOJI_OPTIONS } from '../../lib/memoryTypes'
import { displayUppercase } from '../../lib/greekText'
import { MemoryEmojiIcon, memoryEmojiTone } from './MemoryEmojiIcon'
import { HmDateField } from '../HmDateField'

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
  onUpgrade?: () => void
  upgradeFeatureLabel?: string
  upgradeRequiredPlanLabel?: string
  onSave: (values: MemoryFormValues) => void
  onPickPhoto: () => void
  pendingPhoto?: string | null
  pendingVideo?: string | null
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
  onUpgrade,
  upgradeFeatureLabel,
  upgradeRequiredPlanLabel,
  onSave,
  onPickPhoto,
  pendingPhoto,
  pendingVideo,
  onClearPhoto,
}: Props) {
  const el = lang === 'el'
  const [emoji, setEmoji] = useState('😊')
  const [text, setText] = useState('')
  const [description, setDescription] = useState('')
  const [dateIso, setDateIso] = useState(todayIso())
  const [mediaCleared, setMediaCleared] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)
  // Stable while the same memory is open — avoid reset/refocus if parent re-renders
  // with a new `initial` object identity (would interrupt typing).
  const editKey = initial?.createdAt || (initial ? 'edit' : 'new')

  useEffect(() => {
    if (!open) return
    setEmoji(initial?.emoji || '😊')
    setText(initial?.text && initial.text !== '📷' && initial.text !== '🎬' ? initial.text : '')
    setDescription(initial?.description || '')
    setDateIso(isoFromMemory(initial))
    setMediaCleared(false)
    const t = window.setTimeout(() => titleRef.current?.focus(), 120)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- seed only when dialog opens / edit target changes
  }, [open, editKey])

  const previewImg = pendingVideo ? undefined : (pendingPhoto || (!mediaCleared ? initial?.img : undefined))
  const previewVideo = pendingPhoto ? undefined : (pendingVideo || (!mediaCleared ? initial?.video : undefined))
  const hasMedia = Boolean(previewImg || previewVideo)
  const canSave = text.trim().length > 0 || hasMedia

  const handleSave = () => {
    if (!canSave) return
    onSave({
      emoji,
      text: text.trim() || (previewImg ? '📷' : previewVideo ? '🎬' : '📝'),
      description: description.trim(),
      dateIso,
      img: previewImg,
      video: previewVideo,
    })
    onClose()
  }

  const mediaAllowed = photoAllowed || videoAllowed
  const showMediaGate = !mediaAllowed && !hasMedia && onUpgrade && upgradeFeatureLabel && upgradeRequiredPlanLabel

  const handlePickPhoto = () => {
    if (!mediaAllowed) {
      onUpgrade?.()
      return
    }
    onPickPhoto()
  }

  const handleClearMedia = () => {
    setMediaCleared(true)
    onClearPhoto?.()
  }

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
            <MemoryEmojiIcon emoji={initial ? '📝' : '✨'} size={18} />
            {initial ? (el ? 'Επεξεργασία' : 'Edit memory') : (el ? 'Νέα ανάμνηση' : 'New memory')}
          </h2>
          <button type="button" className="hm-memory-modal__close" onClick={onClose} aria-label={el ? 'Κλείσιμο' : 'Close'}>
            ×
          </button>
        </div>

        <div className="hm-memory-modal__section">
          <span className="hm-memory-modal__label">{displayUppercase(el ? 'Φωτογραφίες / βίντεο' : 'Photos / video', lang)}</span>
          {showMediaGate ? (
            <FeatureUpgradeGate
              lang={lang}
              featureLabel={upgradeFeatureLabel}
              requiredPlanLabel={upgradeRequiredPlanLabel}
              onUpgrade={onUpgrade}
              compact
            />
          ) : (
          <div className="hm-memory-modal__media-row">
            {previewImg || previewVideo ? (
              <div className="hm-memory-modal__thumb-wrap">
                {previewVideo ? (
                  <video src={previewVideo} className="hm-memory-modal__thumb" muted playsInline />
                ) : (
                  <img src={previewImg} alt="" className="hm-memory-modal__thumb" />
                )}
                <button type="button" className="hm-memory-modal__thumb-remove" onClick={handleClearMedia} aria-label={el ? 'Αφαίρεση' : 'Remove'}>
                  ×
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="hm-memory-modal__add-media"
                onClick={handlePickPhoto}
              >
                <span className="hm-memory-modal__add-media-plus">+</span>
                <span>{el ? 'Πρόσθεσε' : 'Add'}</span>
              </button>
            )}
          </div>
          )}
        </div>

        <div className="hm-memory-modal__section">
          <span className="hm-memory-modal__label">{displayUppercase(el ? 'Εικονίδιο' : 'Icon', lang)}</span>
          <div className="hm-memory-modal__emoji-grid">
            {MEMORY_EMOJI_OPTIONS.map((opt) => {
              const tone = memoryEmojiTone(opt.emoji)
              const label = el ? opt.el : opt.en
              return (
              <button
                key={opt.emoji}
                type="button"
                className={`hm-memory-modal__emoji${emoji === opt.emoji ? ' hm-memory-modal__emoji--active' : ''}`}
                onClick={() => setEmoji(opt.emoji)}
                aria-pressed={emoji === opt.emoji}
                aria-label={label}
                title={label}
                style={{ background: tone.bg }}
              >
                <MemoryEmojiIcon emoji={opt.emoji} size={22} />
              </button>
              )
            })}
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

        <div className="hm-memory-modal__field">
          <span className="hm-memory-modal__label">{displayUppercase(el ? 'Ημερομηνία' : 'Date', lang)}</span>
          <HmDateField
            lang={lang}
            value={dateIso}
            onChange={setDateIso}
            variant="cream"
            size="sm"
            ariaLabel={el ? 'Ημερομηνία' : 'Date'}
          />
        </div>

        <label className="hm-memory-modal__field">
          <span className="hm-memory-modal__label">
            {displayUppercase(el ? 'Περιγραφή' : 'Description', lang)}
          </span>
          <textarea
            className="hm-memory-modal__textarea"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={el ? 'Λίγες σκέψεις/λέξεις για τη στιγμή...' : 'A few words about the moment…'}
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
