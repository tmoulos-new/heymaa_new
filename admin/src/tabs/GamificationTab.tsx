import { LevelsTab } from './LevelsTab'
import { PointsTab } from './PointsTab'

/** Points per action and level thresholds on one page — they are one ladder. */
export function GamificationTab() {
  return (
    <>
      <PointsTab />
      <LevelsTab />
    </>
  )
}
