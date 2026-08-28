import type { MilestoneTimelineGroup } from './milestoneTimelineTypes'

const pregStageRange = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => `preg_w${from + i}`)

export const CHILD_TIMELINE_GROUPS: MilestoneTimelineGroup[] = [
  {
    id: 'baby_0_3',
    labelEl: '0–3 μην.',
    labelEn: '0–3 mo',
    stageIds: ['baby_m1', 'baby_m2', 'baby_m3'],
  },
  {
    id: 'baby_4_6',
    labelEl: '4–6 μην.',
    labelEn: '4–6 mo',
    stageIds: ['baby_m4', 'baby_m5', 'baby_m6'],
  },
  {
    id: 'baby_7_9',
    labelEl: '7–9 μην.',
    labelEn: '7–9 mo',
    stageIds: ['baby_m7', 'baby_m8', 'baby_m9'],
  },
  {
    id: 'baby_10_12',
    labelEl: '10–12 μην.',
    labelEn: '10–12 mo',
    stageIds: ['baby_m10', 'baby_m11', 'baby_m12'],
  },
  {
    id: 'toddler_1_2',
    labelEl: '1–2 ετών',
    labelEn: '1–2 yr',
    stageIds: ['toddler_12_15', 'toddler_15_18', 'toddler_18_24'],
  },
  {
    id: 'toddler_2_3',
    labelEl: '2–3 ετών',
    labelEn: '2–3 yr',
    stageIds: ['toddler_24_36'],
  },
  {
    id: 'child_4_6',
    labelEl: '4–6 ετών',
    labelEn: '4–6 yr',
    stageIds: ['child_y4', 'child_y5', 'child_y6'],
  },
  {
    id: 'child_7_9',
    labelEl: '7–9 ετών',
    labelEn: '7–9 yr',
    stageIds: ['child_y7', 'child_y8', 'child_y9'],
  },
  {
    id: 'child_10_12',
    labelEl: '10–12 ετών',
    labelEn: '10–12 yr',
    stageIds: ['child_y10', 'child_y11', 'child_y12'],
  },
]

export const PREGNANCY_TIMELINE_GROUPS: MilestoneTimelineGroup[] = [
  {
    id: 'preg_t1',
    labelEl: 'Α΄ τρίμηνο',
    labelEn: 'Trimester 1',
    stageIds: pregStageRange(1, 13),
  },
  {
    id: 'preg_t2',
    labelEl: 'Β΄ τρίμηνο',
    labelEn: 'Trimester 2',
    stageIds: pregStageRange(14, 27),
  },
  {
    id: 'preg_t3',
    labelEl: 'Γ΄ τρίμηνο',
    labelEn: 'Trimester 3',
    stageIds: pregStageRange(28, 40),
  },
]

export function getTimelineGroups(pregnancy: boolean): MilestoneTimelineGroup[] {
  return pregnancy ? PREGNANCY_TIMELINE_GROUPS : CHILD_TIMELINE_GROUPS
}
