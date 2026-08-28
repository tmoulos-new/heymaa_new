import axios from 'axios'
import { API, apiDetail, type SubscriptionSnapshot } from './authApi'
import type { RewardsSnapshot } from './levelRewards'
export type ClaimRewardResult = {
  ok: boolean
  grant?: {
    plan_slot: string
    ends_at: string
    days?: number
  }
  rewards?: RewardsSnapshot
  status?: SubscriptionSnapshot
}

export async function fetchRewards(token: string): Promise<RewardsSnapshot | null> {
  try {
    const res = await axios.get<RewardsSnapshot>(`${API}/gamification/rewards`, {
      headers: { 'x-token': token },
    })
    return res.data
  } catch {
    return null
  }
}

export async function claimLevelReward(
  token: string,
  levelId: number,
): Promise<ClaimRewardResult> {
  try {
    const res = await axios.post<ClaimRewardResult>(
      `${API}/gamification/claim-reward`,
      { level_id: levelId },
      { headers: { 'x-token': token } },
    )
    return res.data
  } catch (err: unknown) {
    const detail =
      axios.isAxiosError(err) && err.response?.data
        ? apiDetail(err.response.data, 'Claim failed')
        : 'Claim failed'
    throw new Error(detail)
  }
}
