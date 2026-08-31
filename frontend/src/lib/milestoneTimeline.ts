import {
  getMilestoneBullets,
  getStageById,
  stageIdForAgeMonths,
  stageIdForPregnancyWeek,
  type MilestoneStage,
} from './milestones'
import {
  CHILD_TIMELINE_GROUPS,
  getTimelineGroups,
} from './milestoneTimelineData'

export type {
  MilestoneChecksMap,
  MilestoneTimelineGroup,
  TimelineGroupStatus,
} from './milestoneTimelineTypes'

export {
  CHILD_TIMELINE_GROUPS,
  getTimelineGroups,
  PREGNANCY_TIMELINE_GROUPS,
} from './milestoneTimelineData'

export function timelineGroupLabel(group: import('./milestoneTimelineTypes').MilestoneTimelineGroup, lang: string) {
  return lang === 'el' ? group.labelEl : group.labelEn
}

export function groupForStageId(
  stageId: string,
  pregnancy: boolean,
): import('./milestoneTimelineTypes').MilestoneTimelineGroup | undefined {
  return getTimelineGroups(pregnancy).find((g) => g.stageIds.includes(stageId))
}

export function currentStageIdForChild(ageMonths: number): string {
  return stageIdForAgeMonths(ageMonths)
}

export function currentStageIdForPregnancy(week: number): string {
  return stageIdForPregnancyWeek(week)
}

export function groupStatus(
  group: import('./milestoneTimelineTypes').MilestoneTimelineGroup,
  activeStageId: string,
  pregnancy: boolean,
): import('./milestoneTimelineTypes').TimelineGroupStatus {
  const allGroups = getTimelineGroups(pregnancy)
  const activeGroup = groupForStageId(activeStageId, pregnancy)
  if (!activeGroup) return 'future'
  const activeIdx = allGroups.findIndex((g) => g.id === activeGroup.id)
  const groupIdx = allGroups.findIndex((g) => g.id === group.id)
  if (groupIdx < activeIdx) return 'past'
  if (groupIdx > activeIdx) return 'future'
  return 'current'
}

export function stageStatus(
  stageId: string,
  activeStageId: string,
  pregnancy: boolean,
): import('./milestoneTimelineTypes').TimelineGroupStatus {
  const order = getTimelineGroups(pregnancy).flatMap((g) => g.stageIds)
  const a = order.indexOf(stageId)
  const b = order.indexOf(activeStageId)
  if (a < 0 || b < 0) return 'future'
  if (a < b) return 'past'
  if (a > b) return 'future'
  return 'current'
}

export function canTickStage(stageId: string, activeStageId: string, pregnancy: boolean): boolean {
  return stageStatus(stageId, activeStageId, pregnancy) !== 'future'
}

export function focusStageInGroup(
  group: import('./milestoneTimelineTypes').MilestoneTimelineGroup,
  activeStageId: string,
): string {
  if (group.stageIds.includes(activeStageId)) return activeStageId
  return group.stageIds[0]
}

export function nextTimelineGroup(
  group: import('./milestoneTimelineTypes').MilestoneTimelineGroup,
  pregnancy: boolean,
): import('./milestoneTimelineTypes').MilestoneTimelineGroup | undefined {
  const allGroups = getTimelineGroups(pregnancy)
  const idx = allGroups.findIndex((g) => g.id === group.id)
  if (idx < 0 || idx >= allGroups.length - 1) return undefined
  return allGroups[idx + 1]
}

export function stageShortLabel(stageId: string, lang: string): string {
  const stage = getStageById(stageId)
  if (!stage) return stageId
  if (lang === 'el' && stage.label_el) {
    return stage.label_el.replace(/της εγκυμοσύνης$/i, '').trim()
  }
  return stageLabelFromMeta(stage, lang)
}

function stageLabelFromMeta(stage: MilestoneStage, lang: string): string {
  const el = lang === 'el'
  if (stage.kind === 'pregnancy_week' && stage.week) {
    return el ? `${stage.week}η εβδ.` : `Week ${stage.week}`
  }
  if (stage.kind === 'baby_month' && stage.month) {
    return el ? `${stage.month}ος μήνας` : `Month ${stage.month}`
  }
  if (stage.kind === 'toddler_range') {
    const min = stage.age_months_min ?? 0
    const max = stage.age_months_max ?? min
    return el ? `${min}–${max} μην.` : `${min}–${max} mo`
  }
  if (stage.kind === 'child_year' && stage.year) {
    if (el) return stage.year === 1 ? '1 έτους' : `${stage.year} ετών`
    return stage.year === 1 ? 'Age 1' : `Age ${stage.year}`
  }
  return stage.id
}

