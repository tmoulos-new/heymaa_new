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
  calls: Record<string, number>
  cost_usd?: Record<string, number>
  models?: Record<string, { calls?: number; cost_usd?: number }>
  chat_models?: { slug: string; label: string; calls: number; cost_usd: number }[]
  estimated_cost_usd: number
  total_calls?: number
  day_cost_usd?: number
  day_calls?: number
  month_cost_usd?: number
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
  billing_url?: string
  tokens_url?: string
  prepaid_docs_url?: string
  orgs_url?: string
  heymaa_spend_usd?: number
  credit_scope?: string
  replicate_account?: { username?: string; type?: string }
  note?: string
  replicate_configured?: boolean
  key_rotated?: boolean
  tx_total?: number
  tx_total_cost_usd?: number
  tx_table_ready?: boolean
}

const PROVIDER_ORDER = ['replicate', 'gemini', 'resend', 'groq', 'claude'] as const
const REPLICATE_MODE_PROVIDERS = ['replicate', 'gemini', 'resend'] as const

const PROVIDER_LABEL: Record<string, string> = {
  replicate: 'Replicate chat',
  gemini: 'Gemini embeddings (RAG)',
  groq: 'Groq',
  claude: 'Claude',
  resend: 'Resend',
}

function money(value: number | null | undefined, digits = 2) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `$${Number(value).toFixed(digits)}`
}

function providerDot(ok: boolean | undefined, idle: boolean) {
  if (idle) return 'gray'
  return ok ? 'green' : 'red'
}

