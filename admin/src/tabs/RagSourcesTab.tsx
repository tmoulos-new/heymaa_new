import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  BookOpen,
  ExternalLink,
  FileUp,
  Globe,
  Link2,
  Pencil,
  RefreshCw,
  Sprout,
  Trash2,
  Upload,
  X,
} from 'lucide-react'
import { FieldLabel, useFlashMessage } from '../components/ui'
import { useAdmin } from '../context/AdminContext'
import { apiDetail, getApiBase } from '../lib/api'
import type { RagSourceRow } from '../lib/types'

function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="rag-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <h2 id="rag-modal-title">{title}</h2>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  )
}

function statusBadge(status?: string) {
  const s = (status || '').toLowerCase()
  if (s === 'ready') return 'badge badge-ok'
  if (s === 'processing') return 'badge badge-warn'
  if (s === 'error') return 'badge badge-err'
  return 'badge badge-muted'
}

function formatDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}

function formatDateShort(iso?: string | null) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}

function isHttpUrl(value?: string | null) {
  const v = (value || '').trim()
  return /^https?:\/\//i.test(v)
}

function sourceKind(row: RagSourceRow): { label: string; hint: string } {
  const type = (row.source_type || '').toLowerCase()
  const origin = (row.origin || '').trim()
  if (type === 'url' || isHttpUrl(origin)) {
    return { label: 'URL', hint: 'Fetched from the web' }
  }
  if (type === 'text' || type === 'pdf' || type === 'markdown' || type === 'file') {
    return { label: 'File', hint: 'Uploaded document' }
  }
  if (type) return { label: type, hint: 'Knowledge source' }
  if (isHttpUrl(origin)) return { label: 'URL', hint: 'Fetched from the web' }
  return { label: 'File', hint: 'Uploaded document' }
}

function shortUrl(url: string, max = 48) {
  try {
    const u = new URL(url)
    const path = `${u.hostname}${u.pathname}`.replace(/\/$/, '')
    return path.length > max ? `${path.slice(0, max - 1)}…` : path
  } catch {
    return url.length > max ? `${url.slice(0, max - 1)}…` : url
  }
}

function siteKey(row: RagSourceRow): string {
  const key = (row.source_key || '').trim().toLowerCase()
  if (key) return key
  const origin = (row.origin || '').trim()
  if (isHttpUrl(origin)) {
    try {
      return new URL(origin).hostname.replace(/^www\./i, '').toLowerCase()
    } catch {
      /* fall through */
    }
  }
  return sourceKind(row).label === 'File' ? 'file' : 'other'
}

function siteLabel(key: string): string {
  if (key === 'babyspace') return 'Babyspace'
  if (key === 'myparenthood') return 'My Parenthood'
  if (key === 'file') return 'Uploaded files'
  if (key === 'other') return 'Other'
  return key
}

const PRESET_SEEDS: {
  key: string
  name: string
  blurb: string
  sinceYears?: number
}[] = [
  {
    key: 'babyspace',
    name: 'Babyspace',
    blurb: 'Greek parenting articles. Sync finds new pages; auto-maintenance repairs empty/error rows.',
    sinceYears: 5,
  },
  {
    key: 'myparenthood',
    name: 'My Parenthood',
    blurb: 'From their post sitemap. Sync skips healthy pages; broken rows are fixed automatically.',
  },
]

type SeedJobPublic = {
  id: string
  source_key: string
  status: string
  mode?: string
  discovered?: number
  queued?: number
  ingested?: number
  skipped?: number
  failed?: number
  discover_page?: number
  max_discover_pages?: number
  discover_done?: boolean
  cursor_idx?: number
  last_error?: string | null
  done?: boolean
}

type RagHealth = {
  ok?: boolean
  sources?: number
  ready?: number
  processing?: number
  error?: number
  empty_chunks?: number
  broken?: number
  chunks?: number
  urls?: number
  files?: number
  by_source_key?: Record<
    string,
    { sources: number; ready: number; error: number; empty_chunks: number; broken: number }
  >
  active_job?: SeedJobPublic | null
  auto?: {
    rebuild_empty_hours?: number
    add_new_hours?: number
    maintained_keys?: string[]
  }
}