export function getChecksForStage(
  map: import('./milestoneTimelineTypes').MilestoneChecksMap,
  ref: string,
  stageId: string,
  bulletCount: number,
): boolean[] {
  const stored = map[ref]?.[stageId] || []
  if (stored.length >= bulletCount) return stored.slice(0, bulletCount)
  return [...stored, ...Array(bulletCount - stored.length).fill(false)]
}

export function setCheckForStage(
  map: import('./milestoneTimelineTypes').MilestoneChecksMap,
  ref: string,
  stageId: string,
  idx: number,
  value: boolean,
  bulletCount: number,
): import('./milestoneTimelineTypes').MilestoneChecksMap {
  const prev = getChecksForStage(map, ref, stageId, bulletCount)
  const arr = [...prev]
  arr[idx] = value
  return {
    ...map,
    [ref]: {
      ...(map[ref] || {}),
      [stageId]: arr,
    },
  }
}

export function countCheckedInGroup(
  map: import('./milestoneTimelineTypes').MilestoneChecksMap,
  ref: string,
  group: import('./milestoneTimelineTypes').MilestoneTimelineGroup,
  lang: string,
): { checked: number; total: number } {
  let checked = 0
  let total = 0
  group.stageIds.forEach((stageId) => {
    const bullets = getMilestoneBullets(stageId, lang)
    total += bullets.length
    const checks = map[ref]?.[stageId] || []
    checked += checks.filter(Boolean).length
  })
  return { checked, total }
}

function isLegacyChecksEntry(val: unknown): val is boolean[] {
  return Array.isArray(val) && (val.length === 0 || typeof val[0] === 'boolean')
}

export function migrateMilestoneChecksMap(
  raw: Record<string, unknown>,
  resolveStageId: (ref: string) => string,
): import('./milestoneTimelineTypes').MilestoneChecksMap {
  const out: import('./milestoneTimelineTypes').MilestoneChecksMap = {}
  for (const [ref, val] of Object.entries(raw || {})) {
    if (isLegacyChecksEntry(val)) {
      const stageId = resolveStageId(ref)
      out[ref] = { [stageId]: val }
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      out[ref] = val as Record<string, boolean[]>
    }
  }
  return out
}

export function isLegacyMilestoneChecksMap(raw: Record<string, unknown>): boolean {
  return Object.values(raw || {}).some(isLegacyChecksEntry)
}

export const ALL_CHILD_STAGE_IDS = CHILD_TIMELINE_GROUPS.flatMap((g) => g.stageIds)

function checksRicher(a: boolean[], b: boolean[]): boolean[] {
  if (!a.length) return b
  if (!b.length) return a
  const len = Math.max(a.length, b.length)
  const out = new Array<boolean>(len)
  for (let i = 0; i < len; i++) out[i] = !!(a[i] || b[i])
  return out
}

/** Merge local + cloud milestone checks (legacy flat arrays or per-stage maps). */
export function mergeMilestoneChecksMaps(
  local: Record<string, unknown>,
  remote: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...local }
  for (const [ref, remoteVal] of Object.entries(remote || {})) {
    const localVal = out[ref]
    if (isLegacyChecksEntry(remoteVal)) {
      out[ref] = isLegacyChecksEntry(localVal)
        ? checksRicher(localVal, remoteVal)
        : remoteVal
      continue
    }
    if (remoteVal && typeof remoteVal === 'object' && !Array.isArray(remoteVal)) {
      const merged: Record<string, boolean[]> = {}
      const localByStage =
        localVal && typeof localVal === 'object' && !Array.isArray(localVal)
          ? (localVal as Record<string, boolean[]>)
          : {}
      const remoteByStage = remoteVal as Record<string, boolean[]>
      for (const stageId of Object.keys({ ...localByStage, ...remoteByStage })) {
        merged[stageId] = checksRicher(
          localByStage[stageId] || [],
          remoteByStage[stageId] || [],
        )
      }
      out[ref] = merged
    }
  }
  return out
}