export function OverviewTab({ userCount }: { userCount: number | null }) {
  const { adminFetch } = useAdmin()
  const navigate = useNavigate()
  const { show } = useFlashMessage()
  const [health, setHealth] = useState<Record<string, ProviderStatus | string> | null>(null)
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
      setHealth(d as unknown as Record<string, ProviderStatus | string>)
    } catch {
      setHealthErr(true)
    }
  }, [adminFetch])

  const loadUsage = useCallback(async () => {
    try {
      const d = (await adminFetch('/admin/usage')) as unknown as UsageState
      setUsage(d)
      if (d.replicate_balance_usd != null) setBalanceInput(String(d.replicate_balance_usd))
      if (d.alert_threshold_usd != null) setThresholdInput(String(d.alert_threshold_usd))
      if (d.daily_budget_usd != null) setDailyInput(String(d.daily_budget_usd))
      if (d.monthly_budget_usd != null) setMonthlyInput(String(d.monthly_budget_usd))
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
      show('Enter the current HeyMaa Replicate prepaid remaining ($).', 'err')
      return
    }
    const threshold = Number(thresholdInput || 5)
    setSaving(true)
    try {
      const d = (await adminFetch('/admin/credits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          replicate_balance_usd: balance,
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
      show('HeyMaa credits synced. Remaining = this number minus chat until you paste again.', 'ok')
    } catch {
      show('Could not save credits', 'err')
    } finally {
      setSaving(false)
    }
  }

  const mode =
    (typeof health?.llm_provider_mode === 'string' && health.llm_provider_mode) ||
    usage?.provider_mode ||
    'replicate'
  const remaining = usage?.remaining_usd
  const reloadNeeded = Boolean(usage?.reload_needed)
  const remainingClass = reloadNeeded ? 'coral' : 'green'
  const replicateMode = mode === 'replicate'
  const providersToShow = replicateMode ? REPLICATE_MODE_PROVIDERS : PROVIDER_ORDER
  const chatModels = usage?.chat_models?.length
    ? usage.chat_models
    : [
        { slug: 'meta/meta-llama-3-70b-instruct', label: 'Llama 70B', calls: 0, cost_usd: 0 },
        { slug: 'google/gemini-2.5-flash', label: 'Gemini Flash', calls: 0, cost_usd: 0 },
        { slug: 'anthropic/claude-4.5-haiku', label: 'Claude Haiku', calls: 0, cost_usd: 0 },
      ]

  return (
    <>
      {reloadNeeded && (
        <div className="msg err" style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <AlertTriangle size={16} style={{ marginTop: 2, flexShrink: 0 }} />
          <div>
            <strong>Reload Replicate credits.</strong>{' '}
            {usage?.last_error_kind === 'credit_exhausted'
              ? 'Replicate blocked new work (402) — the HeyMaa prepaid balance is empty. Top up or turn on auto reload in Billing.'
              : `Estimated remaining is ${money(remaining)} (at or below your alert).`}
            {' '}Admins are emailed when this happens.
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
          <div className="l">HeyMaa remaining</div>
        </div>
        <div className="stat coral">
          <div className="n">{money(usage?.day_cost_usd, 3)}</div>
          <div className="l">Est. spend today</div>
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
            Chat uses <strong>one Replicate token</strong> and the same occasion order as before:
            Llama 70B (everyday, was Groq), Gemini Flash (photos and CJK/RTL), Claude Haiku
            (backup / vision fallback). Groq and Anthropic keys are not required. Gemini below is
            Google embeddings for RAG, not chat.
          </p>
          <div className="prov-grid">
            {healthErr && <div className="msg err">Failed to load</div>}
            {!healthErr && !health && (
              <div className="prov">
                <span className="nm">Checking providers…</span>
              </div>
            )}
            {health &&
              providersToShow.map((p) => {
                const raw = health[p]
                const s =
                  raw && typeof raw === 'object'
                    ? (raw as ProviderStatus)
                    : { ok: false, msg: '?' }
                const idle = /idle|not used|not required/i.test(s.msg || '')
                return (
                  <div className="prov" key={p}>
                    <span className="nm">
                      <span className={`dot ${providerDot(s.ok, idle)}`} />
                      {PROVIDER_LABEL[p] || p}
                    </span>
                    <span className="st">
                      {idle ? '–' : s.ok ? '✓' : '✗'} {s.msg}
                    </span>
                  </div>
                )
              })}
          </div>
        </div>

        <div className="card card-clickable" onClick={goToTransactions} role="link" tabIndex={0}
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
            <div
              className="stat stat-link teal"
              onClick={(e) => {
                e.stopPropagation()
                goToTransactions()
              }}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  goToTransactions()
                }
              }}
            >
              <div className="n">{usage?.tx_total ?? usage?.total_calls ?? '…'}</div>
              <div className="l">Total transactions</div>
              <div className="meta">Click to open ledger</div>
            </div>
            <div
              className="stat stat-link coral"
              onClick={(e) => {
                e.stopPropagation()
                goToTransactions()
              }}
              role="link"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  e.stopPropagation()
                  goToTransactions()
                }
              }}
            >
              <div className="n">
                {money(
                  usage?.tx_table_ready ? usage?.tx_total_cost_usd : usage?.estimated_cost_usd,
                  3,
                )}
              </div>
              <div className="l">Total cost</div>
              <div className="meta">
                {usage?.tx_table_ready ? 'From llm_transactions' : 'Est. tracked'}
              </div>
            </div>
            <div className="stat">
              <div className="n">{money(usage?.day_cost_usd, 3)}</div>
              <div className="l">Spend today</div>
            </div>
          </div>
          <div className="grid-3">
            {chatModels.map((row) => (
              <div className="stat" key={row.slug}>
                <div className="n">{row.calls}</div>
                <div className="l">{row.label}</div>
                <div className="meta">
                  {money(row.cost_usd, 3)}
                </div>
              </div>
            ))}
          </div>
          <div className="grid-3">
            <div className="stat">
              <div className="n">{usage?.calls?.replicate ?? '…'}</div>
              <div className="l">Replicate chat total</div>
            </div>
            <div className="stat">
              <div className="n">{usage?.calls?.gemini_embed ?? '…'}</div>
              <div className="l">Gemini embeddings</div>
            </div>
            <div className="stat">
              <div className="n">{money(usage?.estimated_cost_usd, 3)}</div>
              <div className="l">Est. aggregate tracked</div>
            </div>
          </div>
          {usage && (
            <p className="meta">
              Today: {usage.day_calls || 0} calls · {money(usage.day_cost_usd, 3)}
              {usage.spent_since_sync_usd != null && (
                <> · Since last credit sync: {money(usage.spent_since_sync_usd, 3)}</>
              )}
              {(usage.calls?.groq || usage.calls?.claude) ? (
                <>
                  <br />
                  Legacy fallback: Groq {usage.calls.groq || 0} · Claude {usage.calls.claude || 0}
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
              <CreditCard size={16} className="h-icon" /> HeyMaa Replicate credits
            </h2>
          </div>
        <p className="card-desc">
          This Replicate account is <strong>HeyMaa-only</strong>. Replicate does not expose remaining
          credit on the API — paste the prepaid number from Billing. Remaining here = that amount
          minus HeyMaa chat since you pasted it. Gemini RAG embeddings bill Google, not this pot.
          Enable <strong>auto reload</strong> in Billing (min $5 threshold / $15 reload) so chat
          does not stop at $0.
        </p>
        {usage?.replicate_account?.username && (
          <p className="meta">
            HeyMaa account:{' '}
            <strong>
              {usage.replicate_account.type === 'organization' ? 'org' : 'user'}{' '}
              {usage.replicate_account.username}
            </strong>
          </p>
        )}
        {usage && usage.replicate_configured === false ? (
          <p className="msg err">No HeyMaa Replicate token configured.</p>
        ) : (
          <p className="meta">
            {usage?.key_rotated ? 'Token changed, spend counter reset · ' : ''}
            {usage?.heymaa_spend_usd != null
              ? `Spent ${money(usage.heymaa_spend_usd, 3)} since sync`
              : null}
          </p>
        )}
        <div className="row">
          <div className="field-wrap">
            <FieldLabel required>Prepaid remaining now $ (from Billing)</FieldLabel>
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
            <FieldLabel>Reload alert below ($)</FieldLabel>
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
          {saving ? 'Saving…' : 'Sync HeyMaa credits'}
        </button>
        {usage?.synced_at && (
          <p className="meta">
            Last sync {new Date(usage.synced_at).toLocaleString()}
            {usage.last_error_msg ? ` · Last error: ${usage.last_error_msg}` : ''}
          </p>
        )}
        <div className="links">
          <a href={usage?.billing_url || 'https://replicate.com/account/billing'} target="_blank" rel="noopener noreferrer">
            Billing &amp; auto reload
          </a>
          <a href={usage?.prepaid_docs_url || 'https://replicate.com/docs/topics/billing/prepaid-credit'} target="_blank" rel="noopener noreferrer">
            Prepaid credit docs
          </a>
          <a href={usage?.tokens_url || 'https://replicate.com/account/api-tokens'} target="_blank" rel="noopener noreferrer">
            API tokens
          </a>
          <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer">
            Google AI Studio (RAG)
          </a>
          <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer">
            Resend
          </a>
        </div>
      </div>
    </>
  )
}
