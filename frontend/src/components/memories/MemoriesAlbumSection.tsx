import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { FamilyChild, FamilyMemberRecord } from '../../lib/familyData'
import {
  bookletLabelsForLang,
  bookletMemoryKey,
  bookletMemoryTitle,
  downloadMemoriesBooklet,
  formatBookletDateRangeLabel,
  memoriesInDateRange,
  albumPhotoMemories,
  prepareBookletContent,
  type AlbumPhotoFrame,
  type BookletMemory,
} from '../../lib/memoriesBooklet'
import {
  datePresetChips,
  datePresetRange,
  inferDatePreset,
  memoriesDateSpan,
  type DatePreset,
} from '../../lib/memoryDatePresets'
import { formatMemoryDisplayDate } from '../../lib/memoryTypes'
import { displayUppercase } from '../../lib/greekText'
import { BookletFlipbookModal } from '../MemoriesBookletPanel'
import { ConfirmDialog } from '../ConfirmDialog'
import { IconPencil, IconTrash } from '../ui/LineIcons'
import { MemoryEmojiIcon, memoryEmojiTone } from './MemoryEmojiIcon'
import { HmDateField } from '../HmDateField'
import {
  loadSavedMemoryAlbums,
  persistSavedMemoryAlbums,
  upsertSavedMemoryAlbum,
  type SavedMemoryAlbum,
} from '../../lib/memoryAlbums'

type Layout = 'inline' | 'modal'
type Variant = 'composer' | 'library'

type Props = {
  memories: BookletMemory[]
  userName: string
  journalName: string
  lang: string
  familyChildren: FamilyChild[]
  members: FamilyMemberRecord[]
  layout?: Layout
  variant?: Variant
  savedAlbums?: SavedMemoryAlbum[]
  onAlbumsChange?: (next: SavedMemoryAlbum[]) => void
  onAlbumSaved?: () => void
  onCreateAlbum?: () => void
  onEditAlbum?: (album: SavedMemoryAlbum) => void
  editingAlbum?: SavedMemoryAlbum | null
  onDownload?: () => void
  onSave?: () => void
  saving?: boolean
  onRemovePhoto?: (m: BookletMemory) => void
  onDeleteMemory?: (m: BookletMemory) => void
  onClose?: () => void
  showHeader?: boolean
  exportAllowed?: boolean
  onUpgradeExport?: () => void
  exportRequiredPlanLabel?: string
}

