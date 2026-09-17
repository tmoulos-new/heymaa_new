/** Memories Booklet — personalized, downloadable HTML/PDF export. */

import type { FamilyChild, FamilyMemberRecord } from './familyData'
import { relationshipLabel } from './familyTree'
import { displayUppercase, greekGenitiveArticle, nameInGenitive, type GreekNameGender } from './greekText'
import { AUTH_LOGO_SRC } from '../auth/authLogo'

export const MIN_MEMORIES_FOR_BOOKLET = 0

export interface BookletMemory {
  emoji: string
  text: string
  date: string
  img?: string
  ref?: string
  createdAt?: string
  description?: string
  /** Album crop: 0–100 object-position X */
  focusX?: number
  /** Album crop: 0–100 object-position Y */
  focusY?: number
  /** Album crop scale, 1–3 */
  zoom?: number
}

export type AlbumPhotoFrame = {
  x: number
  y: number
  zoom: number
}

export const DEFAULT_ALBUM_PHOTO_FRAME: AlbumPhotoFrame = { x: 50, y: 50, zoom: 1 }

function clampNum(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n))
}

export function clampAlbumPhotoFrame(f?: Partial<AlbumPhotoFrame> | null): AlbumPhotoFrame {
  return {
    x: clampNum(typeof f?.x === 'number' && Number.isFinite(f.x) ? f.x : 50, 0, 100),
    y: clampNum(typeof f?.y === 'number' && Number.isFinite(f.y) ? f.y : 50, 0, 100),
    zoom: clampNum(typeof f?.zoom === 'number' && Number.isFinite(f.zoom) ? f.zoom : 1, 1, 3),
  }
}

export function isCustomAlbumPhotoFrame(f?: AlbumPhotoFrame | null): boolean {
  if (!f) return false
  return f.x !== 50 || f.y !== 50 || f.zoom !== 1
}

export function frameFromMemory(m: BookletMemory): AlbumPhotoFrame {
  return clampAlbumPhotoFrame({ x: m.focusX, y: m.focusY, zoom: m.zoom })
}

export function withAlbumPhotoFrame(m: BookletMemory, frames?: Record<string, AlbumPhotoFrame>): BookletMemory {
  const f = frames?.[bookletMemoryKey(m)]
  if (!f) return m
  const c = clampAlbumPhotoFrame(f)
  return { ...m, focusX: c.x, focusY: c.y, zoom: c.zoom }
}

/** Inline CSS for booklet HTML export. */
export function albumPhotoImgCss(frame?: AlbumPhotoFrame | null): string {
  const f = clampAlbumPhotoFrame(frame)
  if (!isCustomAlbumPhotoFrame(f)) return ''
  return `object-fit:cover;object-position:${f.x}% ${f.y}%;transform:scale(${f.zoom});transform-origin:${f.x}% ${f.y}%;`
}

export function albumPhotoFrameStyle(
  frame?: AlbumPhotoFrame | null,
  forceCover = false,
): {
  width: string
  height: string
  objectFit: 'contain' | 'cover'
  objectPosition: string
  transform?: string
  transformOrigin?: string
  display: 'block'
} {
  const f = clampAlbumPhotoFrame(frame)
  const custom = forceCover || isCustomAlbumPhotoFrame(f)
  if (!custom) {
    return {
      width: '100%',
      height: '100%',
      objectFit: 'contain',
      objectPosition: 'center',
      display: 'block',
    }
  }
  return {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    objectPosition: `${f.x}% ${f.y}%`,
    transform: `scale(${f.zoom})`,
    transformOrigin: `${f.x}% ${f.y}%`,
    display: 'block',
  }
}

export interface BookletPersonGroup {
  key: string
  label: string
  icon: string
  memories: BookletMemory[]
}

export interface BookletPeriodOption {
  months: number
  memoryCount: number
  eligible: boolean
  label: string
  periodLabel: string
}

export interface BookletLabels {
  bookletTitle: string
  bookletSubtitle: string
  download: string
  downloadHint: string
  saveAlbum: string
  preview: string
  closePreview: string
  nextPage: string
  prevPage: string
  pageOf: string
  editAlbum: string
  doneEditing: string
  backToAlbum: string
  editPhoto: string
  zoomIn: string
  zoomOut: string
  focalHint: string
  savePhotoFrame: string
  removePhoto: string
  deleteMemory: string
  editHint: string
  notEnough: string
  period: string
  month1: string
  months2: string
  months3: string
  months6: string
  annual: string
  general: string
  pregnancy: string
  family: string
  tableOfContents: string
  memoriesCount: string
  madeWith: string
  dedication: string
  pickPeriod: string
  pickPeriodHint: string
  dateFrom: string
  dateTo: string
  albumTitleField: string
  albumTitleHint: string
  albumSubtitleField: string
  albumSubtitleHint: string
  pickMemories: string
  pickMemoriesHint: string
  coverPhoto: string
  coverPhotoHint: string
  coverNone: string
  untitledPhoto: string
}

