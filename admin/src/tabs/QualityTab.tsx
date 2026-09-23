import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FlaskConical,
  MessageSquareWarning,
  RefreshCw,
  ThumbsDown,
} from 'lucide-react'
import { BarChart, SeriesChart } from '../components/InsightsCharts'
import { useAdmin } from '../context/AdminContext'
import { useFlashMessage } from '../components/ui'

type SeriesPoint = { date: string; value: number }

type ProposalBundle = {
  prompt_diff?: string | null
  rag_gap?: string | null
  product?: string | null
}

type BadItem = {
  id: string
  message_id?: string
  score?: number
  tags?: string[]
  summary?: string
  proposal?: string
  proposal_bundle?: ProposalBundle
  status?: string
  source?: string
  user_message?: string
  assistant_reply?: string
  lang?: string
  provider?: string
  admin_note?: string
}

type GoldenCase = {
  id: string
  ok?: boolean
  score?: number
  tags?: string[]
  expect_fail?: boolean
  missing_tags?: string[]
}

type QualityPayload = {
  ok?: boolean
  days?: number
  notes?: string[]
  migration_hint?: string | null
  health?: {
    score?: number
    confidence?: string
    sample_size?: number
    formula_note?: string
  }
  kpis?: {
    turns?: number
    thumbs_up?: number
    thumbs_down?: number
    rated?: number
    reviews?: number
    open_bad?: number
    auto_fail?: number
  }
  top_tags?: { tag: string; count: number }[]
  series?: { turns?: SeriesPoint[]; thumbs_down?: SeriesPoint[] }
  bad_queue?: BadItem[]
  proposals?: {
    review_id?: string
    message_id?: string
    score?: number
    tags?: string[]
    proposal?: string
    summary?: string
    prompt_diff?: string | null
    rag_gap?: string | null
    product?: string | null
  }[]
  golden?: {
    ok?: boolean
    passed?: number
    failed?: number
    total?: number
    cases?: GoldenCase[]
  }
}

function scoreClass(score: number | undefined) {
  if (score == null) return ''
  if (score >= 80) return 'green'
  if (score >= 60) return ''
  return 'coral'
}

