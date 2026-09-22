import { compressImageDataUrl } from './memoriesSync'

export type DocCategoryKey =
  | 'blood'
  | 'vaccine'
  | 'pediatrician'
  | 'ultrasound'
  | 'allergy'
  | 'growth'
  | 'other'

export interface DocFile {
  name: string
  mime: string
  dataUrl: string
}

export interface DocEntry {
  id: string
  title: string
  date: string
  /** Category key or legacy free-text label */
  category: string
  ref: string
  addedDate: string
  note?: string
  provider?: string
  file?: DocFile
}

export const DOC_CATEGORIES: {
  key: DocCategoryKey
  icon: string
  el: string
  en: string
  tint: string
}[] = [
  { key: 'blood', icon: '🩸', el: 'Εξέταση αίματος', en: 'Blood test', tint: '#F8D7DA' },
  { key: 'vaccine', icon: '💉', el: 'Εμβόλιο', en: 'Vaccine', tint: '#D4EDDA' },
  { key: 'pediatrician', icon: '🩺', el: 'Παιδίατρος', en: 'Pediatrician', tint: '#E8E0F0' },
  { key: 'ultrasound', icon: '🔬', el: 'Υπέρηχος', en: 'Ultrasound', tint: '#D1ECF1' },
  { key: 'allergy', icon: '🌿', el: 'Αλλεργιοεξέταση', en: 'Allergy test', tint: '#FFF3CD' },
  { key: 'growth', icon: '📏', el: 'Μέτρηση ανάπτυξης', en: 'Growth check', tint: '#FFE5D0' },
  { key: 'other', icon: '📄', el: 'Άλλο', en: 'Other', tint: '#E9ECEF' },
]

const MAX_DOC_FILE_BYTES = 4 * 1024 * 1024

export function docCategoryLabel(category: string, lang: string): string {
  const preset = DOC_CATEGORIES.find((c) => c.key === category)
  if (preset) return lang === 'el' ? preset.el : preset.en
  return category
}

export function docCategoryMeta(category: string) {
  const preset = DOC_CATEGORIES.find((c) => c.key === category)
  return preset ?? DOC_CATEGORIES.find((c) => c.key === 'other')!
}

export function newDocId() {
  return `doc-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Upgrade legacy entries (no id, free-text category). */
export function normalizeDocEntries(raw: unknown[]): DocEntry[] {
  if (!Array.isArray(raw)) return []
  return raw
    .map((item) => {
      const d = item as Partial<DocEntry>
      if (!d || typeof d.title !== 'string') return null
      return {
        id: d.id || newDocId(),
        title: d.title.trim(),
        date: (d.date || '').trim(),
        category: (d.category || 'other').trim() || 'other',
        ref: d.ref ?? '',
        addedDate: d.addedDate || '',
        note: d.note?.trim() || undefined,
        provider: d.provider?.trim() || undefined,
        file: d.file?.dataUrl
          ? { name: d.file.name || 'document', mime: d.file.mime || 'application/octet-stream', dataUrl: d.file.dataUrl }
          : undefined,
      } satisfies DocEntry
    })
    .filter(Boolean) as DocEntry[]
}

export async function readDocFile(file: File): Promise<DocFile> {
  if (file.size > MAX_DOC_FILE_BYTES) {
    throw new Error('file_too_large')
  }
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

  if (file.type.startsWith('image/')) {
    const compressed = await compressImageDataUrl(dataUrl, 1200, 0.72)
    return { name: file.name, mime: 'image/jpeg', dataUrl: compressed }
  }

  return { name: file.name, mime: file.type || 'application/octet-stream', dataUrl }
}

export function downloadDocFile(file: DocFile) {
  const a = document.createElement('a')
  a.href = file.dataUrl
  a.download = file.name || 'document'
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
}

/** Human-readable doc rows for /chat librarian context (no file bytes). */
export function formatDocsForChatContext(
  docs: DocEntry[],
  opts: {
    lang: string
    userName?: string
    childNames?: string[]
    resolveMemberLabel?: (ref: string) => string | null
  },
  limit = 40,
): Array<{
  title: string
  category?: string
  date?: string
  ref?: string
  note?: string
  provider?: string
}> {
  const el = opts.lang === 'el'
  const childSet = new Set((opts.childNames || []).map((n) => n.trim()).filter(Boolean))
  const resolveRef = (ref: string): string => {
    const r = (ref || '').trim()
    if (!r) return el ? 'γενικό / οικογένεια' : 'general / family'
    if (r === 'pregnancy') return el ? 'εγκυμοσύνη' : 'pregnancy'
    if (r === '__self__') return (opts.userName || '').trim() || (el ? 'εσύ' : 'you')
    if (childSet.has(r)) return r
    const memberLabel = opts.resolveMemberLabel?.(r)
    if (memberLabel) return memberLabel
    return r.startsWith('m:') ? (el ? 'μέλος οικογένειας' : 'family member') : r
  }
  return docs.slice(0, limit).map((d) => ({
    title: d.title,
    category: docCategoryLabel(d.category, opts.lang),
    ...(d.date ? { date: d.date } : {}),
    ref: resolveRef(d.ref),
    ...(d.note ? { note: d.note.slice(0, 240) } : {}),
    ...(d.provider ? { provider: d.provider.slice(0, 120) } : {}),
  }))
}

export function formatDocDateInput(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function formatDocDateDisplay(isoOrText: string, lang: string) {
  if (!isoOrText) return ''
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrText)) {
    const d = new Date(isoOrText + 'T12:00:00')
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString(lang, { day: 'numeric', month: 'long', year: 'numeric' })
    }
  }
  return isoOrText
}
