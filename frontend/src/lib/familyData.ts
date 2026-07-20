/** Persisted under user_data key `family` (JSON). */

export interface FamilyChild {
  name: string
  birthDate: string
  /** Optional portrait as data URL or remote URL. */
  photo?: string
}

/** Special relatedTo anchors (not a person name). */
export const RELATED_TO_SELF = '__self__'
export const RELATED_TO_PARTNER = '__partner__'

export interface FamilyMemberRecord {
  /** Stable id — used for memories, docs, and relatedTo links (survives duplicate names). */
  id: string
  name: string
  relationship: string
  /**
   * Whose relative this member is:
   * - `__self__` = the user
   * - `__partner__` = the partner/spouse
   * - `m:{id}` = another family member
   * - otherwise a child name (legacy: bare member name still accepted)
   */
  relatedTo?: string
  email?: string
  phone?: string
  birthDate?: string
  note?: string
  /** Optional portrait as data URL or remote URL. */
  photo?: string
}

export interface FamilyData {
  children: FamilyChild[]
  members: FamilyMemberRecord[]
  /** Portrait for the signed-in user (tree "You" node). */
  selfPhoto?: string
}

export const EMPTY_FAMILY: FamilyData = { children: [], members: [] }

type LegacyMember = {
  id?: string
  name?: string
  role?: string
  relationship?: string
  relatedTo?: string
  related_to?: string
  email?: string
  phone?: string
}

export function newFamilyMemberId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `fm_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`
}

/** Memory / doc / relatedTo key for a family member. */
export function memberMemoryRef(memberId: string): string {
  return `m:${memberId}`
}

export function memberIdFromRef(ref: string | undefined | null): string | null {
  if (!ref || typeof ref !== 'string') return null
  if (ref.startsWith('m:')) return ref.slice(2) || null
  return null
}

export function findMemberById(
  members: FamilyMemberRecord[],
  id: string | undefined | null,
): FamilyMemberRecord | undefined {
  if (!id) return undefined
  return members.find((m) => m.id === id)
}

/** Resolve relatedTo / memory ref to a member (id link, legacy bare id, or unique name). */
export function findMemberByRelatedTo(
  relatedTo: string | undefined,
  members: FamilyMemberRecord[],
): FamilyMemberRecord | undefined {
  const rt = (relatedTo || '').trim()
  if (!rt || rt === RELATED_TO_SELF || rt === RELATED_TO_PARTNER) return undefined
  const fromPrefixed = memberIdFromRef(rt)
  if (fromPrefixed) return findMemberById(members, fromPrefixed)
  const byId = findMemberById(members, rt)
  if (byId) return byId
  const matches = members.filter((m) => m.name.toLowerCase() === rt.toLowerCase())
  return matches.length === 1 ? matches[0] : matches[0]
}

export function isDuplicateMemberName(member: FamilyMemberRecord, members: FamilyMemberRecord[]): boolean {
  const key = member.name.trim().toLowerCase()
  return members.filter((m) => m.name.trim().toLowerCase() === key).length > 1
}

/** Show "Name · Relationship" when two people share a name. */
export function memberDisplayLabel(member: FamilyMemberRecord, members: FamilyMemberRecord[]): string {
  if (!isDuplicateMemberName(member, members)) return member.name
  return `${member.name} · ${member.relationship}`
}

export function memoryBelongsToMember(
  ref: string | undefined,
  member: FamilyMemberRecord,
  members: FamilyMemberRecord[],
): boolean {
  if (!ref) return false
  if (member.id && ref === memberMemoryRef(member.id)) return true
  // Legacy name refs only when the name is unique (otherwise they'd collide)
  if (!isDuplicateMemberName(member, members) && ref === member.name) return true
  return false
}

function normalizeChild(raw: unknown): FamilyChild | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { name?: string; birthDate?: string; birth_date?: string; photo?: string }
  const name = (o.name || '').trim()
  if (!name) return null
  const birthDate = (o.birthDate || o.birth_date || '').trim()
  const photo = typeof o.photo === 'string' && o.photo.trim() ? o.photo.trim() : undefined
  return { name, birthDate, ...(photo ? { photo } : {}) }
}

function normalizeRelatedTo(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const v = raw.trim()
  if (!v) return undefined
  return v
}

