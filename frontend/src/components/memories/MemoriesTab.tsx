import { useMemo, useState } from 'react'
import type { FamilyChild, FamilyMemberRecord } from '../../lib/familyData'
import { memberMemoryRef, memoryBelongsToMember } from '../../lib/familyData'
import type { AppMemory } from '../../lib/memoryTypes'
import { isMemoryMilestone, memorySortTime } from '../../lib/memoryTypes'
import { memoriesInDateRange, toIsoDate } from '../../lib/memoriesBooklet'
import { useSavedMemoryAlbums } from '../../lib/memoryAlbums'
import { AppTabPageShell } from '../AppTabPageShell'
import { MemoryCard } from './MemoryCard'
import { AddMemoryModal, type MemoryFormValues } from './AddMemoryModal'
import { MemoriesAlbumModal } from './MemoriesAlbumModal'
import { MemoriesAlbumSection } from './MemoriesAlbumSection'
import { MemoryEmojiIcon } from './MemoryEmojiIcon'
import { HmDateField } from '../HmDateField'

export type MemoriesTabProps = {
  lang: string
  memories: AppMemory[]
  profileName: string
  familyChildren: FamilyChild[]
  members: FamilyMemberRecord[]
  pregnancyActive: boolean
  activeMemRef: string | null
  setActiveMemRef: (ref: string | null) => void
  photoAllowed: boolean
  videoAllowed: boolean
  onUpgrade?: () => void
  upgradeFeatureLabel?: string
  upgradeRequiredPlanLabel?: string
  onCreateMemory: (values: MemoryFormValues, ref: string) => void
  onUpdateMemory: (index: number, values: MemoryFormValues) => void
  onDeleteMemory: (index: number) => void
  onPickPhoto: () => void
  pendingPhoto: string | null
  onClearPendingPhoto: () => void
  onAlbumDownload?: () => void
  exportAllowed?: boolean
  onUpgradeExport?: () => void
  exportRequiredPlanLabel?: string
  onSaveMemories?: () => void
  memoriesSaving?: boolean
  onRemoveAlbumPhoto?: (memory: AppMemory) => void
  onDeleteAlbumMemory?: (memory: AppMemory) => void
  title: string
}

type FeedFilter = 'all' | 'photos' | 'milestones'
type DatePreset = 'all' | 'month' | 'months3' | 'year' | 'custom'
type MemoriesView = 'journal' | 'albums'

function memoryMatchesJournal(
  m: AppMemory,
  journalRef: string,
  members: FamilyMemberRecord[],
): boolean {
  if (journalRef === '__general__') return !m.ref || m.ref === '__general__'
  if (m.ref === journalRef) return true
  const member = members.find((fm) => memberMemoryRef(fm.id) === journalRef)
  return member ? memoryBelongsToMember(m.ref, member, members) : false
}

function presetRange(preset: Exclude<DatePreset, 'all' | 'custom'>): { from: string; to: string } {
  const now = new Date()
  const to = toIsoDate(now)
  if (preset === 'month') {
    return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth(), 1)), to }
  }
  if (preset === 'months3') {
    return { from: toIsoDate(new Date(now.getFullYear(), now.getMonth() - 2, 1)), to }
  }
  return { from: toIsoDate(new Date(now.getFullYear(), 0, 1)), to }
}

