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

const PRESET_SEEDS = [
  {
    key: 'babyspace',
    name: 'Babyspace',
    blurb: 'Scrapes /el/articles listings, then full-page chunks each article.',
  },
  {
    key: 'myparenthood',
    name: 'My Parenthood',
    blurb: 'Uses their post sitemap, then full-page chunks each article.',
  },
] as const


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

  const [siteName, setSiteName] = useState('')
  const [siteBaseUrl, setSiteBaseUrl] = useState('')
  const [siteSitemap, setSiteSitemap] = useState('')
  const [siteRss, setSiteRss] = useState('')
  const [siteMax, setSiteMax] = useState('20')
  const [siteSeeding, setSiteSeeding] = useState(false)

  const [filterQ, setFilterQ] = useState('')
  const [filterKind, setFilterKind] = useState<'all' | 'URL' | 'File'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready' | 'processing' | 'error'>('all')
  const [filterSite, setFilterSite] = useState('all')


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
      const d = await adminFetch('/admin/rag_sources')
      setSources((d.sources as RagSourceRow[]) || [])
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

  const stats = useMemo(() => {
    let chunks = 0
    let ready = 0
    let errors = 0
    let urls = 0
    let files = 0
    for (const row of sources) {
      chunks += Number(row.chunks_live ?? row.chunk_count ?? 0)
      const st = (row.status || '').toLowerCase()
      if (st === 'ready') ready += 1
      if (st === 'error') errors += 1
      const kind = sourceKind(row).label
      if (kind === 'URL') urls += 1
      else files += 1
    }
    return {
      sources: sources.length,
      chunks,
      ready,
      errors,
      urls,
      files,
    }
  }, [sources])

  const siteOptions = useMemo(() => {
    const keys = new Set<string>()
    for (const row of sources) keys.add(siteKey(row))
    return Array.from(keys).sort((a, b) => siteLabel(a).localeCompare(siteLabel(b)))
  }, [sources])

  const filteredSources = useMemo(() => {
    const q = filterQ.trim().toLowerCase()
    return sources.filter((row) => {
      const kind = sourceKind(row).label
      if (filterKind !== 'all' && kind !== filterKind) return false
      const st = (row.status || '').toLowerCase()
      if (filterStatus !== 'all' && st !== filterStatus) return false
      if (filterSite !== 'all' && siteKey(row) !== filterSite) return false
      if (!q) return true
      const hay = `${row.title || ''} ${row.origin || ''} ${row.source_key || ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [sources, filterQ, filterKind, filterStatus, filterSite])

  const filtersActive =
    filterQ.trim() !== '' || filterKind !== 'all' || filterStatus !== 'all' || filterSite !== 'all'

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

  const seedSite = async (sourceKey: string, label: string) => {
    setSeedingKey(sourceKey)
    try {
      const d = await adminFetch('/admin/rag_sources/seed_parenthood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_per_source: 20, source_keys: [sourceKey] }),
      })
      show(`Seeded ${label} — ${d.ingested}/${d.total} pages`, 'ok')
      await loadSources()
    } catch (e) {
      show(e instanceof Error ? e.message : `Seed ${label} failed`, 'err')
    } finally {
      setSeedingKey(null)
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

  return (
    <>
      {Message}
      <div className="card">
        <div className="card-head">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <BookOpen size={18} />
              Knowledge sources (RAG)
            </h2>
          </div>
          <button type="button" className="sec sm" onClick={() => void loadSources()} disabled={loading}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <p className="card-desc">
          This page fills the knowledge HeyMaa can quote in chat. You add sources in one of the three
          ways below; each source is split into <strong>chunks</strong> (small searchable pieces). When a
          parent asks something, chat retrieves the most relevant chunks and adds them to the model
          context.
        </p>

        <div className="rag-howto" aria-label="How RAG sources work">
          <div className="rag-howto-title">How this page works</div>
          <ol className="rag-howto-steps">
            <li>
              <strong>1. Add a source</strong>
              <span>Upload a file, paste one URL, or seed a whole website.</span>
            </li>
            <li>
              <strong>2. Chunks are created</strong>
              <span>Text is split and embedded so chat can search it.</span>
            </li>
            <li>
              <strong>3. Chat uses them</strong>
              <span>Matching chunks are injected into replies when relevant.</span>
            </li>
          </ol>
        </div>
      </div>

      <div className="rag-add-grid">
        <section className="card rag-add-card">
          <div className="rag-add-head">
            <span className="rag-add-icon" aria-hidden>
              <FileUp size={18} />
            </span>
            <div>
              <h2>1. Upload a document</h2>
              <p className="card-desc" style={{ marginBottom: 0 }}>
                Best for PDFs, guides, or .txt/.md files you already have. One upload = one source in
                the library below.
              </p>
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
            {uploadFile ? (
              <p className="muted" style={{ margin: '6px 0 0', fontSize: 12 }}>
                {uploadFile.name} · {(uploadFile.size / 1024).toFixed(1)} KB
              </p>
            ) : null}
          </div>
          <button
            type="button"
            className="teal"
            onClick={() => void uploadSource()}
            disabled={uploading || !uploadFile}
          >
            <Upload size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {uploading ? 'Uploading & chunking…' : 'Upload & create chunks'}
          </button>
        </section>

        <section className="card rag-add-card">
          <div className="rag-add-head">
            <span className="rag-add-icon" aria-hidden>
              <Link2 size={18} />
            </span>
            <div>
              <h2>2. Ingest one URL</h2>
              <p className="card-desc" style={{ marginBottom: 0 }}>
                Fetch a single public article or page. Use this when you want one specific URL in the
                knowledge base.
              </p>
            </div>
          </div>
          <div className="field">
            <FieldLabel>Page URL</FieldLabel>
            <input
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              placeholder="https://example.com/article"
            />
          </div>
          <div className="field">
            <FieldLabel>Title (optional)</FieldLabel>
            <input
              value={urlTitle}
              onChange={(e) => setUrlTitle(e.target.value)}
              placeholder="Overrides the page title"
            />
          </div>
          <button
            type="button"
            className="teal"
            onClick={() => void ingestUrl()}
            disabled={urlIngesting || !urlInput.trim()}
          >
            <Globe size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {urlIngesting ? 'Fetching & chunking…' : 'Ingest URL'}
          </button>
        </section>
      </div>

      <section className="card rag-add-card rag-seed-panel">
          <div className="rag-add-head">
            <span className="rag-add-icon" aria-hidden>
              <Sprout size={18} />
            </span>
            <div>
              <h2>3. Seed websites</h2>
              <p className="card-desc" style={{ marginBottom: 0 }}>
                Bulk-import many pages from a site. Built-in presets for Babyspace and My Parenthood,
                or add any public website below. Each discovered page is fetched in full and chunked
                (not just a feed summary).
              </p>
            </div>
          </div>

          <div className="rag-seed-presets">
            <div className="rag-seed-presets-label">Built-in sites</div>
            <div className="rag-seed-preset-grid">
              {PRESET_SEEDS.map((site) => (
                <div key={site.key} className="rag-seed-preset">
                  <strong>{site.name}</strong>
                  <p>{site.blurb}</p>
                  <button
                    type="button"
                    className="sec"
                    onClick={() => void seedSite(site.key, site.name)}
                    disabled={seedingKey !== null || siteSeeding}
                  >
                    <Sprout size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
                    {seedingKey === site.key ? `Seeding ${site.name}…` : `Seed ${site.name}`}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rag-seed-custom">
            <div className="rag-seed-presets-label">Add a website source</div>
            <p className="card-desc" style={{ marginBottom: 12 }}>
              Point at a blog or article listing. Prefer a <strong>sitemap</strong> or{' '}
              <strong>RSS</strong> URL when you have one — discovery is more accurate. Otherwise we
              crawl links from the base URL.
            </p>
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
              {siteSeeding ? 'Discovering & chunking…' : 'Discover & seed website'}
            </button>
          </div>
      </section>

      <div className="card">
        <div className="card-head">
          <div>
            <h2 style={{ margin: 0 }}>Library — seeded URLs &amp; documents</h2>
            <p className="card-desc" style={{ margin: '6px 0 0' }}>
              Every source that chat can retrieve from. <strong>Chunks</strong> = searchable pieces.
              For URL rows, open the link to see what was ingested.
            </p>
          </div>
        </div>

        {!loading && !err ? (
          <div className="rag-stats" aria-label="Library summary">
            <div className="rag-stat">
              <span className="rag-stat-value">{stats.sources}</span>
              <span className="rag-stat-label">Sources</span>
            </div>
            <div className="rag-stat">
              <span className="rag-stat-value">{stats.chunks}</span>
              <span className="rag-stat-label">Chunks live</span>
            </div>
            <div className="rag-stat">
              <span className="rag-stat-value">{stats.urls}</span>
              <span className="rag-stat-label">URL sources</span>
            </div>
            <div className="rag-stat">
              <span className="rag-stat-value">{stats.files}</span>
              <span className="rag-stat-label">File sources</span>
            </div>
            <div className="rag-stat">
              <span className="rag-stat-value">{stats.ready}</span>
              <span className="rag-stat-label">Ready</span>
            </div>
            <div className="rag-stat">
              <span className="rag-stat-value">{stats.errors}</span>
              <span className="rag-stat-label">Errors</span>
            </div>
          </div>
        ) : null}

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
                {filteredSources.map((row) => {
                  const chunks = row.chunks_live ?? row.chunk_count ?? 0
                  const needsChunks =
                    chunks === 0 || (row.status || '').toLowerCase() === 'error'
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
                            title="Rebuild chunks from a new file"
                            onClick={() => {
                              setRechunkTarget(row)
                              rechunkInputRef.current?.click()
                            }}
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
