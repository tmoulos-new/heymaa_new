/** Kinship classification & genealogy layout for the Family Tree. */

import {
  RELATED_TO_PARTNER,
  RELATED_TO_SELF,
  findMemberByRelatedTo,
  memberMemoryRef,
  type FamilyChild,
  type FamilyMemberRecord,
} from './familyData'

export type KinKind =
  | 'self'
  | 'partner'
  | 'parent'
  | 'parent_in_law'
  | 'grandparent'
  | 'sibling'
  | 'sibling_in_law'
  | 'child'
  | 'grandchild'
  | 'aunt_uncle'
  | 'niece_nephew'
  | 'cousin'
  | 'pregnancy'
  | 'pet'
  | 'other'

/** Which side of the couple this person belongs to. */
export type KinSide = 'self' | 'partner'

export type Generation = -2 | -1 | 0 | 1 | 2

export type MemberKinInfo = { kind: KinKind; side: KinSide }

export const RELATIONSHIP_PRESETS: { value: string; kind: KinKind; el: string; en: string }[] = [
  { value: 'Partner', kind: 'partner', el: 'Σύντροφος / Σύζυγος', en: 'Partner / Spouse' },
  { value: 'Mother', kind: 'parent', el: 'Μητέρα', en: 'Mother' },
  { value: 'Father', kind: 'parent', el: 'Πατέρας', en: 'Father' },
  { value: 'Mother-in-law', kind: 'parent_in_law', el: 'Πεθερά', en: 'Mother-in-law' },
  { value: 'Father-in-law', kind: 'parent_in_law', el: 'Πεθερός', en: 'Father-in-law' },
  { value: 'Grandmother', kind: 'grandparent', el: 'Γιαγιά', en: 'Grandmother' },
  { value: 'Grandfather', kind: 'grandparent', el: 'Παππούς', en: 'Grandfather' },
  { value: 'Sister', kind: 'sibling', el: 'Αδελφή', en: 'Sister' },
  { value: 'Brother', kind: 'sibling', el: 'Αδελφός', en: 'Brother' },
  { value: 'Sister-in-law', kind: 'sibling_in_law', el: 'Κουνιάδα', en: 'Sister-in-law' },
  { value: 'Brother-in-law', kind: 'sibling_in_law', el: 'Κουνιάδος', en: 'Brother-in-law' },
  { value: 'Aunt', kind: 'aunt_uncle', el: 'Θεία', en: 'Aunt' },
  { value: 'Uncle', kind: 'aunt_uncle', el: 'Θείος', en: 'Uncle' },
  { value: 'Cousin', kind: 'cousin', el: 'Ξάδελφος/η', en: 'Cousin' },
  { value: 'Niece', kind: 'niece_nephew', el: 'Ανιψιά', en: 'Niece' },
  { value: 'Nephew', kind: 'niece_nephew', el: 'Ανιψιός', en: 'Nephew' },
  { value: 'Grandchild', kind: 'grandchild', el: 'Εγγόνι', en: 'Grandchild' },
  { value: 'Pet', kind: 'pet', el: 'Κατοικίδιο', en: 'Family Pet' },
  { value: 'Family', kind: 'other', el: 'Άλλο μέλος', en: 'Other family' },
]

export function classifyKinship(relationship: string): KinKind {
  const r = (relationship || '').toLowerCase().trim()
  if (!r) return 'other'

  if (/mother[\s-]*in[\s-]*law|father[\s-]*in[\s-]*law|πεθερ|πεθερά|πεθερος|πεθερός|suegra|suegro|belle[\s-]*mère|beau[\s-]*père|schwiegermutter|schwiegervater/.test(r)) {
    return 'parent_in_law'
  }
  if (
    /sister[\s-]*in[\s-]*law|brother[\s-]*in[\s-]*law|κουνιάδ|κουνιαδ|cuñada|cunada|cuñado|cunado|belle[\s-]*sœur|beau[\s-]*frère|schwägerin|schwager/.test(
      r,
    )
  ) {
    return 'sibling_in_law'
  }
  if (/partner|spouse|husband|wife|σύζυγ|συζυγ|σύντροφ|αντρας|άντρας|γυναίκα|boyfriend|girlfriend/.test(r)) {
    return 'partner'
  }
  if (/grand\s*mother|grand\s*father|grandparent|γιαγ|παππο|παππού|бабуш|дедуш|oma|opa|nonna|nonno/.test(r)) {
    return 'grandparent'
  }
  if (/grand\s*child|grandchild|εγγον|εγγόν|внук|внуч/.test(r)) return 'grandchild'
  if (/mother|father|mom|dad|mum|parent|μητέρ|μητερ|πατέρ|πατερ|μάνα|μανα|μπαμπ|mama|papa/.test(r)) {
    return 'parent'
  }
  if (/sister|brother|sibling|αδελφ|αδερφ|hermana|hermano|schwester|bruder/.test(r)) return 'sibling'
  if (/aunt|uncle|θεία|θεια|θείος|θειος|tante|onkel|tia|tio/.test(r)) return 'aunt_uncle'
  if (/niece|nephew|ανιψ/.test(r)) return 'niece_nephew'
  if (/cousin|ξάδελ|ξαδελ|primo|cousine/.test(r)) return 'cousin'
  if (/pet|κατοικίδ|κατοικιδ|σκύλ|σκυλ|γάτ|γατ|dog|cat|puppy|kitten|bunny|rabbit|hamster|parrot|bird|fish|ίππ|άλογ|horse/.test(r)) {
    return 'pet'
  }
  return 'other'
}

