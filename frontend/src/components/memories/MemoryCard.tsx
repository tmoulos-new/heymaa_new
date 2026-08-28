import type { AppMemory } from '../../lib/memoryTypes'
import { formatMemoryDisplayDate } from '../../lib/memoryTypes'

type Props = {
  memory: AppMemory
  lang: string
  onEdit?: () => void
  onDelete?: () => void
}

export function MemoryCard({ memory, lang, onEdit, onDelete }: Props) {
  const el = lang === 'el'
  const title = memory.text && memory.text !== '📷' && memory.text !== '🎬' ? memory.text : ''
  const displayDate = formatMemoryDisplayDate(memory, lang)
  const sourceLabel =
    memory.source === 'milestone'
      ? el ? 'Ορόσημα' : 'Milestone'
      : memory.source === 'chat'
      ? el ? 'Από chat' : 'From chat'
      : el ? 'Ανάμνηση' : 'Memory'

  return (
    <article className="hm-memory-card">
      <div className="hm-memory-card__media">
        {memory.video ? (
          <video
            src={memory.video}
            className="hm-memory-card__img"
            muted
            playsInline
            aria-hidden={!title}
          />
        ) : memory.img ? (
          <img src={memory.img} alt="" className="hm-memory-card__img" />
        ) : (
          <div className="hm-memory-card__emoji-bg" aria-hidden="true">
            <span className="hm-memory-card__emoji">{memory.emoji || '😊'}</span>
          </div>
        )}
        <span className="hm-memory-card__badge">{sourceLabel}</span>
        <span className="hm-memory-card__date">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <rect x="4" y="5" width="16" height="16" rx="2" stroke="currentColor" strokeWidth="1.8" />
            <path d="M4 10h16M9 4v4M15 4v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          {displayDate}
        </span>
      </div>
      <div className="hm-memory-card__body">
        <div className="hm-memory-card__quote-mark" aria-hidden="true">"</div>
        <div className="hm-memory-card__content">
          {title ? (
            <h3 className="hm-memory-card__title">
              {memory.emoji && !title.startsWith(memory.emoji) ? `${memory.emoji} ` : ''}
              {title}
            </h3>
          ) : null}
          {memory.description ? (
            <p className="hm-memory-card__desc">{memory.description}</p>
          ) : null}
        </div>
        {(onEdit || onDelete) && (
          <div className="hm-memory-card__actions">
            {onEdit && (
              <button type="button" className="hm-memory-card__action" onClick={onEdit} aria-label={el ? 'Επεξεργασία' : 'Edit'}>
                ✏️
              </button>
            )}
            {onDelete && (
              <button type="button" className="hm-memory-card__action hm-memory-card__action--delete" onClick={onDelete} aria-label={el ? 'Διαγραφή' : 'Delete'}>
                ×
              </button>
            )}
          </div>
        )}
      </div>
    </article>
  )
}
