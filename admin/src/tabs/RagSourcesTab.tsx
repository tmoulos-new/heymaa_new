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

function canonicalSiteFromHost(host: string): string | null {
  const h = host.replace(/^www\./i, '').toLowerCase()
  if (h === 'babyspace.gr' || h.endsWith('.babyspace.gr')) return 'babyspace'
  if (h === 'myparenthood.gr' || h.endsWith('.myparenthood.gr')) return 'myparenthood'
  if (h === 'eody.gov.gr' || h.endsWith('.eody.gov.gr')) return 'eody-gov-gr'
  return null
}

function hostToSiteKey(host: string): string {
  const canonical = canonicalSiteFromHost(host)
  if (canonical) return canonical
  return host
    .replace(/^www\./i, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}

function slugFromFilename(filename: string): string {
  const base = filename.replace(/^.*[\\/]/, '') || 'document'
  const stem = base.replace(/\.[^.]+$/, '')
  const slug = stem
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  if (slug) return slug.slice(0, 40)
  // Greek / non-latin filenames — stable key (never collapse to "file")
  let hash = 0
  for (let i = 0; i < base.length; i++) hash = (hash * 31 + base.charCodeAt(i)) >>> 0
  return `doc-${hash.toString(16).slice(0, 10)}`
}

function siteKey(row: RagSourceRow): string {
  const key = (row.source_key || '').trim().toLowerCase()
  if (key === 'babyspace' || key === 'myparenthood') return key
  const origin = (row.origin || '').trim()
  if (isHttpUrl(origin)) {
    try {
      const host = new URL(origin).hostname
      const fromHost = canonicalSiteFromHost(host)
      if (fromHost) return fromHost
      if (key) return key
      return hostToSiteKey(host)
    } catch {
      /* fall through */
    }
  }
  if (key) return key
  if (sourceKind(row).label === 'File' && origin) return slugFromFilename(origin)
  return 'other'
}

function siteLabel(key: string): string {
  if (key === 'babyspace') return 'Babyspace'
  if (key === 'myparenthood') return 'My Parenthood'
  if (key === 'eody-gov-gr' || key === 'eody') return 'EODY'
  if (key === 'file') return 'Uploaded files'
  if (key === 'other') return 'Other'
  return key.replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

type SyncSiteCard = {
  key: string
  name: string
  blurb: string
  sinceYears?: number
  sources?: number
  broken?: number
  sourceType?: string
  canSync?: boolean
}

const ALWAYS_SYNC_SITES: SyncSiteCard[] = [
  {
    key: 'babyspace',
    name: 'Babyspace',
    blurb:
      'https://www.babyspace.gr/ — Sync discovers additions; Fix broken re-ingests empty/error rows.',
    sinceYears: 5,
    sourceType: 'website',
    canSync: true,
  },
  {
    key: 'myparenthood',
    name: 'My Parenthood',
    blurb:
      'https://myparenthood.gr/blog/ — Sync discovers additions; Fix broken re-ingests empty/error rows.',
    sourceType: 'website',
    canSync: true,
  },
  {
    key: 'eody-gov-gr',
    name: 'EODY',
    blurb:
      'https://eody.gov.gr/el/ — Sync discovers additions; Fix broken re-ingests empty/error rows.',
    sourceType: 'website',
    canSync: true,
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
  sites?: SyncSiteCard[]
  active_job?: SeedJobPublic | null
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
        if (active && !active.done) {
          // Keep the job this tab is already ticking. Replacing it mid-run
          // stops that sync, because only one job is advanced from the page.
          setSeedJob((current) => (current && !current.done ? current : active))
        }
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

  // While a job is active, poll + nudge ticks (keep this tab open).
  useEffect(() => {
    if (!seedJob?.id || seedJob.done) return
    let stopped = false
    const jobId = seedJob.id
    const pulse = async () => {
      if (stopped || seedAbortRef.current) return
      try {
        const ticked = await adminFetch(`/admin/rag_sources/seed_jobs/${jobId}/tick`, {
          method: 'POST',
        })
        if (stopped || seedAbortRef.current) return
        const job = (ticked.job || ticked) as SeedJobPublic
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
          } else if (job.status === 'cancelled') {
            show('Job cancelled', 'ok')
          }
        }
      } catch {
        /* ignore transient errors; next pulse retries */
      }
    }
    const id = window.setInterval(() => void pulse(), 2500)
    void pulse()
    return () => {
      stopped = true
      window.clearInterval(id)
    }
  }, [seedJob?.id, seedJob?.done, seedJob?.mode, adminFetch, loadSources, show])

  const siteOptions = useMemo(() => {
    const keys = new Set<string>()
    for (const row of sources) keys.add(siteKey(row))
    return Array.from(keys).sort((a, b) => siteLabel(a).localeCompare(siteLabel(b)))
  }, [sources])

  const syncSites = useMemo((): SyncSiteCard[] => {
    const map = new Map<string, SyncSiteCard>()

    const put = (site: SyncSiteCard) => {
      const key = (site.key || '').trim().toLowerCase()
      if (!key || key === 'file' || key === 'other') return
      const prev = map.get(key)
      map.set(key, {
        key,
        name: site.name || prev?.name || siteLabel(key),
        blurb:
          (site.blurb && site.blurb.trim()) ||
          prev?.blurb ||
          'Registered source. Sync discovers additions; Fix broken re-ingests failures.',
        sinceYears: site.sinceYears ?? prev?.sinceYears,
        sources: site.sources ?? prev?.sources,
        broken: site.broken ?? prev?.broken,
        sourceType: site.sourceType || prev?.sourceType || 'website',
        canSync:
          site.canSync ??
          prev?.canSync ??
          (site.sourceType || prev?.sourceType || 'website') !== 'file',
      })
    }

    // Always show the known websites (independent of API / registry).
    for (const site of ALWAYS_SYNC_SITES) put(site)

    // Health API sites (registry + library backfill).
    for (const s of health?.sites || []) {
      const raw = s as SyncSiteCard & {
        since_years?: number
        source_type?: string
        can_sync?: boolean
      }
      put({
        key: s.key,
        name: s.name || siteLabel(s.key),
        blurb: s.blurb || '',
        sinceYears: raw.sinceYears ?? raw.since_years,
        sources: s.sources,
        broken: s.broken,
        sourceType: raw.sourceType || raw.source_type || 'website',
        canSync: raw.canSync ?? raw.can_sync ?? (raw.source_type || 'website') !== 'file',
      })
    }

    // Every library row contributes — websites by site key, each PDF/file as its own card.
    for (const row of sources) {
      const kind = sourceKind(row)
      const isFile = kind.label === 'File'
      const key = isFile
        ? (row.source_key || '').trim().toLowerCase() ||
          (row.origin ? slugFromFilename(row.origin) : '') ||
          `doc-${String(row.id || '').slice(0, 8)}`
        : siteKey(row)
      if (!key || key === 'file' || key === 'other') continue

      const counts = health?.by_source_key?.[key]
      const existing = map.get(key)
      const fileTitle =
        (row.title || '').trim() ||
        (row.origin || '').replace(/^.*[\\/]/, '') ||
        siteLabel(key)

      put({
        key,
        name: isFile ? fileTitle : existing?.name || siteLabel(key),
        blurb: isFile
          ? `Uploaded document${row.origin ? ` (${row.origin})` : ''}. Re-upload from Add a source if broken.`
          : existing?.blurb ||
            'Registered source. Sync discovers additions; Fix broken re-ingests failures.',
        sources: isFile ? 1 : existing?.sources ?? counts?.sources,
        broken: isFile
          ? (row.status || '').toLowerCase() === 'error' ||
            Number(row.chunk_count ?? row.chunks_live ?? 0) < 1
            ? 1
            : 0
          : existing?.broken ?? counts?.broken,
        sourceType: isFile ? 'file' : existing?.sourceType || 'website',
        canSync: !isFile,
      })
    }

    for (const [key, site] of map) {
      const counts = health?.by_source_key?.[key]
      if (!counts || site.sourceType === 'file') continue
      if (site.sources == null) site.sources = counts.sources
      if (site.broken == null) site.broken = counts.broken
    }

    return Array.from(map.values()).sort((a, b) => {
      const order = (s: SyncSiteCard) => {
        if (s.key === 'babyspace') return 0
        if (s.key === 'myparenthood') return 1
        if (s.key === 'eody-gov-gr') return 2
        if (s.sourceType === 'file') return 50
        return 10
      }
      const d = order(a) - order(b)
      if (d !== 0) return d
      return a.name.localeCompare(b.name)
    })
  }, [health, sources])

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
          since_years: opts?.sinceYears,
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
          ? `${label}: rebuilding ${job0.queued ?? 0} broken URLs…`
          : `${label}: syncing new pages…`,
        'ok',
      )
      // Polling effect advances the job while this tab stays open.
    } catch (e) {
      show(e instanceof Error ? e.message : `Seed ${label} failed`, 'err')
    } finally {
      setSeedingKey(null)
    }
  }

  const cancelSeedJob = async () => {
    seedAbortRef.current = true
    if (!seedJob?.id || seedJob.done) return
    const jobId = seedJob.id
    // Hide the progress card immediately; in-flight ticks must not revive it.
    setSeedJob((prev) =>
      prev && prev.id === jobId
        ? { ...prev, status: 'cancelled', done: true }
        : prev,
    )
    try {
      const cancelled = await adminFetch(`/admin/rag_sources/seed_jobs/${jobId}/cancel`, {
        method: 'POST',
      })
      setSeedJob((cancelled.job || cancelled) as SeedJobPublic)
      show('Job cancelled', 'ok')
      void loadSources()
    } catch (e) {
      seedAbortRef.current = false
      show(e instanceof Error ? e.message : 'Cancel failed', 'err')
      void loadSources()
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
      const maxUrls = Math.max(1, Math.min(Number(siteMax) || 20, 100))
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
      const job = (d.job || null) as SeedJobPublic | null
      const behindCurrent = Boolean(seedJob && !seedJob.done)
      if (job && !job.done && !behindCurrent) setSeedJob(job)
      show(
        behindCurrent
          ? `Queued ${d.discovered ?? d.total ?? 0} pages from ${d.name || 'the site'}. They start after the current sync finishes — keep this tab open.`
          : `Ingesting ${d.name || 'website'} — ${d.discovered ?? d.total ?? 0} pages. Keep this tab open.`,
        'ok',
      )
      setSiteName('')
      setSiteBaseUrl('')
      setSiteSitemap('')
      setSiteRss('')
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
              Chat retrieves chunks from these sources. Health is global (not filtered). Use the
              manual Sync / Fix buttons below — keep this tab open while a job runs.
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" className="sec sm" onClick={() => void loadSources()} aria-busy={loading || undefined}>
              <RefreshCw size={14} className={loading ? 'icon-spin' : undefined} />
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
                chunks. Use Fix broken to re-ingest them.
              </p>
            </div>
            <button
              type="button"
              className="teal sm"
              disabled={seedingKey !== null || Boolean(seedJob && !seedJob.done)}
              onClick={() => {
                const brokenEntries = Object.entries(health?.by_source_key || {}).sort(
                  (a, b) => (b[1].broken || 0) - (a[1].broken || 0),
                )
                const syncable = syncSites.filter((s) => s.canSync !== false && s.sourceType !== 'file')
                const key =
                  brokenEntries.find(([k]) => syncable.some((s) => s.key === k))?.[0] ||
                  syncable[0]?.key ||
                  syncSites[0]?.key
                if (!key) {
                  show('No website sources to rebuild', 'err')
                  return
                }
                const site =
                  syncSites.find((s) => s.key === key) ||
                  syncable[0] || {
                    key,
                    name: siteLabel(key),
                    blurb: '',
                  }
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
            Running job · {seedJob.status}
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
            Keep this tab open until the job finishes — progress stops if you leave.
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
              {syncSites.length} collection{syncSites.length === 1 ? '' : 's'} — websites and uploaded
              docs. Sync new pages for sites; Fix broken re-ingests empty/error URLs.
            </p>
          </div>
        </div>

        <div className="rag-seed-presets">
          {syncSites.length === 0 ? (
            <p className="muted" style={{ margin: '0 0 12px' }}>
              No collections yet. Upload a PDF or add a website below.
            </p>
          ) : null}
          <div className="rag-seed-preset-grid">
            {syncSites.map((site) => {
              const siteHealth = health?.by_source_key?.[site.key]
              const broken = site.broken ?? siteHealth?.broken ?? 0
              const sourceCount = site.sources ?? siteHealth?.sources
              const canSync = site.canSync !== false && site.sourceType !== 'file'
              return (
                <div key={site.key} className="rag-seed-preset">
                  <strong>{site.name}</strong>
                  <p>{site.blurb}</p>
                  {typeof sourceCount === 'number' ? (
                    <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                      {sourceCount} sources · {broken} broken
                      {site.sourceType === 'file' ? ' · file' : ''}
                    </p>
                  ) : null}
                  <div className="rag-seed-preset-actions">
                    {canSync ? (
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
                    ) : null}
                    {canSync ? (
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
                        title={
                          broken > 0
                            ? `Re-ingest ${broken} broken source${broken === 1 ? '' : 's'}`
                            : 'Re-ingest empty/error sources for this site'
                        }
                      >
                        {broken > 0 ? `Fix ${broken} broken` : 'Fix broken'}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="ghost sm"
                        onClick={() => {
                          setFilterSite(site.key)
                          setShowAddPanel(true)
                          document.getElementById('rag-library')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start',
                          })
                        }}
                      >
                        View in library
                      </button>
                    )}
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
          <span className="muted">Upload file · one URL · website</span>
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
              <div className="rag-seed-presets-label">Website</div>
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
                            <RefreshCw size={14} className={rechunking ? 'icon-spin' : undefined} />
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