export function MemoriesAlbumSection({
  memories,
  userName,
  journalName,
  lang,
  familyChildren,
  members,
  layout = 'inline',
  variant = 'composer',
  savedAlbums: savedAlbumsProp,
  onAlbumsChange,
  onAlbumSaved,
  onCreateAlbum,
  onEditAlbum,
  editingAlbum,
  onDownload,
  onSave,
  saving,
  onRemovePhoto: _onRemovePhoto,
  onDeleteMemory: _onDeleteMemory,
  onClose,
  showHeader = true,
  exportAllowed = true,
  onUpgradeExport,
  exportRequiredPlanLabel,
}: Props) {
  const el = lang === 'el'
  const saveAlbumLabel = editingAlbum
    ? (el ? 'Αποθήκευση αλλαγών' : 'Save changes')
    : (el ? 'Αποθήκευση άλμπουμ' : 'Save album')
  const savingLabel = el ? 'Αποθήκευση…' : 'Saving…'
  const labels = useMemo(() => bookletLabelsForLang(lang), [lang])
  const dateChips = datePresetChips(el)
  const [datePreset, setDatePreset] = useState<DatePreset>(
    editingAlbum ? inferDatePreset(editingAlbum.fromDate, editingAlbum.toDate) : 'all',
  )
  const [fromDate, setFromDate] = useState(editingAlbum?.fromDate || '')
  const [toDate, setToDate] = useState(editingAlbum?.toDate || '')
  const [previewOpen, setPreviewOpen] = useState(false)
  const [albumTitle, setAlbumTitle] = useState(editingAlbum?.title || '')
  const [albumSubtitle, setAlbumSubtitle] = useState(editingAlbum?.subtitle || '')
  const [coverKey, setCoverKey] = useState(editingAlbum?.coverMemoryKey || '')
  const [internalAlbums, setInternalAlbums] = useState<SavedMemoryAlbum[]>(() => loadSavedMemoryAlbums())
  const savedAlbums = savedAlbumsProp ?? internalAlbums
  const setSavedAlbums = (next: SavedMemoryAlbum[]) => {
    if (onAlbumsChange) onAlbumsChange(next)
    else {
      setInternalAlbums(next)
      persistSavedMemoryAlbums(next)
    }
  }
  const [previewAlbumId, setPreviewAlbumId] = useState<string | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<string[]>(editingAlbum?.memoryKeys || [])
  const [selectionTouched, setSelectionTouched] = useState(Boolean(editingAlbum?.memoryKeys?.length))
  const [photoFrames, setPhotoFrames] = useState<Record<string, AlbumPhotoFrame>>(editingAlbum?.photoFrames || {})
  const [deleteAlbumId, setDeleteAlbumId] = useState<string | null>(null)

  useEffect(() => {
    if (!editingAlbum) return
    setDatePreset(inferDatePreset(editingAlbum.fromDate, editingAlbum.toDate))
    setFromDate(editingAlbum.fromDate)
    setToDate(editingAlbum.toDate)
    setAlbumTitle(editingAlbum.title)
    setAlbumSubtitle(editingAlbum.subtitle || '')
    setCoverKey(editingAlbum.coverMemoryKey || '')
    setSelectedKeys(editingAlbum.memoryKeys || [])
    setSelectionTouched(Boolean(editingAlbum.memoryKeys?.length))
    setPhotoFrames(editingAlbum.photoFrames || {})
  }, [editingAlbum])

  const lastJournalRef = useRef(journalName)
  useEffect(() => {
    if (editingAlbum) return
    const journalChanged = lastJournalRef.current !== journalName
    lastJournalRef.current = journalName
    if (!journalChanged) return
    setDatePreset('all')
    setFromDate('')
    setToDate('')
    setAlbumTitle('')
    setAlbumSubtitle('')
  }, [journalName, editingAlbum])

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset)
    if (preset === 'all') {
      setFromDate('')
      setToDate('')
      return
    }
    if (preset === 'custom') return
    const range = datePresetRange(preset)
    setFromDate(range.from)
    setToDate(range.to)
  }

  const allDates = datePreset === 'all'
  const rangeOk = allDates || Boolean(fromDate && toDate)
  const normalizedFrom = !allDates && rangeOk && fromDate > toDate ? toDate : fromDate
  const normalizedTo = !allDates && rangeOk && fromDate > toDate ? fromDate : toDate
  const photoMemories = useMemo(() => albumPhotoMemories(memories), [memories])
  const inRange = useMemo(
    () => (allDates ? photoMemories : rangeOk ? memoriesInDateRange(photoMemories, normalizedFrom, normalizedTo, lang) : []),
    [allDates, photoMemories, rangeOk, normalizedFrom, normalizedTo, lang],
  )
  const rangeKeys = useMemo(() => inRange.map((m) => bookletMemoryKey(m)), [inRange])
  const effectiveKeys = useMemo(() => {
    if (!selectionTouched) return rangeKeys
    const keep = selectedKeys.filter((k) => rangeKeys.includes(k))
    return keep.length ? keep : rangeKeys
  }, [selectionTouched, selectedKeys, rangeKeys])
  const selectedSet = useMemo(() => new Set(effectiveKeys), [effectiveKeys])
  const selectedMemories = useMemo(
    () => inRange.filter((m) => selectedSet.has(bookletMemoryKey(m))),
    [inRange, selectedSet],
  )
  const countInPeriod = inRange.length
  const selectedCount = selectedMemories.length
  const periodText = allDates
    ? (el ? 'Όλες οι ημερομηνίες' : 'All dates')
    : rangeOk
      ? formatBookletDateRangeLabel(normalizedFrom, normalizedTo, lang)
      : ''
  const coverPhotos = useMemo(() => selectedMemories.filter((m) => Boolean(m.img)), [selectedMemories])
  const resolvedCoverKey = coverPhotos.some((m) => bookletMemoryKey(m) === coverKey)
    ? coverKey
    : coverPhotos[0]
      ? bookletMemoryKey(coverPhotos[0])
      : ''
  const resolvedTitle = albumTitle.trim()
  const resolvedSubtitle = albumSubtitle.trim()
  const copyReady = Boolean(resolvedTitle && resolvedSubtitle)
  const composerReady = rangeOk && selectedCount > 0 && copyReady
  const titlePlaceholder = el ? 'Γράψε τον τίτλο' : 'Write the title'
  const subtitlePlaceholder = el ? 'Γράψε ένα υπότιτλο' : 'Write a subtitle'

  const toggleMemory = (key: string) => {
    setSelectionTouched(true)
    setSelectedKeys(
      effectiveKeys.includes(key) ? effectiveKeys.filter((k) => k !== key) : [...effectiveKeys, key],
    )
  }

  const setAllSelected = (on: boolean) => {
    setSelectionTouched(true)
    setSelectedKeys(on ? rangeKeys : [])
  }

  const persistRange = useMemo(() => {
    if (allDates) return memoriesDateSpan(selectedMemories.length ? selectedMemories : photoMemories, lang)
    return { from: normalizedFrom, to: normalizedTo }
  }, [allDates, selectedMemories, photoMemories, lang, normalizedFrom, normalizedTo])

  const bookletOpts = useMemo(
    () => ({
      userName,
      memories: selectedMemories,
      fromDate: persistRange.from,
      toDate: persistRange.to,
      lang,
      children: familyChildren,
      members,
      labels,
      albumTitle: resolvedTitle,
      albumSubtitle: resolvedSubtitle,
      coverMemoryKey: resolvedCoverKey || undefined,
      photoFrames,
    }),
    [
      userName,
      selectedMemories,
      persistRange,
      lang,
      familyChildren,
      members,
      labels,
      resolvedTitle,
      resolvedSubtitle,
      resolvedCoverKey,
      photoFrames,
    ],
  )

  const journalAlbums = useMemo(
    () => savedAlbums.filter((a) => a.journalName === journalName),
    [savedAlbums, journalName],
  )

  const optsForAlbum = useCallback(
    (album: SavedMemoryAlbum) => {
      const inAlbumRange = memoriesInDateRange(photoMemories, album.fromDate, album.toDate, lang)
      const picked =
        album.memoryKeys?.length
          ? inAlbumRange.filter((m) => album.memoryKeys!.includes(bookletMemoryKey(m)))
          : inAlbumRange
      return {
        userName,
        memories: picked,
        fromDate: album.fromDate,
        toDate: album.toDate,
        lang,
        children: familyChildren,
        members,
        labels,
        albumTitle: album.title,
        albumSubtitle: album.subtitle,
        coverMemoryKey: album.coverMemoryKey,
        photoFrames: album.photoFrames,
      }
    },
    [userName, photoMemories, lang, familyChildren, members, labels],
  )

  const previewingAlbum = previewAlbumId
    ? savedAlbums.find((a) => a.id === previewAlbumId)
    : undefined

  const previewPages = useMemo(() => {
    if (!previewOpen) return []
    if (previewingAlbum) return prepareBookletContent(optsForAlbum(previewingAlbum)).pages
    if (!rangeOk) return []
    return prepareBookletContent(bookletOpts).pages
  }, [previewOpen, previewingAlbum, rangeOk, bookletOpts, optsForAlbum])

  const handleDownloadAlbum = (album: SavedMemoryAlbum) => {
    if (!exportAllowed) {
      onUpgradeExport?.()
      return
    }
    const ok = downloadMemoriesBooklet(optsForAlbum(album))
    if (ok) onDownload?.()
  }

  const handleShareAlbum = async (album: SavedMemoryAlbum) => {
    if (!exportAllowed) {
      onUpgradeExport?.()
      return
    }
    const range = formatBookletDateRangeLabel(album.fromDate, album.toDate, lang)
    const count = optsForAlbum(album).memories.length
    const text = el
      ? `${album.title} · ${journalName} — ${count} στιγμές (${range})`
      : `${album.title} · ${journalName} — ${count} moments (${range})`
    try {
      if (navigator.share) {
        await navigator.share({ title: album.title, text })
        return
      }
    } catch {
      /* cancelled */
    }
    void navigator.clipboard?.writeText(text)
  }

  const handleSaveAlbum = () => {
    if (!composerReady) return
    const next = upsertSavedMemoryAlbum(savedAlbums, {
      id: editingAlbum?.id,
      createdAt: editingAlbum?.createdAt,
      title: resolvedTitle,
      subtitle: resolvedSubtitle,
      fromDate: persistRange.from,
      toDate: persistRange.to,
      coverMemoryKey: resolvedCoverKey || undefined,
      memoryKeys: effectiveKeys,
      photoFrames,
      journalName,
    })
    setSavedAlbums(next)
    onSave?.()
    onAlbumSaved?.()
  }

  const handleSavePhotoFrame = (m: BookletMemory, frame: AlbumPhotoFrame) => {
    const key = bookletMemoryKey(m)
    if (previewAlbumId) {
      const next = savedAlbums.map((a) =>
        a.id === previewAlbumId
          ? { ...a, photoFrames: { ...a.photoFrames, [key]: frame } }
          : a,
      )
      setSavedAlbums(next)
      return
    }
    setPhotoFrames((prev) => ({ ...prev, [key]: frame }))
  }

  const handleDeleteAlbum = (id: string) => {
    const next = savedAlbums.filter((a) => a.id !== id)
    setSavedAlbums(next)
  }

  const coverForAlbum = (album: SavedMemoryAlbum) =>
    photoMemories.find((m) => bookletMemoryKey(m) === album.coverMemoryKey)?.img
    || optsForAlbum(album).memories.find((m) => m.img)?.img

  const albumCards = journalAlbums.map((album) => {
    const cover = coverForAlbum(album)
    const range = formatBookletDateRangeLabel(album.fromDate, album.toDate, lang)
    const count = optsForAlbum(album).memories.length
    return (
      <div key={album.id} className="hm-memories-album-saved">
        <div className="hm-memories-album-saved__main">
          <button
            type="button"
            className="hm-memories-album-saved__open"
            onClick={() => {
              setPreviewAlbumId(album.id)
              setPreviewOpen(true)
            }}
          >
            {cover ? (
              <img src={cover} alt="" className="hm-memories-album-saved__cover" />
            ) : (
              <div className="hm-memories-album-saved__cover hm-memories-album-saved__cover--empty" aria-hidden="true">
                ✦
              </div>
            )}
            <div className="hm-memories-album-saved__meta">
              <div className="hm-memories-album-saved__title">{album.title}</div>
              <div className="hm-memories-album-saved__range">{range}</div>
              <div className="hm-memories-album-saved__count">
                {count} {el ? 'στιγμές' : 'moments'}
              </div>
            </div>
          </button>
          <div className="hm-memories-album-saved__actions">
            {onEditAlbum && (
              <button
                type="button"
                className="hm-memories-album-saved__action"
                onClick={() => onEditAlbum(album)}
                title={el ? 'Επεξεργασία' : 'Edit'}
                aria-label={el ? 'Επεξεργασία άλμπουμ' : 'Edit album'}
              >
                <IconPencil size={15} />
              </button>
            )}
            <button
              type="button"
              className="hm-memories-album-saved__action hm-memories-album-saved__action--delete"
              onClick={() => setDeleteAlbumId(album.id)}
              title={el ? 'Διαγραφή' : 'Delete'}
              aria-label={el ? 'Διαγραφή άλμπουμ' : 'Delete album'}
            >
              <IconTrash size={15} />
            </button>
          </div>
        </div>
        <div className="hm-memory-album-modal__actions">
          <button
            type="button"
            className={`hm-memory-album-modal__btn hm-memory-album-modal__btn--share${!exportAllowed ? ' hm-memory-album-modal__btn--locked' : ''}`}
            onClick={() => void handleShareAlbum(album)}
            title={!exportAllowed ? `Premium+: ${exportRequiredPlanLabel || ''}` : undefined}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {el ? 'Μοιράσου' : 'Share'}
          </button>
          <button
            type="button"
            className={`hm-memory-album-modal__btn hm-memory-album-modal__btn--download${!exportAllowed ? ' hm-memory-album-modal__btn--locked' : ''}`}
            onClick={() => handleDownloadAlbum(album)}
            title={!exportAllowed ? `Premium+: ${exportRequiredPlanLabel || ''}` : undefined}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M12 3v12M7 10l5 5 5-5M4 20h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {labels.download}
          </button>
        </div>
      </div>
    )
  })

  const previewModal =
    previewOpen && previewPages.length > 0 ? (
      <BookletFlipbookModal
        pages={previewPages}
        labels={labels}
        lang={lang}
        onClose={() => {
          setPreviewOpen(false)
          setPreviewAlbumId(null)
        }}
        onSave={() => {
          if (!previewingAlbum) handleSaveAlbum()
          setPreviewOpen(false)
          setPreviewAlbumId(null)
        }}
        onSavePhotoFrame={handleSavePhotoFrame}
      />
    ) : null

  if (variant === 'library') {
    return (
      <div className="hm-memories-album-library">
        {onCreateAlbum && (
          <button type="button" className="hm-memories-album-library__create" onClick={onCreateAlbum}>
            + {el ? 'Νέο άλμπουμ' : 'New album'}
          </button>
        )}
        {journalAlbums.length === 0 ? (
          <div className="hm-memories-empty">
            <div className="hm-memories-empty__icon" aria-hidden="true">
              <MemoryEmojiIcon emoji="✨" size={52} />
            </div>
            <h3 className="hm-memories-empty__title">
              {el ? 'Δεν έχεις άλμπουμ ακόμη' : 'No albums yet'}
            </h3>
            <p className="hm-memories-empty__sub">
              {el
                ? 'Αποθήκευσε ένα άλμπουμ από τις αναμνήσεις και θα εμφανιστεί εδώ.'
                : 'Save an album from your memories and it will show up here.'}
            </p>
            {onCreateAlbum && (
              <button type="button" className="hm-memories-empty__cta" onClick={onCreateAlbum}>
                + {el ? 'Πρώτο άλμπουμ' : 'First album'}
              </button>
            )}
          </div>
        ) : (
          <div className="hm-memories-album-library__grid">{albumCards}</div>
        )}
        {previewModal}
        <ConfirmDialog
          open={Boolean(deleteAlbumId)}
          title={el ? 'Διαγραφή άλμπουμ' : 'Delete album'}
          message={
            el
              ? `Είσαι σίγουρη/ος ότι θέλεις να διαγράψεις το άλμπουμ${
                  deleteAlbumId
                    ? ` «${journalAlbums.find((a) => a.id === deleteAlbumId)?.title || ''}»`
                    : ''
                };`
              : `Are you sure you want to delete this album${
                  deleteAlbumId
                    ? ` “${journalAlbums.find((a) => a.id === deleteAlbumId)?.title || ''}”`
                    : ''
                }?`
          }
          confirmLabel={el ? 'Διαγραφή' : 'Delete'}
          cancelLabel={el ? 'Ακύρωση' : 'Cancel'}
          variant="danger"
          onConfirm={() => {
            if (deleteAlbumId) handleDeleteAlbum(deleteAlbumId)
            setDeleteAlbumId(null)
          }}
          onCancel={() => setDeleteAlbumId(null)}
        />
      </div>
    )
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
              {el ? (editingAlbum ? 'Επεξεργασία άλμπουμ' : 'Άλμπουμ Αναμνήσεων') : (editingAlbum ? 'Edit album' : 'Memories Album')}
            </div>
            <p className="hm-memories-album-section__sub">
              {selectedCount || countInPeriod || memories.length} {el ? 'αναμνήσεις' : 'memories'} · {journalName}
            </p>
          </div>
          <div className="hm-memories-album-section__head-actions">
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

      <div className="hm-memories-album-section__setup">
        <p className="hm-memories-album-section__period-label">
          {displayUppercase(labels.pickPeriod, lang)}
        </p>
        <p className="hm-memories-album-section__step-hint">{labels.pickPeriodHint}</p>
        <div className="hm-memories-date-presets">
          {dateChips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              className={`hm-memories-filter hm-memories-filter--date${datePreset === chip.id ? ' hm-memories-filter--active' : ''}`}
              onClick={() => applyPreset(chip.id)}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {datePreset === 'custom' ? (
          <div className="hm-memories-album-section__dates">
            <label className="hm-memories-album-section__date-field">
              <span>{labels.dateFrom}</span>
              <HmDateField
                lang={lang}
                value={fromDate}
                max={toDate || undefined}
                onChange={(iso) => {
                  setDatePreset('custom')
                  setFromDate(iso)
                }}
                variant="input"
                size="sm"
                ariaLabel={labels.dateFrom}
              />
            </label>
            <label className="hm-memories-album-section__date-field">
              <span>{labels.dateTo}</span>
              <HmDateField
                lang={lang}
                value={toDate}
                min={fromDate || undefined}
                onChange={(iso) => {
                  setDatePreset('custom')
                  setToDate(iso)
                }}
                variant="input"
                size="sm"
                ariaLabel={labels.dateTo}
              />
            </label>
          </div>
        ) : null}

        {rangeOk ? (
          <p className="hm-memories-album-section__period-summary">
            <strong>{periodText}</strong>
            {' · '}
            {countInPeriod} {el ? 'στιγμές' : 'moments'}
          </p>
        ) : null}

        <label className="hm-memories-album-section__title-field">
          <span className="hm-memories-album-section__period-label">{displayUppercase(labels.albumTitleField, lang)}</span>
          <span className="hm-memories-album-section__step-hint">{labels.albumTitleHint}</span>
          <input
            type="text"
            className="hm-memories-album-section__title-input"
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
            placeholder={titlePlaceholder}
            maxLength={80}
            autoComplete="off"
            aria-label={labels.albumTitleField}
          />
        </label>

        <label className="hm-memories-album-section__title-field">
          <span className="hm-memories-album-section__period-label">{displayUppercase(labels.albumSubtitleField, lang)}</span>
          <span className="hm-memories-album-section__step-hint">{labels.albumSubtitleHint}</span>
          <input
            type="text"
            className="hm-memories-album-section__title-input"
            value={albumSubtitle}
            onChange={(e) => setAlbumSubtitle(e.target.value)}
            placeholder={subtitlePlaceholder}
            maxLength={140}
            autoComplete="off"
            aria-label={labels.albumSubtitleField}
          />
        </label>
      </div>

      <div className="hm-memory-album-preview">
        <div className="hm-memory-album-preview__header">
          <span className="hm-memory-album-preview__brand">HeyMaa · {journalName}</span>
          <span className="hm-memory-album-preview__meta">
            {resolvedTitle || titlePlaceholder}
            {rangeOk ? ` — ${periodText}` : ''}
          </span>
        </div>
        <div className="hm-memory-album-preview__pick">
          <div className="hm-memory-album-preview__pick-copy">
            <p className="hm-memories-album-section__period-label">
              {displayUppercase(labels.pickMemories, lang)}
            </p>
            <p className="hm-memories-album-section__step-hint">{labels.pickMemoriesHint}</p>
          </div>
          {inRange.length > 0 && (
            <div className="hm-memory-album-preview__pick-row">
              <span>
                {el
                  ? `${selectedCount} από ${inRange.length}`
                  : `${selectedCount} of ${inRange.length}`}
              </span>
              <button
                type="button"
                className="hm-memory-album-preview__pick-all"
                onClick={() => setAllSelected(selectedCount !== inRange.length)}
              >
                {selectedCount === inRange.length
                  ? (el ? 'Καμία' : 'None')
                  : (el ? 'Όλες' : 'All')}
              </button>
            </div>
          )}
        </div>
        <div className="hm-memory-album-preview__grid">
          {inRange.length === 0 ? (
            <p className="hm-memory-album-preview__empty">
              {el ? 'Δεν υπάρχουν φωτογραφίες σε αυτή την περίοδο.' : 'No photos in this period.'}
            </p>
          ) : (
            inRange.map((m, i) => {
              const key = bookletMemoryKey(m)
              const on = selectedSet.has(key)
              return (
                <button
                  key={key || `${m.text}-${i}`}
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  className={`hm-memory-album-preview__cell${on ? ' is-on' : ''}`}
                  onClick={() => toggleMemory(key)}
                >
                  {m.img ? (
                    <img src={m.img} alt="" className="hm-memory-album-preview__img" />
                  ) : (
                    <div className="hm-memory-album-preview__emoji" style={{ background: memoryEmojiTone(m.emoji).bg }}>
                      <MemoryEmojiIcon emoji={m.emoji === '🏆' ? '🚩' : m.emoji || '⭐'} size={34} />
                    </div>
                  )}
                  <span className="hm-memory-album-preview__tick" aria-hidden="true">
                    {on ? (
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path d="M5 12.5l5 5 9-11" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : null}
                  </span>
                  <div className="hm-memory-album-preview__caption">
                    <div>{m.text !== '📷' ? m.text : m.emoji}</div>
                    <div className="hm-memory-album-preview__date">
                      {formatMemoryDisplayDate(m, lang)}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
        <div className="hm-memory-album-preview__footer">
          {el ? 'Μόνο οι επιλεγμένες μπαίνουν στο άλμπουμ' : 'Only selected memories go in the album'}
        </div>
      </div>

      <div className="hm-memories-album-section__cover">
        <p className="hm-memories-album-section__period-label">{displayUppercase(labels.coverPhoto, lang)}</p>
        <p className="hm-memories-album-section__step-hint">{labels.coverPhotoHint}</p>
        {coverPhotos.length === 0 ? (
          <p className="hm-memories-album-section__cover-empty">{labels.coverNone}</p>
        ) : (
          <div className="hm-memories-album-section__cover-grid" role="listbox" aria-label={labels.coverPhoto}>
            {coverPhotos.map((m) => {
              const key = bookletMemoryKey(m)
              const selected = key === resolvedCoverKey
              return (
                <button
                  key={key}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`hm-memories-album-section__cover-btn${selected ? ' hm-memories-album-section__cover-btn--on' : ''}`}
                  onClick={() => setCoverKey(key)}
                  title={bookletMemoryTitle(m, labels.untitledPhoto)}
                >
                  <img src={m.img} alt={bookletMemoryTitle(m, labels.untitledPhoto)} />
                </button>
              )
            })}
          </div>
        )}
        {resolvedCoverKey && coverPhotos.length > 0 && (
          <p className="hm-memories-album-section__cover-selected">
            {el ? 'Επιλεγμένο' : 'Selected'}
            {': '}
            {bookletMemoryTitle(
              coverPhotos.find((m) => bookletMemoryKey(m) === resolvedCoverKey) || coverPhotos[0],
              labels.untitledPhoto,
            )}
          </p>
        )}
      </div>

      <div className="hm-memories-album-section__composer-actions">
        <button
          type="button"
          className="hm-memories-album-section__btn hm-memories-album-section__btn--preview"
          disabled={!composerReady}
          onClick={() => {
            setPreviewAlbumId(null)
            setPreviewOpen(true)
          }}
          title={
            !copyReady
              ? (el ? 'Γράψε τίτλο και υπότιτλο για προεπισκόπηση.' : 'Add a title and subtitle to preview.')
              : undefined
          }
        >
          ✦ {labels.preview}
        </button>
        <button
          type="button"
          className="hm-memories-album-section__btn hm-memories-album-section__btn--save"
          disabled={!composerReady || saving}
          onClick={handleSaveAlbum}
        >
          {saving ? savingLabel : saveAlbumLabel}
        </button>
      </div>

      {previewModal}
    </div>
  )
}