export function RagSourcesTab() {
  const { adminFetch, token } = useAdmin()
  const { show, Message } = useFlashMessage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rechunkInputRef = useRef<HTMLInputElement>(null)

  const [sources, setSources] = useState<RagSourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [urlInput, setUrlInput] = useState('')
  const [urlTitle, setUrlTitle] = useState('')
  const [urlIngesting, setUrlIngesting] = useState(false)
  const [seedingKey, setSeedingKey] = useState<string | null>(null)
  const [seedJob, setSeedJob] = useState<SeedJobPublic | null>(null)
  const seedAbortRef = useRef(false)

  const [siteName, setSiteName] = useState('')
  const [siteBaseUrl, setSiteBaseUrl] = useState('')
  const [siteSitemap, setSiteSitemap] = useState('')
  const [siteRss, setSiteRss] = useState('')
  const [siteMax, setSiteMax] = useState('20')
  const [siteSeeding, setSiteSeeding] = useState(false)

  const [filterQ, setFilterQ] = useState('')
  const [filterKind, setFilterKind] = useState<'all' | 'URL' | 'File'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'processing' | 'error' | 'broken'>('all')
  const [filterSite, setFilterSite] = useState('all')
  const [libraryPage, setLibraryPage] = useState(1)
  const LIBRARY_PAGE_SIZE = 10
  const [showAddPanel, setShowAddPanel] = useState(false)
  const [health, setHealth] = useState<RagHealth | null>(null)
  const [maintaining, setMaintaining] = useState(false)

  const [editRow, setEditRow] = useState<RagSourceRow | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteTarget, setDeleteTarget] = useState<RagSourceRow | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [rechunkTarget, setRechunkTarget] = useState<RagSourceRow | null>(null)
  const [rechunking, setRechunking] = useState(false)
  const apiBase = getApiBase()

  const loadSources = useCallback(async () => {
    setLoading(true)
    setErr(false)
    try {
      const [d, h] = await Promise.all([
        adminFetch('/admin/rag_sources'),
        adminFetch('/admin/rag_sources/health').catch(() => null),
      ])
      setSources((d.sources as RagSourceRow[]) || [])
      if (h && typeof h === 'object') {
        setHealth(h as RagHealth)
        const active = (h as RagHealth).active_job
        if (active && !active.done) setSeedJob(active)
      }
      if (d.error) show(String(d.error), 'err')
    } catch {
      setErr(true)
      setSources([])
    } finally {
      setLoading(false)
    }
  }, [adminFetch, show])

  useEffect(() => {
    void loadSources()
  }, [loadSources])

  // While a job is active, poll + nudge ticks (cron also advances in production).
  useEffect(() => {
    if (!seedJob?.id || seedJob.done) return
    let cancelled = false
    const pulse = async () => {
      if (cancelled || seedAbortRef.current) return
      try {
        await adminFetch(`/admin/rag_sources/seed_jobs/${seedJob.id}/tick`, { method: 'POST' })
        const got = await adminFetch(`/admin/rag_sources/seed_jobs/${seedJob.id}`)
        const job = (got.job || got) as SeedJobPublic
        if (cancelled) return
        setSeedJob(job)
        if (job.done) {
          void loadSources()
          if (job.status === 'completed') {
            show(
              job.mode === 'rebuild_empty'
                ? `Rebuild done — ${job.ingested || 0} rebuilt, ${job.skipped || 0} skipped`
                : `Sync done — ${job.ingested || 0} new, ${job.skipped || 0} skipped`,
              'ok',
            )
          } else if (job.status === 'failed') {
            show(job.last_error || 'Seed job failed', 'err')
          }
        }
      } catch {
        /* cron may still advance; ignore transient errors */
      }
    }
    const id = window.setInterval(() => void pulse(), 2500)
    void pulse()
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [seedJob?.id, seedJob?.done, seedJob?.mode, adminFetch, loadSources, show])

  const siteOptions = useMemo(() => {
    const keys = new Set<string>()
    for (const row of sources) keys.add(siteKey(row))
    return Array.from(keys).sort((a, b) => siteLabel(a).localeCompare(siteLabel(b)))
  }, [sources])

  const filteredSources = useMemo(() => {
    const q = filterQ.trim().toLowerCase()
    const rows = sources.filter((row) => {
      const kind = sourceKind(row).label
      if (filterKind !== 'all' && kind !== filterKind) return false
      const st = (row.status || '').toLowerCase()
      const chunks = Number(row.chunk_count ?? row.chunks_live ?? 0)
      const broken = st === 'error' || chunks < 1
      if (filterStatus === 'broken') {
        if (!broken) return false
      } else if (filterStatus !== 'all' && st !== filterStatus) {
        return false
      }
      if (filterSite !== 'all' && siteKey(row) !== filterSite) return false
      if (!q) return true
      const hay = `${row.title || ''} ${row.origin || ''} ${row.source_key || ''}`.toLowerCase()
      return hay.includes(q)
    })
    // Broken first so attention items aren't buried
    return rows.sort((a, b) => {
      const ab =
        (a.status || '').toLowerCase() === 'error' || Number(a.chunk_count ?? a.chunks_live ?? 0) < 1
          ? 0
          : 1
      const bb =
        (b.status || '').toLowerCase() === 'error' || Number(b.chunk_count ?? b.chunks_live ?? 0) < 1
          ? 0
          : 1
      return ab - bb
    })
  }, [sources, filterQ, filterKind, filterStatus, filterSite])

  const libraryTotalPages = Math.max(1, Math.ceil(filteredSources.length / LIBRARY_PAGE_SIZE))

  useEffect(() => {
    setLibraryPage(1)
  }, [filterQ, filterKind, filterStatus, filterSite])

  useEffect(() => {
    setLibraryPage((p) => Math.min(p, libraryTotalPages))
  }, [libraryTotalPages])

  const pagedSources = useMemo(() => {
    const start = (libraryPage - 1) * LIBRARY_PAGE_SIZE
    return filteredSources.slice(start, start + LIBRARY_PAGE_SIZE)
  }, [filteredSources, libraryPage])

  const libraryRangeStart =
    filteredSources.length === 0 ? 0 : (libraryPage - 1) * LIBRARY_PAGE_SIZE + 1
  const libraryRangeEnd = Math.min(libraryPage * LIBRARY_PAGE_SIZE, filteredSources.length)

  const filtersActive =
    filterQ.trim() !== '' || filterKind !== 'all' || filterStatus !== 'all' || filterSite !== 'all'

  // Unfiltered totals — used when health API is unavailable. Never use filtered stats
  // for the health tiles (clicking a filter was rewriting those numbers).
  const globalStats = useMemo(() => {
    let chunks = 0
    let ready = 0
    let errors = 0
    let broken = 0
    for (const row of sources) {
      const n = Number(row.chunk_count ?? row.chunks_live ?? 0)
      chunks += n
      const st = (row.status || '').toLowerCase()
      if (st === 'ready') ready += 1
      if (st === 'error') errors += 1
      if (st === 'error' || n < 1) broken += 1
    }
    return { sources: sources.length, chunks, ready, errors, broken }
  }, [sources])

  const healthView = {
    sources: health?.sources ?? globalStats.sources,
    ready: health?.ready ?? globalStats.ready,
    broken: health?.broken ?? globalStats.broken,
    chunks: health?.chunks ?? globalStats.chunks,
    error: health?.error ?? globalStats.errors,
  }

  const applyLibraryFilter = (next: typeof filterStatus) => {
    setFilterStatus(next)
    setLibraryPage(1)
    const el = document.getElementById('rag-library')
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const uploadSource = async () => {
    if (!uploadFile) {
      show('Choose a .txt, .md, or .pdf file', 'err')
      return
    }
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', uploadFile)
      if (uploadTitle.trim()) fd.append('title', uploadTitle.trim())
      const r = await fetch(`${apiBase}/admin/rag_sources/upload`, {
        method: 'POST',
        headers: { 'x-token': token },
        body: fd,
      })
      let d: Record<string, unknown> = {}
      try {
        d = (await r.json()) as Record<string, unknown>
      } catch {
        /* empty */
      }
      if (!r.ok) throw new Error(apiDetail(d) || `HTTP ${r.status}`)
      const chunks = Number(d.chunk_count || 0)
      const total = Number(d.chunk_total || chunks)
      if (chunks < 1) {
        const errs = Array.isArray(d.errors) ? d.errors.join('; ') : ''
        throw new Error(errs || 'Upload succeeded but no chunks were created. Check GEMINI_API_KEY.')
      }
      show(`Uploaded — ${chunks}/${total} chunks created`, 'ok')
      setUploadFile(null)
      setUploadTitle('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await loadSources()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Upload failed', 'err')
    } finally {
      setUploading(false)
    }
  }

  const ingestUrl = async () => {
    const url = urlInput.trim()
    if (!url) {
      show('Enter a URL to ingest', 'err')
      return
    }
    setUrlIngesting(true)
    try {
      const d = await adminFetch('/admin/rag_sources/ingest_url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          title: urlTitle.trim() || undefined,
        }),
      })
      const chunks = Number(d.chunk_count || 0)
      if (chunks < 1) throw new Error('URL ingested but no chunks were created')
      show(`URL ingested — ${chunks} chunks`, 'ok')
      setUrlInput('')
      setUrlTitle('')
      await loadSources()
    } catch (e) {
      show(e instanceof Error ? e.message : 'URL ingest failed', 'err')
    } finally {
      setUrlIngesting(false)
    }
  }

  const seedSite = async (
    sourceKey: string,
    label: string,
    opts?: { sinceYears?: number; mode?: 'add_new' | 'rebuild_empty' },
  ) => {
    const mode = opts?.mode || 'add_new'
    setSeedingKey(sourceKey)
    seedAbortRef.current = false
    try {
      const created = await adminFetch('/admin/rag_sources/seed_jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_key: sourceKey,
          since_years: opts?.sinceYears ?? (sourceKey === 'babyspace' ? 5 : undefined),
          batch_size: 5,
          mode,
        }),
      })
      const job0 = (created.job || created) as SeedJobPublic
      setSeedJob(job0)
      if (mode === 'rebuild_empty' && (job0.queued || 0) < 1) {
        show(`${label}: nothing to rebuild`, 'ok')
        setSeedingKey(null)
        await loadSources()
        return
      }
      show(
        mode === 'rebuild_empty'
          ? `${label}: rebuilding ${job0.queued ?? 0} broken URLs in the background…`
          : `${label}: syncing new pages in the background…`,
        'ok',
      )
      // Polling effect advances the job; cron does too if the tab closes.
    } catch (e) {
      show(e instanceof Error ? e.message : `Seed ${label} failed`, 'err')
    } finally {
      setSeedingKey(null)
    }
  }

  const cancelSeedJob = async () => {
    seedAbortRef.current = true
    if (!seedJob?.id || seedJob.done) return
    try {
      const cancelled = await adminFetch(`/admin/rag_sources/seed_jobs/${seedJob.id}/cancel`, {
        method: 'POST',
      })
      setSeedJob((cancelled.job || cancelled) as SeedJobPublic)
      show('Job cancelled', 'ok')
    } catch (e) {
      show(e instanceof Error ? e.message : 'Cancel failed', 'err')
    }
  }

  const runMaintenanceNow = async () => {
    setMaintaining(true)
    try {
      const d = await adminFetch('/admin/rag_sources/cron_tick?max_ticks=10&enqueue=true', {
        method: 'POST',
      })
      if (d.skipped) {
        show('Auto-maintenance is disabled on the server', 'err')
      } else if (d.enqueued) {
        setSeedJob(d.enqueued as SeedJobPublic)
        show(
          `Queued ${(d.enqueued as SeedJobPublic).mode === 'rebuild_empty' ? 'rebuild' : 'sync'} for ${(d.enqueued as SeedJobPublic).source_key}`,
          'ok',
        )
      } else if (d.job) {
        setSeedJob(d.job as SeedJobPublic)
        show(`Advanced job (${d.ticks || 0} ticks)`, 'ok')
      } else {
        show('Library is healthy — nothing to enqueue', 'ok')
      }
      await loadSources()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Maintenance failed', 'err')
    } finally {
      setMaintaining(false)
    }
  }

  const seedCustomWebsite = async () => {
    const base = siteBaseUrl.trim()
    if (!base) {
      show('Enter a website base URL (e.g. https://example.com/blog/)', 'err')
      return
    }
    setSiteSeeding(true)
    try {
      const maxUrls = Math.max(1, Math.min(Number(siteMax) || 20, 50))
      const d = await adminFetch('/admin/rag_sources/seed_website', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_url: base,
          name: siteName.trim() || undefined,
          sitemap_url: siteSitemap.trim() || undefined,
          rss_url: siteRss.trim() || undefined,
          max_urls: maxUrls,
          language: 'el',
        }),
      })
      show(
        `Seeded ${d.name || 'website'} — ${d.ingested}/${d.total} pages (${d.discovered} discovered)`,
        'ok',
      )
      setSiteName('')
      setSiteBaseUrl('')
      setSiteSitemap('')
      setSiteRss('')
      await loadSources()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Website seed failed', 'err')
    } finally {
      setSiteSeeding(false)
    }
  }

  const saveTitle = async () => {
    if (!editRow) return
    const title = editTitle.trim()
    if (!title) {
      show('Title is required', 'err')
      return
    }
    setSaving(true)
    try {
      await adminFetch(`/admin/rag_sources/${editRow.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      })
      show('Title updated', 'ok')
      setEditRow(null)
      await loadSources()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Update failed', 'err')
    } finally {
      setSaving(false)
    }
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await adminFetch(`/admin/rag_sources/${deleteTarget.id}`, { method: 'DELETE' })
      show('Source deleted', 'ok')
      setDeleteTarget(null)
      await loadSources()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Delete failed', 'err')
    } finally {
      setDeleting(false)
    }
  }

  const runRechunk = async (file: File) => {
    if (!rechunkTarget) return
    setRechunking(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${apiBase}/admin/rag_sources/${rechunkTarget.id}/rechunk`, {
        method: 'POST',
        headers: { 'x-token': token },
        body: fd,
      })
      let d: Record<string, unknown> = {}
      try {
        d = (await r.json()) as Record<string, unknown>
      } catch {
        /* empty */
      }
      if (!r.ok) throw new Error(apiDetail(d) || `HTTP ${r.status}`)
      const chunks = Number(d.chunk_count || 0)
      if (chunks < 1) {
        const errs = Array.isArray(d.errors) ? d.errors.join('; ') : ''
        throw new Error(errs || 'Rebuild finished but no chunks were created. Check GEMINI_API_KEY.')
      }
      show(`Rebuilt — ${chunks} chunks`, 'ok')
      setRechunkTarget(null)
      await loadSources()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Rechunk failed', 'err')
    } finally {
      setRechunking(false)
      if (rechunkInputRef.current) rechunkInputRef.current.value = ''
    }
  }

  const rebuildOneSource = async (row: RagSourceRow) => {
    const origin = (row.origin || '').trim()
    if (isHttpUrl(origin)) {
      setRechunking(true)
      try {
        const d = await adminFetch('/admin/rag_sources/ingest_url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: origin,
            title: row.title || undefined,
            source_key: row.source_key || undefined,
          }),
        })
        const chunks = Number(d.chunk_count || 0)
        if (chunks < 1) throw new Error('URL rebuild finished but no chunks were created')
        show(`Rebuilt URL — ${chunks} chunks`, 'ok')
        await loadSources()
      } catch (e) {
        show(e instanceof Error ? e.message : 'URL rebuild failed', 'err')
      } finally {
        setRechunking(false)
      }
      return
    }
    setRechunkTarget(row)
    rechunkInputRef.current?.click()
  }

  return (
    <>
      {Message}
      <div className="card">
        <div className="card-head">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <BookOpen size={18} />
              Knowledge library
            </h2>
            <p className="card-desc" style={{ margin: '6px 0 0' }}>
              Chat retrieves chunks from these sources. Health is global (not filtered). Sync and
              repair can run in the background — you do not need to keep this tab open.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="sec sm"
              onClick={() => void runMaintenanceNow()}
              disabled={maintaining || seedingKey !== null}
              title="Enqueue rebuild/sync if needed and advance the active job"
            >
              <Sprout size={14} />
              {maintaining ? 'Running…' : 'Run maintenance'}
            </button>
            <button type="button" className="sec sm" onClick={() => void loadSources()} disabled={loading}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
        </div>

        <div className="rag-stats rag-health-stats" aria-label="Library health">
          <button
            type="button"
            className={`rag-stat rag-stat-btn${filterStatus === 'all' ? ' is-active' : ''}`}
            title="Show all sources in the library below"
            onClick={() => applyLibraryFilter('all')}
          >
            <span className="rag-stat-value">{healthView.sources}</span>
            <span className="rag-stat-label">Sources</span>
          </button>
          <button
            type="button"
            className={`rag-stat rag-stat-btn${filterStatus === 'ready' ? ' is-active' : ''}`}
            title="Filter library to ready sources"
            onClick={() => applyLibraryFilter('ready')}
          >
            <span className="rag-stat-value">{healthView.ready}</span>
            <span className="rag-stat-label">Ready</span>
          </button>
          <button
            type="button"
            className={`rag-stat rag-stat-btn${healthView.broken > 0 ? ' is-warn' : ''}${filterStatus === 'broken' ? ' is-active' : ''}`}
            title="Filter library to sources with errors or 0 chunks"
            onClick={() => applyLibraryFilter('broken')}
          >
            <span className="rag-stat-value">{healthView.broken}</span>
            <span className="rag-stat-label">Needs attention</span>
          </button>
          <div className="rag-stat" title="Total chunks stored in the knowledge base (no row cap)">
            <span className="rag-stat-value">{healthView.chunks}</span>
            <span className="rag-stat-label">Chunks</span>
          </div>
          <div className="rag-stat" title="Sources currently in error status">
            <span className="rag-stat-value">{healthView.error}</span>
            <span className="rag-stat-label">Errors</span>
          </div>
        </div>

        <p className="muted" style={{ margin: '8px 0 0', fontSize: 12, lineHeight: 1.4 }}>
          Sources / Ready / Needs attention filter the library list below — totals above stay global.
        </p>

        <p className="muted" style={{ margin: '10px 0 0', fontSize: 12.5, lineHeight: 1.45 }}>
          Auto-maintenance (Vercel cron every 5 min): repairs empty/error URLs daily, syncs new pages
          about every 3 days for Babyspace & My Parenthood, and advances any active job. Set{' '}
          <code>CRON_SECRET</code> in production; disable with <code>RAG_AUTO_MAINTENANCE=0</code>.
        </p>
      </div>

      {(health?.broken || 0) > 0 ? (
        <div className="card rag-attention-card">
          <div className="card-head">
            <div>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                <AlertTriangle size={16} />
                Needs attention
              </h2>
              <p className="card-desc" style={{ margin: '6px 0 0' }}>
                {health?.broken} source{(health?.broken || 0) === 1 ? '' : 's'} with status Error or 0
                chunks. Auto-repair runs daily; you can also fix now.
              </p>
            </div>
            <button
              type="button"
              className="teal sm"
              disabled={seedingKey !== null || Boolean(seedJob && !seedJob.done)}
              onClick={() => {
                const key =
                  (health?.by_source_key &&
                    Object.entries(health.by_source_key).sort(
                      (a, b) => (b[1].broken || 0) - (a[1].broken || 0),
                    )[0]?.[0]) ||
                  'babyspace'
                const site = PRESET_SEEDS.find((s) => s.key === key) || PRESET_SEEDS[0]
                void seedSite(site.key, site.name, {
                  sinceYears: site.sinceYears,
                  mode: 'rebuild_empty',
                })
              }}
            >
              Fix broken now
            </button>
          </div>
        </div>
      ) : null}

      {seedJob && !seedJob.done ? (
        <div className="card rag-seed-progress-card" aria-live="polite">
          <strong>
            Background job · {seedJob.status}
            {seedJob.mode === 'rebuild_empty' ? ' · rebuild' : ' · sync new'}
            {seedJob.source_key ? ` · ${seedJob.source_key}` : ''}
          </strong>
          <span>
            Queued {seedJob.discovered ?? seedJob.queued ?? 0} · ingested {seedJob.ingested ?? 0} ·
            skipped {seedJob.skipped ?? 0} · failed {seedJob.failed ?? 0}
            {seedJob.status === 'running'
              ? ` · cursor ${seedJob.cursor_idx ?? 0}/${seedJob.queued ?? seedJob.discovered ?? 0}`
              : ''}
          </span>
          <span className="muted" style={{ fontSize: 12 }}>
            Safe to leave this page — cron keeps ticking every 5 minutes while the job is active.
          </span>
          {seedJob.last_error ? (
            <span
              className={
                /404|410|dead link|not found/i.test(seedJob.last_error)
                  ? 'rag-seed-progress-note'
                  : 'rag-seed-progress-err'
              }
            >
              {seedJob.last_error}
            </span>
          ) : null}
          <div>
            <button type="button" className="ghost sm" onClick={() => void cancelSeedJob()}>
              Cancel job
            </button>
          </div>
        </div>
      ) : null}

      <section className="card rag-seed-panel">
        <div className="rag-add-head">
          <span className="rag-add-icon" aria-hidden>
            <Sprout size={18} />
          </span>
          <div>
            <h2>Site sync</h2>
            <p className="card-desc" style={{ marginBottom: 0 }}>
              One primary action per site. Sync only adds new pages; repair is automatic (or use Fix
              broken above).
            </p>
          </div>
        </div>

        <div className="rag-seed-presets">
          <div className="rag-seed-preset-grid">
            {PRESET_SEEDS.map((site) => {
              const siteHealth = health?.by_source_key?.[site.key]
              return (
                <div key={site.key} className="rag-seed-preset">
                  <strong>{site.name}</strong>
                  <p>{site.blurb}</p>
                  {siteHealth ? (
                    <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                      {siteHealth.sources} sources · {siteHealth.broken} broken
                    </p>
                  ) : null}
                  <div className="rag-seed-preset-actions">
                    <button
                      type="button"
                      className="sec"
                      onClick={() =>
                        void seedSite(site.key, site.name, {
                          sinceYears: site.sinceYears,
                          mode: 'add_new',
                        })
                      }
                      disabled={seedingKey !== null || Boolean(seedJob && !seedJob.done)}
                    >
                      <Sprout size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                      {seedingKey === site.key ? 'Starting…' : 'Sync new pages'}
                    </button>
                    {(siteHealth?.broken || 0) > 0 ? (
                      <button
                        type="button"
                        className="ghost sm"
                        onClick={() =>
                          void seedSite(site.key, site.name, {
                            sinceYears: site.sinceYears,
                            mode: 'rebuild_empty',
                          })
                        }
                        disabled={seedingKey !== null || Boolean(seedJob && !seedJob.done)}
                      >
                        Fix {siteHealth?.broken} broken
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <div className="card">
        <button
          type="button"
          className="rag-collapse-toggle"
          onClick={() => setShowAddPanel((v) => !v)}
          aria-expanded={showAddPanel}
        >
          <span>{showAddPanel ? '▼' : '▶'} Add a source manually</span>
          <span className="muted">Upload file · one URL · custom website</span>
        </button>
        {showAddPanel ? (
          <>
            <div className="rag-add-grid" style={{ marginTop: 14 }}>
              <section className="rag-add-card rag-add-card--flat">
                <div className="rag-add-head">
                  <span className="rag-add-icon" aria-hidden>
                    <FileUp size={18} />
                  </span>
                  <div>
                    <h2>Upload a document</h2>
                  </div>
                </div>
                <div className="field">
                  <FieldLabel>Title (optional)</FieldLabel>
                  <input
                    value={uploadTitle}
                    onChange={(e) => setUploadTitle(e.target.value)}
                    placeholder="e.g. Pregnancy Guide"
                  />
                </div>
                <div className="field">
                  <FieldLabel>File (.txt, .md, .pdf)</FieldLabel>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,.md,.markdown,.pdf,text/plain,application/pdf"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                  />
                </div>
                <button
                  type="button"
                  className="teal"
                  onClick={() => void uploadSource()}
                  disabled={uploading || !uploadFile}
                >
                  <Upload size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  {uploading ? 'Uploading…' : 'Upload'}
                </button>
              </section>

              <section className="rag-add-card rag-add-card--flat">
                <div className="rag-add-head">
                  <span className="rag-add-icon" aria-hidden>
                    <Link2 size={18} />
                  </span>
                  <div>
                    <h2>Ingest one URL</h2>
                  </div>
                </div>
                <div className="field">
                  <FieldLabel>URL</FieldLabel>
                  <input
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    placeholder="https://…"
                  />
                </div>
                <div className="field">
                  <FieldLabel>Title (optional)</FieldLabel>
                  <input
                    value={urlTitle}
                    onChange={(e) => setUrlTitle(e.target.value)}
                    placeholder="Optional title"
                  />
                </div>
                <button
                  type="button"
                  className="teal"
                  onClick={() => void ingestUrl()}
                  disabled={urlIngesting || !urlInput.trim()}
                >
                  <Globe size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                  {urlIngesting ? 'Ingesting…' : 'Ingest URL'}
                </button>
              </section>
            </div>

            <div className="rag-seed-custom" style={{ marginTop: 16 }}>
              <div className="rag-seed-presets-label">Custom website</div>
              <div className="rag-seed-custom-grid">
                <div className="field">
                  <FieldLabel>Display name (optional)</FieldLabel>
                  <input
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="e.g. Parenting Tips Blog"
                  />
                </div>
                <div className="field">
                  <FieldLabel>Base URL</FieldLabel>
                  <input
                    value={siteBaseUrl}
                    onChange={(e) => setSiteBaseUrl(e.target.value)}
                    placeholder="https://example.com/blog/"
                  />
                </div>
                <div className="field">
                  <FieldLabel>Sitemap URL (optional)</FieldLabel>
                  <input
                    value={siteSitemap}
                    onChange={(e) => setSiteSitemap(e.target.value)}
                    placeholder="https://example.com/post-sitemap.xml"
                  />
                </div>
                <div className="field">
                  <FieldLabel>RSS / Atom URL (optional)</FieldLabel>
                  <input
                    value={siteRss}
                    onChange={(e) => setSiteRss(e.target.value)}
                    placeholder="https://example.com/feed"
                  />
                </div>
                <div className="field">
                  <FieldLabel>Max pages</FieldLabel>
                  <input
                    value={siteMax}
                    onChange={(e) => setSiteMax(e.target.value)}
                    inputMode="numeric"
                    placeholder="20"
                  />
                </div>
              </div>
              <button
                type="button"
                className="teal"
                onClick={() => void seedCustomWebsite()}
                disabled={siteSeeding || seedingKey !== null || !siteBaseUrl.trim()}
              >
                <Globe size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                {siteSeeding ? 'Discovering…' : 'Discover & seed website'}
              </button>
            </div>
          </>
        ) : null}
      </div>

      <div className="card" id="rag-library">
        <div className="card-head">
          <div>
            <h2 style={{ margin: 0 }}>Library</h2>
            <p className="card-desc" style={{ margin: '6px 0 0' }}>
              10 per page. Broken rows sort first. Health chips above filter this list (totals stay global).
            </p>
          </div>
        </div>

        {!loading && !err && sources.length > 0 ? (
          <div className="rag-filters" aria-label="Filter sources">
            <div className="field">
              <FieldLabel>Search</FieldLabel>
              <input
                value={filterQ}
                onChange={(e) => setFilterQ(e.target.value)}
                placeholder="Title, URL, or site key…"
              />
            </div>
            <div className="field">
              <FieldLabel>Kind</FieldLabel>
              <select value={filterKind} onChange={(e) => setFilterKind(e.target.value as typeof filterKind)}>
                <option value="all">All kinds</option>
                <option value="URL">URL</option>
                <option value="File">File</option>
              </select>
            </div>
            <div className="field">
              <FieldLabel>Status</FieldLabel>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as typeof filterStatus)}
              >
                <option value="all">All statuses</option>
                <option value="broken">Needs attention</option>
                <option value="ready">Ready</option>
                <option value="processing">Processing</option>
                <option value="error">Error</option>
              </select>
            </div>
            <div className="field">
              <FieldLabel>Site</FieldLabel>
              <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
                <option value="all">All sites</option>
                {siteOptions.map((key) => (
                  <option key={key} value={key}>
                    {siteLabel(key)}
                  </option>
                ))}
              </select>
            </div>
            {filtersActive ? (
              <div className="rag-filters-clear">
                <button
                  type="button"
                  className="ghost sm"
                  onClick={() => {
                    setFilterQ('')
                    setFilterKind('all')
                    setFilterStatus('all')
                    setFilterSite('all')
                    setLibraryPage(1)
                  }}
                >
                  Clear filters
                </button>
                <span className="muted">
                  Showing {filteredSources.length} of {sources.length}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}

        {loading ? <p className="muted">Loading sources…</p> : null}
        {err ? (
          <p className="flash err" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} />
            Failed to load sources
          </p>
        ) : null}

        {!loading && !err && sources.length === 0 ? (
          <p className="muted">
            No sources yet. Use one of the three sections above to upload a file, ingest a URL, or seed
            a website.
          </p>
        ) : null}

        {!loading && sources.length > 0 && filteredSources.length === 0 ? (
          <p className="muted">No sources match these filters.</p>
        ) : null}

        {!loading && filteredSources.length > 0 ? (
          <>
          <div className="table-wrap rag-table-wrap">
            <table className="rag-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Kind</th>
                  <th>Site</th>
                  <th>URL / file</th>
                  <th className="num">Chunks</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {pagedSources.map((row) => {
                  const chunks = Number(row.chunk_count ?? row.chunks_live ?? 0)
                  const st = (row.status || '').toLowerCase()
                  const needsChunks = chunks < 1 || st === 'error'
                  const kind = sourceKind(row)
                  const origin = (row.origin || '').trim()
                  const url = isHttpUrl(origin) ? origin : ''
                  const site = siteKey(row)
                  return (
                    <tr key={row.id} className={needsChunks ? 'rag-row-warn' : undefined}>
                      <td>
                        <strong className="rag-title">{row.title}</strong>
                      </td>
                      <td>
                        <span className="rag-kind" title={kind.hint}>
                          {kind.label}
                        </span>
                      </td>
                      <td>
                        <span className="rag-site" title={site}>
                          {siteLabel(site)}
                        </span>
                      </td>
                      <td className="rag-origin">
                        {url ? (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={url}
                            className="rag-url"
                          >
                            <span>{shortUrl(url)}</span>
                            <ExternalLink size={12} aria-hidden />
                          </a>
                        ) : (
                          <span className="muted" title={origin || undefined}>
                            {origin || '—'}
                          </span>
                        )}
                        {formatDateShort(row.created_at) ? (
                          <span
                            className="rag-origin-date"
                            title={`Added ${formatDate(row.created_at)}`}
                          >
                            {formatDateShort(row.created_at)}
                          </span>
                        ) : null}
                      </td>
                      <td className="num">
                        <span className={`rag-chunks${needsChunks ? ' warn' : ''}`}>{chunks}</span>
                        {needsChunks ? (
                          <span className="rag-chunks-hint">needs rebuild</span>
                        ) : null}
                      </td>
                      <td>
                        <span className={statusBadge(row.status)}>{row.status || '—'}</span>
                      </td>
                      <td className="muted rag-date">
                        {formatDate(row.updated_at || row.created_at)}
                      </td>
                      <td>
                        <div className="rag-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            title="Edit title"
                            onClick={() => {
                              setEditRow(row)
                              setEditTitle(row.title)
                            }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title={
                              url
                                ? 'Rebuild: re-fetch this URL and replace chunks'
                                : 'Rebuild chunks from a new file'
                            }
                            onClick={() => void rebuildOneSource(row)}
                            disabled={rechunking}
                          >
                            <RefreshCw size={14} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Delete source and its chunks"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <span className="pagination-info">
              {libraryRangeStart}–{libraryRangeEnd} of {filteredSources.length}
              {filtersActive ? ` (filtered from ${sources.length})` : ''}
            </span>
            <div className="pagination-controls">
              <button
                type="button"
                className="sec sm"
                disabled={libraryPage <= 1}
                onClick={() => setLibraryPage((p) => Math.max(1, p - 1))}
              >
                Previous
              </button>
              <span className="pagination-page">
                Page {libraryPage} / {libraryTotalPages}
              </span>
              <button
                type="button"
                className="sec sm"
                disabled={libraryPage >= libraryTotalPages}
                onClick={() => setLibraryPage((p) => Math.min(libraryTotalPages, p + 1))}
              >
                Next
              </button>
            </div>
          </div>
          </>
        ) : null}

        <input
          ref={rechunkInputRef}
          type="file"
          accept=".txt,.md,.markdown,.pdf,text/plain,application/pdf"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) void runRechunk(file)
          }}
        />
      </div>

      {editRow ? (
        <Modal title="Edit source title" onClose={() => setEditRow(null)}>
          <div className="field">
            <FieldLabel>Title</FieldLabel>
            <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
          </div>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={() => setEditRow(null)}>
              Cancel
            </button>
            <button type="button" onClick={() => void saveTitle()} disabled={saving}>
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </Modal>
      ) : null}

      {deleteTarget ? (
        <Modal title="Delete source" onClose={() => setDeleteTarget(null)}>
          <p>
            Delete <strong>{deleteTarget.title}</strong> and all{' '}
            {deleteTarget.chunks_live ?? deleteTarget.chunk_count ?? 0} chunks? This cannot be undone.
          </p>
          <div className="modal-foot">
            <button type="button" className="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </button>
            <button type="button" className="del" onClick={() => void confirmDelete()} disabled={deleting}>
              {deleting ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </Modal>
      ) : null}
    </>
  )
}
