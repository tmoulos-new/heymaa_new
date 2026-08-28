import { useEffect, useMemo, useState } from 'react'
import { getMilestoneBullets } from '../lib/milestones'
import {
  canTickStage,
  countCheckedInGroup,
  currentStageIdForChild,
  currentStageIdForPregnancy,
  focusStageInGroup,
  getChecksForStage,
  getTimelineGroups,
  groupForStageId,
  groupStatus,
  nextTimelineGroup,
  stageShortLabel,
  stageStatus,
  timelineGroupLabel,
  type MilestoneChecksMap,
} from '../lib/milestoneTimeline'
import { MilestoneProgressBar } from './MilestoneProgressBar'

type RefOption = { label: string; value: string }

const NEXT_PREVIEW_BULLETS = 4

export function MilestonesPanel({
  lang,
  refs,
  activeRef,
  onActiveRefChange,
  isPregnancy,
  pregWeek,
  dueDate,
  ageMonths,
  displayAge,
  childName,
  checksMap,
  lastChecked,
  onToggle,
  pregMilestoneMsg,
  childMilestoneMsg,
  copy,
}: {
  lang: string
  refs: RefOption[]
  activeRef: string
  onActiveRefChange: (ref: string) => void
  isPregnancy: boolean
  pregWeek: number
  dueDate?: string
  ageMonths: number
  displayAge: string
  childName: string
  checksMap: MilestoneChecksMap
  lastChecked: { stageId: string; idx: number } | null
  onToggle: (ref: string, stageId: string, idx: number, label: string) => void
  pregMilestoneMsg: (idx: number, total: number) => string
  childMilestoneMsg: (idx: number, total: number) => string
  copy: {
    milestones: string
    tickall: string
    pregTitle: string
    pregSub: string
    pregCardTitle: string
    pregCardBody: string
    weekLabel: string
    lockedHint: string
    progress: string
    currentPeriod: string
    nextPreview: string
    pastPeriod: string
    askaboutmile: string
    askmaa: string
    nochildyet: string
  }
}) {
  const groups = getTimelineGroups(isPregnancy)
  const activeStageId = isPregnancy
    ? currentStageIdForPregnancy(pregWeek)
    : currentStageIdForChild(ageMonths)
  const defaultGroup = groupForStageId(activeStageId, isPregnancy)
  const [selectedGroupId, setSelectedGroupId] = useState(defaultGroup?.id ?? groups[0]?.id)

  useEffect(() => {
    const g = groupForStageId(activeStageId, isPregnancy)
    if (g) setSelectedGroupId(g.id)
  }, [activeRef, activeStageId, isPregnancy])

  const selectedGroup = groups.find((g) => g.id === selectedGroupId) ?? groups[0]
  const selectedStatus = selectedGroup
    ? groupStatus(selectedGroup, activeStageId, isPregnancy)
    : 'current'

  const stagesToRender = useMemo(() => {
    if (!selectedGroup) return []
    if (selectedStatus === 'current') {
      const focus = focusStageInGroup(selectedGroup, activeStageId)
      return [focus]
    }
    return selectedGroup.stageIds
  }, [selectedGroup, selectedStatus, activeStageId])

  const groupProgress = selectedGroup
    ? countCheckedInGroup(checksMap, activeRef, selectedGroup, lang)
    : { checked: 0, total: 0 }

  const nextGroupPreview = useMemo(() => {
    if (!selectedGroup || selectedStatus !== 'current') return null
    const next = nextTimelineGroup(selectedGroup, isPregnancy)
    if (!next) return null
    const stageId = next.stageIds[0]
    const bullets = getMilestoneBullets(stageId, lang).slice(0, NEXT_PREVIEW_BULLETS)
    if (!bullets.length) return null
    return { group: next, stageId, bullets }
  }, [selectedGroup, selectedStatus, isPregnancy, lang])

  const milestoneMsg = isPregnancy ? pregMilestoneMsg : childMilestoneMsg

  const renderStage = (stageId: string, locked = false) => {
    const bullets = locked
      ? getMilestoneBullets(stageId, lang).slice(0, NEXT_PREVIEW_BULLETS)
      : getMilestoneBullets(stageId, lang)
    if (!bullets.length) return null
    const checks = getChecksForStage(checksMap, activeRef, stageId, bullets.length)
    const status = stageStatus(stageId, activeStageId, isPregnancy)
    const tickable = !locked && canTickStage(stageId, activeStageId, isPregnancy)
    const showStageHeader = !locked && (stagesToRender.length > 1 || selectedGroup!.stageIds.length > 1)

    return (
      <div key={`${stageId}${locked ? '-preview' : ''}`} className="hm-ms-stage">
        {showStageHeader && (
          <div className="hm-ms-stage__title">{stageShortLabel(stageId, lang)}</div>
        )}
        {status === 'future' && !locked && (
          <div className="hm-ms-stage__locked-hint">🔒 {copy.lockedHint}</div>
        )}
        {bullets.map((label, idx) => {
          const checked = !!checks[idx]
          const isLast =
            !locked && lastChecked?.stageId === stageId && lastChecked?.idx === idx && checked
          return (
            <div key={`${stageId}-${idx}`}>
              <div
                role={tickable ? 'button' : undefined}
                tabIndex={tickable ? 0 : undefined}
                onClick={() => tickable && onToggle(activeRef, stageId, idx, label)}
                onKeyDown={(e) => {
                  if (tickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onToggle(activeRef, stageId, idx, label)
                  }
                }}
                className={`hm-ms-row${tickable ? '' : ' hm-ms-row--locked'}${checked ? ' hm-ms-row--checked' : ''}`}
              >
                <div className="hm-ms-row__check">{checked ? '✓' : tickable ? '○' : '🔒'}</div>
                <div className="hm-ms-row__label">{label}</div>
              </div>
              {isLast && <div className="hm-callout">{milestoneMsg(idx, bullets.length)}</div>}
            </div>
          )
        })}
      </div>
    )
  }

  if (!activeRef) {
    return <div className="hm-tab-card"><div className="hm-tab-empty">{copy.nochildyet}</div></div>
  }

  return (
    <>
      {refs.length > 1 && (
        <div className="hm-ms-ref-filters">
          {refs.map((r) => (
            <button
              key={r.value || '__general__'}
              type="button"
              className={`hm-ms-ref-chip${activeRef === r.value ? ' hm-ms-ref-chip--active' : ''}`}
              onClick={() => onActiveRefChange(r.value)}
            >
              {r.label}
            </button>
          ))}
        </div>
      )}

      <MilestoneProgressBar
        lang={lang}
        groups={groups}
        activeStageId={activeStageId}
        isPregnancy={isPregnancy}
        selectedGroupId={selectedGroupId}
        onSelectGroup={setSelectedGroupId}
        currentLabel={copy.currentPeriod}
        ariaLabel={copy.milestones}
      />

      {isPregnancy && dueDate && (
        <div className="hm-tab-card">
          <div className="hm-ms-card-title">🤰 {copy.pregCardTitle}</div>
          <div className="hm-ms-card-sub">
            {copy.pregCardBody.replace('{week}', String(pregWeek)).replace('{date}', dueDate)}
          </div>
        </div>
      )}

      <div className="hm-tab-card">
        <div className="hm-ms-card-title">
          {isPregnancy
            ? `${copy.pregTitle} · ${copy.weekLabel} ${pregWeek}`
            : `${copy.milestones} · ${childName} · ${displayAge}`}
        </div>
        <div className="hm-ms-card-sub">
          {selectedStatus === 'future'
            ? copy.lockedHint
            : selectedStatus === 'past'
              ? copy.pastPeriod
              : copy.tickall}
        </div>
        {groupProgress.total > 0 && (
          <div className="hm-ms-group-progress">
            {copy.progress}: {groupProgress.checked}/{groupProgress.total}
          </div>
        )}
        {stagesToRender.map((stageId) => renderStage(stageId))}
      </div>

      {nextGroupPreview && (
        <div className="hm-tab-card hm-ms-next-preview">
          <div className="hm-ms-next-preview__title">
            🔒 {copy.nextPreview}: {timelineGroupLabel(nextGroupPreview.group, lang)}
          </div>
          <div className="hm-ms-next-preview__sub">{copy.lockedHint}</div>
          {renderStage(nextGroupPreview.stageId, true)}
        </div>
      )}

      {groupProgress.checked > 0 && selectedStatus !== 'future' && (
        <div className="hm-success-strip">
          🎉 {groupProgress.checked}/{groupProgress.total}{' '}
          {isPregnancy ? copy.pregTitle : copy.milestones}
        </div>
      )}
    </>
  )
}