/** Display title for a memory in the album TOC / cover picker. */
export function bookletMemoryTitle(m: BookletMemory, untitled: string): string {
  const t = (m.text || '').trim()
  if (t && t !== '📷' && t !== '🎬' && t !== '📝') return t
  const d = (m.description || '').trim()
  if (d) return d
  return untitled
}

/** Stable-ish identity for matching booklet entries back to the live memories array. */
export function bookletMemoryKey(m: BookletMemory): string {
  if (m.createdAt) return `ca:${m.createdAt}`
  const imgHint = m.img ? m.img.slice(0, 48) : ''
  return `d:${m.date}|r:${m.ref || ''}|t:${m.text || ''}|i:${imgHint.length}|h:${imgHint}`
}

const MONTH_NAMES: Record<string, string[]> = {
  en: ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  el: ['Ιανουάριος', 'Φεβρουάριος', 'Μάρτιος', 'Απρίλιος', 'Μάιος', 'Ιούνιος', 'Ιούλιος', 'Αύγουστος', 'Σεπτέμβριος', 'Οκτώβριος', 'Νοέμβριος', 'Δεκέμβριος'],
}

function monthName(monthIndex: number, lang: string): string {
  const names = MONTH_NAMES[lang === 'el' ? 'el' : 'en']
  return names[monthIndex] ?? names[monthIndex]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function bookletLogoSrc(): string {
  const src = String(AUTH_LOGO_SRC || '')
  if (!src) return ''
  if (/^(data:|https?:|blob:)/i.test(src)) return src
  if (typeof window === 'undefined') return src
  const path = src.startsWith('/') ? src : `/${src}`
  return `${window.location.origin}${path}`
}

function coverBrandHtml(): string {
  const src = bookletLogoSrc()
  const mark = src
    ? `<img class="cover-brand-mark" src="${escapeHtml(src)}" alt="HeyMaa" />`
    : ''
  return `<div class="cover-brand">${mark}<div class="cover-brand-name">Hey<span>Maa</span></div></div>`
}

/** Resolve sortable timestamp — prefers ISO createdAt, else parses display date. */
export function memoryTimestamp(m: BookletMemory, index: number, total: number, lang: string): number {
  if (m.createdAt) {
    const t = Date.parse(m.createdAt)
    if (!isNaN(t)) return t
  }
  if (m.date) {
    const now = new Date()
    const tryParse = (year: number) => {
      const parts = m.date.match(/(\d{1,2})\s+(\S+)/)
      if (parts) {
        const day = parseInt(parts[1], 10)
        const monthStr = parts[2]
        for (let mi = 0; mi < 12; mi++) {
          const en = MONTH_NAMES.en[mi].slice(0, 3).toLowerCase()
          const el = MONTH_NAMES.el[mi].slice(0, 3).toLowerCase()
          const short = monthStr.toLowerCase().slice(0, 3)
          if (short === en || short === el || monthStr.toLowerCase().includes(MONTH_NAMES.en[mi].toLowerCase().slice(0, 3))) {
            return new Date(year, mi, day).getTime()
          }
        }
      }
      const d = new Date(`${m.date} ${year}`)
      if (!isNaN(d.getTime())) return d.getTime()
      return NaN
    }
    let t = tryParse(now.getFullYear())
    if (!isNaN(t) && t > Date.now()) t = tryParse(now.getFullYear() - 1)
    if (!isNaN(t)) return t
  }
  // Newest-first array: higher index = older
  return Date.now() - (total - index) * 86_400_000
}

export function getLatestQualifyingMonthKey(
  memories: BookletMemory[],
  lang: string,
): { year: number; month: number } | null {
  const now = new Date()
  for (let back = 0; back < 24; back++) {
    const d = new Date(now.getFullYear(), now.getMonth() - back, 1)
    if (countMemoriesInMonth(memories, d.getFullYear(), d.getMonth(), lang) >= MIN_MEMORIES_FOR_BOOKLET) {
      return { year: d.getFullYear(), month: d.getMonth() }
    }
  }
  return null
}

export function memoriesInRollingMonths(
  memories: BookletMemory[],
  months: number,
  lang: string,
): BookletMemory[] {
  if (months === 1) {
    const key = getLatestQualifyingMonthKey(memories, lang)
    if (!key) {
      const now = new Date()
      return memories.filter((m, i) => {
        const d = new Date(memoryTimestamp(m, i, memories.length, lang))
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
      })
    }
    return memories.filter((m, i) => {
      const d = new Date(memoryTimestamp(m, i, memories.length, lang))
      return d.getFullYear() === key.year && d.getMonth() === key.month
    })
  }

  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  return memories.filter((m, i) => {
    const ts = memoryTimestamp(m, i, memories.length, lang)
    return ts >= start.getTime()
  })
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}

function endOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).getTime()
}

