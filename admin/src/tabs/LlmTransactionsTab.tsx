/** Admin screen: per-call LLM cost ledger (llm_transactions). */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Receipt, RefreshCw, X } from 'lucide-react'
import { useSearchParams } from 'react-router-dom'
import { useAdmin } from '../context/AdminContext'
import { FieldLabel } from '../components/ui'

type LlmTx = {
  id: string
  created_at: string
  purpose?: string
  provider?: string
  model?: string | null
  ok?: boolean
  cost_usd?: number
  latency_ms?: number | null
  predict_time_ms?: number | null
  input_chars?: number | null
  output_chars?: number | null
  user_id?: string | null
  user_name?: string | null
  user_email?: string | null
  user_plan?: string | null
  user_label?: string | null
  request_id?: string | null
  error_kind?: string | null
  error_msg?: string | null
}

type TxResponse = {
  transactions: LlmTx[]
  total: number
  total_cost_usd: number
  ok_count: number
  fail_count: number
  limit: number
  offset: number
  table_ready?: boolean
  error?: string
  filter_user_id?: string | null
}

const PAGE_SIZE = 25

const PROVIDER_OPTIONS = [
  { value: '', label: 'All providers' },
  { value: 'replicate', label: 'Replicate' },
  { value: 'groq', label: 'Groq' },
  { value: 'gemini', label: 'Gemini' },
  { value: 'claude', label: 'Claude' },
  { value: 'gemini_embed', label: 'Gemini embed' },
]

const PURPOSE_OPTIONS = [
  { value: '', label: 'All purposes' },
  { value: 'chat', label: 'Chat' },
  { value: 'embed', label: 'Embed' },
]

function money(value: number | null | undefined, digits = 4) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  return `$${Number(value).toFixed(digits)}`
}

function shortId(id?: string | null) {
  if (!id) return '—'
  return id.length > 10 ? `${id.slice(0, 8)}…` : id
}

function formatWhen(iso?: string) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function userDisplay(r: LlmTx) {
  if (r.user_label) return r.user_label
  if (r.user_name) return r.user_name
  if (r.user_email) return r.user_email.split('@')[0]
  return r.user_id ? shortId(r.user_id) : '—'
}

