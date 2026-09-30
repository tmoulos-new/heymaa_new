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
  const [seeding, setSeeding] = useState(false)

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

  const seedParenthood = async () => {
    setSeeding(true)
    try {
      const d = await adminFetch('/admin/rag_sources/seed_parenthood', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ max_per_source: 20 }),
      })
      show(`Seeded parenthood sources — ${d.ingested}/${d.total} pages`, 'ok')
      await loadSources()
    } catch (e) {
      show(e instanceof Error ? e.message : 'Seed failed', 'err')
    } finally {
      setSeeding(false)
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
              <span>Upload a file, paste one URL, or seed known parenting sites.</span>
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

        <section className="card rag-add-card">
          <div className="rag-add-head">
            <span className="rag-add-icon" aria-hidden>
              <Sprout size={18} />
            </span>
            <div>
              <h2>3. Seed parenting sites</h2>
              <p className="card-desc" style={{ marginBottom: 0 }}>
                Bulk-import a curated set of Babyspace + My Parenthood pages (up to 20 per site). Use
                this to bootstrap lots of URL sources at once — not for a single page.
              </p>
            </div>
          </div>
          <ul className="rag-seed-notes">
            <li>Creates many rows in the library (one per page).</li>
            <li>Safe to re-run; existing URLs are updated rather than duplicated.</li>
            <li>Needs working embeddings (Gemini key) like the other sections.</li>
          </ul>
          <button
            type="button"
            className="sec"
            onClick={() => void seedParenthood()}
            disabled={seeding}
            title="Babyspace + My Parenthood seed crawl"
          >
            <Sprout size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
            {seeding ? 'Seeding parenthood sources…' : 'Seed Babyspace + My Parenthood'}
          </button>
        </section>
      </div>

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
            parenting sites.
          </p>
        ) : null}

        {!loading && sources.length > 0 ? (
          <div className="table-wrap rag-table-wrap">
            <table className="rag-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Kind</th>
                  <th>URL / file</th>
                  <th className="num">Chunks</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {sources.map((row) => {
                  const chunks = row.chunks_live ?? row.chunk_count ?? 0
                  const needsChunks =
                    chunks === 0 || (row.status || '').toLowerCase() === 'error'
                  const kind = sourceKind(row)
                  const origin = (row.origin || '').trim()
                  const url = isHttpUrl(origin) ? origin : ''
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
