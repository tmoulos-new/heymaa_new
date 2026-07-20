import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Pencil,
  RefreshCw,
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
  if (s === 'error') return 'badge badge-warn'
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

export function RagSourcesTab() {
  const { adminFetch, token } = useAdmin()
  const { show } = useFlashMessage()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const rechunkInputRef = useRef<HTMLInputElement>(null)

  const [sources, setSources] = useState<RagSourceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState(false)

  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

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
      <div className="card">
        <div className="card-head">
          <div>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
              <BookOpen size={18} />
              Knowledge sources
            </h2>
            <p className="muted" style={{ margin: '6px 0 0', fontSize: 13 }}>
              Upload documents for chat RAG. Chunks are created on upload.
            </p>
          </div>
          <button type="button" className="sec sm" onClick={() => void loadSources()} disabled={loading}>
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <div style={{ display: 'grid', gap: 12, marginBottom: 20 }}>
          <div className="field">
            <FieldLabel>Title</FieldLabel>
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
          <div>
            <button
              type="button"
              onClick={() => void uploadSource()}
              disabled={uploading || !uploadFile}
            >
              <Upload size={14} />
              {uploading ? 'Uploading & chunking…' : 'Upload & create chunks'}
            </button>
          </div>
        </div>

        {loading ? <p className="muted">Loading sources…</p> : null}
        {err ? (
          <p className="flash err" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <AlertTriangle size={16} />
            Failed to load sources
          </p>
        ) : null}

        {!loading && !err && sources.length === 0 ? (
          <p className="muted">No sources yet. Upload a document to get started.</p>
        ) : null}

        {!loading && sources.length > 0 ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Chunks</th>
                  <th>Origin</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {sources.map((row) => {
                  const chunks = row.chunks_live ?? row.chunk_count ?? 0
                  const needsChunks =
                    chunks === 0 || (row.status || '').toLowerCase() === 'error'
                  return (
                    <tr key={row.id}>
                      <td>
                        <strong>{row.title}</strong>
                      </td>
                      <td>{row.source_type || '—'}</td>
                      <td>
                        <span className={statusBadge(row.status)}>{row.status || '—'}</span>
                      </td>
                      <td>
                        <strong>{chunks}</strong>
                        {needsChunks ? (
                          <span className="muted" style={{ marginLeft: 6, fontSize: 12 }}>
                            needs rebuild
                          </span>
                        ) : null}
                      </td>
                      <td className="muted" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {row.origin || '—'}
                      </td>
                      <td className="muted">{formatDate(row.created_at)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
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
                            title="Rebuild chunks from file"
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
                            title="Delete"
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