/** Prefer first brother/sister when niece, nephew, or sibling-in-law needs an anchor. */
export function defaultRelatedToForRelationship(
  relationship: string,
  members: FamilyMemberRecord[],
  currentRelatedTo?: string,
): string {
  const kind = classifyKinship(relationship)
  const siblings = members.filter((m) => classifyKinship(m.relationship) === 'sibling')

  if (kind === 'niece_nephew' || kind === 'sibling_in_law') {
    if (currentRelatedTo) {
      const current = findMemberByRelatedTo(currentRelatedTo, members)
      if (current && classifyKinship(current.relationship) === 'sibling') {
        return memberMemoryRef(current.id)
      }
    }
    if (siblings.length) return memberMemoryRef(siblings[0].id)
    return RELATED_TO_SELF
  }
  if (kind === 'parent_in_law') return RELATED_TO_PARTNER
  if (kind === 'partner') return RELATED_TO_SELF
  return currentRelatedTo || RELATED_TO_SELF
}

/**
 * Resolve final kinship + couple side from relationship + "relative of".
 * Example: Mother of partner → parent_in_law on partner side.
 * Niece of a brother → niece_nephew on that brother's side, under him in layout.
 */
export function resolveKinshipForMember(
  relationship: string,
  relatedTo: string | undefined,
  ctx?: {
    partnerNames?: Set<string>
    childNames?: Set<string>
    /** Resolved kind/side keyed by member id and lowercased name. */
    memberInfoByKey?: Map<string, MemberKinInfo>
    /** @deprecated use memberInfoByKey */
    memberInfoByName?: Map<string, MemberKinInfo>
    /** @deprecated use memberInfoByKey */
    memberKindByName?: Map<string, KinKind>
    members?: FamilyMemberRecord[]
  },
): { kind: KinKind; side: KinSide } {
  let kind = classifyKinship(relationship)
  let side: KinSide = 'self'
  const rt = (relatedTo || RELATED_TO_SELF).trim()
  const partnerNames = ctx?.partnerNames || new Set<string>()
  const childNames = ctx?.childNames || new Set<string>()
  const memberInfoByKey =
    ctx?.memberInfoByKey ||
    ctx?.memberInfoByName ||
    (() => {
      const map = new Map<string, MemberKinInfo>()
      ;(ctx?.memberKindByName || new Map()).forEach((k, name) => {
        map.set(name, { kind: k, side: 'self' })
      })
      return map
    })()

  const isPartnerAnchor =
    rt === RELATED_TO_PARTNER || partnerNames.has(rt.toLowerCase())

  const lookupAnchorInfo = (): MemberKinInfo | undefined => {
    const anchored = ctx?.members ? findMemberByRelatedTo(rt, ctx.members) : undefined
    if (anchored) {
      return (
        memberInfoByKey.get(anchored.id) ||
        memberInfoByKey.get(anchored.name.toLowerCase()) ||
        memberInfoByKey.get(memberMemoryRef(anchored.id))
      )
    }
    return (
      memberInfoByKey.get(rt) ||
      memberInfoByKey.get(rt.toLowerCase()) ||
      (rt.startsWith('m:') ? memberInfoByKey.get(rt.slice(2)) : undefined)
    )
  }

  if (rt === RELATED_TO_SELF || !rt) {
    side = 'self'
  } else if (isPartnerAnchor) {
    side = 'partner'
    if (kind === 'parent') kind = 'parent_in_law'
  } else if (childNames.has(rt.toLowerCase())) {
    side = 'self'
    if (kind === 'child' || kind === 'other') kind = 'grandchild'
    if (kind === 'partner') kind = 'other'
  } else {
    const anchor = lookupAnchorInfo()
    const anchorKind = anchor?.kind
    if (anchorKind === 'partner') {
      side = 'partner'
      if (kind === 'parent') kind = 'parent_in_law'
    } else if (anchorKind === 'sibling' || anchorKind === 'sibling_in_law') {
      side = anchor?.side === 'partner' ? 'partner' : 'self'
      if (kind === 'child' || kind === 'other') kind = 'niece_nephew'
      if (kind === 'partner') kind = 'sibling_in_law'
    } else if (anchorKind === 'parent_in_law' || anchorKind === 'parent') {
      side = anchorKind === 'parent_in_law' ? 'partner' : 'self'
      if (kind === 'sibling' || kind === 'other') kind = 'aunt_uncle'
      if (kind === 'parent') kind = 'grandparent'
    } else if (anchorKind === 'aunt_uncle') {
      side = anchor?.side === 'partner' ? 'partner' : 'self'
      if (kind === 'child' || kind === 'other') kind = 'cousin'
    } else {
      side = 'self'
    }
  }

  if (kind === 'parent_in_law') side = 'partner'
  if (kind === 'partner') side = 'self'

  return { kind, side }
}

export function generationForKind(kind: KinKind): Generation {
  switch (kind) {
    case 'grandparent':
      return -2
    case 'parent':
    case 'parent_in_law':
    case 'aunt_uncle':
      return -1
    case 'self':
    case 'partner':
    case 'sibling':
    case 'sibling_in_law':
    case 'cousin':
    case 'other':
      return 0
    case 'child':
    case 'pregnancy':
    case 'niece_nephew':
    case 'pet':
      return 1
    case 'grandchild':
      return 2
  }
}

export type TreePerson = {
  id: string
  name: string
  role: string
  kind: KinKind
  side: KinSide
  generation: Generation
  birthDate?: string
  note?: string
  relatedTo?: string
  ref?: string
  memoryCount: number
  color: string
  photo?: string
  /** Index in familyData.members when this node is a member */
  memberIndex?: number
  /** Index in family children list */
  childIndex?: number
}


export type TreeEdge =
  | { type: 'spouse'; a: string; b: string }
  | { type: 'parent_child'; parentIds: string[]; childId: string }
  | { type: 'sibling_bar'; ids: string[] }

export type HistoryEvent = {
  id: string
  year: number
  label: string
  detail: string
  kind: KinKind
}