export function LlmTransactionsTab() {
  const { adminFetch } = useAdmin()
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState<LlmTx[]>([])
  const [total, setTotal] = useState(0)
  const [totalCost, setTotalCost] = useState(0)
  const [okCount, setOkCount] = useState(0)
  const [failCount, setFailCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [tableReady, setTableReady] = useState(true)

  const [provider, setProvider] = useState('')
  const [purpose, setPurpose] = useState('')
  const [okFilter, setOkFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [page, setPage] = useState(1)
  const userIdFilter = (searchParams.get('user_id') || '').trim()

  useEffect(() => {
    setPage(1)
  }, [provider, purpose, okFilter, fromDate, toDate, userIdFilter])

  const queryString = useMemo(() => {
    const params = new URLSearchParams()
    if (provider) params.set('provider', provider)
    if (purpose) params.set('purpose', purpose)
    if (okFilter === '1') params.set('ok', 'true')
    if (okFilter === '0') params.set('ok', 'false')
    if (fromDate) params.set('from_date', fromDate)
    if (toDate) params.set('to_date', toDate)
    if (userIdFilter) params.set('user_id', userIdFilter)
    params.set('limit', String(PAGE_SIZE))
    params.set('offset', String((page - 1) * PAGE_SIZE))
    return `?${params.toString()}`
  }, [provider, purpose, okFilter, fromDate, toDate, userIdFilter, page])

  const load = useCallback(async () => {
    setLoading(true)
    setErr('')
    try {
      const d = (await adminFetch(`/admin/llm_transactions${queryString}`)) as TxResponse
      setRows(d.transactions || [])
      setTotal(d.total || 0)
      setTotalCost(Number(d.total_cost_usd || 0))
      setOkCount(d.ok_count || 0)
      setFailCount(d.fail_count || 0)
      setTableReady(d.table_ready !== false)
      if (d.error) setErr(String(d.error))
    } catch (e) {
      setErr((e instanceof Error && e.message) || 'Failed to load transactions')
      setRows([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, queryString])

  useEffect(() => {
    void load()
  }, [load])

  const clearUserFilter = () => {
    const next = new URLSearchParams(searchParams)
    next.delete('user_id')
    setSearchParams(next, { replace: true })
  }

  const filteredUserLabel = useMemo(() => {
    if (!userIdFilter) return ''
    const hit = rows.find((r) => r.user_id === userIdFilter)
    if (hit) return userDisplay(hit)
    return shortId(userIdFilter)
  }, [userIdFilter, rows])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <>
      <div className="grid-3">
        <div className="stat teal">
          <div className="n">{total}</div>
          <div className="l">Total transactions</div>
        </div>
        <div className="stat coral">
          <div className="n">{money(totalCost, 4)}</div>
          <div className="l">Total cost (filtered)</div>
        </div>
        <div className="stat green">
          <div className="n">
            {okCount}
            <span style={{ fontSize: 14, color: 'var(--muted)', fontWeight: 500 }}> / {failCount} fail</span>
          </div>
          <div className="l">Successful calls</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <Receipt size={16} className="h-icon" /> LLM transactions
          </h2>
          <button type="button" className="sec sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
            Refresh
          </button>
        </div>
        <p className="card-desc">
          One row per API call via LLMWrapper — chat and embeddings. Costs are estimates from the
          configured model rates.
        </p>

        {!tableReady && (
          <div className="msg err">
            Table <code>llm_transactions</code> is missing. Run{' '}
            <code>backend/migrations/llm_transactions.sql</code> in the Supabase SQL editor.
          </div>
        )}
        {err && tableReady ? <div className="msg err">{err}</div> : null}

        {userIdFilter ? (
          <div className="msg" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <span>
              Filtered to user <strong>{filteredUserLabel}</strong>
              {rows[0]?.user_email ? ` (${rows[0].user_email})` : ''}
            </span>
            <button type="button" className="ghost sm" onClick={clearUserFilter}>
              <X size={12} style={{ verticalAlign: -1, marginRight: 4 }} />
              Clear
            </button>
          </div>
        ) : null}

        <div className="filters-row" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
          <div className="field-wrap" style={{ minWidth: 140 }}>
            <FieldLabel>Provider</FieldLabel>
            <select value={provider} onChange={(e) => setProvider(e.target.value)}>
              {PROVIDER_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-wrap" style={{ minWidth: 120 }}>
            <FieldLabel>Purpose</FieldLabel>
            <select value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              {PURPOSE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field-wrap" style={{ minWidth: 120 }}>
            <FieldLabel>Status</FieldLabel>
            <select value={okFilter} onChange={(e) => setOkFilter(e.target.value)}>
              <option value="">All</option>
              <option value="1">OK</option>
              <option value="0">Failed</option>
            </select>
          </div>
          <div className="field-wrap" style={{ minWidth: 140 }}>
            <FieldLabel>From</FieldLabel>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="field-wrap" style={{ minWidth: 140 }}>
            <FieldLabel>To</FieldLabel>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>When</th>
                <th>User</th>
                <th>Purpose</th>
                <th>Provider</th>
                <th>Model</th>
                <th>OK</th>
                <th>Cost</th>
                <th>Latency</th>
                <th>Tx</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={9} className="muted">
                    Loading…
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={9} className="muted">
                    No transactions yet.
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatWhen(r.created_at)}</td>
                    <td title={r.user_email || r.user_id || ''}>
                      <div style={{ fontWeight: 600 }}>{userDisplay(r)}</div>
                      {r.user_email ? (
                        <div className="muted" style={{ fontSize: 11 }}>
                          {r.user_email}
                        </div>
                      ) : null}
                      {r.user_plan ? (
                        <div className="muted" style={{ fontSize: 11, textTransform: 'capitalize' }}>
                          {r.user_plan}
                        </div>
                      ) : null}
                    </td>
                    <td>{r.purpose || '—'}</td>
                    <td>{r.provider || '—'}</td>
                    <td title={r.model || ''} style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {r.model || '—'}
                    </td>
                    <td>
                      <span className={`badge ${r.ok ? '' : 'warn'}`} style={{ background: r.ok ? '#2D9E6B' : '#C45B28' }}>
                        {r.ok ? 'ok' : 'fail'}
                      </span>
                    </td>
                    <td>{money(r.cost_usd)}</td>
                    <td>{r.latency_ms != null ? `${Math.round(r.latency_ms)}ms` : '—'}</td>
                    <td title={r.id}>{shortId(r.id)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        <div className="pager" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 12, gap: 8 }}>
          <span className="muted" style={{ fontSize: 12 }}>
            {total === 0 ? '0' : `${rangeStart}–${rangeEnd}`} of {total}
          </span>
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              type="button"
              className="ghost sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <ChevronUp size={14} style={{ transform: 'rotate(-90deg)', verticalAlign: -2 }} /> Prev
            </button>
            <span className="muted" style={{ fontSize: 12, alignSelf: 'center' }}>
              {page} / {totalPages}
            </span>
            <button
              type="button"
              className="ghost sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Next <ChevronDown size={14} style={{ transform: 'rotate(-90deg)', verticalAlign: -2 }} />
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
