import { useState } from 'react'
import type { AppMemory } from '../../lib/memoryTypes'
import { formatMemoryDisplayDate, isMemoryMilestone } from '../../lib/memoryTypes'
import { milestoneDisplayEmoji } from '../../lib/milestoneMemories'
import { ConfirmDialog } from '../ConfirmDialog'
import { IconCamera, IconPencil, IconPlay, IconTrash } from '../ui/LineIcons'
import { MemoryEmojiIcon, memoryEmojiTone } from './MemoryEmojiIcon'

type Props = {
  memory: AppMemory
  lang: string
  onOpen?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function MemoryCard({ memory, lang, onOpen, onEdit, onDelete }: Props) {
  const el = lang === 'el'
  const [confirmDelete, setConfirmDelete] = useState(false)
  const title = memory.text && memory.text !== '📷' && memory.text !== '🎬' ? memory.text : ''
  const displayEmoji = milestoneDisplayEmoji(memory) || memory.emoji || '⭐'
  const tone = memoryEmojiTone(displayEmoji)
  const displayDate = formatMemoryDisplayDate(memory, lang)
  const isMs = isMemoryMilestone(memory)
  const isVideo = Boolean(memory.video)
  const isPhoto = Boolean(memory.img) && !isVideo
  const sourceLabel =
    memory.source === 'milestone' || isMs
      ? el ? 'Ορόσημα' : 'Milestone'
      : memory.source === 'chat'
      ? el ? 'Από chat' : 'From chat'
      : el ? 'Ανάμνηση' : 'Memory'
  const cleanTitle = title.replace(/^[🏆🚩]\s*/, '')
  const openLabel = cleanTitle
    ? (el ? `Άνοιγμα: ${cleanTitle}` : `Open: ${cleanTitle}`)
    : isVideo
      ? (el ? 'Άνοιγμα βίντεο' : 'Open video')
      : isPhoto
        ? (el ? 'Άνοιγμα φωτογραφίας' : 'Open photo')
        : (el ? 'Άνοιγμα ανάμνησης' : 'Open memory')

  return (
    <article className={`hm-memory-card${isMs ? ' hm-memory-card--milestone' : ''}`}>
      <button type="button" className="hm-memory-card__open" onClick={onOpen} aria-label={openLabel}>
        <div className="hm-memory-card__media">
          {isVideo ? (
            <video
              src={memory.video}
              className="hm-memory-card__img"
              muted
              playsInline
              preload="metadata"
              aria-hidden="true"
            />
          ) : isPhoto ? (
            <img src={memory.img} alt="" className="hm-memory-card__img" />
          ) : (
            <div className="hm-memory-card__emoji-bg" style={{ background: tone.bg }} aria-hidden="true">
              <span className="hm-memory-card__emoji">
                <MemoryEmojiIcon emoji={displayEmoji} size={80} />
              </span>
            </div>
          )}
          <span className={`hm-memory-card__badge${isMs ? ' hm-memory-card__badge--milestone' : ''}`}>
            {isMs ? <MemoryEmojiIcon emoji="🚩" size={12} /> : null}
            {sourceLabel}
          </span>
          <span className="hm-memory-card__date">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
              <path d="M4 10h16M9 4v4M15 4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            {displayDate}
          </span>
          {(isVideo || isPhoto) && (
            <span
              className={`hm-memory-card__kind${isVideo ? ' hm-memory-card__kind--video' : ''}`}
              title={isVideo ? (el ? 'Βίντεο' : 'Video') : (el ? 'Φωτογραφία' : 'Photo')}
            >
              {isVideo ? <IconPlay size={14} /> : <IconCamera size={14} />}
            </span>
          )}
        </div>
        {(title || memory.description) ? (
          <div className="hm-memory-card__body">
            <div className="hm-memory-card__content">
              {title ? (
                <span className="hm-memory-card__title">{cleanTitle}</span>
              ) : null}
              {memory.description ? (
                <p className="hm-memory-card__desc">{memory.description}</p>
              ) : null}
            </div>
          </div>
        ) : null}
      </button>
      {(onEdit || onDelete) && (
        <div className="hm-memory-card__actions">
          {onEdit && !isMs && (
            <button
              type="button"
              className="hm-memory-card__action"
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              title={el ? 'Επεξεργασία' : 'Edit'}
              aria-label={el ? 'Επεξεργασία' : 'Edit'}
            >
              <IconPencil size={15} />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              className="hm-memory-card__action hm-memory-card__action--delete"
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDelete(true)
              }}
              title={el ? 'Διαγραφή' : 'Delete'}
              aria-label={el ? 'Διαγραφή' : 'Delete'}
            >
              <IconTrash size={15} />
            </button>
          )}
        </div>
      )}
      {onDelete && (
        <ConfirmDialog
          open={confirmDelete}
          title={el ? (isMs ? 'Διαγραφή οροσήμου' : 'Διαγραφή ανάμνησης') : (isMs ? 'Delete milestone' : 'Delete memory')}
          message={
            el
              ? `Είσαι σίγουρη/ος ότι θέλεις να διαγράψεις ${isMs ? 'αυτό το ορόσημο' : 'αυτή την ανάμνηση'}${cleanTitle ? ` «${cleanTitle}»` : ''};`
              : `Are you sure you want to delete this ${isMs ? 'milestone' : 'memory'}${cleanTitle ? ` “${cleanTitle}”` : ''}?`
          }
          confirmLabel={el ? 'Διαγραφή' : 'Delete'}
          cancelLabel={el ? 'Ακύρωση' : 'Cancel'}
          variant="danger"
          onConfirm={() => {
            setConfirmDelete(false)
            onDelete()
          }}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </article>
  )
}
