import { LevelsTab } from './LevelsTab'
import { PointsTab } from './PointsTab'

/** Points per action and level thresholds on one page — they are one ladder. */
export function GamificationTab() {
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="card-head">
          <h2>Points &amp; levels</h2>
        </div>
        <p className="card-desc" style={{ marginBottom: 0 }}>
          One ladder: moms earn <strong>points</strong> for actions → reach <strong>level</strong>{' '}
          thresholds → optional free-plan gift days. Edit rules first, then level thresholds. Moms
          only see the labels you set — <code>action</code> / <code>path</code> ids are internal.
        </p>
      </div>
      <PointsTab />
      <LevelsTab />
    </>
  )
}