export type LaidOutNode = TreePerson & { x: number; y: number }
export type LaidOutEdge = { x1: number; y1: number; x2: number; y2: number; kind: 'spouse' | 'blood' }

export type TreeRowSlot =
  | 'grandparents'
  | 'parents'
  | 'couple'
  | 'siblings'
  | 'children'
  | 'pets'
  | 'grandchildren'

export type TreeLayout = {
  nodes: LaidOutNode[]
  edges: LaidOutEdge[]
  width: number
  height: number
  generationLabels: { generation: Generation; y: number; label: string; slot: TreeRowSlot }[]
  /** Vertical bands for drag/drop targeting (only present rows) */
  genBands: {
    generation: Generation
    yTop: number
    yBottom: number
    yCenter: number
    slot: TreeRowSlot
  }[]
}

export const TREE_NODE_W = 68
export const TREE_NODE_H = 74
/** Slightly larger cards for the focus trio: you, partner, kids */
export const TREE_FOCUS_NODE_W = 78
export const TREE_FOCUS_NODE_H = 82

const NODE_W = TREE_NODE_W
const NODE_H = TREE_NODE_H
const FOCUS_W = TREE_FOCUS_NODE_W
const FOCUS_H = TREE_FOCUS_NODE_H
const H_GAP = 16
const COUPLE_GAP = 28
const ROW_GAP = 44
const PAD_X = 28
const PAD_Y = 32

const PALETTE = ['#2B3A67', '#4ABEAA', '#E07B54', '#7C5CBF', '#2D9E6B', '#5B7FE8', '#C4785A']

function distribute(count: number, center: number, slot: number): number[] {
  if (count <= 0) return []
  if (count === 1) return [center]
  const total = (count - 1) * slot
  const start = center - total / 2
  return Array.from({ length: count }, (_, i) => start + i * slot)
}

function packLeftOf(count: number, anchorLeft: number, slot: number): number[] {
  if (count <= 0) return []
  const xs: number[] = []
  for (let i = count - 1; i >= 0; i--) {
    xs.unshift(anchorLeft - slot * (count - i))
  }
  return xs
}

function packRightOf(count: number, anchorRight: number, slot: number): number[] {
  if (count <= 0) return []
  return Array.from({ length: count }, (_, i) => anchorRight + slot * (i + 1))
}

export function isFocusKind(kind: KinKind): boolean {
  return kind === 'self' || kind === 'partner' || kind === 'child' || kind === 'pregnancy'
}

export function buildTreePeople(opts: {
  userName: string
  youLabel: string
  pregnancyLabel: string
  childLabel: string
  pregnancyActive: boolean
  children: FamilyChild[]
  members: FamilyMemberRecord[]
  memoryCounts?: Record<string, number>
  selfPhoto?: string
}): TreePerson[] {
  const people: TreePerson[] = []
  let colorIdx = 0
  const nextColor = () => PALETTE[colorIdx++ % PALETTE.length]

  people.push({
    id: 'self',
    name: opts.userName || 'You',
    role: opts.youLabel,
    kind: 'self',
    side: 'self',
    generation: 0,
    memoryCount: opts.memoryCounts?.['__general__'] ?? 0,
    color: '#2B3A67',
    ...(opts.selfPhoto ? { photo: opts.selfPhoto } : {}),
  })

  if (opts.pregnancyActive) {
    people.push({
      id: 'pregnancy',
      name: opts.pregnancyLabel,
      role: opts.pregnancyLabel,
      kind: 'pregnancy',
      side: 'self',
      generation: 1,
      ref: 'pregnancy',
      memoryCount: opts.memoryCounts?.pregnancy ?? 0,
      color: '#E07B54',
    })
  }

  opts.children.forEach((c, i) => {
    people.push({
      id: `child-${i}-${c.name}`,
      name: c.name,
      role: opts.childLabel,
      kind: 'child',
      side: 'self',
      generation: 1,
      birthDate: c.birthDate,
      ref: c.name,
      memoryCount: opts.memoryCounts?.[c.name] ?? 0,
      color: '#4ABEAA',
      childIndex: i,
      ...(c.photo ? { photo: c.photo } : {}),
    })
  })

  const partnerNames = new Set(
    opts.members
      .filter((m) => classifyKinship(m.relationship) === 'partner')
      .map((m) => m.name.toLowerCase()),
  )
  const childNames = new Set(opts.children.map((c) => c.name.toLowerCase()))
  const memberInfoByKey = new Map<string, MemberKinInfo>()
  opts.members.forEach((m) => {
    const info = { kind: classifyKinship(m.relationship), side: 'self' as KinSide }
    memberInfoByKey.set(m.id, info)
    memberInfoByKey.set(memberMemoryRef(m.id), info)
    memberInfoByKey.set(m.name.toLowerCase(), info)
  })

  opts.members.forEach((m, i) => {
    const { kind, side } = resolveKinshipForMember(m.relationship, m.relatedTo, {
      partnerNames,
      childNames,
      memberInfoByKey,
      members: opts.members,
    })
    const info = { kind, side }
    memberInfoByKey.set(m.id, info)
    memberInfoByKey.set(memberMemoryRef(m.id), info)
    memberInfoByKey.set(m.name.toLowerCase(), info)
    const memRef = memberMemoryRef(m.id)
    people.push({
      id: `member-${m.id}`,
      name: m.name,
      role: m.relationship,
      kind,
      side,
      generation: generationForKind(kind),
      birthDate: m.birthDate,
      note: m.note,
      relatedTo: m.relatedTo,
      ref: memRef,
      memoryCount: opts.memoryCounts?.[memRef] ?? opts.memoryCounts?.[m.name] ?? 0,
      color: nextColor(),
      memberIndex: i,
      ...(m.photo ? { photo: m.photo } : {}),
    })
  })

  return people
}

