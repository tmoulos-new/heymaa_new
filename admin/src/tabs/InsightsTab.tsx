import { useCallback, useEffect, useState } from 'react'
import {
  Activity,
  BarChart3,
  Euro,
  RefreshCw,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BarChart, SeriesChart } from '../components/InsightsCharts'
import { useAdmin } from '../context/AdminContext'
import { pathForTab } from '../lib/constants'

type SeriesPoint = { date: string; value: number }

type InsightsPayload = {
  ok?: boolean
  days?: number
  notes?: string[]
  kpis?: {
    total_users?: number
    new_users_today?: number
    new_users_7d?: number
    new_users_30d?: number
    free_plan_users?: number
    paying_active?: number
    trial_active?: number
    pending_cancels?: number
    active_last_7d?: number
    recognized_mrr_eur?: number
    renewing_mrr_eur?: number
    cash_revenue_eur?: number
    orders_count?: number
    llm_cost_usd_window?: number
    llm_cost_usd_mtd?: number
    projected_llm_cost_usd_month?: number
    users_near_llm_limit?: number
  }
  mrr?: {
    recognized_mrr_eur?: number
    renewing_mrr_eur?: number
    note?: string
    by_plan?: Record<string, { users?: number; recognized_mrr_eur?: number; renewing_mrr_eur?: number }>
  }
  users_per_plan?: {
    plan_id: string
    name: string
    users: number
    monthly_price_eur: number
    is_free?: boolean
  }[]
  subscription_status?: { status: string; users: number }[]
  series?: {
    new_users?: SeriesPoint[]
    llm_cost_usd?: SeriesPoint[]
    llm_calls?: SeriesPoint[]
    cash_revenue_eur?: SeriesPoint[]
    dau?: SeriesPoint[]
  }
  behavior?: {
    active_last_7d?: number
    users_with_chat?: number
    avg_chat_messages?: number
    total_chat_messages?: number
    total_threads?: number
    total_memories?: number
    users_near_llm_limit?: number
    dau_today?: number
    note?: string
  }
  prices_eur?: {
    starter?: number
    premium?: number
    annual_monthly_equiv?: number
    annual_yearly?: number
  }
}

function moneyEur(n: number | null | undefined, digits = 0) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `€${Number(n).toFixed(digits)}`
}

function moneyUsd(n: number | null | undefined, digits = 2) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return `$${Number(n).toFixed(digits)}`
}