function parseIsoDate(iso: string): Date | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const d = new Date(`${iso}T12:00:00`)
  return isNaN(d.getTime()) ? null : d
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Inclusive From–To calendar range. */
export function memoriesInDateRange(
  memories: BookletMemory[],
  fromIso: string,
  toIso: string,
  lang: string,
): BookletMemory[] {
  const from = parseIsoDate(fromIso)
  const to = parseIsoDate(toIso)
  if (!from || !to) return []
  let start = startOfDay(from)
  let end = endOfDay(to)
  if (start > end) {
    start = startOfDay(to)
    end = endOfDay(from)
  }
  return memories.filter((m, i) => {
    const ts = memoryTimestamp(m, i, memories.length, lang)
    return ts >= start && ts <= end
  })
}

export function formatBookletDateRangeLabel(fromIso: string, toIso: string, lang: string): string {
  const from = parseIsoDate(fromIso)
  const to = parseIsoDate(toIso)
  if (!from || !to) return ''
  const el = lang === 'el'
  const fmt = (d: Date) => {
    const day = d.getDate()
    const mon = monthName(d.getMonth(), lang)
    return `${day} ${mon} ${d.getFullYear()}`
  }
  if (fromIso === toIso) return fmt(from)
  return el ? `${fmt(from)} – ${fmt(to)}` : `${fmt(from)} – ${fmt(to)}`
}

/** Sensible default range: earliest memory → today (capped), or last 30 days. */
export function defaultBookletDateRange(
  memories: BookletMemory[],
  lang: string,
): { fromDate: string; toDate: string } {
  const today = new Date()
  const toDate = toIsoDate(today)
  if (!memories.length) {
    const from = new Date(today.getFullYear(), today.getMonth() - 1, today.getDate())
    return { fromDate: toIsoDate(from), toDate }
  }
  let minTs = Infinity
  memories.forEach((m, i) => {
    const ts = memoryTimestamp(m, i, memories.length, lang)
    if (ts < minTs) minTs = ts
  })
  const earliest = new Date(minTs)
  // Prefer last year of content if span is huge
  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate())
  const from = earliest < yearAgo ? yearAgo : earliest
  return { fromDate: toIsoDate(from), toDate }
}

export function countMemoriesInMonth(memories: BookletMemory[], year: number, month: number, lang: string): number {
  return memories.filter((m, i) => {
    const d = new Date(memoryTimestamp(m, i, memories.length, lang))
    return d.getFullYear() === year && d.getMonth() === month
  }).length
}

function periodLabel(months: number, lang: string, memoryCount: number, memories?: BookletMemory[]): string {
  const now = new Date()
  if (months === 1) {
    if (memories) {
      const key = getLatestQualifyingMonthKey(memories, lang)
      if (key) {
        const name = monthName(key.month, lang)
        return `${name} ${key.year}`
      }
    }
    const name = monthName(now.getMonth(), lang)
    return `${name} ${now.getFullYear()}`
  }
  if (months === 12) {
    return lang === 'el' ? 'Ετήσιο Βιβλίο Αναμνήσεων' : 'Annual Memories Book'
  }
  const start = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1)
  const startName = monthName(start.getMonth(), lang)
  const endName = monthName(now.getMonth(), lang)
  if (start.getFullYear() === now.getFullYear()) {
    return lang === 'el'
      ? `${startName} – ${endName} ${now.getFullYear()}`
      : `${startName} – ${endName} ${now.getFullYear()}`
  }
  return `${startName} ${start.getFullYear()} – ${endName} ${now.getFullYear()}`
}

export function getBookletPeriodOptions(
  memories: BookletMemory[],
  labels: BookletLabels,
  lang: string,
): BookletPeriodOption[] {
  const spans = [
    { months: 1, short: labels.month1 },
    { months: 2, short: labels.months2 },
    { months: 3, short: labels.months3 },
    { months: 6, short: labels.months6 },
    { months: 12, short: labels.annual },
  ]
  return spans.map(({ months, short }) => {
    const inPeriod = memoriesInRollingMonths(memories, months, lang)
    return {
      months,
      memoryCount: inPeriod.length,
      eligible: true,
      label: short,
      periodLabel: periodLabel(months, lang, inPeriod.length, memories),
    }
  })
}

export function groupMemoriesForBooklet(
  memories: BookletMemory[],
  lang: string,
  children: FamilyChild[],
  members: FamilyMemberRecord[],
  labels: BookletLabels,
): BookletPersonGroup[] {
  const indexed = memories.map((m, i) => ({ m, i, ts: memoryTimestamp(m, i, memories.length, lang) }))
  indexed.sort((a, b) => a.ts - b.ts)

  const groups: BookletPersonGroup[] = []
  const addGroup = (key: string, label: string, icon: string, filter: (ref?: string) => boolean) => {
    const items = indexed.filter(({ m }) => filter(m.ref)).map(({ m }) => m)
    if (items.length > 0) groups.push({ key, label, icon, memories: items })
  }

  addGroup('pregnancy', labels.pregnancy, '🤰', (ref) => ref === 'pregnancy')
  children.forEach((c) => addGroup(`child:${c.name}`, c.name, '👶', (ref) => ref === c.name))
  members.forEach((m) => {
    const label = members.filter((x) => x.name.toLowerCase() === m.name.toLowerCase()).length > 1
      ? `${m.name} · ${relationshipLabel(m.relationship, lang)}`
      : m.name
    const memRef = `m:${m.id}`
    addGroup(
      `member:${m.id}`,
      label,
      '👤',
      (ref) => ref === memRef || (members.filter((x) => x.name.toLowerCase() === m.name.toLowerCase()).length === 1 && ref === m.name),
    )
  })

  const knownRefs = new Set<string>([
    'pregnancy',
    ...children.map((c) => c.name),
    ...members.map((m) => m.name),
    ...members.map((m) => `m:${m.id}`),
  ])
  addGroup('general', labels.general, '🌸', (ref) => !ref || !knownRefs.has(ref))

  return groups
}