export function buildHistoryEvents(
  people: TreePerson[],
  lang: string,
): HistoryEvent[] {
  const el = lang === 'el'
  const events: HistoryEvent[] = []

  people.forEach((p) => {
    if (p.birthDate) {
      const d = new Date(p.birthDate)
      if (!isNaN(d.getTime())) {
        events.push({
          id: `birth-${p.id}`,
          year: d.getFullYear(),
          label: el ? 'Γέννηση' : 'Born',
          detail: `${p.name}${p.role ? ` · ${p.role}` : ''}`,
          kind: p.kind,
        })
      }
    }
    if (p.note?.trim()) {
      events.push({
        id: `note-${p.id}`,
        year: p.birthDate && !isNaN(new Date(p.birthDate).getTime())
          ? new Date(p.birthDate).getFullYear()
          : new Date().getFullYear(),
        label: el ? 'Σημείωση' : 'Note',
        detail: `${p.name}: ${p.note.trim()}`,
        kind: p.kind,
      })
    }
  })

  return events.sort((a, b) => a.year - b.year || a.detail.localeCompare(b.detail))
}

function rowTitle(slot: TreeRowSlot, lang: string): string {
  const el = lang === 'el'
  switch (slot) {
    case 'grandparents':
      return el ? 'Παππούδες & Γιαγιάδες' : 'Grandparents'
    case 'parents':
      return el ? 'Γονείς' : 'Parents'
    case 'couple':
      return el ? 'Εσύ & σύντροφος' : 'You & partner'
    case 'siblings':
      return el ? 'Αδέλφια' : 'Brothers & sisters'
    case 'children':
      return el ? 'Παιδιά' : 'Children'
    case 'pets':
      return el ? 'Κατοικίδια' : 'Family pets'
    case 'grandchildren':
      return el ? 'Εγγόνια' : 'Grandchildren'
  }
}

function relatedToMatchesNode(relatedTo: string | undefined, node: { id: string; name: string }): boolean {
  const rt = (relatedTo || '').trim()
  if (!rt) return false
  if (node.id.startsWith('member-')) {
    const mid = node.id.slice('member-'.length)
    if (rt === memberMemoryRef(mid) || rt === mid) return true
  }
  return rt.toLowerCase() === node.name.toLowerCase()
}

function nodeSize(kind: KinKind) {
  return isFocusKind(kind) ? { w: FOCUS_W, h: FOCUS_H } : { w: NODE_W, h: NODE_H }
}

type LayoutRow = {
  slot: TreeRowSlot
  generation: Generation
  people: TreePerson[]
}

/**
 * Couple-centered genealogy:
 *   grandparents (if any)
 *   parents / in-laws above
 *   YOU — PARTNER  (always center)
 *   siblings below & to the user's side
 *   kids directly under the couple
 *   grandchildren (if any)
 * Empty rows are omitted.
 */
