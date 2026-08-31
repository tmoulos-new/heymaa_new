import { useEffect, useMemo, useState } from 'react'
import type { FamilyChild, FamilyMemberRecord } from '../../lib/familyData'
import {
  bookletLabelsForLang,
  defaultBookletDateRange,
  downloadMemoriesBooklet,
  formatBookletDateRangeLabel,
  memoriesInDateRange,
  prepareBookletContent,
  type BookletMemory,
} from '../../lib/memoriesBooklet'
import { formatMemoryDisplayDate } from '../../lib/memoryTypes'
import { displayUppercase } from '../../lib/greekText'
import { BookletFlipbookModal } from '../MemoriesBookletPanel'
import { MemoryEmojiIcon, memoryEmojiTone } from './MemoryEmojiIcon'

type Layout = 'inline' | 'modal'

type Props = {
  memories: BookletMemory[]
  userName: string
  journalName: string
  lang: string
  familyChildren: FamilyChild[]
  members: FamilyMemberRecord[]
  layout?: Layout
  onDownload?: () => void
  onSave?: () => void
  saving?: boolean
  onRemovePhoto?: (m: BookletMemory) => void
  onDeleteMemory?: (m: BookletMemory) => void
  onClose?: () => void
  showHeader?: boolean
}

export function MemoriesAlbumSection({
  memories,
  userName,
  journalName,
  lang,
  familyChildren,
  members,
  layout = 'inline',
  onDownload,
  onSave,
  saving,
  onRemovePhoto,
  onDeleteMemory,
  onClose,
  showHeader = true,
}: Props) {
  const el = lang === 'el'
  const saveLabel = el ? 'Αποθήκευση' : 'Save'
  const savingLabel = el ? 'Αποθήκευση…' : 'Saving…'
  const labels = useMemo(() => bookletLabelsForLang(lang), [lang])
  const defaults = useMemo(() => defaultBookletDateRange(memories, lang), [memories, lang])
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [rangeTouched, setRangeTouched] = useState(false)

  useEffect(() => {
    if (rangeTouched) return
    setFromDate(defaults.fromDate)
    setToDate(defaults.toDate)
  }, [defaults.fromDate, defaults.toDate, rangeTouched])

  const rangeOk = Boolean(fromDate && toDate)
  const normalizedFrom = rangeOk && fromDate > toDate ? toDate : fromDate
  const normalizedTo = rangeOk && fromDate > toDate ? fromDate : toDate
  const inRange = useMemo(
    () => (rangeOk ? memoriesInDateRange(memories, normalizedFrom, normalizedTo, lang) : []),
    [memories, normalizedFrom, normalizedTo, lang, rangeOk],
  )
  const countInPeriod = inRange.length
  const periodText = rangeOk ? formatBookletDateRangeLabel(normalizedFrom, normalizedTo, lang) : ''
  const previewItems = inRange.slice(0, 4)

  const previewPages = useMemo(() => {
    if (!previewOpen || !rangeOk) return []
    return prepareBookletContent({
      userName,
      memories,
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      lang,
      children: familyChildren,
      members,
      labels,
    }).pages
  }, [
    previewOpen,
    rangeOk,
    userName,
    memories,
    normalizedFrom,
    normalizedTo,
    lang,
    familyChildren,
    members,
    labels,
  ])

  const handleDownload = () => {
    if (!rangeOk) return
    const ok = downloadMemoriesBooklet({
      userName,
      memories,
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      lang,
      children: familyChildren,
      members,
      labels,
    })
    if (ok) onDownload?.()
  }

  const handleShare = async () => {
    const text = el
      ? `Άλμπουμ αναμνήσεων · ${journalName} — ${countInPeriod} στιγμές (${periodText})`
      : `Memories album · ${journalName} — ${countInPeriod} moments (${periodText})`
    try {
      if (navigator.share) {
        await navigator.share({ title: el ? 'Άλμπουμ Αναμνήσεων' : 'Memories Album', text })
        return
      }
    } catch {
      /* cancelled */
    }
    void navigator.clipboard?.writeText(text)
  }

  const rootClass =
    layout === 'inline'
      ? 'hm-memories-album-section hm-memories-album-section--inline'
      : 'hm-memories-album-section hm-memories-album-section--modal'

  return (
    <div className={rootClass}>
      {showHeader && (
        <div className="hm-memories-album-section__head">
          <div className="hm-memories-album-section__head-text">
            <div className="hm-memories-album-section__title">
              <span aria-hidden="true">✦</span>
              {el ? 'Άλμπουμ Αναμνήσεων' : 'Memories Album'}
            </div>
            <p className="hm-memories-album-section__sub">
              {countInPeriod || memories.length} {el ? 'αναμνήσεις' : 'memories'} · {journalName}
            </p>
          </div>
          <div className="hm-memories-album-section__head-actions">
            {onSave && (
              <button
                type="button"
                className="hm-memories-album-section__save"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? savingLabel : saveLabel}
              </button>
            )}
            {onClose && (
              <button
                type="button"
                className="hm-memory-modal__close"
                onClick={onClose}
                aria-label={el ? 'Κλείσιμο' : 'Close'}
              >
                ×
              </button>
            )}
          </div>
        </div>
      )}

      <p className="hm-memories-album-section__period-label">
        {displayUppercase(labels.pickPeriod, lang)}
      </p>
      <div className="hm-memories-album-section__dates">
        <label className="hm-memories-album-section__date-field">
          <span>{labels.dateFrom}</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setRangeTouched(true)
              setFromDate(e.target.value)
            }}
          />
        </label>
        <label className="hm-memories-album-section__date-field">
          <span>{labels.dateTo}</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setRangeTouched(true)
              setToDate(e.target.value)
            }}
          />
        </label>
      </div>

      {rangeOk && (
        <p className="hm-memories-album-section__period-summary">
          <strong>{periodText}</strong>
          {' · '}
          {countInPeriod} {el ? 'στιγμές' : 'moments'}
        </p>
      )}

      <div className="hm-memory-album-preview">
        <div className="hm-memory-album-preview__header">
          <span className="hm-memory-album-preview__brand">HeyMaa · {journalName}</span>
          <span className="hm-memory-album-preview__meta">
            {el ? 'Άλμπουμ αναμνήσεων' : 'Memories album'}
            {rangeOk ? ` — ${periodText}` : ''}
          </span>
        </div>
        <div className="hm-memory-album-preview__grid">
          {previewItems.length === 0 ? (
            <p className="hm-memory-album-preview__empty">
              {el ? 'Δεν υπάρχουν αναμνήσεις σε αυτή την περίοδο.' : 'No memories in this period.'}
            </p>
          ) : (
            previewItems.map((m, i) => (
              <div key={m.createdAt || `${m.text}-${i}`} className="hm-memory-album-preview__cell">
                {m.img ? (
                  <img src={m.img} alt="" className="hm-memory-album-preview__img" />
                ) : (
                  <div className="hm-memory-album-preview__emoji" style={{ background: memoryEmojiTone(m.emoji).bg }}>
                    <MemoryEmojiIcon emoji={m.emoji === '🏆' ? '🚩' : m.emoji || '⭐'} size={34} />
                  </div>
                )}
                <div className="hm-memory-album-preview__caption">
                  <div>{m.text !== '📷' ? m.text : m.emoji}</div>
                  <div className="hm-memory-album-preview__date">
                    {formatMemoryDisplayDate(m, lang)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="hm-memory-album-preview__footer">
          {el ? 'Δημιουργήθηκε με HeyMaa' : 'Created with HeyMaa'}
          {' · '}
          {new Date().toLocaleDateString(el ? 'el-GR' : lang, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      </div>

      <div className="hm-memories-album-section__preview-row">
        <button
          type="button"
          className="hm-memories-album-section__btn hm-memories-album-section__btn--preview"
          disabled={!rangeOk || countInPeriod === 0}
          onClick={() => setPreviewOpen(true)}
        >
          ✦ {labels.preview}
        </button>
      </div>

      <div className="hm-memory-album-modal__actions">
        <button
          type="button"
          className="hm-memory-album-modal__btn hm-memory-album-modal__btn--share"
          disabled={!rangeOk || countInPeriod === 0}
          onClick={() => void handleShare()}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {el ? 'Μοιράσου' : 'Share'}
        </button>
        <button
          type="button"
          className="hm-memory-album-modal__btn hm-memory-album-modal__btn--download"
          disabled={!rangeOk || countInPeriod === 0}
          onClick={handleDownload}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 3v12M7 10l5 5 5-5M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {labels.download}
        </button>
      </div>

      <p className="hm-memories-album-section__hint">{labels.downloadHint}</p>

      {previewOpen && previewPages.length > 0 && (
        <BookletFlipbookModal
          pages={previewPages}
          labels={labels}
          lang={lang}
          onClose={() => setPreviewOpen(false)}
          onDownload={() => {
            handleDownload()
            setPreviewOpen(false)
          }}
          onRemovePhoto={onRemovePhoto}
          onDeleteMemory={onDeleteMemory}
        />
      )}
    </div>
  )
}