function bookletStyles(): string {
  return `
    @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400;1,9..40,500&display=swap');
    :root {
      --linen: #F6F0E8;
      --linen-deep: #E8DFD2;
      --rose: #C97B84;
      --rose-soft: #E8B4B8;
      --rose-pale: #F3E0E2;
      --ink: #2C2421;
      --ink-soft: #5C534C;
      --gold: #A8896A;
      --paper: #FFFBF7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'DM Sans', sans-serif;
      color: var(--ink);
      background: var(--linen-deep);
      line-height: 1.55;
    }
    button, input, textarea, select, label, a, h1, h2, h3, h4, p, span, li {
      font-family: 'DM Sans', sans-serif;
    }
    .page {
      max-width: 720px;
      margin: 24px auto;
      padding: 44px 40px 48px;
      background: var(--paper);
      min-height: 88vh;
      page-break-after: always;
      box-shadow: 0 18px 48px rgba(44,36,33,.10);
      position: relative;
      border: 1px solid rgba(43,58,103,.10);
      border-radius: 0;
    }
    .cover {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      min-height: 90vh;
      background:
        radial-gradient(ellipse at 30% 20%, rgba(243,224,226,.55), transparent 50%),
        radial-gradient(ellipse at 80% 80%, rgba(201,123,132,.28), transparent 45%),
        linear-gradient(165deg, #3A2F2C 0%, #5A3F42 42%, #C97B84 78%, #E8B4B8 100%);
      color: #FFFBF7;
      border: none;
      padding: 0;
      box-shadow: none;
      overflow: hidden;
    }
    .cover.has-photo {
      background: #2B3A67;
      padding: 0;
    }
    .cover-photo {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      object-fit: cover;
      object-position: center;
    }
    .cover-veil {
      position: absolute;
      inset: 0;
      background: linear-gradient(180deg, rgba(43,58,103,.28) 0%, rgba(43,58,103,.62) 42%, rgba(43,58,103,.88) 100%);
    }
    .cover-inner {
      position: relative;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      width: 100%;
      min-height: 90vh;
      padding: 64px 44px;
      box-sizing: border-box;
    }
    .cover-ornament {
      width: 56px;
      height: 1px;
      background: linear-gradient(90deg, transparent, rgba(255,251,247,.7), transparent);
      margin: 0 auto 22px;
    }
    .cover-brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
      margin: 10px auto 18px;
    }
    .cover-brand-mark {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      object-fit: cover;
      display: block;
      box-shadow: 0 8px 24px rgba(0,0,0,.28);
      background: #fff;
    }
    .cover-brand-name {
      font-family: 'DM Sans', sans-serif;
      font-size: 22px;
      font-weight: 600;
      letter-spacing: 0.02em;
      color: #FFFBF7;
    }
    .cover-brand-name span { color: #F8E5D6; }
    .cover h1 {
      font-family: 'DM Sans', sans-serif;
      font-size: 38px;
      font-weight: 600;
      margin-bottom: 14px;
      line-height: 1.18;
      max-width: 14ch;
    }
    .cover .dedication {
      font-family: 'DM Sans', sans-serif;
      font-size: 20px;
      font-style: italic;
      font-weight: 500;
      opacity: 0.9;
      margin: 8px 0 20px;
      max-width: 28ch;
      line-height: 1.4;
    }
    .cover .period {
      font-size: 15px;
      opacity: 0.88;
      margin-bottom: 8px;
      font-weight: 500;
      letter-spacing: 0.04em;
    }
    .cover .count {
      font-size: 13px;
      opacity: 0.78;
      margin-top: 28px;
    }
    .cover .brand {
      margin-top: 52px;
      font-size: 11px;
      opacity: 0.7;
      letter-spacing: 0.14em;
    }
    h2.section-title {
      font-family: 'DM Sans', sans-serif;
      font-size: 24px;
      color: var(--ink);
      margin: 0 0 6px;
      padding-bottom: 10px;
      border-bottom: 1px solid rgba(43,58,103,.10);
      display: flex;
      align-items: center;
      gap: 10px;
      font-weight: 600;
    }
    .section-album-title {
      font-family: 'DM Sans', sans-serif;
      font-size: 16px;
      font-style: italic;
      color: var(--ink-soft);
      margin: 0 0 20px;
      font-weight: 500;
    }
    .toc { list-style: none; padding: 0; }
    .toc li {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 14px 0;
      border-bottom: 1px solid rgba(43,58,103,.10);
      font-size: 16px;
      color: var(--ink);
      font-weight: 500;
      font-family: 'DM Sans', sans-serif;
    }
    .toc li span:last-child {
      color: var(--ink-soft);
      font-family: 'DM Sans', sans-serif;
      font-size: 13px;
      font-weight: 600;
    }
    .memory {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 0 0 28px;
      margin-bottom: 22px;
      border-bottom: 1px solid rgba(232,223,210,.9);
      page-break-inside: avoid;
    }
    .memory:last-child { border-bottom: none; margin-bottom: 0; padding-bottom: 0; }
    .memory.has-photo { align-items: stretch; }
    .memory-photo-wrap {
      width: 100%;
      max-width: 100%;
      aspect-ratio: 4 / 3;
      max-height: min(320px, 42vh);
      background: var(--linen);
      padding: 0;
      box-shadow: none;
      border: 1px solid rgba(43,58,103,.10);
      box-sizing: border-box;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .memory-photo-frame {
      width: 100%;
      height: 100%;
      background: #EDE6DC;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .memory-img {
      width: 100%;
      height: 100%;
      max-width: 100%;
      max-height: 100%;
      object-fit: contain;
      object-position: center;
      display: block;
      border: none;
    }
    .memory.has-photo.photo-only .memory-photo-wrap {
      max-height: min(420px, 58vh);
      aspect-ratio: 3 / 4;
    }
    .memory.has-photo.photo-only .memory-photo-wrap.is-landscape {
      aspect-ratio: 4 / 3;
    }
    .memory-row {
      display: flex;
      gap: 14px;
      align-items: flex-start;
    }
    .memory-emoji {
      font-size: 26px;
      line-height: 1.2;
      flex-shrink: 0;
      width: 36px;
      text-align: center;
      opacity: 0.85;
    }
    .memory-body { flex: 1; min-width: 0; }
    .memory-text {
      font-family: 'DM Sans', sans-serif;
      font-size: 19px;
      font-weight: 500;
      color: var(--ink);
      line-height: 1.45;
      margin-bottom: 8px;
    }
    .memory-date {
      font-size: 11px;
      color: var(--ink-soft);
      font-weight: 600;
      letter-spacing: 0.08em;
    }
    .page-title {
      font-family: 'DM Sans', sans-serif;
      font-size: 28px;
      color: var(--ink);
      margin-bottom: 8px;
      font-weight: 600;
    }
    .page-sub {
      font-family: 'DM Sans', sans-serif;
      font-size: 17px;
      font-style: italic;
      color: var(--ink-soft);
      margin-bottom: 28px;
    }
    .part-label {
      margin-left: auto;
      font-family: 'DM Sans', sans-serif;
      font-size: 11px;
      color: var(--ink-soft);
      font-weight: 600;
      letter-spacing: 0.06em;
    }
    @media print {
      body { background: #fff; }
      .page { margin: 0; padding: 28px 24px; box-shadow: none; min-height: auto; }
      .cover { min-height: 100vh; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .cover.has-photo { padding: 0; }
      .cover-inner { min-height: 100vh; }
    }
  `
}