export function layoutFamilyTree(people: TreePerson[], lang: string, _opts?: { showAllGenerations?: boolean }): TreeLayout {
  const grandparents = people.filter((p) => p.kind === 'grandparent').sort((a, b) => a.name.localeCompare(b.name))
  const gpSelf = grandparents.filter((p) => p.side !== 'partner')
  const gpPartner = grandparents.filter((p) => p.side === 'partner')

  const parents = people
    .filter((p) => p.kind === 'parent' || (p.kind === 'parent_in_law' && p.side === 'self'))
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
  const inLaws = people
    .filter((p) => p.kind === 'parent_in_law' || (p.kind === 'parent' && p.side === 'partner'))
    .sort((a, b) => a.role.localeCompare(b.role) || a.name.localeCompare(b.name))
  // Avoid double-counting if someone matched both filters
  const inLawIds = new Set(inLaws.map((p) => p.id))
  const parentsOnly = parents.filter((p) => !inLawIds.has(p.id))

  const auntsUncles = people.filter((p) => p.kind === 'aunt_uncle').sort((a, b) => a.name.localeCompare(b.name))
  const auntsSelf = auntsUncles.filter((p) => p.side !== 'partner')
  const auntsPartner = auntsUncles.filter((p) => p.side === 'partner')

  const self = people.find((p) => p.kind === 'self')
  const partners = people.filter((p) => p.kind === 'partner').sort((a, b) => a.name.localeCompare(b.name))
  const siblings = people.filter((p) => p.kind === 'sibling').sort((a, b) => a.name.localeCompare(b.name))
  const sibSelf = siblings.filter((p) => p.side !== 'partner')
  const sibPartner = siblings.filter((p) => p.side === 'partner')
  const siblingInLaws = people
    .filter((p) => p.kind === 'sibling_in_law')
    .sort((a, b) => a.name.localeCompare(b.name))
  const cousins = people
    .filter((p) => p.kind === 'cousin' || p.kind === 'other')
    .sort((a, b) => a.name.localeCompare(b.name))
  const children = people
    .filter((p) => p.kind === 'child' || p.kind === 'pregnancy')
    .sort((a, b) => {
      if (a.kind === 'pregnancy') return -1
      if (b.kind === 'pregnancy') return 1
      return a.name.localeCompare(b.name)
    })
  const niecesNephews = people.filter((p) => p.kind === 'niece_nephew').sort((a, b) => a.name.localeCompare(b.name))
  const pets = people.filter((p) => p.kind === 'pet').sort((a, b) => a.name.localeCompare(b.name))
  const grandchildren = people.filter((p) => p.kind === 'grandchild').sort((a, b) => a.name.localeCompare(b.name))

  const couplePeople: TreePerson[] = []
  if (self) couplePeople.push(self)
  couplePeople.push(...partners)

  const parentRowPeople = [...parentsOnly, ...auntsUncles, ...inLaws]
  const siblingRowPeople = [...siblings, ...siblingInLaws, ...cousins]
  const childRowPeople = [...children, ...niecesNephews]

  const orderSiblingsWithInLaws = (sibs: TreePerson[], side: KinSide, cousinList: TreePerson[]) => {
    const ordered: TreePerson[] = []
    const usedInLaw = new Set<string>()
    sibs.forEach((s) => {
      ordered.push(s)
      siblingInLaws
        .filter((il) => relatedToMatchesNode(il.relatedTo, s))
        .forEach((il) => {
          ordered.push(il)
          usedInLaw.add(il.id)
        })
    })
    siblingInLaws
      .filter((il) => !usedInLaw.has(il.id) && (side === 'partner' ? il.side === 'partner' : il.side !== 'partner'))
      .forEach((il) => ordered.push(il))
    ordered.push(...cousinList)
    return ordered
  }

  const rows: LayoutRow[] = []
  if (grandparents.length) rows.push({ slot: 'grandparents', generation: -2, people: grandparents })
  if (parentRowPeople.length) rows.push({ slot: 'parents', generation: -1, people: parentRowPeople })
  rows.push({ slot: 'couple', generation: 0, people: couplePeople.length ? couplePeople : people.filter((p) => p.kind === 'self') })
  if (siblingRowPeople.length) rows.push({ slot: 'siblings', generation: 0, people: siblingRowPeople })
  if (childRowPeople.length) rows.push({ slot: 'children', generation: 1, people: childRowPeople })
  if (pets.length) rows.push({ slot: 'pets', generation: 1, people: pets })
  if (grandchildren.length) rows.push({ slot: 'grandchildren', generation: 2, people: grandchildren })

  const slot = NODE_W + H_GAP
  const coupleSlot = FOCUS_W + COUPLE_GAP

  const estimateRowWidth = (row: LayoutRow) => {
    if (row.slot === 'couple') {
      const n = Math.max(1, row.people.length)
      return (n - 1) * coupleSlot + FOCUS_W
    }
    if (row.slot === 'parents' || row.slot === 'grandparents' || row.slot === 'siblings') {
      return row.people.length * slot + coupleSlot + FOCUS_W * 2
    }
    const focus = row.slot === 'children'
    const w = focus ? FOCUS_W : NODE_W
    const g = focus ? FOCUS_W + H_GAP : slot
    const n = Math.max(1, row.people.length)
    return (n - 1) * g + w
  }

  const contentW = Math.max(300, ...rows.map(estimateRowWidth))
  const width = contentW + PAD_X * 2
  const cx = width / 2

  const nodes: LaidOutNode[] = []
  const edges: LaidOutEdge[] = []
  const generationLabels: TreeLayout['generationLabels'] = []
  const genBands: TreeLayout['genBands'] = []
  const rowY = new Map<TreeRowSlot, number>()

  const placeSplitSides = (
    leftPeople: TreePerson[],
    rightPeople: TreePerson[],
    yPos: number,
  ) => {
    const coupleHalf = (Math.max(couplePeople.length, 1) * coupleSlot) / 2
    const leftAnchor = cx - Math.max(coupleHalf, FOCUS_W / 2) - 8
    const rightAnchor = cx + Math.max(coupleHalf, FOCUS_W / 2) + 8
    if (leftPeople.length && rightPeople.length) {
      const lx = packLeftOf(leftPeople.length, leftAnchor + NODE_W / 2, slot)
      const rx = packRightOf(rightPeople.length, rightAnchor - NODE_W / 2, slot)
      leftPeople.forEach((p, i) => nodes.push({ ...p, x: lx[i], y: yPos }))
      rightPeople.forEach((p, i) => nodes.push({ ...p, x: rx[i], y: yPos }))
    } else if (leftPeople.length) {
      const xs = distribute(leftPeople.length, cx - (rightPeople.length ? coupleHalf : 0), slot)
      leftPeople.forEach((p, i) => nodes.push({ ...p, x: xs[i], y: yPos }))
    } else if (rightPeople.length) {
      const xs = distribute(rightPeople.length, cx, slot)
      rightPeople.forEach((p, i) => nodes.push({ ...p, x: xs[i], y: yPos }))
    }
  }

  let y = PAD_Y
  rows.forEach((row, idx) => {
    const maxH = Math.max(...row.people.map((p) => nodeSize(p.kind).h), NODE_H)
    if (idx > 0) y += ROW_GAP
    y += maxH / 2
    rowY.set(row.slot, y)

    const bandPad = ROW_GAP / 2
    genBands.push({
      generation: row.generation,
      yTop: y - maxH / 2 - bandPad,
      yBottom: y + maxH / 2 + bandPad,
      yCenter: y,
      slot: row.slot,
    })
    generationLabels.push({
      generation: row.generation,
      y: y - maxH / 2 - 12,
      label: rowTitle(row.slot, lang),
      slot: row.slot,
    })

    if (row.slot === 'couple') {
      const xs = distribute(row.people.length, cx, coupleSlot)
      row.people.forEach((p, i) => nodes.push({ ...p, x: xs[i], y }))
    } else if (row.slot === 'grandparents') {
      placeSplitSides(gpSelf, gpPartner, y)
    } else if (row.slot === 'parents') {
      placeSplitSides([...parentsOnly, ...auntsSelf], [...inLaws, ...auntsPartner], y)
    } else if (row.slot === 'siblings') {
      const leftGroup = orderSiblingsWithInLaws(
        sibSelf,
        'self',
        cousins.filter((c) => c.side !== 'partner'),
      )
      const rightGroup = orderSiblingsWithInLaws(
        sibPartner,
        'partner',
        cousins.filter((c) => c.side === 'partner'),
      )
      placeSplitSides(leftGroup, rightGroup, y)
    } else if (row.slot === 'children') {
      const kids = row.people.filter((p) => p.kind === 'child' || p.kind === 'pregnancy')
      const nieces = row.people.filter((p) => p.kind === 'niece_nephew')
      const kidGap = FOCUS_W + H_GAP
      const kidXs = distribute(kids.length, cx, kidGap)
      kids.forEach((p, i) => nodes.push({ ...p, x: kidXs[i], y }))

      const siblingNodes = nodes.filter((n) => n.kind === 'sibling')
      const attached: { person: TreePerson; parentX: number }[] = []
      const unattached: TreePerson[] = []
      nieces.forEach((n) => {
        const parent = siblingNodes.find((s) => relatedToMatchesNode(n.relatedTo, s))
        if (parent) attached.push({ person: n, parentX: parent.x })
        else unattached.push(n)
      })

      const byParentX = new Map<number, TreePerson[]>()
      attached.forEach(({ person, parentX }) => {
        const list = byParentX.get(parentX) || []
        list.push(person)
        byParentX.set(parentX, list)
      })
      byParentX.forEach((group, parentX) => {
        const xs = distribute(group.length, parentX, slot * 0.85)
        group.forEach((p, i) => nodes.push({ ...p, x: xs[i], y }))
      })

      if (unattached.length) {
        const selfSide = unattached.filter((p) => p.side !== 'partner')
        const partnerSide = unattached.filter((p) => p.side === 'partner')
        const placedXs = nodes.filter((n) => n.y === y).map((n) => n.x)
        if (selfSide.length) {
          const leftEdge = placedXs.length ? Math.min(...placedXs) - FOCUS_W / 2 - 8 : cx
          const ox = packLeftOf(selfSide.length, leftEdge, slot)
          selfSide.forEach((p, i) => nodes.push({ ...p, x: ox[i], y }))
        }
        if (partnerSide.length) {
          const rightEdge = placedXs.length ? Math.max(...placedXs) + FOCUS_W / 2 + 8 : cx
          const ox = packRightOf(partnerSide.length, rightEdge, slot)
          partnerSide.forEach((p, i) => nodes.push({ ...p, x: ox[i], y }))
        }
      }
    } else {
      const xs = distribute(row.people.length, cx, slot)
      row.people.forEach((p, i) => nodes.push({ ...p, x: xs[i], y }))
    }

    y += maxH / 2
  })

  const minNodeX = Math.min(...nodes.map((n) => n.x - nodeSize(n.kind).w / 2), PAD_X)
  if (minNodeX < PAD_X) {
    const shift = PAD_X - minNodeX
    nodes.forEach((n) => {
      n.x += shift
    })
  }
  const maxNodeX = Math.max(...nodes.map((n) => n.x + nodeSize(n.kind).w / 2), width - PAD_X)
  const finalWidth = Math.max(width, maxNodeX + PAD_X)
  const height = y + PAD_Y

  const byId = new Map(nodes.map((n) => [n.id, n]))
  const selfN = nodes.find((n) => n.kind === 'self')
  const partnerNs = nodes.filter((n) => n.kind === 'partner')
  const parentNs = nodes.filter((n) => n.kind === 'parent' || (n.kind === 'parent_in_law' && n.side === 'self'))
  const inLawNs = nodes.filter((n) => n.kind === 'parent_in_law' || (n.kind === 'parent' && n.side === 'partner'))
  const siblingNs = nodes.filter((n) => n.kind === 'sibling' || n.kind === 'cousin' || n.kind === 'other')
  const siblingInLawNs = nodes.filter((n) => n.kind === 'sibling_in_law')
  const childNs = nodes.filter((n) => n.kind === 'child' || n.kind === 'pregnancy')
  const nieceNs = nodes.filter((n) => n.kind === 'niece_nephew')
  const grandparentNs = nodes.filter((n) => n.kind === 'grandparent')
  const grandchildNs = nodes.filter((n) => n.kind === 'grandchild')

  const coupleY = rowY.get('couple') ?? selfN?.y ?? 0

  partnerNs.forEach((p) => {
    if (!selfN) return
    edges.push({
      x1: Math.min(selfN.x, p.x) + FOCUS_W / 2 - 8,
      y1: selfN.y,
      x2: Math.max(selfN.x, p.x) - FOCUS_W / 2 + 8,
      y2: p.y,
      kind: 'spouse',
    })
  })

  const coupleBar = (group: LaidOutNode[]) => {
    if (group.length < 2) return
    const xs = group.map((g) => g.x)
    const yy = group[0].y
    edges.push({
      x1: Math.min(...xs) + NODE_W / 2 - 6,
      y1: yy,
      x2: Math.max(...xs) - NODE_W / 2 + 6,
      y2: yy,
      kind: 'spouse',
    })
  }
  coupleBar(parentNs)
  coupleBar(inLawNs)
  coupleBar(grandparentNs.filter((g) => g.side !== 'partner'))
  coupleBar(grandparentNs.filter((g) => g.side === 'partner'))

  // Sibling ↔ their spouse (brother/sister-in-law)
  siblingInLawNs.forEach((il) => {
    const sib = nodes.find((n) => n.kind === 'sibling' && relatedToMatchesNode(il.relatedTo, n))
    if (!sib) return
    edges.push({
      x1: Math.min(sib.x, il.x) + NODE_W / 2 - 6,
      y1: sib.y,
      x2: Math.max(sib.x, il.x) - NODE_W / 2 + 6,
      y2: il.y,
      kind: 'spouse',
    })
  })

  const dropTo = (from: LaidOutNode[], toY: number, targets: LaidOutNode[], preferMidX?: number) => {
    if (!from.length || !targets.length) return
    const midY = (from[0].y + toY) / 2
    const fromXs = from.map((f) => f.x)
    const tgtXs = targets.map((t) => t.x)
    const hubX = preferMidX ?? fromXs.reduce((a, b) => a + b, 0) / fromXs.length

    from.forEach((f) => {
      edges.push({ x1: f.x, y1: f.y + nodeSize(f.kind).h / 2 - 4, x2: f.x, y2: midY, kind: 'blood' })
    })
    if (from.length > 1) {
      edges.push({
        x1: Math.min(...fromXs),
        y1: midY,
        x2: Math.max(...fromXs),
        y2: midY,
        kind: 'blood',
      })
    }
    const barL = Math.min(hubX, ...tgtXs)
    const barR = Math.max(hubX, ...tgtXs)
    edges.push({ x1: barL, y1: midY, x2: barR, y2: midY, kind: 'blood' })
    targets.forEach((t) => {
      edges.push({ x1: t.x, y1: midY, x2: t.x, y2: t.y - nodeSize(t.kind).h / 2 + 4, kind: 'blood' })
    })
  }

  const gpSelfN = grandparentNs.filter((g) => g.side !== 'partner')
  const gpPartnerN = grandparentNs.filter((g) => g.side === 'partner')
  if (gpSelfN.length && parentNs.length) dropTo(gpSelfN, parentNs[0].y, parentNs)
  if (gpPartnerN.length && inLawNs.length) dropTo(gpPartnerN, inLawNs[0].y, inLawNs)
  else if (gpPartnerN.length && partnerNs.length) dropTo(gpPartnerN, partnerNs[0].y, partnerNs)

  if (parentNs.length && selfN) dropTo(parentNs, selfN.y, [selfN])
  if (inLawNs.length && partnerNs.length) dropTo(inLawNs, partnerNs[0].y, partnerNs)
  else if (inLawNs.length && selfN) dropTo(inLawNs, selfN.y, partnerNs.length ? partnerNs : [selfN])

  // Siblings: branch beside you (left) or partner (right)
  const linkSiblings = (sibs: LaidOutNode[], anchor: LaidOutNode | undefined) => {
    if (!sibs.length || !anchor) return
    const sibY = sibs[0].y
    const joinY = (coupleY + sibY) / 2
    const outward = Math.min(...sibs.map((s) => s.x), anchor.x)
    const inward = Math.max(...sibs.map((s) => s.x), anchor.x)
    edges.push({
      x1: anchor.x,
      y1: anchor.y + FOCUS_H / 2 - 4,
      x2: anchor.x,
      y2: joinY,
      kind: 'blood',
    })
    edges.push({
      x1: outward,
      y1: joinY,
      x2: inward,
      y2: joinY,
      kind: 'blood',
    })
    sibs.forEach((s) => {
      edges.push({ x1: s.x, y1: joinY, x2: s.x, y2: s.y - NODE_H / 2 + 4, kind: 'blood' })
    })
  }
  linkSiblings(
    siblingNs.filter((s) => s.side !== 'partner' && (s.kind === 'sibling' || s.kind === 'cousin' || s.kind === 'other')),
    selfN,
  )
  linkSiblings(
    siblingNs.filter((s) => s.side === 'partner' && s.kind === 'sibling'),
    partnerNs[0],
  )
  // Partner-side sibling-in-laws without a sibling link still hang near partner
  linkSiblings(
    siblingInLawNs.filter((s) => s.side === 'partner' && !nodes.some((n) => n.kind === 'sibling' && relatedToMatchesNode(s.relatedTo, n))),
    partnerNs[0],
  )
  linkSiblings(
    siblingInLawNs.filter((s) => s.side !== 'partner' && !nodes.some((n) => n.kind === 'sibling' && relatedToMatchesNode(s.relatedTo, n))),
    selfN,
  )

  if (childNs.length && (selfN || partnerNs.length)) {
    const sources = [...(selfN ? [selfN] : []), ...partnerNs]
    const midY = (coupleY + childNs[0].y) / 2
    const coupleMid = sources.reduce((s, n) => s + n.x, 0) / sources.length

    sources.forEach((s) => {
      edges.push({
        x1: s.x,
        y1: s.y + FOCUS_H / 2 - 4,
        x2: s.x,
        y2: midY,
        kind: 'blood',
      })
    })
    if (sources.length > 1) {
      edges.push({
        x1: Math.min(...sources.map((s) => s.x)),
        y1: midY,
        x2: Math.max(...sources.map((s) => s.x)),
        y2: midY,
        kind: 'blood',
      })
    }
    const tgtXs = childNs.map((c) => c.x)
    edges.push({
      x1: Math.min(coupleMid, ...tgtXs),
      y1: midY,
      x2: Math.max(coupleMid, ...tgtXs),
      y2: midY,
      kind: 'blood',
    })
    childNs.forEach((c) => {
      edges.push({
        x1: c.x,
        y1: midY,
        x2: c.x,
        y2: c.y - FOCUS_H / 2 + 4,
        kind: 'blood',
      })
    })
  }

  // Niece/nephew under their appointed sibling
  const nieceByParent = new Map<string, LaidOutNode[]>()
  const freeNieces: LaidOutNode[] = []
  nieceNs.forEach((nn) => {
    const parent = nodes.find((n) => n.kind === 'sibling' && relatedToMatchesNode(nn.relatedTo, n))
    if (parent) {
      const list = nieceByParent.get(parent.id) || []
      list.push(nn)
      nieceByParent.set(parent.id, list)
    } else {
      freeNieces.push(nn)
    }
  })
  nieceByParent.forEach((kids, parentId) => {
    const parent = byId.get(parentId)
    if (!parent || !kids.length) return
    dropTo([parent], kids[0].y, kids)
  })
  if (freeNieces.length) {
    const left = freeNieces.filter((n) => n.side !== 'partner')
    const right = freeNieces.filter((n) => n.side === 'partner')
    if (left.length && selfN) dropTo([selfN], left[0].y, left)
    if (right.length && partnerNs[0]) dropTo([partnerNs[0]], right[0].y, right)
  }

  if (grandchildNs.length && childNs.length) {
    dropTo(childNs, grandchildNs[0].y, grandchildNs, cx)
  }

  return {
    nodes,
    edges,
    width: finalWidth,
    height,
    generationLabels,
    genBands,
  }
}