function normalizeMember(raw: unknown): FamilyMemberRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as LegacyMember & {
    birthDate?: string
    birth_date?: string
    note?: string
    facts?: string
    photo?: string
  }
  const name = (o.name || '').trim()
  if (!name) return null
  const relationship = (o.relationship || o.role || 'Family').trim() || 'Family'
  const relatedTo = normalizeRelatedTo(o.relatedTo ?? o.related_to) || RELATED_TO_SELF
  const email = (o.email || '').trim()
  const phone = (o.phone || '').trim()
  const birthDate = (o.birthDate || o.birth_date || '').trim()
  const note = (o.note || o.facts || '').trim()
  const photo = typeof o.photo === 'string' && o.photo.trim() ? o.photo.trim() : undefined
  const id = (typeof o.id === 'string' && o.id.trim()) || newFamilyMemberId()
  return {
    id,
    name,
    relationship,
    relatedTo,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
    ...(birthDate ? { birthDate } : {}),
    ...(note ? { note } : {}),
    ...(photo ? { photo } : {}),
  }
}

/** Same person fingerprint — name + relationship (allows two ΚΑΤΕΡΙΝΑ with different roles). */
export function memberIdentityKey(m: Pick<FamilyMemberRecord, 'name' | 'relationship'>): string {
  return `${(m.name || '').trim().toLowerCase()}|${(m.relationship || '').trim().toLowerCase()}`
}

/**
 * Collapse accidental doubles (e.g. local id + remote without id for the same person).
 * Keeps the first stable id so memory refs stay valid.
 */
export function dedupeFamilyMembers(members: FamilyMemberRecord[]): FamilyMemberRecord[] {
  const byIdent = new Map<string, FamilyMemberRecord>()
  const byId = new Map<string, string>() // id → identity key

  members.forEach((m) => {
    if (!m?.name?.trim()) return
    const ident = memberIdentityKey(m)
    const id = (m.id || '').trim()

    // Same id already stored under another identity — merge into that slot
    if (id && byId.has(id)) {
      const prevIdent = byId.get(id)!
      const prev = byIdent.get(prevIdent)
      if (prev) {
        byIdent.set(prevIdent, {
          ...prev,
          ...m,
          id: prev.id || id,
          relatedTo: m.relatedTo && m.relatedTo !== RELATED_TO_SELF ? m.relatedTo : prev.relatedTo,
          email: m.email || prev.email,
          phone: m.phone || prev.phone,
          birthDate: m.birthDate || prev.birthDate,
          note: m.note || prev.note,
        })
      }
      return
    }

    const prev = byIdent.get(ident)
    if (prev) {
      const mergedId = prev.id || id || newFamilyMemberId()
      byIdent.set(ident, {
        ...prev,
        ...m,
        id: mergedId,
        relatedTo: m.relatedTo && m.relatedTo !== RELATED_TO_SELF ? m.relatedTo : prev.relatedTo,
        email: m.email || prev.email,
        phone: m.phone || prev.phone,
        birthDate: m.birthDate || prev.birthDate,
        note: m.note || prev.note,
      })
      byId.set(mergedId, ident)
      return
    }

    const withId = id ? m : { ...m, id: newFamilyMemberId() }
    byIdent.set(ident, withId)
    byId.set(withId.id, ident)
  })

  return Array.from(byIdent.values())
}

/** Ensure every member has an id; upgrade unique-name relatedTo links to m:{id}. */
export function ensureFamilyMemberIds(data: FamilyData): FamilyData {
  const members = dedupeFamilyMembers(
    data.members.map((m) => (m.id ? m : { ...m, id: newFamilyMemberId() })),
  )

  const nameCounts = new Map<string, number>()
  members.forEach((m) => {
    const k = m.name.toLowerCase()
    nameCounts.set(k, (nameCounts.get(k) || 0) + 1)
  })
  const uniqueNameToId = new Map<string, string>()
  members.forEach((m) => {
    const k = m.name.toLowerCase()
    if ((nameCounts.get(k) || 0) === 1) uniqueNameToId.set(k, m.id)
  })

  const next = members.map((m) => {
    const rt = m.relatedTo || RELATED_TO_SELF
    if (rt === RELATED_TO_SELF || rt === RELATED_TO_PARTNER || rt.startsWith('m:')) return m
    if (members.some((x) => x.id === rt)) {
      return { ...m, relatedTo: memberMemoryRef(rt) }
    }
    const id = uniqueNameToId.get(rt.toLowerCase())
    if (id) {
      return { ...m, relatedTo: memberMemoryRef(id) }
    }
    return m
  })

  const sameLength = next.length === data.members.length
  const sameIds = sameLength && next.every((m, i) => m.id === data.members[i]?.id && m.relatedTo === data.members[i]?.relatedTo)
  if (sameIds) return data
  return { ...data, members: next }
}

