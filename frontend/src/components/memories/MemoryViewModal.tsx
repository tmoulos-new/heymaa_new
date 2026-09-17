import { AppDialog } from '../AppDialog'
import { DialogPanel } from '../ui/DialogPanel'
import type { AppMemory } from '../../lib/memoryTypes'
import { formatMemoryDisplayDate, isMemoryMilestone } from '../../lib/memoryTypes'
import { milestoneDisplayEmoji } from '../../lib/milestoneMemories'
import { MemoryEmojiIcon, memoryEmojiTone } from './MemoryEmojiIcon'
import { IconCamera, IconPlay } from '../ui/LineIcons'

type Props = {
  open: boolean
  memory: AppMemory | null
  lang: string
  onClose: () => void
}

export function MemoryViewModal({ open, memory, lang, onClose }: Props) {
  const el = lang === 'el'
  if (!memory) return null

  const title = memory.text && memory.text !== '📷' && memory.text !== '🎬' ? memory.text.replace(/^[🏆🚩]\s*/, '') : ''
  const displayEmoji = milestoneDisplayEmoji(memory) || memory.emoji || '⭐'
  const tone = memoryEmojiTone(displayEmoji)
  const isVideo = Boolean(memory.video)
  const isPhoto = Boolean(memory.img) && !isVideo
  const kindLabel = isVideo ? (el ? 'Βίντεο' : 'Video') : isPhoto ? (el ? 'Φωτογραφία' : 'Photo') : (el ? 'Ανάμνηση' : 'Memory')

  return (
    <AppDialog
      open={open}
      onClose={onClose}
      size="lg"
      align="bottom"
      ariaLabel={title || kindLabel}
      panelClassName="hm-memory-view-modal"
    >
      <DialogPanel variant="white" padding="lg" className="hm-memory-view-modal__panel">
        <div className="hm-memory-view-modal__head">
          <h2 className="hm-memory-view-modal__title">
            {isVideo ? <IconPlay size={16} /> : isPhoto ? <IconCamera size={16} /> : <MemoryEmojiIcon emoji={displayEmoji} size={18} />}
            {title || kindLabel}
          </h2>
          <button type="button" className="hm-memory-modal__close" onClick={onClose} aria-label={el ? 'Κλείσιμο' : 'Close'}>
            ×
          </button>
        </div>

        <div className={`hm-memory-view-modal__media${isVideo || isPhoto ? '' : ' hm-memory-view-modal__media--emoji'}`}>
          {isVideo ? (
            <video
              src={memory.video}
              className="hm-memory-view-modal__player"
              controls
              playsInline
              autoPlay
            />
          ) : isPhoto ? (
            <img src={memory.img} alt={title || kindLabel} className="hm-memory-view-modal__player" />
          ) : (
            <div className="hm-memory-view-modal__emoji" style={{ background: tone.bg }}>
              <MemoryEmojiIcon emoji={displayEmoji} size={96} />
            </div>
          )}
        </div>

        <p className="hm-memory-view-modal__meta">
          {kindLabel}
          {' · '}
          {formatMemoryDisplayDate(memory, lang)}
          {isMemoryMilestone(memory) ? ` · ${el ? 'Ορόσημο' : 'Milestone'}` : ''}
        </p>
        {memory.description ? <p className="hm-memory-view-modal__desc">{memory.description}</p> : null}
      </DialogPanel>
    </AppDialog>
  )
}
