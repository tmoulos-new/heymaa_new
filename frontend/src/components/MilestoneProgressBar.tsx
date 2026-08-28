import { useEffect, useRef } from 'react'
import {
  groupForStageId,
  groupStatus,
  timelineGroupLabel,
  type MilestoneTimelineGroup,
} from '../lib/milestoneTimeline'

export function MilestoneProgressBar({
  lang,
  groups,
  activeStageId,
  isPregnancy,
  selectedGroupId,
  onSelectGroup,
  currentLabel,
  ariaLabel,
}: {
  lang: string
  groups: MilestoneTimelineGroup[]
  activeStageId: string
  isPregnancy: boolean
  selectedGroupId: string
  onSelectGroup: (groupId: string) => void
  currentLabel: string
  ariaLabel: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const currentGroup = groupForStageId(activeStageId, isPregnancy)
  const currentIdx = currentGroup
    ? groups.findIndex((g) => g.id === currentGroup.id)
    : 0
  const fillPct =
    groups.length <= 1 ? 100 : (Math.max(0, currentIdx) / (groups.length - 1)) * 100

  useEffect(() => {
    const root = scrollRef.current
    if (!root || !currentGroup) return
    const node = root.querySelector<HTMLElement>(`[data-group-id="${currentGroup.id}"]`)
    node?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [currentGroup?.id, groups.length])

  return (
    <div className="hm-ms-track-wrap">
      <div className="hm-ms-track-scroll" ref={scrollRef}>
        <div className="hm-ms-track" role="tablist" aria-label={ariaLabel}>
          <div className="hm-ms-track__rail" aria-hidden>
            <div className="hm-ms-track__fill" style={{ width: `${fillPct}%` }} />
          </div>
          <div className="hm-ms-track__nodes">
            {groups.map((group) => {
              const status = groupStatus(group, activeStageId, isPregnancy)
              const selected = selectedGroupId === group.id
              return (
                <button
                  key={group.id}
                  type="button"
                  role="tab"
                  data-group-id={group.id}
                  aria-selected={selected}
                  aria-current={status === 'current' ? 'step' : undefined}
                  className={`hm-ms-track__node hm-ms-track__node--${status}${selected ? ' hm-ms-track__node--selected' : ''}`}
                  onClick={() => onSelectGroup(group.id)}
                  title={timelineGroupLabel(group, lang)}
                >
                  <span className="hm-ms-track__dot" aria-hidden />
                  <span className="hm-ms-track__node-label">{timelineGroupLabel(group, lang)}</span>
                </button>
              )
            })}
          </div>
        </div>
      </div>
      {currentGroup ? (
        <div className="hm-ms-track__current">
          <span className="hm-ms-track__current-arrow" aria-hidden>
            ↑
          </span>{' '}
          {currentLabel}: {timelineGroupLabel(currentGroup, lang)}
        </div>
      ) : null}
    </div>
  )
}