/**
 * Rewrite legacy name-based memory/doc refs to m:{id}.
 * Duplicate names: all old shared-name memories go to the first matching member
 * (so they stop appearing on both); new memories stay person-specific.
 */
export function migrateRefsToMemberIds<T extends { ref?: string }>(
  items: T[],
  members: FamilyMemberRecord[],
): T[] {
  if (!items.length || !members.length) return items
  let changed = false
  const next = items.map((item) => {
    const ref = item.ref
    if (!ref || ref.startsWith('m:') || ref === 'pregnancy') return item
    const matches = members.filter((m) => m.name.toLowerCase() === ref.toLowerCase())
    if (matches.length === 0) return item
    changed = true
    return { ...item, ref: memberMemoryRef(matches[0].id) }
  })
  return changed ? next : items
}

/** Parse user_data / localStorage value; migrates legacy member-only array. */
export function parseFamilyData(
  raw: string | null | undefined,
  profileChildren?: FamilyChild[],
): FamilyData {
  const fallbackChildren = (profileChildren || [])
    .map((c) => normalizeChild(c))
    .filter(Boolean) as FamilyChild[]

  if (!raw || !raw.trim()) {
    return { children: fallbackChildren, members: [] }
  }

  try {
    const parsed = JSON.parse(raw)

    if (Array.isArray(parsed)) {
      const members = parsed
        .map((m) => normalizeMember(m))
        .filter(Boolean) as FamilyMemberRecord[]
      return ensureFamilyMemberIds({ children: fallbackChildren, members })
    }

    if (parsed && typeof parsed === 'object') {
      const children = (Array.isArray(parsed.children) ? parsed.children : [])
        .map(normalizeChild)
        .filter(Boolean) as FamilyChild[]
      const members = (Array.isArray(parsed.members) ? parsed.members : [])
        .map(normalizeMember)
        .filter(Boolean) as FamilyMemberRecord[]
      const selfPhoto =
        typeof (parsed as { selfPhoto?: string }).selfPhoto === 'string' &&
        (parsed as { selfPhoto?: string }).selfPhoto!.trim()
          ? (parsed as { selfPhoto: string }).selfPhoto.trim()
          : undefined
      return ensureFamilyMemberIds({
        children: children.length > 0 ? children : fallbackChildren,
        members,
        ...(selfPhoto ? { selfPhoto } : {}),
      })
    }
  } catch {
    /* ignore */
  }

  return { children: fallbackChildren, members: [] }
}

export function parseFamilyDataValue(
  value: unknown,
  profileChildren?: FamilyChild[],
): FamilyData {
  if (value == null) return parseFamilyData(undefined, profileChildren)
  if (typeof value === 'string') return parseFamilyData(value, profileChildren)
  try {
    return parseFamilyData(JSON.stringify(value), profileChildren)
  } catch {
    return EMPTY_FAMILY
  }
}

/** Strip / normalize before persisting. */
export function normalizeFamilyData(data: FamilyData): FamilyData {
  const normalized = ensureFamilyMemberIds({
    children: data.children.map(normalizeChild).filter(Boolean) as FamilyChild[],
    members: data.members.map(normalizeMember).filter(Boolean) as FamilyMemberRecord[],
  })
  const selfPhoto = typeof data.selfPhoto === 'string' && data.selfPhoto.trim() ? data.selfPhoto.trim() : undefined
  return { ...normalized, ...(selfPhoto ? { selfPhoto } : {}) }
}

export function getFamilyChildren(
  family: FamilyData,
  profileChildren: FamilyChild[],
): FamilyChild[] {
  if (family.children.length > 0) return family.children
  return profileChildren
}

export function relatedToLabel(
  relatedTo: string | undefined,
  lang: string,
  opts?: { youName?: string; partnerName?: string; members?: FamilyMemberRecord[] },
): string {
  const el = lang === 'el'
  const rt = relatedTo || RELATED_TO_SELF
  if (rt === RELATED_TO_SELF) return opts?.youName?.trim() || (el ? 'Εσύ' : 'You')
  if (rt === RELATED_TO_PARTNER) return opts?.partnerName?.trim() || (el ? 'Σύντροφος' : 'Partner')
  const members = opts?.members || []
  const member = findMemberByRelatedTo(rt, members)
  if (member) return memberDisplayLabel(member, members)
  return rt
}