export function QualityTab() {
  const { adminFetch } = useAdmin()
  const { show } = useFlashMessage()
  const [days, setDays] = useState(30)
  const [data, setData] = useState<QualityPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setErr(null)
    try {
      const d = (await adminFetch(`/admin/chat-quality?days=${days}`)) as QualityPayload
      setData(d)
    } catch (e) {
      setErr((e instanceof Error && e.message) || 'Failed to load quality dashboard')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [adminFetch, days])

  useEffect(() => {
    void load()
  }, [load])

  const setStatus = async (id: string, status: 'fixed' | 'dismissed' | 'open') => {
    setBusyId(id)
    try {
      await adminFetch(`/admin/chat-quality/reviews/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      show(status === 'fixed' ? 'Marked fixed.' : status === 'dismissed' ? 'Dismissed.' : 'Reopened.', 'ok')
      await load()
    } catch {
      show('Could not update review', 'err')
    } finally {
      setBusyId(null)
    }
  }

  const rejudge = async (id: string) => {
    setBusyId(id)
    try {
      await adminFetch(`/admin/chat-quality/reviews/${id}/rejudge`, { method: 'POST' })
      show('Re-judged with rules + LLM.', 'ok')
      await load()
    } catch {
      show('Rejudge failed', 'err')
    } finally {
      setBusyId(null)
    }
  }

  const exportPreferences = async () => {
    setExporting(true)
    try {
      const d = (await adminFetch(
        `/admin/chat-quality/preferences?days=${days}&limit=500`,
      )) as { pairs?: unknown[]; count?: number; note?: string }
      const blob = new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `heymaa-chat-preferences-${days}d.json`
      a.click()
      URL.revokeObjectURL(url)
      show(`Exported ${d.count ?? 0} preference pairs.`, 'ok')
    } catch {
      show('Export failed', 'err')
    } finally {
      setExporting(false)
    }
  }

  const h = data?.health
  const k = data?.kpis
  const g = data?.golden
  const tagBars =
    data?.top_tags?.map((t) => ({
      label: t.tag,
      value: t.count,
    })) || []

  return (
    <>
      <div className="card">
        <div className="card-head">
          <h2>
            <MessageSquareWarning size={16} className="h-icon" /> Chat quality
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
            <button type="button" className="sec sm" disabled={exporting} onClick={() => void exportPreferences()}>
              <Download size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              {exporting ? 'Exporting…' : 'Export prefs'}
            </button>
            <button type="button" className="sec sm" disabled={loading} onClick={() => void load()}>
              <RefreshCw size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
              {loading ? 'Loading…' : 'Refresh'}
            </button>
          </div>
        </div>
        <p className="card-desc">
          Full quality loop: thumbs, rule + LLM judge, bad-reply queue, golden regression, and
          preference export for later fine-tune. Prefer prompt/RAG fixes from proposals before
          training a custom model. Turns appear only after the SQL migration and new chats (not
          backfilled from older history).
        </p>
        {err ? <div className="msg err">{err}</div> : null}
        {data?.migration_hint ? <div className="msg err">{data.migration_hint}</div> : null}
        {data?.notes && data.notes.length > 0 ? (
          <div className="msg err">Notes: {data.notes.join(' · ')}</div>
        ) : null}
      </div>

      <div className="grid-3 insights-kpi-grid">
        <div className={`stat ${scoreClass(h?.score)}`}>
          <div className="n">{loading ? '…' : h?.score != null ? Math.round(h.score) : 0}</div>
          <div className="l">Health score / 100</div>
          <div className="meta">
            Confidence {loading ? '…' : (h?.confidence ?? 'low')} · sample{' '}
            {loading ? '…' : (h?.sample_size ?? 0)}
          </div>
        </div>
        <div className="stat teal">
          <div className="n">{loading ? '…' : (k?.turns ?? 0)}</div>
          <div className="l">Logged turns</div>
          <div className="meta">
            👍 {loading ? '…' : (k?.thumbs_up ?? 0)} · 👎 {loading ? '…' : (k?.thumbs_down ?? 0)}
          </div>
        </div>
        <div className={`stat ${(k?.open_bad || 0) > 0 ? 'coral' : 'green'}`}>
          <div className="n">{loading ? '…' : (k?.open_bad ?? 0)}</div>
          <div className="l">Open bad replies</div>
          <div className="meta">
            {loading ? '…' : (k?.auto_fail ?? 0)} scored &lt; 75 in window
          </div>
        </div>
        <div className={`stat ${g?.ok ? 'green' : 'coral'}`}>
          <div className="n">
            {loading ? '…' : `${g?.passed ?? 0}/${g?.total ?? 0}`}
          </div>
          <div className="l">Golden pack</div>
          <div className="meta">
            {loading
              ? '…'
              : g?.ok
                ? 'All regression cases pass'
                : `${g?.failed ?? 0} failing`}
          </div>
        </div>
      </div>

      <p className="meta" style={{ marginTop: -8, marginBottom: 16 }}>
        {h?.formula_note}
      </p>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>
              <ThumbsDown size={16} className="h-icon" /> Thumbs down / day
            </h2>
          </div>
          <SeriesChart
            series={data?.series?.thumbs_down || []}
            label="Thumbs down per day"
            color="#C45B28"
          />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>
              <MessageSquareWarning size={16} className="h-icon" /> Failure tags
            </h2>
          </div>
          <BarChart items={tagBars} label="Top failure tags" color="#C45B28" />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <FlaskConical size={16} className="h-icon" /> Golden regression
          </h2>
        </div>
        <p className="card-desc">
          Fixed cases (local find-a-doctor, medical boundary, language mix). Must stay green after
          prompt changes.
        </p>
        {!g?.cases?.length ? (
          <div className="meta">No golden results.</div>
        ) : (
          <div className="quality-golden-list">
            {g.cases.map((c) => (
              <div key={c.id} className={`quality-golden-row ${c.ok ? 'ok' : 'fail'}`}>
                <span className={`badge ${c.ok ? 'badge-ok' : 'badge-warn'}`}>{c.ok ? 'pass' : 'fail'}</span>
                <code>{c.id}</code>
                <span className="meta">score {c.score}</span>
                {(c.missing_tags || []).length > 0 ? (
                  <span className="meta">missing tags: {c.missing_tags?.join(', ')}</span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <AlertTriangle size={16} className="h-icon" /> Fix proposals
          </h2>
        </div>
        {!data?.proposals?.length ? (
          <div className="attention-empty">
            <CheckCircle2 size={16} />
            <div>No open proposals — keep collecting thumbs and turns.</div>
          </div>
        ) : (
          <ul className="quality-proposals">
            {data.proposals.map((p) => (
              <li key={p.review_id || p.message_id}>
                <div className="quality-proposal-score">Score {p.score ?? '—'}</div>
                <div className="quality-proposal-body">
                  <div className="quality-proposal-tags">
                    {(p.tags || []).map((t) => (
                      <span key={t} className="badge badge-warn">
                        {t}
                      </span>
                    ))}
                  </div>
                  <p>{p.proposal}</p>
                  {p.prompt_diff ? (
                    <p className="quality-fix-part">
                      <strong>Prompt:</strong> {p.prompt_diff}
                    </p>
                  ) : null}
                  {p.rag_gap ? (
                    <p className="quality-fix-part">
                      <strong>RAG gap:</strong> {p.rag_gap}
                    </p>
                  ) : null}
                  {p.product ? (
                    <p className="quality-fix-part">
                      <strong>Product:</strong> {p.product}
                    </p>
                  ) : null}
                  {p.summary ? <p className="meta">{p.summary}</p> : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>
            <ThumbsDown size={16} className="h-icon" /> Bad replies queue
          </h2>
        </div>
        {!data?.bad_queue?.length ? (
          <div className="attention-empty">
            <CheckCircle2 size={16} />
            <div>Queue empty.</div>
          </div>
        ) : (
          <div className="quality-queue">
            {data.bad_queue.map((row) => (
              <article key={row.id} className="quality-queue-item">
                <header>
                  <span className={`badge ${Number(row.score) < 50 ? 'badge-warn' : 'badge-muted'}`}>
                    {row.score}/100
                  </span>
                  <span className="meta">
                    {row.source} · {row.lang || '—'} · {row.provider || '—'}
                  </span>
                  <div className="quality-queue-actions">
                    <button
                      type="button"
                      className="sec sm"
                      disabled={busyId === row.id}
                      onClick={() => void rejudge(row.id)}
                    >
                      Rejudge
                    </button>
                    <button
                      type="button"
                      className="sec sm"
                      disabled={busyId === row.id}
                      onClick={() => void setStatus(row.id, 'fixed')}
                    >
                      Mark fixed
                    </button>
                    <button
                      type="button"
                      className="ghost sm"
                      disabled={busyId === row.id}
                      onClick={() => void setStatus(row.id, 'dismissed')}
                    >
                      Dismiss
                    </button>
                  </div>
                </header>
                <div className="quality-queue-tags">
                  {(row.tags || []).map((t) => (
                    <span key={t} className="badge badge-muted">
                      {t}
                    </span>
                  ))}
                </div>
                <div className="quality-turn">
                  <div>
                    <div className="l">User</div>
                    <p>{row.user_message || '—'}</p>
                  </div>
                  <div>
                    <div className="l">Assistant</div>
                    <p>{row.assistant_reply || '—'}</p>
                  </div>
                </div>
                {row.proposal ? (
                  <div className="quality-proposal-inline">
                    <strong>Proposal:</strong> {row.proposal}
                  </div>
                ) : null}
                {row.proposal_bundle?.prompt_diff ? (
                  <div className="quality-proposal-inline">
                    <strong>Prompt:</strong> {row.proposal_bundle.prompt_diff}
                  </div>
                ) : null}
                {row.proposal_bundle?.rag_gap ? (
                  <div className="quality-proposal-inline">
                    <strong>RAG:</strong> {row.proposal_bundle.rag_gap}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  )
}
