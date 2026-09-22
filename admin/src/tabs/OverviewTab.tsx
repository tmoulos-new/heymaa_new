import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ExternalLink,
  Gauge,
  RefreshCw,
  Save,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { pathForTab } from '../lib/constants'
import type { ProviderStatus } from '../lib/types'

type ProviderBalance = {
  provider?: string
  ok?: boolean
  label?: string
  kind?: string
  msg?: string
  summary?: string
  note?: string
  billing_url?: string
  usage_url?: string
  remaining_requests?: number | null
  limit_requests?: number | null
  remaining_tokens?: number | null
  limit_tokens?: number | null
  requests_pct_left?: number | null
  tokens_pct_left?: number | null
  month_cost_usd?: number | null
  tracked_cost_usd?: number | null
  rate_limited?: boolean
}

type UsageState = {
  provider_mode?: string
  calls?: Record<string, number>
  cost_usd?: Record<string, number>
  estimated_cost_usd?: number
  total_calls?: number
  day_cost_usd?: number
  day_calls?: number
  month_cost_usd?: number
  remaining_usd?: number | null
  remaining_vs_cap_usd?: number | null
  alert_threshold_usd?: number | null
  daily_budget_usd?: number | null
  monthly_budget_usd?: number | null
  synced_at?: string | null
  reload_needed?: boolean
  last_error_kind?: string | null
  last_error_msg?: string | null
  note?: string
  tx_total?: number
  tx_total_cost_usd?: number
  tx_table_ready?: boolean
  provider_balances?: {
    fetched_at?: string | null
    disclaimer?: string
    error?: string
    providers?: Record<string, ProviderBalance>
  }
}

const PROVIDER_ORDER = ['groq', 'gemini', 'claude', 'resend'] as const

const PROVIDER_LABEL: Record<string, string> = {
  groq: 'Groq',
  gemini: 'Gemini',
  claude: 'Claude',
  resend: 'Resend',
}

const SPEND_ROWS: { key: string; label: string; hint: string }[] = [
  { key: 'groq', label: 'Groq', hint: 'Primary chat' },
  { key: 'gemini', label: 'Gemini', hint: 'Chat + vision' },
  { key: 'claude', label: 'Claude', hint: 'Chat fallback' },
  { key: 'gemini_embed', label: 'Embeddings', hint: 'RAG only' },
]

const BALANCE_ORDER = ['groq', 'gemini', 'claude'] as const

function money(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `$${Number(value).toFixed(digits)}`
}

function providerDot(ok: boolean | undefined, idle: boolean) {
  if (idle) return 'gray'
  return ok ? 'green' : 'red'
}

function asStatus(raw: unknown): ProviderStatus {
  if (raw && typeof raw === 'object' && 'ok' in (raw as object)) {
    const s = raw as ProviderStatus
    return { ok: Boolean(s.ok), msg: String(s.msg || '') }
  }
  return { ok: false, msg: 'no status' }
}

function headroomClass(pct: number | null | undefined) {
  if (pct == null || Number.isNaN(pct)) return ''
  if (pct <= 10) return 'coral'
  if (pct <= 30) return 'coral'
  return 'green'
}