export function MemoriesTab({
  lang,
  memories,
  profileName,
  familyChildren,
  members,
  pregnancyActive,
  activeMemRef,
  setActiveMemRef,
  photoAllowed,
  videoAllowed,
  onUpgrade,
  upgradeFeatureLabel,
  upgradeRequiredPlanLabel,
  onCreateMemory,
  onUpdateMemory,
  onDeleteMemory,
  onPickPhoto,
  pendingPhoto,
  onClearPendingPhoto,
  onAlbumDownload,
  exportAllowed = true,
  onUpgradeExport,
  exportRequiredPlanLabel,
  onSaveMemories,
  memoriesSaving,
  onRemoveAlbumPhoto,
  onDeleteAlbumMemory,
  title,
}: MemoriesTabProps) {
  const el = lang === 'el'
  const [view, setView] = useState<MemoriesView>('journal')
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const [query, setQuery] = useState('')
  const [datePreset, setDatePreset] = useState<DatePreset>('all')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAlbumModal, setShowAlbumModal] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)
  const [savedAlbums, replaceAlbums] = useSavedMemoryAlbums()

  const journalOptions = useMemo(() => {
    const opts: { label: string; value: string }[] = []
    if (familyChildren.length > 0) {
      familyChildren.forEach((c) => opts.push({ label: c.name, value: c.name }))
    } else if (pregnancyActive) {
      opts.push({ label: el ? 'Εγκυμοσύνη' : 'Pregnancy', value: 'pregnancy' })
    } else {
      opts.push({ label: profileName || (el ? 'Εσύ' : 'You'), value: '__general__' })
    }
    return opts
  }, [familyChildren, pregnancyActive, profileName, el])

  const journalRef = useMemo(() => {
    if (activeMemRef && journalOptions.some((o) => o.value === activeMemRef)) return activeMemRef
    return journalOptions[0]?.value ?? '__general__'
  }, [activeMemRef, journalOptions])

  const journalName = journalOptions.find((o) => o.value === journalRef)?.label ?? (el ? 'Μωρό' : 'Baby')

  const journalMemories = useMemo(
    () => memories.filter((m) => memoryMatchesJournal(m, journalRef, members)),
    [memories, journalRef, members],
  )

  const journalAlbumCount = useMemo(
    () => savedAlbums.filter((a) => a.journalName === journalName).length,
    [savedAlbums, journalName],
  )

  const filteredMemories = useMemo(() => {
    let list = journalMemories
    if (feedFilter === 'milestones') list = list.filter(isMemoryMilestone)
    if (feedFilter === 'photos') list = list.filter((m) => Boolean(m.img || m.video))
    if (fromDate || toDate) {
      list = memoriesInDateRange(list, fromDate || '1970-01-01', toDate || toIsoDate(new Date()), lang)
    }
    const q = query.trim().toLowerCase()
    if (q) {
      list = list.filter((m) => {
        const title = (m.text || '').toLowerCase()
        const desc = (m.description || '').toLowerCase()
        const date = (m.date || '').toLowerCase()
        return title.includes(q) || desc.includes(q) || date.includes(q)
      })
    }
    return [...list].sort((a, b) => memorySortTime(b) - memorySortTime(a))
  }, [journalMemories, feedFilter, fromDate, toDate, query, lang])

  const filtersActive = datePreset !== 'all' || Boolean(query.trim()) || Boolean(fromDate || toDate)

  const applyPreset = (preset: DatePreset) => {
    setDatePreset(preset)
    if (preset === 'all' || preset === 'custom') {
      if (preset === 'all') {
        setFromDate('')
        setToDate('')
      }
      return
    }
    const range = presetRange(preset)
    setFromDate(range.from)
    setToDate(range.to)
  }

  const clearFilters = () => {
    setFeedFilter('all')
    setQuery('')
    applyPreset('all')
  }

  const openCreate = () => {
    setEditIndex(null)
    setActiveMemRef(journalRef)
    setShowAddModal(true)
  }

  const openEdit = (globalIndex: number) => {
    setEditIndex(globalIndex)
    setShowAddModal(true)
  }

  const handleSave = (values: MemoryFormValues) => {
    if (editIndex != null) {
      onUpdateMemory(editIndex, values)
    } else {
      onCreateMemory(values, journalRef)
    }
    onClearPendingPhoto()
  }

  const openAlbums = () => setView('albums')
  const openComposer = () => setShowAlbumModal(true)

  const headerActions = (
    <div className="hm-memories-head-actions">
      <button
        type="button"
        className={`hm-memories-head-btn hm-memories-head-btn--album${view === 'albums' ? ' is-on' : ''}`}
        onClick={openAlbums}
        aria-label={el ? 'Άλμπουμ αναμνήσεων' : 'Memories album'}
        title={el ? 'Άλμπουμ' : 'Album'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <path d="M4 16l4.5-4.5 3 3L14 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {journalAlbumCount > 0 && <span className="hm-memories-head-btn__badge">{journalAlbumCount}</span>}
      </button>
      <button
        type="button"
        className="hm-memories-head-btn hm-memories-head-btn--add"
        onClick={openCreate}
        aria-label={el ? 'Νέα ανάμνηση' : 'New memory'}
      >
        +
      </button>
    </div>
  )

  const dateChips: { id: DatePreset; label: string }[] = [
    { id: 'all', label: el ? 'Όλες οι ημερομηνίες' : 'All dates' },
    { id: 'month', label: el ? 'Αυτόν τον μήνα' : 'This month' },
    { id: 'months3', label: el ? '3 μήνες' : '3 months' },
    { id: 'year', label: el ? 'Φέτος' : 'This year' },
  ]

  return (
    <>
      <AppTabPageShell
        title={title}
        subtitle={`${el ? 'Ημερολόγιο Αναμνήσεων' : 'Memory Journal'} · ${journalName}`}
        action={headerActions}
      >
        <div className="hm-memories-view-tabs" role="tablist" aria-label={el ? 'Προβολή' : 'View'}>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'journal'}
            className={`hm-memories-view-tab${view === 'journal' ? ' hm-memories-view-tab--active' : ''}`}
            onClick={() => setView('journal')}
          >
            {el ? 'Αναμνήσεις' : 'Memories'}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={view === 'albums'}
            className={`hm-memories-view-tab${view === 'albums' ? ' hm-memories-view-tab--active' : ''}`}
            onClick={() => setView('albums')}
          >
            {el ? 'Άλμπουμ' : 'Albums'}
            {journalAlbumCount > 0 ? ` · ${journalAlbumCount}` : ''}
          </button>
        </div>

        {journalOptions.length > 1 && (
          <div className="hm-memories-journal-tabs">
            {journalOptions.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`hm-memories-journal-tab${journalRef === opt.value ? ' hm-memories-journal-tab--active' : ''}`}
                onClick={() => setActiveMemRef(opt.value)}
              >
                👶 {opt.label}
              </button>
            ))}
          </div>
        )}

        {view === 'albums' ? (
          <MemoriesAlbumSection
            variant="library"
            memories={journalMemories}
            userName={profileName}
            journalName={journalName}
            lang={lang}
            familyChildren={familyChildren}
            members={members}
            savedAlbums={savedAlbums}
            onAlbumsChange={replaceAlbums}
            onCreateAlbum={openComposer}
            onDownload={onAlbumDownload}
            exportAllowed={exportAllowed}
            onUpgradeExport={onUpgradeExport}
            exportRequiredPlanLabel={exportRequiredPlanLabel}
            showHeader={false}
          />
        ) : (
          <>
            <div className="hm-memories-toolbar">
              <label className="hm-memories-search">
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={el ? 'Αναζήτηση αναμνήσεων' : 'Search memories'}
                  autoComplete="off"
                  aria-label={el ? 'Αναζήτηση' : 'Search'}
                />
              </label>

              <div className="hm-memories-filters">
                <button
                  type="button"
                  className={`hm-memories-filter${feedFilter === 'all' ? ' hm-memories-filter--active' : ''}`}
                  onClick={() => setFeedFilter('all')}
                >
                  {el ? 'Όλα' : 'All'}
                </button>
                <button
                  type="button"
                  className={`hm-memories-filter${feedFilter === 'photos' ? ' hm-memories-filter--active' : ''}`}
                  onClick={() => setFeedFilter('photos')}
                >
                  {el ? 'Φωτογραφίες' : 'Photos'}
                </button>
                <button
                  type="button"
                  className={`hm-memories-filter hm-memories-filter--icon${feedFilter === 'milestones' ? ' hm-memories-filter--active' : ''}`}
                  onClick={() => setFeedFilter('milestones')}
                >
                  <MemoryEmojiIcon emoji="🚩" size={14} />
                  {el ? 'Ορόσημα' : 'Milestones'}
                </button>
              </div>

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

              <div className="hm-memories-date-row">
                <label className="hm-memories-date-field">
                  <span>{el ? 'Από' : 'From'}</span>
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
                    ariaLabel={el ? 'Από' : 'From'}
                  />
                </label>
                <label className="hm-memories-date-field">
                  <span>{el ? 'Έως' : 'To'}</span>
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
                    ariaLabel={el ? 'Έως' : 'To'}
                  />
                </label>
                {filtersActive && (
                  <button type="button" className="hm-memories-clear" onClick={clearFilters}>
                    {el ? 'Καθαρισμός' : 'Clear'}
                  </button>
                )}
              </div>
            </div>

            <button type="button" className="hm-memories-album-cta" onClick={openComposer}>
              <MemoryEmojiIcon emoji="✨" size={14} />
              {el ? 'Δημιούργησε ένα άλμπουμ αναμνήσεων' : 'Create a memories album'}
            </button>

            {filteredMemories.length === 0 ? (
              <div className="hm-memories-empty">
                <div className="hm-memories-empty__icon" aria-hidden="true">
                  <MemoryEmojiIcon emoji={feedFilter === 'milestones' ? '🚩' : '🧸'} size={52} />
                </div>
                <h3 className="hm-memories-empty__title">
                  {filtersActive
                    ? (el ? 'Καμία ανάμνηση με αυτά τα φίλτρα' : 'No memories match these filters')
                    : feedFilter === 'milestones'
                      ? (el ? 'Δεν υπάρχουν ορόσημα ακόμα' : 'No milestones yet')
                      : feedFilter === 'photos'
                        ? (el ? 'Δεν υπάρχουν φωτογραφίες ακόμα' : 'No photos yet')
                        : (el ? 'Η πρώτη σου ανάμνηση ξεκινάει εδώ' : 'Your first memory starts here')}
                </h3>
                <p className="hm-memories-empty__sub">
                  {filtersActive
                    ? (el ? 'Δοκίμασε άλλο διάστημα ή καθάρισε τα φίλτρα.' : 'Try another date range or clear the filters.')
                    : feedFilter === 'milestones'
                      ? (el ? 'Τα ορόσημα από το chat ή χειροκίνητες καταχωρήσεις θα εμφανίζονται εδώ.' : 'Milestones from chat or manual entries will appear here.')
                      : feedFilter === 'photos'
                        ? (el ? 'Οι αναμνήσεις με φωτογραφία θα φαίνονται εδώ.' : 'Memories with a photo will show up here.')
                        : (el ? 'Κράτα τις γλυκές στιγμές του μωρού σου.' : 'Keep the sweet moments of your baby.')}
                </p>
                {filtersActive ? (
                  <button type="button" className="hm-memories-empty__cta" onClick={clearFilters}>
                    {el ? 'Καθαρισμός φίλτρων' : 'Clear filters'}
                  </button>
                ) : feedFilter === 'all' ? (
                  <button type="button" className="hm-memories-empty__cta" onClick={openCreate}>
                    + {el ? 'Πρώτη Ανάμνηση' : 'First Memory'}
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="hm-memories-feed">
                {filteredMemories.map((m) => {
                  const globalIndex = memories.indexOf(m)
                  return (
                    <MemoryCard
                      key={m.createdAt || `${m.text}-${globalIndex}`}
                      memory={m}
                      lang={lang}
                      onEdit={isMemoryMilestone(m) ? undefined : () => openEdit(globalIndex)}
                      onDelete={() => onDeleteMemory(globalIndex)}
                    />
                  )
                })}
              </div>
            )}
          </>
        )}
      </AppTabPageShell>

      <AddMemoryModal
        open={showAddModal}
        onClose={() => {
          setShowAddModal(false)
          setEditIndex(null)
          onClearPendingPhoto()
        }}
        lang={lang}
        initial={editIndex != null ? memories[editIndex] : null}
        photoAllowed={photoAllowed}
        videoAllowed={videoAllowed}
        onUpgrade={onUpgrade}
        upgradeFeatureLabel={upgradeFeatureLabel}
        upgradeRequiredPlanLabel={upgradeRequiredPlanLabel}
        onSave={handleSave}
        onPickPhoto={onPickPhoto}
        pendingPhoto={pendingPhoto}
        onClearPhoto={onClearPendingPhoto}
      />

      <MemoriesAlbumModal
        open={showAlbumModal}
        onClose={() => setShowAlbumModal(false)}
        memories={journalMemories}
        userName={profileName}
        journalName={journalName}
        lang={lang}
        familyChildren={familyChildren}
        members={members}
        onDownload={onAlbumDownload}
        exportAllowed={exportAllowed}
        onUpgradeExport={onUpgradeExport}
        exportRequiredPlanLabel={exportRequiredPlanLabel}
        onSave={onSaveMemories}
        saving={memoriesSaving}
        onRemovePhoto={onRemoveAlbumPhoto}
        onDeleteMemory={onDeleteAlbumMemory}
        savedAlbums={savedAlbums}
        onAlbumsChange={replaceAlbums}
        onAlbumSaved={() => {
          setShowAlbumModal(false)
          setView('albums')
        }}
      />
    </>
  )
}