/** Pick a relationship when dropping onto a tree row. */
export function relationshipForGenerationDrop(
  generation: Generation,
  dropX: number,
  treeWidth: number,
  currentRelationship: string,
  slot?: TreeRowSlot,
): string {
  const currentKind = classifyKinship(currentRelationship)

  // Prefer explicit row slot when provided (siblings vs couple both use gen 0)
  if (slot === 'siblings') return dropX / Math.max(treeWidth, 1) < 0.5 ? 'Sister' : 'Brother'
  if (slot === 'couple') return 'Partner'
  if (slot === 'parents') {
    const t = dropX / Math.max(treeWidth, 1)
    if (t < 0.5) return t < 0.25 ? 'Mother' : 'Father'
    return t < 0.75 ? 'Mother-in-law' : 'Father-in-law'
  }
  if (slot === 'grandparents') return dropX / Math.max(treeWidth, 1) < 0.5 ? 'Grandmother' : 'Grandfather'
  if (slot === 'children') return dropX / Math.max(treeWidth, 1) < 0.5 ? 'Niece' : 'Nephew'
  if (slot === 'pets') return 'Pet'
  if (slot === 'grandchildren') return 'Grandchild'

  if (generationForKind(currentKind) === generation && !slot) return currentRelationship

  const t = dropX / Math.max(treeWidth, 1)
  switch (generation) {
    case -2:
      return t < 0.5 ? 'Grandmother' : 'Grandfather'
    case -1:
      if (t < 0.34) return t < 0.17 ? 'Mother' : 'Father'
      if (t < 0.67) return t < 0.5 ? 'Mother-in-law' : 'Father-in-law'
      return t < 0.83 ? 'Aunt' : 'Uncle'
    case 0:
      if (Math.abs(t - 0.5) < 0.18) return 'Partner'
      if (t < 0.5) return 'Sister'
      return 'Brother'
    case 1:
      return t < 0.5 ? 'Niece' : 'Nephew'
    case 2:
      return 'Grandchild'
  }
}