export function OverviewTab({ userCount }: { userCount: number | null }) {
  const { adminFetch } = useAdmin()
  const navigate = useNavigate()
  const { show } = useFlashMessage()
  const [health, setHealth] = useState<Record<string, unknown> | null>(null)
  const [healthErr, setHealthErr] = useState(false)
  const [usage, setUsage] = useState<UsageState | null>(null)
  const [thresholdInput, setThresholdInput] = useState('5')
  const [dailyInput, setDailyInput] = useState('')
  const [monthlyInput, setMonthlyInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [balancesLoading, setBalancesLoading] = useState(false)

  const goToTransactions = () => navigate(pathForTab('llmtransactions'))

  const loadHealth = useCallback(async () => {
    setHealthErr(false)
    setHealth(null)
    try {
      const d = await adminFetch('/admin/health')
      setHealth(d as Record<string, unknown>)
    } catch {
      setHealthErr(true)
    }
  }, [adminFetch])

  const loadUsage = useCallback(async () => {
    setBalancesLoading(true)
    try {
      const d = (await adminFetch('/admin/usage')) as unknown as UsageState
      setUsage(d)
      if (d.alert_threshold_usd != null) setThresholdInput(String(d.alert_threshold_usd))
      setDailyInput(d.daily_budget_usd != null ? String(d.daily_budget_usd) : '')
      setMonthlyInput(d.monthly_budget_usd != null ? String(d.monthly_budget_usd) : '')
    } catch {
      /* ignore */
    } finally {
      setBalancesLoading(false)
    }
  }, [adminFetch])

  useEffect(() => {
    void loadHealth()
    void loadUsage()
  }, [loadHealth, loadUsage])

  const saveCaps = async () => {
    const threshold = Number(thresholdInput || 5)
    setSaving(true)
    try {
      const d = (await adminFetch('/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          alert_threshold_usd: Number.isFinite(threshold) ? threshold : 5,
          daily_budget_usd: dailyInput === '' ? null : Number(dailyInput),
          monthly_budget_usd: monthlyInput === '' ? null : Number(monthlyInput),
        }),
      })) as unknown as UsageState & { ok?: boolean; error?: string }
      if (!d.ok && d.error) {
        show(String(d.error), 'err')
        return
      }
      await loadUsage()
      show('Spend caps saved.', 'ok')
    } catch {
      show('Could not save caps', 'err')
    } finally {
      setSaving(false)
    }
  }

  const remainingVsCap = usage?.remaining_vs_cap_usd ?? usage?.remaining_usd
  const reloadNeeded = Boolean(usage?.reload_needed)
  const remainingClass = reloadNeeded ? 'coral' : 'green'
  const historicReplicate = Number(usage?.calls?.replicate || 0)
  const totalCost =
    usage?.tx_table_ready && usage.tx_total_cost_usd != null
      ? usage.tx_total_cost_usd
      : usage?.estimated_cost_usd
  const balances = usage?.provider_balances?.providers || {}

  return (
    <>
      {reloadNeeded && (
        <div className="msg err" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong>Spend cap alert.</strong>{' '}
            {usage?.last_error_kind === 'credit_exhausted'
              ? 'A chat provider blocked new work — check vendor billing consoles below.'
              : `Remaining vs your cap is ${money(remainingVsCap)} (at or below alert).`}
          </div>
        </div>
      )}

      <div className="grid-3">
        <div className="stat teal">
          <div className="n">{userCount ?? '—'}</div>
          <div className="l">Total users</div>
        </div>
        <div className="stat coral">
          <div className="n">{money(usage?.day_cost_usd, 3)}</div>
          <div className="l">Chat spend today</div>
          <div className="meta">{usage?.day_calls ?? 0} calls · HeyMaa tracked</div>
        </div>
        <div className={`stat ${remainingClass}`}>
          <div className="n">{money(usage?.month_cost_usd, 3)}</div>
          <div className="l">Chat spend this month</div>
          <div className="meta">
            {remainingVsCap != null
              ? `${money(remainingVsCap)} left vs your cap`
              : 'Set a daily/monthly cap below'}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <Gauge size={16} className="h-icon" /> Live provider headroom
          </h2>
          <button type="button" className="sec sm" disabled={balancesLoading} onClick={() => void loadUsage()}>
            <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
            {balancesLoading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
        <p className="card-desc">
          Groq, Gemini, and Claude <strong>do not expose prepaid $ balance</strong> on the chat API
          key. This panel shows live rate-limit remaining (Groq), Admin month spend when configured
          (Claude), and HeyMaa-tracked spend + billing links (Gemini).
        </p>
        {usage?.provider_balances?.error ? (
          <div className="msg err">{usage.provider_balances.error}</div>
        ) : null}
        <div className="grid-3">
          {BALANCE_ORDER.map((id) => {
            const row = balances[id]
            const pct = row?.requests_pct_left ?? row?.tokens_pct_left
            const statClass = headroomClass(pct)
            return (
              <div className={`stat ${statClass}`.trim()} key={id}>
                <div className="l" style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                  <span>{row?.label || PROVIDER_LABEL[id] || id}</span>
                  <span className={`dot ${providerDot(row?.ok, !row)}`} />
                </div>
                <div className="n" style={{ fontSize: row?.month_cost_usd != null ? undefined : '0.95rem' }}>
                  {row?.month_cost_usd != null
                    ? money(row.month_cost_usd, 2)
                    : row?.remaining_requests != null && row?.limit_requests != null
                      ? `${Math.round(row.remaining_requests).toLocaleString()}`
                      : row?.ok
                        ? 'OK'
                        : '—'}
                </div>
                <div className="meta">{row?.summary || row?.msg || (balancesLoading ? 'Loading…' : 'No data')}</div>
                <div className="meta" style={{ marginTop: 6 }}>
                  {row?.billing_url ? (
                    <a href={row.billing_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                      Billing <ExternalLink size={12} style={{ verticalAlign: -1 }} />
                    </a>
                  ) : null}
                  {row?.usage_url ? (
                    <>
                      {' · '}
                      <a href={row.usage_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
                        Usage
                      </a>
                    </>
                  ) : null}
                </div>
              </div>
            )
          })}
        </div>
        {usage?.provider_balances?.disclaimer ? (
          <p className="meta" style={{ marginTop: 12 }}>
            {usage.provider_balances.disclaimer}
          </p>
        ) : null}
        {balances.claude?.note || balances.gemini?.note || balances.groq?.note ? (
          <p className="meta">
            Tip: set <code>ANTHROPIC_ADMIN_API_KEY</code> (sk-ant-admin…) for Claude month-to-date $.
          </p>
        ) : null}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>
              <Activity size={16} className="h-icon" /> Provider status
            </h2>
            <button type="button" className="sec sm" onClick={() => void loadHealth()}>
              <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Refresh
            </button>
          </div>
          <p className="card-desc">
            Chat order is <strong>Groq → Gemini → Claude</strong>. Photos and some languages try
            Gemini first. Resend is email only.
          </p>
          <div className="prov-grid">
            {healthErr && <div className="msg err">Failed to load provider status</div>}
            {!healthErr && !health && (
              <div className="prov">
                <span className="nm">Checking providers…</span>
              </div>
            )}
            {health &&
              PROVIDER_ORDER.map((p) => {
                const s = asStatus(health[p])
                const idle = /idle|not used|not required/i.test(s.msg || '')
                return (
                  <div className="prov" key={p}>
                    <span className="nm">
                      <span className={`dot ${providerDot(s.ok, idle)}`} />
                      {PROVIDER_LABEL[p] || p}
                    </span>
                    <span className="st">
                      {idle ? '–' : s.ok ? '✓' : '✗'} {s.msg || (s.ok ? 'online' : 'offline')}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        <div
          className="card card-clickable"
          onClick={goToTransactions}
          role="link"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              goToTransactions()
            }
          }}
        >
          <div className="card-head">
            <h2>
              <BarChart3 size={16} className="h-icon" /> HeyMaa usage
            </h2>
            <button
              type="button"
              className="sec sm"
              onClick={(e) => {
                e.stopPropagation()
                goToTransactions()
              }}
            >
              View transactions
            </button>
          </div>
          <div className="grid-3">
            <div className="stat teal">
              <div className="n">{usage?.tx_total ?? usage?.total_calls ?? '…'}</div>
              <div className="l">Total transactions</div>
            </div>
            <div className="stat coral">
              <div className="n">{money(totalCost, 3)}</div>
              <div className="l">Total cost</div>
              <div className="meta">{usage?.tx_table_ready ? 'From ledger' : 'Estimate'}</div>
            </div>
            <div className="stat">
              <div className="n">{usage?.day_calls ?? '…'}</div>
              <div className="l">Calls today</div>
              <div className="meta">{money(usage?.day_cost_usd, 3)}</div>
            </div>
          </div>
          <div className="grid-2" style={{ marginTop: 12 }}>
            {SPEND_ROWS.map((row) => {
              const calls = usage?.calls?.[row.key]
              const cost = usage?.cost_usd?.[row.key]
              return (
                <div className="stat" key={row.key}>
                  <div className="n">{calls ?? '…'}</div>
                  <div className="l">{row.label}</div>
                  <div className="meta">
                    {row.hint} · {money(cost, 3)}
                  </div>
                </div>
              )
            })}
          </div>
          {usage && historicReplicate > 0 ? (
            <p className="meta" style={{ marginTop: 12 }}>
              Historical Replicate calls still in ledger: {historicReplicate}
            </p>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <AlertTriangle size={16} className="h-icon" /> Internal spend caps
          </h2>
        </div>
        <p className="card-desc">
          Optional HeyMaa alerts when <strong>our tracked chat spend</strong> crosses a daily or
          monthly cap. This is not the vendor prepaid balance (unavailable via API).
        </p>
        <div className="row">
          <div className="field-wrap">
            <FieldLabel>Daily spend cap $</FieldLabel>
            <input
              type="number"
              min={0}
              step="0.5"
              value={dailyInput}
              onChange={(e) => setDailyInput(e.target.value)}
              placeholder="off"
            />
          </div>
          <div className="field-wrap">
            <FieldLabel>Monthly spend cap $</FieldLabel>
            <input
              type="number"
              min={0}
              step="1"
              value={monthlyInput}
              onChange={(e) => setMonthlyInput(e.target.value)}
              placeholder="off"
            />
          </div>
          <div className="field-wrap">
            <FieldLabel>Alert below remaining $</FieldLabel>
            <input
              type="number"
              min={0}
              step="0.5"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
            />
          </div>
        </div>
        <button type="button" className="teal" disabled={saving} onClick={() => void saveCaps()}>
          <Save size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          {saving ? 'Saving…' : 'Save caps'}
        </button>
      </div>
    </>
  )
}
