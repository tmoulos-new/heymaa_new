export type MilestoneChecksMap = Record<string, Record<string, boolean[]>>

export type TimelineGroupStatus = 'past' | 'current' | 'future'

export type MilestoneTimelineGroup = {
  id: string
  labelEl: string
  labelEn: string
  stageIds: string[]
}