/** Reorder members after dragging one onto a generation at dropX. */
export function placeMemberInTree(
  members: FamilyMemberRecord[],
  memberIndex: number,
  newRelationship: string,
  dropX: number,
  peerLayout: { memberIndex: number; x: number; name?: string; kind?: KinKind }[],
): FamilyMemberRecord[] {
  if (memberIndex < 0 || memberIndex >= members.length) return members
  const newKind = classifyKinship(newRelationship)
  let relatedTo = members[memberIndex]?.relatedTo || RELATED_TO_SELF

  if (newKind === 'niece_nephew' || newKind === 'sibling_in_law') {
    const siblings = peerLayout
      .map((p) => {
        const m = typeof p.memberIndex === 'number' ? members[p.memberIndex] : null
        const kind = p.kind || (m ? classifyKinship(m.relationship) : undefined)
        return { x: p.x, name: p.name || m?.name, kind, id: m?.id }
      })
      .filter((p) => p.kind === 'sibling' && (p.id || p.name))
    members.forEach((m) => {
      if (classifyKinship(m.relationship) !== 'sibling') return
      if (siblings.some((s) => s.id === m.id)) return
      siblings.push({ x: dropX, name: m.name, kind: 'sibling', id: m.id })
    })
    if (siblings.length) {
      const nearest = [...siblings].sort((a, b) => Math.abs(a.x - dropX) - Math.abs(b.x - dropX))[0]
      relatedTo = nearest?.id
        ? memberMemoryRef(nearest.id)
        : defaultRelatedToForRelationship(newRelationship, members, relatedTo)
    } else {
      relatedTo = defaultRelatedToForRelationship(newRelationship, members, relatedTo)
    }
  } else if (newKind === 'parent_in_law') {
    relatedTo = RELATED_TO_PARTNER
  } else if (newKind === 'partner') {
    relatedTo = RELATED_TO_SELF
  }

  const next = members.map((m, i) =>
    i === memberIndex ? { ...m, relationship: newRelationship, relatedTo } : { ...m },
  )
  const targetGen = generationForKind(newKind)

  const peers = next
    .map((m, i) => ({ i, kind: classifyKinship(m.relationship) }))
    .filter(({ kind }) => generationForKind(kind) === targetGen)

  const others = peers
    .filter(({ i }) => i !== memberIndex)
    .sort((a, b) => {
      const xa = peerLayout.find((p) => p.memberIndex === a.i)?.x ?? a.i * 100
      const xb = peerLayout.find((p) => p.memberIndex === b.i)?.x ?? b.i * 100
      return xa - xb
    })

  let insertAt = others.findIndex((o) => {
    const x = peerLayout.find((p) => p.memberIndex === o.i)?.x ?? 0
    return x > dropX
  })
  if (insertAt < 0) insertAt = others.length

  const orderedGen = [
    ...others.slice(0, insertAt).map((o) => o.i),
    memberIndex,
    ...others.slice(insertAt).map((o) => o.i),
  ]
  const genSet = new Set(orderedGen)
  const result: FamilyMemberRecord[] = []
  let flushed = false
  next.forEach((m, i) => {
    if (genSet.has(i)) {
      if (!flushed) {
        orderedGen.forEach((gi) => result.push(next[gi]))
        flushed = true
      }
    } else {
      result.push(m)
    }
  })
  if (!flushed) orderedGen.forEach((gi) => result.push(next[gi]))
  return result
}
