import { useMemo, useState } from 'react'
import type { FamilyChild, FamilyMemberRecord } from '../../lib/familyData'
import { memberMemoryRef, memoryBelongsToMember } from '../../lib/familyData'
import type { AppMemory } from '../../lib/memoryTypes'
import { isMemoryMilestone, memorySortTime } from '../../lib/memoryTypes'
import { AppTabPageShell } from '../AppTabPageShell'
import { MemoryCard } from './MemoryCard'
import { AddMemoryModal, type MemoryFormValues } from './AddMemoryModal'
import { MemoriesAlbumModal } from './MemoriesAlbumModal'
import { MemoriesAlbumSection } from './MemoriesAlbumSection'

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
  onSaveMemories?: () => void
  memoriesSaving?: boolean
  onRemoveAlbumPhoto?: (memory: AppMemory) => void
  onDeleteAlbumMemory?: (memory: AppMemory) => void
  title: string
}

type FeedFilter = 'all' | 'milestones'

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
  onSaveMemories,
  memoriesSaving,
  onRemoveAlbumPhoto,
  onDeleteAlbumMemory,
  title,
}: MemoriesTabProps) {
  const el = lang === 'el'
  const [feedFilter, setFeedFilter] = useState<FeedFilter>('all')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showAlbumModal, setShowAlbumModal] = useState(false)
  const [albumInlineOpen, setAlbumInlineOpen] = useState(false)
  const [editIndex, setEditIndex] = useState<number | null>(null)

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

  const filteredMemories = useMemo(() => {
    let list = journalMemories
    if (feedFilter === 'milestones') {
      list = list.filter(isMemoryMilestone)
    }
    return [...list].sort((a, b) => memorySortTime(b) - memorySortTime(a))
  }, [journalMemories, feedFilter])

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

  const headerActions = (
    <div className="hm-memories-head-actions">
      <button
        type="button"
        className="hm-memories-head-btn hm-memories-head-btn--album"
        onClick={() => setShowAlbumModal(true)}
        aria-label={el ? 'Άλμπουμ αναμνήσεων' : 'Memories album'}
        title={el ? 'Άλμπουμ' : 'Album'}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="9" cy="10" r="1.5" fill="currentColor" />
          <path d="M4 16l4.5-4.5 3 3L14 12l6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
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

  return (
    <>
      <AppTabPageShell
        title={title}
        subtitle={`Baby Journal · ${journalName}`}
        action={headerActions}
      >
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
            className={`hm-memories-filter${feedFilter === 'milestones' ? ' hm-memories-filter--active' : ''}`}
            onClick={() => setFeedFilter('milestones')}
          >
            {el ? 'Ορόσημα' : 'Milestones'}
          </button>
        </div>

        <section className="hm-memories-album-inline">
          <button
            type="button"
            className="hm-memories-album-inline__toggle"
            onClick={() => setAlbumInlineOpen((v) => !v)}
            aria-expanded={albumInlineOpen}
          >
            <span className="hm-memories-album-inline__toggle-label">
              ✦ {el ? 'Άλμπουμ αναμνήσεων' : 'Memories album'}
              <span className="hm-memories-album-inline__count">
                {journalMemories.length} {el ? 'αναμνήσεις' : 'memories'}
              </span>
            </span>
            <span className="hm-memories-album-inline__chevron" aria-hidden="true">
              {albumInlineOpen ? '▾' : '▸'}
            </span>
          </button>
          {albumInlineOpen && (
            <div className="hm-memories-album-inline__body">
              <MemoriesAlbumSection
                layout="inline"
                memories={journalMemories}
                userName={profileName}
                journalName={journalName}
                lang={lang}
                familyChildren={familyChildren}
                members={members}
                onDownload={onAlbumDownload}
                onSave={onSaveMemories}
                saving={memoriesSaving}
                onRemovePhoto={onRemoveAlbumPhoto}
                onDeleteMemory={onDeleteAlbumMemory}
                showHeader={false}
              />
              <button
                type="button"
                className="hm-memories-album-inline__expand"
                onClick={() => setShowAlbumModal(true)}
              >
                {el ? 'Άνοιγμα σε πλήρη οθόνη →' : 'Open full screen →'}
              </button>
            </div>
          )}
        </section>

        {filteredMemories.length === 0 ? (
          <div className="hm-memories-empty">
            <div className="hm-memories-empty__icon" aria-hidden="true">
              <span>🧸</span>
            </div>
            <h3 className="hm-memories-empty__title">
              {feedFilter === 'milestones'
                ? (el ? 'Δεν υπάρχουν ορόσημα ακόμα' : 'No milestones yet')
                : (el ? 'Η πρώτη σου ανάμνηση ξεκινάει εδώ 💛' : 'Your first memory starts here 💛')}
            </h3>
            <p className="hm-memories-empty__sub">
              {feedFilter === 'milestones'
                ? (el ? 'Τα ορόσημα από το chat ή χειροκίνητες καταχωρήσεις θα εμφανίζονται εδώ.' : 'Milestones from chat or manual entries will appear here.')
                : (el ? 'Κράτα τις γλυκές στιγμές του μωρού σου.' : 'Keep the sweet moments of your baby.')}
            </p>
            {feedFilter === 'all' && (
              <button type="button" className="hm-memories-empty__cta" onClick={openCreate}>
                + {el ? 'Πρώτη Ανάμνηση' : 'First Memory'}
              </button>
            )}
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
                  onEdit={() => openEdit(globalIndex)}
                  onDelete={() => onDeleteMemory(globalIndex)}
                />
              )
            })}
          </div>
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
        onSave={onSaveMemories}
        saving={memoriesSaving}
        onRemovePhoto={onRemoveAlbumPhoto}
        onDeleteMemory={onDeleteAlbumMemory}
      />
    </>
  )
}
