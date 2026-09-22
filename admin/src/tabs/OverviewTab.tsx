import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CreditCard,
  RefreshCw,
  Save,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { pathForTab } from '../lib/constants'
import type { ProviderStatus } from '../lib/types'

type UsageState = {
  provider_mode?: string
  calls?: Record<string, number>
  cost_usd?: Record<string, number>
  estimated_cost_usd?: number
  total_calls?: number
  day_cost_usd?: number
  day_calls?: number
  month_cost_usd?: number
  llm_balance_usd?: number | null
  replicate_balance_usd?: number | null
  spent_since_sync_usd?: number
  remaining_usd?: number | null
  alert_threshold_usd?: number | null
  daily_budget_usd?: number | null
  monthly_budget_usd?: number | null
  synced_at?: string | null
  reload_needed?: boolean
  last_error_kind?: string | null
  last_error_msg?: string | null
  heymaa_spend_usd?: number
  note?: string
  tx_total?: number
  tx_total_cost_usd?: number
  tx_table_ready?: boolean
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

function applyBudgetFields(
  d: UsageState,
  setBalance: (v: string) => void,
  setThreshold: (v: string) => void,
  setDaily: (v: string) => void,
  setMonthly: (v: string) => void,
) {
  const bal = d.llm_balance_usd ?? d.replicate_balance_usd
  if (bal != null) setBalance(String(bal))
  if (d.alert_threshold_usd != null) setThreshold(String(d.alert_threshold_usd))
  setDaily(d.daily_budget_usd != null ? String(d.daily_budget_usd) : '')
  setMonthly(d.monthly_budget_usd != null ? String(d.monthly_budget_usd) : '')
}

export function OverviewTab({ userCount }: { userCount: number | null }) {
  const { adminFetch } = useAdmin()
  const navigate = useNavigate()
  const { show } = useFlashMessage()
  const [health, setHealth] = useState<Record<string, unknown> | null>(null)
  const [healthErr, setHealthErr] = useState(false)
  const [usage, setUsage] = useState<UsageState | null>(null)
  const [balanceInput, setBalanceInput] = useState('')
  const [thresholdInput, setThresholdInput] = useState('5')
  const [dailyInput, setDailyInput] = useState('')
  const [monthlyInput, setMonthlyInput] = useState('')
  const [saving, setSaving] = useState(false)

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
    try {
      const d = (await adminFetch('/admin/usage')) as unknown as UsageState
      setUsage(d)
      applyBudgetFields(d, setBalanceInput, setThresholdInput, setDailyInput, setMonthlyInput)
    } catch {
      /* ignore */
    }
  }, [adminFetch])

  useEffect(() => {
    void loadHealth()
    void loadUsage()
  }, [loadHealth, loadUsage])

  const saveCredits = async () => {
    const balance = Number(balanceInput)
    if (!Number.isFinite(balance) || balance < 0) {
      show('Enter the current LLM budget remaining ($).', 'err')
      return
    }
    const threshold = Number(thresholdInput || 5)
    setSaving(true)
    try {
      const d = (await adminFetch('/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          llm_balance_usd: balance,
          alert_threshold_usd: Number.isFinite(threshold) ? threshold : 5,
          daily_budget_usd: dailyInput === '' ? null : Number(dailyInput),
          monthly_budget_usd: monthlyInput === '' ? null : Number(monthlyInput),
        }),
      })) as unknown as UsageState & { ok?: boolean; error?: string }
      if (!d.ok && d.error) {
        show(String(d.error), 'err')
        return
      }
      setUsage(d)
      applyBudgetFields(d, setBalanceInput, setThresholdInput, setDailyInput, setMonthlyInput)
      show('LLM budget synced.', 'ok')
    } catch {
      show('Could not save budget', 'err')
    } finally {
      setSaving(false)
    }
  }

  const remaining = usage?.remaining_usd
  const reloadNeeded = Boolean(usage?.reload_needed)
  const remainingClass = reloadNeeded ? 'coral' : 'green'
  const historicReplicate = Number(usage?.calls?.replicate || 0)
  const totalCost =
    usage?.tx_table_ready && usage.tx_total_cost_usd != null
      ? usage.tx_total_cost_usd
      : usage?.estimated_cost_usd

  return (
    <>
      {reloadNeeded && (
        <div className="msg err" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong>Reload LLM budget.</strong>{' '}
            {usage?.last_error_kind === 'credit_exhausted'
              ? 'A chat provider blocked new work — top up and sync the remaining balance.'
              : `Estimated remaining is ${money(remaining)} (at or below your alert).`}{' '}
            Admins are emailed when this happens.
          </div>
        </div>
      )}

      <div className="grid-3">
        <div className="stat teal">
          <div className="n">{userCount ?? '—'}</div>
          <div className="l">Total users</div>
        </div>
        <div className={`stat ${remainingClass}`}>
          <div className="n">{money(remaining)}</div>
          <div className="l">Budget remaining</div>
        </div>
        <div className="stat coral">
          <div className="n">{money(usage?.day_cost_usd, 3)}</div>
          <div className="l">Spend today</div>
        </div>
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
            Gemini first. Gemini also powers RAG embeddings. Resend is email only.
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
              <BarChart3 size={16} className="h-icon" /> Usage
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
              <div className="meta">
                {usage?.tx_table_ready ? 'From ledger' : 'Estimated estimate'}
              </div>
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
          {usage && (
            <p className="meta" style={{ marginTop: 12 }}>
              {usage.spent_since_sync_usd != null ? (
                <>Since last budget sync: {money(usage.spent_since_sync_usd, 3)}</>
              ) : null}
              {historicReplicate > 0 ? (
                <>
                  {usage.spent_since_sync_usd != null ? ' · ' : null}
                  Historical Replicate calls: {historicReplicate}
                </>
              ) : null}
              {!usage.tx_table_ready ? (
                <>
                  <br />
                  Run <code>llm_transactions.sql</code> to enable the per-call ledger.
                </>
              ) : null}
            </p>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <CreditCard size={16} className="h-icon" /> LLM spend budget
          </h2>
          <button type="button" className="sec sm" onClick={() => void loadUsage()}>
            <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} /> Refresh
          </button>
        </div>
        <p className="card-desc">
          Optional prepaid pot for <strong>chat</strong> (Groq / Gemini / Claude). Paste the remaining
          budget you want to track. Remaining = that amount minus chat spend since the last sync.
          RAG embeddings do not drain this pot.
        </p>
        {usage?.note ? <p className="meta">{usage.note}</p> : null}
        <div className="row">
          <div className="field-wrap">
            <FieldLabel required>Budget remaining now $</FieldLabel>
            <input
              type="number"
              min={0}
              step="0.01"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              placeholder="e.g. 25.00"
            />
          </div>
          <div className="field-wrap">
            <FieldLabel>Alert below ($)</FieldLabel>
            <input
              type="number"
              min={0}
              step="0.5"
              value={thresholdInput}
              onChange={(e) => setThresholdInput(e.target.value)}
            />
          </div>
        </div>
        <div className="row">
          <div className="field-wrap">
            <FieldLabel>Daily spend cap $ (optional)</FieldLabel>
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
            <FieldLabel>Monthly spend cap $ (optional)</FieldLabel>
            <input
              type="number"
              min={0}
              step="1"
              value={monthlyInput}
              onChange={(e) => setMonthlyInput(e.target.value)}
              placeholder="off"
            />
          </div>
        </div>
        <button type="button" className="teal" disabled={saving} onClick={() => void saveCredits()}>
          <Save size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
          {saving ? 'Saving…' : 'Sync LLM budget'}
        </button>
        {usage?.synced_at && (
          <p className="meta">
            Last sync {new Date(usage.synced_at).toLocaleString()}
            {usage.heymaa_spend_usd != null ? ` · Spent since sync ${money(usage.heymaa_spend_usd, 3)}` : ''}
            {usage.last_error_msg ? ` · Last error: ${usage.last_error_msg}` : ''}
          </p>
        )}
        <div className="links">
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
            Groq API keys
          </a>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
            Google AI Studio (Gemini)
          </a>
          <a href="https://console.anthropic.com/" target="_blank" rel="noopener noreferrer">
            Anthropic (Claude)
          </a>
          <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">
            Resend
          </a>
        </div>
      </div>
    </>
  )
}