export type BookletFlipPage =
  | {
      type: 'cover'
      title: string
      subtitle: string
      periodLabel: string
      memoryCount: number
      madeWith: string
      coverImg?: string
    }
  | {
      type: 'toc'
      title: string
      periodLabel: string
      items: { icon: string; label: string; meta: string }[]
    }
  | {
      type: 'section'
      icon: string
      label: string
      albumTitle?: string
      partLabel?: string
      memories: BookletMemory[]
    }

function chunkTocItems<T>(items: T[], size = 12): T[][] {
  if (items.length === 0) return [[]]
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size))
  return chunks
}

export function defaultAlbumTitle(
  userName: string,
  labels: BookletLabels,
  lang = 'en',
  gender?: GreekNameGender,
): string {
  const raw = (userName || '').trim() || 'HeyMaa'
  if (!lang.startsWith('el')) {
    return labels.bookletTitle.replace('{name}', raw)
  }
  const inflected = nameInGenitive(raw, lang, gender)
  const article = greekGenitiveArticle(raw, gender)
  return article ? `Αναμνήσεις ${article} ${inflected}` : `Αναμνήσεις ${inflected}`
}

export function prepareBookletContent(opts: {
  userName: string
  memories: BookletMemory[]
  fromDate: string
  toDate: string
  lang: string
  children: FamilyChild[]
  members: FamilyMemberRecord[]
  labels: BookletLabels
  albumTitle?: string
  albumSubtitle?: string
  coverMemoryKey?: string
  photoFrames?: Record<string, AlbumPhotoFrame>
  /** @deprecated Prefer fromDate/toDate */
  months?: number
}): {
  filtered: BookletMemory[]
  groups: BookletPersonGroup[]
  period: string
  title: string
  pages: BookletFlipPage[]
} {
  const { memories, fromDate, toDate, lang, children, members, labels, userName } = opts
  const filtered = memoriesInDateRange(memories, fromDate, toDate, lang)
  let groups = groupMemoriesForBooklet(filtered, lang, children, members, labels)
  if (groups.length === 0) {
    groups = [{ key: 'general', label: labels.general, icon: '🌸', memories: [] }]
  }
  const period = formatBookletDateRangeLabel(fromDate, toDate, lang)
  const title = (opts.albumTitle || '').trim() || defaultAlbumTitle(userName, labels, lang)
  const subtitle = (opts.albumSubtitle || '').trim() || labels.dedication
  const coverMem =
    (opts.coverMemoryKey
      ? filtered.find((m) => m.img && bookletMemoryKey(m) === opts.coverMemoryKey)
      : undefined) || filtered.find((m) => Boolean(m.img))

  const dated = filtered.map((m, i) => ({ m, ts: memoryTimestamp(m, i, filtered.length, lang) }))
  dated.sort((a, b) => a.ts - b.ts)
  const tocItems = dated.map(({ m }) => ({
    icon: m.img ? '📷' : m.emoji === '🏆' ? '🚩' : m.emoji || '✦',
    label: bookletMemoryTitle(m, labels.untitledPhoto),
    meta: m.date,
  }))

  const pages: BookletFlipPage[] = [
    {
      type: 'cover',
      title,
      subtitle,
      periodLabel: period,
      memoryCount: filtered.length,
      madeWith: labels.madeWith,
      coverImg: coverMem?.img,
    },
  ]
  chunkTocItems(tocItems).forEach((items, idx, all) => {
    pages.push({
      type: 'toc',
      title: all.length > 1 ? `${labels.tableOfContents} ${idx + 1}/${all.length}` : labels.tableOfContents,
      periodLabel: period,
      items,
    })
  })

  dated.forEach(({ m }) => {
    pages.push({
      type: 'section',
      icon: m.img ? '📷' : m.emoji === '🏆' ? '🚩' : m.emoji || '✦',
      label: bookletMemoryTitle(m, labels.untitledPhoto),
      albumTitle: title,
      memories: [withAlbumPhotoFrame(m, opts.photoFrames)],
    })
  })

  return { filtered, groups, period, title, pages }
}

