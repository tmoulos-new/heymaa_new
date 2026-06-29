import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  CreditCard,
  RefreshCw,
} from 'lucide-react'
import { useAdmin } from '../context/AdminContext'
import type { ProviderStatus } from '../lib/types'

export function OverviewTab({ userCount }: { userCount: number | null }) {
  const { adminFetch } = useAdmin()
  const [health, setHealth] = useState<Record<string, ProviderStatus> | null>(null)
  const [healthErr, setHealthErr] = useState(false)
  const [usage, setUsage] = useState<{
    groq: number
    gemini: number
    claude: number
    cost: number
    sinceDays: number
    total: number
  } | null>(null)

  const loadHealth = useCallback(async () => {
    setHealthErr(false)
    setHealth(null)
    try {
      const d = await adminFetch('/admin/health')
      setHealth(d as unknown as Record<string, ProviderStatus>)
    } catch {
      setHealthErr(true)
    }
  }, [adminFetch])

  const loadUsage = useCallback(async () => {
    try {
      const d = await adminFetch('/admin/usage')
      const c = (d.calls as Record<string, number>) || {}
      const groq = c.groq || 0
      const gemini = c.gemini || 0
      const claude = c.claude || 0
      setUsage({
        groq,
        gemini,
        claude,
        total: groq + gemini + claude,
        cost: Number(d.estimated_cost_usd) || 0,
        sinceDays: Number(d.since_days) || 0,
      })
    } catch {
      /* ignore */
    }
  }, [adminFetch])

  useEffect(() => {
    void loadHealth()
    void loadUsage()
  }, [loadHealth, loadUsage])

  return (
    <>
      <div className="grid-3" style={{ marginBottom: 20 }}>
        <div className="stat teal">
          <div className="n">{userCount ?? '—'}</div>
          <div className="l">Total users</div>
        </div>
        <div className="stat coral">
          <div className="n">{usage ? `$${usage.cost.toFixed(2)}` : '—'}</div>
          <div className="l">Est. API cost</div>
        </div>
        <div className="stat green">
          <div className="n">{usage?.total ?? '—'}</div>
          <div className="l">Total API calls</div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>
              <Activity size={16} className="h-icon" /> Provider Status
            </h2>
            <button type="button" className="sec sm" onClick={() => void loadHealth()}>
              <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Refresh
            </button>
          </div>
          <div className="prov-grid">
            {healthErr && <div className="msg err">Failed to load</div>}
            {!healthErr && !health && (
              <div className="prov">
                <span className="nm">Pinging providers…</span>
              </div>
            )}
            {health &&
              (['groq', 'gemini', 'claude', 'resend'] as const).map((p) => {
                const s = health[p] || { ok: false, msg: '?' }
                return (
                  <div className="prov" key={p}>
                    <span className="nm">
                      <span className={`dot ${s.ok ? 'green' : 'red'}`} />
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </span>
                    <span className="st">
                      {s.ok ? '✓' : '✗'} {s.msg}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>
              <BarChart3 size={16} className="h-icon" /> Usage
            </h2>
          </div>
          <div className="grid-3">
            <div className="stat">
              <div className="n">{usage?.groq ?? '…'}</div>
              <div className="l">Groq</div>
            </div>
            <div className="stat">
              <div className="n">{usage?.gemini ?? '…'}</div>
              <div className="l">Gemini</div>
            </div>
            <div className="stat">
              <div className="n">{usage?.claude ?? '…'}</div>
              <div className="l">Claude</div>
            </div>
          </div>
          {usage && (
            <p className="meta" style={{ marginTop: 12 }}>
              Since {usage.sinceDays} days ago · Claude ≈ $0.0025/call · Resets on server restart.
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <CreditCard size={16} className="h-icon" /> Top up credits
          </h2>
        </div>
        <p className="card-desc">
          Live balances aren&apos;t exposed via API — use these links to check &amp; top up.
        </p>
        <div className="links">
          <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noopener noreferrer">
            Anthropic Billing
          </a>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
            Google AI Studio
          </a>
          <a href="https://console.groq.com/settings/billing" target="_blank" rel="noopener noreferrer">
            Groq Billing
          </a>
          <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">
            Resend API Keys
          </a>
        </div>
      </div>
    </>
  )
}