export function InsightsTab() {
  const { adminFetch } = useAdmin()
  const navigate = useNavigate()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<InsightsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = (await adminFetch(`/admin/insights?days=${days}`)) as InsightsPayload
      setData(d)
    } catch (e) {
      setErr((e instanceof Error && e.message) || 'Failed to load insights')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, days])

  useEffect(() => {
    void load()
  }, [load])

  const k = data?.kpis
  const b = data?.behavior
  const planBars =
    data?.users_per_plan?.map((p) => ({
      label: p.name || (p.plan_id === 'trial' ? 'Free trial' : p.plan_id),
      value: p.users,
      hint: p.is_free || p.monthly_price_eur <= 0 ? 'Free plan' : `${moneyEur(p.monthly_price_eur, 0)}/mo equiv`,
    })) || []
  const statusBars =
    data?.subscription_status?.map((s) => ({
      label: s.status,
      value: s.users,
    })) || []

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>
            <BarChart3 size={16} className="h-icon" /> Business insights
          </h2>
          <div className="card-head-actions">
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              aria-label="Window days"
              style={{ marginBottom: 0, width: 'auto', minWidth: 110 }}
            >
              <option value={14}>Last 14 days</option>
              <option value={30}>Last 30 days</option>
              <option value={60}>Last 60 days</option>
              <option value={90}>Last 90 days</option>
            </select>
            <button type="button" className="sec sm" disabled={loading} onClick={() => void load()}>
              <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        <p className="card-desc">
          Growth, plan mix (including Free trial), modelled paid MRR, Viva cash, and LLM consumption.
          Free trial users are counted in Total / Free plan / Users per plan — not under Paying.
        </p>
        {err ? <div className="msg err">{err}</div> : null}
        {data?.notes && data.notes.length > 0 ? (
          <div className="msg err" style={{ marginBottom: 12 }}>
            Some sources unavailable: {data.notes.join(' · ')}
          </div>
        ) : null}
      </div>

      <div className="grid-3 insights-kpi-grid">
        <div className="stat teal">
          <div className="n">{loading ? '…' : (k?.total_users ?? 0)}</div>
          <div className="l">Total users</div>
          <div className="meta">
            +{loading ? '…' : (k?.new_users_today ?? 0)} today · +
            {loading ? '…' : (k?.new_users_7d ?? 0)} / 7d · +
            {loading ? '…' : (k?.new_users_30d ?? 0)} / 30d
          </div>
        </div>
        <div className="stat">
          <div className="n">{loading ? '…' : (k?.free_plan_users ?? k?.trial_active ?? 0)}</div>
          <div className="l">Free plan users</div>
          <div className="meta">
            {loading ? '…' : (k?.trial_active ?? 0)} with unexpired trial access
          </div>
        </div>
        <div className="stat green">
          <div className="n">{loading ? '…' : (k?.paying_active ?? 0)}</div>
          <div className="l">Paying active</div>
          <div className="meta">
            {loading ? '…' : (k?.pending_cancels ?? 0)} pending cancel · Starter/Premium/Annual
          </div>
        </div>
        <div className="stat green">
          <div className="n">{loading ? '…' : moneyEur(k?.recognized_mrr_eur, 0)}</div>
          <div className="l">Projected MRR</div>
          <div className="meta">
            Renewing {loading ? '…' : moneyEur(k?.renewing_mrr_eur, 0)} (excl. cancel queue)
          </div>
        </div>
        <div className="stat">
          <div className="n">{loading ? '…' : moneyEur(k?.cash_revenue_eur, 0)}</div>
          <div className="l">Cash ({days}d)</div>
          <div className="meta">{loading ? '…' : (k?.orders_count ?? 0)} completed orders</div>
        </div>
        <div className="stat coral">
          <div className="n">{loading ? '…' : moneyUsd(k?.llm_cost_usd_mtd, 2)}</div>
          <div className="l">LLM cost MTD</div>
          <div className="meta">
            Projected month {loading ? '…' : moneyUsd(k?.projected_llm_cost_usd_month, 2)}
          </div>
        </div>
        <div className="stat">
          <div className="n">{loading ? '…' : (k?.active_last_7d ?? 0)}</div>
          <div className="l">Active last 7d (login)</div>
          <div className="meta">
            DAU today {loading ? '…' : (b?.dau_today ?? 0)} · near limit{' '}
            {loading ? '…' : (k?.users_near_llm_limit ?? 0)}
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>
              <Users size={16} className="h-icon" /> Users per plan
            </h2>
            <button type="button" className="sec sm" onClick={() => navigate(pathForTab('plans'))}>
              Plans
            </button>
          </div>
          <BarChart items={planBars} label="Users per plan" color="#4ABEAA" />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>
              <Activity size={16} className="h-icon" /> Subscription status
            </h2>
          </div>
          <BarChart items={statusBars} label="Subscription status" color="#2B3A67" />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>
              <TrendingUp size={16} className="h-icon" /> New users / day
            </h2>
          </div>
          <SeriesChart series={data?.series?.new_users || []} label="New users per day" color="#2B3A67" />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>
              <Activity size={16} className="h-icon" /> Daily active users
            </h2>
          </div>
          <SeriesChart
            series={data?.series?.dau || []}
            label="DAU"
            color="#4ABEAA"
            emptyText="No user activity events in this window."
          />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>
              <Wallet size={16} className="h-icon" /> LLM cost / day (USD)
            </h2>
            <button
              type="button"
              className="sec sm"
              onClick={() => navigate(pathForTab('llmtransactions'))}
            >
              Transactions
            </button>
          </div>
          <SeriesChart
            series={data?.series?.llm_cost_usd || []}
            label="LLM cost per day"
            color="#C45B28"
            money
          />
          <p className="meta" style={{ marginTop: 8 }}>
            Window total {moneyUsd(k?.llm_cost_usd_window, 3)} · calls series available below.
          </p>
        </div>
        <div className="card">
          <div className="card-head">
            <h2>
              <BarChart3 size={16} className="h-icon" /> LLM calls / day
            </h2>
          </div>
          <SeriesChart series={data?.series?.llm_calls || []} label="LLM calls per day" color="#7C5CBF" />
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>
              <Euro size={16} className="h-icon" /> Cash revenue / day (EUR)
            </h2>
          </div>
          <SeriesChart
            series={data?.series?.cash_revenue_eur || []}
            label="Cash revenue per day"
            color="#2D9E6B"
            money
            emptyText="No completed Viva orders in this window."
          />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>
              <TrendingUp size={16} className="h-icon" /> Revenue model
            </h2>
          </div>
          <div className="insights-mrr-grid">
            <div className="stat green">
              <div className="n">{moneyEur(data?.mrr?.recognized_mrr_eur, 0)}</div>
              <div className="l">Recognized / prepaid MRR</div>
              <div className="meta">Includes period-end cancels still in access</div>
            </div>
            <div className="stat teal">
              <div className="n">{moneyEur(data?.mrr?.renewing_mrr_eur, 0)}</div>
              <div className="l">Renewing MRR</div>
              <div className="meta">Excludes pending/approved cancel queue</div>
            </div>
          </div>
          {data?.mrr?.by_plan ? (
            <div className="insights-mrr-plans">
              {Object.entries(data.mrr.by_plan).map(([pid, row]) => (
                <div key={pid} className="insights-mrr-plan">
                  <strong>{pid}</strong>
                  <span>
                    {row.users ?? 0} paying · {moneyEur(row.recognized_mrr_eur, 0)} recognized
                  </span>
                </div>
              ))}
            </div>
          ) : null}
          <p className="meta" style={{ marginTop: 12 }}>
            {data?.mrr?.note ||
              'Checkout is one-shot; renewing MRR is a retention model, not an auto-charge guarantee.'}
          </p>
          <p className="meta">
            Catalog: Starter {moneyEur(data?.prices_eur?.starter, 0)} · Premium{' '}
            {moneyEur(data?.prices_eur?.premium, 0)} · Annual {moneyEur(data?.prices_eur?.annual_yearly, 0)}{' '}
            ({moneyEur(data?.prices_eur?.annual_monthly_equiv, 2)}/mo equiv)
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <Users size={16} className="h-icon" /> Behavior & consumption
          </h2>
          <button type="button" className="sec sm" onClick={() => navigate(pathForTab('userfinancials'))}>
            User financials
          </button>
        </div>
        <div className="grid-3">
          <div className="stat">
            <div className="n">{loading ? '…' : (b?.users_with_chat ?? 0)}</div>
            <div className="l">Users with chat history</div>
            <div className="meta">Row presence (message depth not loaded)</div>
          </div>
          <div className="stat">
            <div className="n">{loading ? '…' : (b?.total_threads ?? 0)}</div>
            <div className="l">Thread rows</div>
            <div className="meta">{loading ? '…' : (b?.total_memories ?? 0)} memory rows</div>
          </div>
          <div className={`stat ${(b?.users_near_llm_limit || 0) > 0 ? 'coral' : ''}`}>
            <div className="n">{loading ? '…' : (b?.users_near_llm_limit ?? 0)}</div>
            <div className="l">Near LLM cost limit</div>
            <div className="meta">≥80% of plan cost quota in window</div>
          </div>
        </div>
        <p className="meta" style={{ marginTop: 14 }}>
          Approximate contribution: {loading ? '…' : moneyEur(k?.recognized_mrr_eur, 0)} MRR (EUR) vs{' '}
          {loading ? '…' : moneyUsd(k?.projected_llm_cost_usd_month, 2)} projected LLM month (USD) —
          currencies differ; treat as directional only.
          {b?.note ? ` ${b.note}` : ''}
        </p>
      </div>
    </>
  )
}