export function buildBookletHtml(opts: {
  userName: string
  periodLabel: string
  memoryCount: number
  groups: BookletPersonGroup[]
  labels: BookletLabels
  lang: string
  pages?: BookletFlipPage[]
}): string {
  const { userName, periodLabel, memoryCount, labels, lang } = opts
  const coverPage = opts.pages?.find((p): p is Extract<BookletFlipPage, { type: 'cover' }> => p.type === 'cover')
  const title = escapeHtml(coverPage?.title || defaultAlbumTitle(userName, labels, lang))

  const memoryArticleHtml = (m: BookletMemory, heading?: string): string => {
    const raw = m.text && m.text !== '📷' ? m.text : ''
    const text = raw && raw !== heading ? escapeHtml(raw) : ''
    const date = escapeHtml(displayUppercase(m.date, lang))
    if (m.img) {
      const photoOnly = !text
      const frameCss = albumPhotoImgCss(frameFromMemory(m))
      return `<article class="memory has-photo${photoOnly ? ' photo-only' : ''}">
      <div class="memory-photo-wrap">
        <div class="memory-photo-frame">
          <img class="memory-img" src="${m.img}" alt=""${frameCss ? ` style="${frameCss}"` : ''} />
        </div>
      </div>
      <div class="memory-body">${text ? `<div class="memory-text">${text}</div>` : ''}<div class="memory-date">${date}</div></div>
    </article>`
    }
    return `<article class="memory">
    <div class="memory-row">
      <div class="memory-emoji">${m.emoji === '🏆' ? '🚩' : m.emoji || '✦'}</div>
      <div class="memory-body">${text ? `<div class="memory-text">${text}</div>` : ''}<div class="memory-date">${date}</div></div>
    </div>
  </article>`
  }

  if (opts.pages?.length) {
    const pageHtml = opts.pages
      .map((page) => {
        if (page.type === 'cover') {
          const inner = `
            <div class="cover-inner">
              <div class="cover-ornament"></div>
              ${coverBrandHtml()}
              <h1>${escapeHtml(page.title)}</h1>
              <p class="dedication">${escapeHtml(page.subtitle || labels.dedication)}</p>
              <div class="cover-ornament"></div>
              <p class="period">${escapeHtml(page.periodLabel)}</p>
              <p class="count">${labels.memoriesCount.replace('{count}', String(page.memoryCount))}</p>
              <p class="brand">${escapeHtml(displayUppercase(page.madeWith, lang))}</p>
            </div>`
          if (page.coverImg) {
            return `<div class="page cover has-photo">
            <img class="cover-photo" src="${page.coverImg}" alt="" />
            <div class="cover-veil"></div>
            ${inner}
          </div>`
          }
          return `<div class="page cover">${inner}</div>`
        }
        if (page.type === 'toc') {
          const tocItems = page.items
            .map((g) => `<li><span>${escapeHtml(g.icon)} ${escapeHtml(g.label)}</span><span>${escapeHtml(g.meta)}</span></li>`)
            .join('')
          return `<div class="page">
            <h1 class="page-title">${escapeHtml(page.title)}</h1>
            <p class="page-sub">${escapeHtml(page.periodLabel)}</p>
            <ul class="toc">${tocItems}</ul>
          </div>`
        }
        const items = page.memories.map((m) => memoryArticleHtml(m, page.label)).join('')
        return `<div class="page">
          <h2 class="section-title">${escapeHtml(page.label)}${page.partLabel ? `<span class="part-label">${escapeHtml(page.partLabel)}</span>` : ''}</h2>
          ${page.albumTitle ? `<p class="section-album-title">${escapeHtml(page.albumTitle)}</p>` : ''}
          ${items || '<p class="page-sub">—</p>'}
        </div>`
      })
      .join('')

    return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — HeyMaa</title>
  <style>${bookletStyles()}</style>
</head>
<body>
  ${pageHtml}
</body>
</html>`
  }

  const tocItems = opts.groups
    .flatMap((g) => g.memories)
    .map((m) => `<li><span>${escapeHtml(m.img ? '📷' : m.emoji || '✦')} ${escapeHtml(bookletMemoryTitle(m, labels.untitledPhoto))}</span><span>${escapeHtml(m.date)}</span></li>`)
    .join('')

  const fallbackTitle = coverPage?.title || defaultAlbumTitle(userName, labels, lang)
  const sections = opts.groups
    .flatMap((g) => g.memories)
    .map((m) => {
      const heading = bookletMemoryTitle(m, labels.untitledPhoto)
      return `<section><h2 class="section-title">${escapeHtml(heading)}</h2><p class="section-album-title">${escapeHtml(fallbackTitle)}</p>${memoryArticleHtml(m, heading)}</section>`
    })
    .join('')

  return `<!DOCTYPE html>
<html lang="${opts.lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${title} — HeyMaa</title>
  <style>${bookletStyles()}</style>
</head>
<body>
  <div class="page cover">
    <div class="cover-inner">
      <div class="cover-ornament"></div>
      ${coverBrandHtml()}
      <h1>${title}</h1>
      <p class="dedication">${escapeHtml(coverPage?.subtitle || labels.dedication)}</p>
      <div class="cover-ornament"></div>
      <p class="period">${escapeHtml(periodLabel)}</p>
      <p class="count">${labels.memoriesCount.replace('{count}', String(memoryCount))}</p>
      <p class="brand">${escapeHtml(displayUppercase(labels.madeWith, lang))}</p>
    </div>
  </div>
  <div class="page">
    <h1 class="page-title">${escapeHtml(labels.tableOfContents)}</h1>
    <p class="page-sub">${escapeHtml(periodLabel)}</p>
    <ul class="toc">${tocItems}</ul>
  </div>
  <div class="page">
    ${sections}
  </div>
</body>
</html>`
}

export function downloadMemoriesBooklet(opts: {
  userName: string
  memories: BookletMemory[]
  fromDate: string
  toDate: string
  lang: string
  children: FamilyChild[]
  members: FamilyMemberRecord[]
  labels: BookletLabels
  albumTitle?: string
  albumSubtitle?: string
  coverMemoryKey?: string
  photoFrames?: Record<string, AlbumPhotoFrame>
}): boolean {
  const prepared = prepareBookletContent(opts)
  const html = buildBookletHtml({
    userName: opts.userName,
    periodLabel: prepared.period,
    memoryCount: prepared.filtered.length,
    groups: prepared.groups,
    labels: opts.labels,
    lang: opts.lang,
    pages: prepared.pages,
  })

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const safeName = (prepared.title || opts.userName || 'HeyMaa').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '-')
  const filename = `HeyMaa-Memories-${safeName || 'album'}-${opts.fromDate}_${opts.toDate}.html`

  const win = window.open(url, '_blank')
  if (win) {
    win.addEventListener('load', () => {
      setTimeout(() => {
        try {
          win.print()
        } catch {
          /* print blocked */
        }
      }, 400)
    })
  }

  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
  return true
}

export function bookletLabelsForLang(lang: string): BookletLabels {
  const el = lang === 'el'
  return {
    bookletTitle: el ? 'Αναμνήσεις {name}' : 'Memories of {name}',
    bookletSubtitle: el
      ? 'Ένα τρυφερό άλμπουμ για όσα αξίζει να κρατήσεις'
      : 'A tender album for the moments worth keeping',
    download: el ? 'Λήψη άλμπουμ' : 'Download album',
    downloadHint: el ? 'Αποθηκεύστε ως PDF από το μενού εκτύπωσης' : 'Save as PDF from the print dialog',
    saveAlbum: el ? 'Αποθήκευση' : 'Save',
    preview: el ? 'Προεπισκόπηση' : 'Preview',
    closePreview: el ? 'Κλείσιμο' : 'Close',
    nextPage: el ? 'Επόμενη' : 'Next',
    prevPage: el ? 'Προηγούμενη' : 'Previous',
    pageOf: el ? 'Σελίδα {current} από {total}' : 'Page {current} of {total}',
    editAlbum: el ? 'Επεξεργασία' : 'Edit',
    doneEditing: el ? 'Τέλος' : 'Done',
    backToAlbum: el ? 'Πίσω' : 'Back',
    editPhoto: el ? 'Επεξεργασία φωτογραφίας' : 'Edit photo',
    zoomIn: el ? 'Μεγέθυνση' : 'Zoom in',
    zoomOut: el ? 'Σμίκρυνση' : 'Zoom out',
    focalHint: el ? 'Σύρε για το σημείο εστίασης' : 'Drag to set the focal point',
    savePhotoFrame: el ? 'Αποθήκευση' : 'Save',
    removePhoto: el ? 'Αφαίρεση φωτο' : 'Remove photo',
    deleteMemory: el ? 'Διαγραφή' : 'Delete',
    editHint: el
      ? 'Πάτα × για διαγραφή ή 📷 για αφαίρεση μόνο της φωτογραφίας'
      : 'Tap × to delete, or 📷 to remove only the photo',
    notEnough: el
      ? 'Πρόσθεσε αναμνήσεις για να γεμίσει το βιβλίο σου.'
      : 'Add memories to fill your booklet.',
    period: el ? 'Διάστημα' : 'Period',
    month1: el ? '1 μήνας' : '1 month',
    months2: el ? '2 μήνες' : '2 months',
    months3: el ? '3 μήνες' : '3 months',
    months6: el ? '6 μήνες' : '6 months',
    annual: el ? 'Ετήσιο' : 'Annual',
    general: el ? 'Γενικά' : 'General',
    pregnancy: el ? 'Εγκυμοσύνη' : 'Pregnancy',
    family: el ? 'Οικογένεια' : 'Family',
    tableOfContents: el ? 'Περιεχόμενα' : 'Contents',
    memoriesCount: el ? '{count} αγαπημένες στιγμές' : '{count} cherished moments',
    madeWith: el ? 'Με αγάπη · HeyMaa' : 'With love · HeyMaa',
    dedication: el
      ? 'Για τις στιγμές που η καρδιά θυμάται πρώτα.'
      : 'For the moments the heart remembers first.',
    pickPeriod: el ? 'Χρονικό διάστημα' : 'Album period',
    pickPeriodHint: el
      ? 'Διάλεξε από πότε έως πότε θα μαζευτούν οι στιγμές στο άλμπουμ.'
      : 'Choose the dates whose moments will go in the album.',
    dateFrom: el ? 'Από' : 'From',
    dateTo: el ? 'Έως' : 'To',
    albumTitleField: el ? 'Τίτλος άλμπουμ' : 'Album title',
    albumTitleHint: el
      ? 'Γράψε πώς θα λέγεται το άλμπουμ στο εξώφυλλο.'
      : 'Write the name that will appear on the cover.',
    albumSubtitleField: el ? 'Υπότιτλος εξωφύλλου' : 'Cover subtitle',
    albumSubtitleHint: el
      ? 'Εμφανίζεται κάτω από τον τίτλο στο εξώφυλλο.'
      : 'Shown under the title on the cover.',
    pickMemories: el ? 'Επίλεξε αναμνήσεις' : 'Choose memories',
    pickMemoriesHint: el
      ? 'Τσέκαρε ποιες φωτογραφίες θα μπουν μέσα. Οι υπόλοιπες μένουν έξω.'
      : 'Tick the photos to include. Unticked ones stay out.',
    coverPhoto: el ? 'Εξώφυλλο' : 'Cover photo',
    coverPhotoHint: el
      ? 'Διάλεξε ποια από τις επιλεγμένες φωτογραφίες θα φαίνεται στο εξώφυλλο.'
      : 'Pick which of the selected photos will show on the cover.',
    coverNone: el
      ? 'Πρόσθεσε φωτογραφίες στην περίοδο για να επιλέξεις εξώφυλλο.'
      : 'Add photos in this period to choose a cover.',
    untitledPhoto: el ? 'Χωρίς τίτλο' : 'Untitled',
  }
}

const BOOKLET_MEMORY_PATTERN =
  /<h2 class="section-title">(?:<span>[^<]*<\/span>\s*)?([^<]+)<\/h2>\s*(?:<p class="(?:page-sub|section-album-title)">[\s\S]*?<\/p>\s*)?<article class="memory[^"]*">[\s\S]*?<img class="memory-img" src="(data:image\/[^"]+)"[^>]*>[\s\S]*?<div class="memory-date">([^<]+)<\/div>/g

/** Parse memories back from a downloaded HeyMaa booklet HTML export. */
export function parseMemoriesBookletHtml(html: string): BookletMemory[] {
  const memories: BookletMemory[] = []
  const pattern = new RegExp(BOOKLET_MEMORY_PATTERN.source, 'g')
  let i = 0
  let m: RegExpExecArray | null
  while ((m = pattern.exec(html)) !== null) {
    memories.push({
      emoji: '📷',
      text: '📷',
      date: m[3].trim(),
      img: m[2],
      ref: m[1].trim(),
      createdAt: new Date(Date.now() - i * 60_000).toISOString(),
    })
    i += 1
  }
  return memories
}
