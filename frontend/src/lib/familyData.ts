/** Persisted under user_data key `family` (JSON). */

export interface FamilyChild {
  name: string
  birthDate: string
}

export interface FamilyMemberRecord {
  name: string
  relationship: string
  email?: string
  phone?: string
}

export interface FamilyData {
  children: FamilyChild[]
  members: FamilyMemberRecord[]
}

export const EMPTY_FAMILY: FamilyData = { children: [], members: [] }

type LegacyMember = {
  name?: string
  role?: string
  relationship?: string
  email?: string
  phone?: string
}

function normalizeChild(raw: unknown): FamilyChild | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as { name?: string; birthDate?: string; birth_date?: string }
  const name = (o.name || '').trim()
  const birthDate = (o.birthDate || o.birth_date || '').trim()
  if (!name || !birthDate) return null
  return { name, birthDate }
}

function normalizeMember(raw: unknown): FamilyMemberRecord | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as LegacyMember
  const name = (o.name || '').trim()
  if (!name) return null
  const relationship = (o.relationship || o.role || 'Family').trim() || 'Family'
  const email = (o.email || '').trim()
  const phone = (o.phone || '').trim()
  return {
    name,
    relationship,
    ...(email ? { email } : {}),
    ...(phone ? { phone } : {}),
  }
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
        .map(normalizeMember)
        .filter(Boolean) as FamilyMemberRecord[]
      return { children: fallbackChildren, members }
    }

    if (parsed && typeof parsed === 'object') {
      const children = (Array.isArray(parsed.children) ? parsed.children : [])
        .map(normalizeChild)
        .filter(Boolean) as FamilyChild[]
      const members = (Array.isArray(parsed.members) ? parsed.members : [])
        .map(normalizeMember)
        .filter(Boolean) as FamilyMemberRecord[]
      return {
        children: children.length > 0 ? children : fallbackChildren,
        members,
      }
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

/** Strip UI-only fields before persisting. */
export function normalizeFamilyData(data: FamilyData): FamilyData {
  return {
    children: data.children
      .map(normalizeChild)
      .filter(Boolean) as FamilyChild[],
    members: data.members
      .map(normalizeMember)
      .filter(Boolean) as FamilyMemberRecord[],
  }
}

export function getFamilyChildren(
  family: FamilyData,
  profileChildren: FamilyChild[],
): FamilyChild[] {
  if (family.children.length > 0) return family.children
  return profileChildren
}
