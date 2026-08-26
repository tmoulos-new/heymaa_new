import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { displayUppercase } from '../lib/greekText'
import type { FamilyChild, FamilyMemberRecord } from '../lib/familyData'
import {
  TREE_FOCUS_NODE_H,
  TREE_FOCUS_NODE_W,
  TREE_NODE_H,
  TREE_NODE_W,
  buildHistoryEvents,
  buildTreePeople,
  isFocusKind,
  layoutFamilyTree,
  placeMemberInTree,
  relationshipForGenerationDrop,
  type LaidOutNode,
  type TreeRowSlot,
} from '../lib/familyTree'

const NAVY = '#2B3A67'
const ACCENT = '#BEB4CD'
const MUTED = 'rgba(43, 58, 103, 0.55)'

type DragState = {
  memberIndex: number
  startSvgX: number
  startSvgY: number
  x: number
  y: number
  moved: boolean
}

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number) {
  const pt = svg.createSVGPoint()
  pt.x = clientX
  pt.y = clientY
  const ctm = svg.getScreenCTM()
  if (!ctm) return { x: 0, y: 0 }
  const p = pt.matrixTransform(ctm.inverse())
  return { x: p.x, y: p.y }
}

function TreeCard({
  node,
  dragging,
  highlight,
  onPointerDown,
}: {
  node: LaidOutNode
  dragging: boolean
  highlight: boolean
  onPointerDown?: (e: ReactPointerEvent, node: LaidOutNode) => void
}) {
  const initial = node.name[0]?.toUpperCase() || '?'
  const isYou = node.kind === 'self'
  const focus = isFocusKind(node.kind)
  const w = focus ? TREE_FOCUS_NODE_W : TREE_NODE_W
  const h = focus ? TREE_FOCUS_NODE_H : TREE_NODE_H
  const movable = node.memberIndex != null
  const editable = node.kind !== 'pregnancy'
  const avatarR = focus ? 17 : 14
  const avatarY = focus ? -18 : -16
  const clipId = `hm-avatar-${node.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  const emoji =
    node.kind === 'pregnancy'
      ? '🤰'
      : node.kind === 'pet'
        ? '🐾'
        : node.kind === 'grandparent'
          ? '✦'
          : !node.photo && node.kind === 'partner'
            ? '♡'
            : !node.photo && node.kind === 'parent_in_law'
              ? '◈'
              : null

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      style={{
        cursor: movable ? (dragging ? 'grabbing' : 'grab') : editable ? 'pointer' : 'default',
        touchAction: 'none',
        opacity: dragging ? 0.35 : 1,
      }}
      onPointerDown={(e) => onPointerDown?.(e, node)}
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx={0} cy={avatarY} r={avatarR} />
        </clipPath>
      </defs>
      <rect
        x={-w / 2}
        y={-h / 2}
        width={w}
        height={h}
        rx={focus ? 20 : 16}
        fill="#fff"
        stroke={
          highlight
            ? ACCENT
            : isYou
              ? NAVY
              : node.kind === 'partner' || node.kind === 'child' || node.kind === 'pet'
                ? ACCENT
                : movable
                  ? 'rgba(190,180,205,.65)'
                  : 'rgba(43,58,103,.10)'
        }
        strokeWidth={highlight || focus ? 2.35 : 1.25}
        filter="url(#hm-ft-shadow)"
      />
      <circle cx={0} cy={avatarY} r={avatarR} fill={node.color} />
      {node.photo ? (
        <image
          href={node.photo}
          x={-avatarR}
          y={avatarY - avatarR}
          width={avatarR * 2}
          height={avatarR * 2}
          clipPath={`url(#${clipId})`}
          preserveAspectRatio="xMidYMid slice"
        />
      ) : (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          y={avatarY}
          fontSize={emoji ? 12 : focus ? 14 : 12}
          fontWeight={700}
          fill="#fff"
          fontFamily="'DM Sans', sans-serif"
        >
          {emoji || initial}
        </text>
      )}
      {editable && (
        <>
          <circle cx={avatarR - 2} cy={avatarY + avatarR - 4} r={7} fill="#fff" stroke={ACCENT} strokeWidth={1.25} />
          <text
            x={avatarR - 2}
            y={avatarY + avatarR - 3.5}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fill={ACCENT}
          >
            ✎
          </text>
        </>
      )}
      {movable && (
        <text x={0} y={-h / 2 + 11} textAnchor="middle" fontSize={9} fill={NAVY} opacity={0.55}>
          ⋮⋮
        </text>
      )}
      {node.memoryCount > 0 && (
        <>
          <circle cx={w / 2 - 8} cy={-h / 2 + 10} r={7.5} fill={ACCENT} />
          <text
            x={w / 2 - 8}
            y={-h / 2 + 10}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={8}
            fill="#fff"
            fontWeight={700}
            fontFamily="'DM Sans', sans-serif"
          >
            {node.memoryCount > 9 ? '9+' : node.memoryCount}
          </text>
        </>
      )}
      <text
        textAnchor="middle"
        y={focus ? 14 : 12}
        fontSize={focus ? 11.5 : 10.5}
        fontWeight={700}
        fill={NAVY}
        fontFamily="'DM Sans', sans-serif"
      >
        {node.name.length > (focus ? 10 : 9) ? `${node.name.slice(0, focus ? 9 : 8)}…` : node.name}
      </text>
      <text textAnchor="middle" y={focus ? 28 : 26} fontSize={8.5} fill={MUTED} fontFamily="'DM Sans', sans-serif">
        {node.role.length > 12 ? `${node.role.slice(0, 11)}…` : node.role}
      </text>
    </g>
  )
}

export function FamilyTreePanel({
  userName,
  lang,
  familyChildren,
  members,
  pregnancyActive,
  memoryCounts,
  selfPhoto,
  onNodeSelect,
  onEditNode,
  onPlaceMembers,
  onSave,
  saving,
  selectedNodeId,
}: {
  userName: string
  lang: string
  familyChildren: FamilyChild[]
  members: FamilyMemberRecord[]
  pregnancyActive: boolean
  memoryCounts?: Record<string, number>
  selfPhoto?: string
  onNodeSelect?: (ref?: string) => void
  onEditNode?: (node: LaidOutNode) => void
  onPlaceMembers?: (nextMembers: FamilyMemberRecord[]) => void
  onSave?: () => void
  saving?: boolean
  selectedNodeId?: string | null
}) {
  const el = lang === 'el'
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [showHistory, setShowHistory] = useState(true)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hoverSlot, setHoverSlot] = useState<TreeRowSlot | null>(null)

  const copy = useMemo(
    () => ({
      title: el ? 'Οικογενειακό Δέντρο' : 'Family Tree',
      subtitle: el
        ? 'Επίλεξε, μετακίνησε ή διέγραψε μέλη, κατοικίδια και συγγενείς'
        : 'Choose, move, or delete members, pets, and relatives',
      you: el ? 'Εσύ' : 'You',
      pregnancy: el ? 'Εγκυμοσύνη' : 'Pregnancy',
      child: el ? 'Παιδί' : 'Child',
      history: el ? 'Ιστορία οικογένειας' : 'Family history',
      hideHistory: el ? 'Απόκρυψη' : 'Hide',
      showHistory: el ? 'Εμφάνιση' : 'Show',
      tapHint: el
        ? 'Πάτα για επιλογή & επεξεργασία · σύρε για μετακίνηση · διέγραψε από το φύλλο'
        : 'Tap to select & edit · drag to move · delete from the edit sheet',
      empty: el
        ? 'Πρόσθεσε σύντροφο, παιδιά ή μέλη για να γεμίσει το δέντρο'
        : 'Add a partner, kids, or members to grow the tree',
      noHistory: el ? 'Πρόσθεσε ημερομηνίες γέννησης για να φανεί η ιστορία' : 'Add birth dates to reveal family history',
      dropHere: el ? 'Άφησε εδώ' : 'Drop here',
      save: el ? 'Αποθήκευση' : 'Save',
      saving: el ? 'Αποθήκευση…' : 'Saving…',
    }),
    [el],
  )

  const people = useMemo(
    () =>
      buildTreePeople({
        userName,
        youLabel: copy.you,
        pregnancyLabel: copy.pregnancy,
        childLabel: copy.child,
        pregnancyActive,
        children: familyChildren,
        members,
        memoryCounts,
        selfPhoto,
      }),
    [userName, copy, pregnancyActive, familyChildren, members, memoryCounts, selfPhoto],
  )

  const layout = useMemo(() => layoutFamilyTree(people, lang), [people, lang])
  const history = useMemo(() => buildHistoryEvents(people, lang), [people, lang])

  const resolveBand = (y: number) => {
    let best = layout.genBands[0]
    let bestDist = Infinity
    layout.genBands.forEach((b) => {
      const d = Math.abs(y - b.yCenter)
      if (d < bestDist) {
        bestDist = d
        best = b
      }
    })
    return best
  }

  const activateNode = (node: LaidOutNode | undefined) => {
    if (!node || node.kind === 'pregnancy') return
    if (onEditNode) onEditNode(node)
    else if (node.ref !== undefined || node.kind === 'self') onNodeSelect?.(node.ref)
  }

  const onPointerDown = (e: ReactPointerEvent, node: LaidOutNode) => {
    if (node.memberIndex == null || !svgRef.current || !onPlaceMembers) {
      activateNode(node)
      return
    }
    e.preventDefault()
    e.stopPropagation()
    const svg = svgRef.current
    svg.setPointerCapture(e.pointerId)
    const p = clientToSvg(svg, e.clientX, e.clientY)
    setDrag({
      memberIndex: node.memberIndex,
      startSvgX: p.x,
      startSvgY: p.y,
      x: node.x,
      y: node.y,
      moved: false,
    })
    const band = resolveBand(node.y)
    setHoverSlot(band?.slot ?? null)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag || !svgRef.current) return
    const p = clientToSvg(svgRef.current, e.clientX, e.clientY)
    const dx = p.x - drag.startSvgX
    const dy = p.y - drag.startSvgY
    const moved = drag.moved || Math.hypot(dx, dy) > 6
    const node = layout.nodes.find((n) => n.memberIndex === drag.memberIndex)
    if (!node) return
    const x = node.x + dx
    const y = node.y + dy
    const band = resolveBand(y)
    setHoverSlot(band?.slot ?? null)
    setDrag({ ...drag, x, y, moved })
  }

  const finishDrag = (e: ReactPointerEvent) => {
    if (!drag || !svgRef.current) return
    try {
      svgRef.current.releasePointerCapture(e.pointerId)
    } catch {
      /* ignore */
    }

    const node = layout.nodes.find((n) => n.memberIndex === drag.memberIndex)
    if (!drag.moved || !node || !onPlaceMembers) {
      if (!drag.moved) activateNode(node)
      setDrag(null)
      setHoverSlot(null)
      return
    }

    const band = resolveBand(drag.y)
    const member = members[drag.memberIndex]
    if (!member || !band) {
      setDrag(null)
      setHoverSlot(null)
      return
    }

    const newRel = relationshipForGenerationDrop(
      band.generation,
      drag.x,
      layout.width,
      member.relationship,
      band.slot,
    )

    const peerLayout = layout.nodes
      .filter((n) => n.memberIndex != null && n.memberIndex !== drag.memberIndex)
      .map((n) => ({ memberIndex: n.memberIndex!, x: n.x, name: n.name, kind: n.kind }))

    const next = placeMemberInTree(members, drag.memberIndex, newRel, drag.x, peerLayout)
    onPlaceMembers(next)
    setDrag(null)
    setHoverSlot(null)
  }

  const ghost = drag
    ? layout.nodes.find((n) => n.memberIndex === drag.memberIndex)
    : null

  return (
    <div className="hm-tab-card hm-tab-card--flush hm-family-tree-panel">
      <div className="hm-family-tree-panel__head">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div className="hm-tab-card-title" style={{ marginBottom: 0 }}>
            {copy.title}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {onSave && (
              <button
                type="button"
                className="hm-btn hm-btn--primary hm-btn--pill hm-btn--sm"
                onClick={onSave}
                disabled={saving}
              >
                {saving ? copy.saving : copy.save}
              </button>
            )}
            <div
              className="hm-family-tree-panel__count"
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: NAVY,
                background: 'rgba(190,180,205,.35)',
                borderRadius: 999,
                padding: '3px 8px',
              }}
            >
              {people.length} {el ? 'μέλη' : 'people'}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>{copy.subtitle}</div>
      </div>

      <div className="hm-family-tree-panel__canvas" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', background: '#fff' }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          width="100%"
          style={{ display: 'block', minHeight: 280, minWidth: Math.min(layout.width, 440), touchAction: 'none' }}
          onPointerMove={onPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
        >
          <defs>
            <filter id="hm-ft-shadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="rgba(43,58,103,.10)" />
            </filter>
          </defs>

          {layout.genBands.map((b) => (
            <rect
              key={`band-${b.slot}`}
              x={8}
              y={b.yTop}
              width={layout.width - 16}
              height={b.yBottom - b.yTop}
              rx={14}
              fill={hoverSlot === b.slot && drag ? 'rgba(190,180,205,.22)' : b.slot === 'couple' || b.slot === 'children' || b.slot === 'pets' ? 'rgba(43,58,103,.04)' : 'transparent'}
              stroke={hoverSlot === b.slot && drag ? ACCENT : 'transparent'}
              strokeWidth={1.5}
              strokeDasharray={drag ? '5 4' : undefined}
            />
          ))}

          {layout.generationLabels.map((g) => (
            <text
              key={g.slot}
              x={layout.width / 2}
              y={g.y}
              textAnchor="middle"
              fontSize={9}
              fontWeight={700}
              fill={hoverSlot === g.slot && drag ? ACCENT : 'rgba(43,58,103,.35)'}
              fontFamily="'DM Sans', sans-serif"
              letterSpacing={0.8}
            >
              {drag && hoverSlot === g.slot
                ? `↓ ${displayUppercase(copy.dropHere, lang)}`
                : displayUppercase(g.label, lang)}
            </text>
          ))}

          {layout.edges.map((e, i) => (
            <line
              key={`edge-${i}`}
              x1={e.x1}
              y1={e.y1}
              x2={e.x2}
              y2={e.y2}
              stroke={e.kind === 'spouse' ? ACCENT : 'rgba(43,58,103,.20)'}
              strokeWidth={e.kind === 'spouse' ? 2.25 : 1.5}
              strokeLinecap="round"
              opacity={drag ? 0.35 : e.kind === 'spouse' ? 0.85 : 1}
            />
          ))}

          {layout.edges
            .filter((e) => e.kind === 'spouse')
            .map((e, i) => (
              <text
                key={`heart-${i}`}
                x={(e.x1 + e.x2) / 2}
                y={(e.y1 + e.y2) / 2 + 4}
                textAnchor="middle"
                fontSize={10}
                fill={ACCENT}
                opacity={drag ? 0.35 : 1}
              >
                ♡
              </text>
            ))}

          {layout.nodes.map((n) => (
            <TreeCard
              key={n.id}
              node={n}
              dragging={drag?.memberIndex === n.memberIndex}
              highlight={selectedNodeId === n.id}
              onPointerDown={onPointerDown}
            />
          ))}

          {drag && ghost && (
            <g transform={`translate(${drag.x}, ${drag.y})`} style={{ pointerEvents: 'none' }}>
              <rect
                x={-(isFocusKind(ghost.kind) ? TREE_FOCUS_NODE_W : TREE_NODE_W) / 2}
                y={-(isFocusKind(ghost.kind) ? TREE_FOCUS_NODE_H : TREE_NODE_H) / 2}
                width={isFocusKind(ghost.kind) ? TREE_FOCUS_NODE_W : TREE_NODE_W}
                height={isFocusKind(ghost.kind) ? TREE_FOCUS_NODE_H : TREE_NODE_H}
                rx={18}
                fill="#fff"
                stroke={ACCENT}
                strokeWidth={2.5}
                opacity={0.95}
                filter="url(#hm-ft-shadow)"
              />
              <circle cx={0} cy={-16} r={15} fill={ghost.color} />
              <text textAnchor="middle" dominantBaseline="central" y={-16} fontSize={13} fontWeight={700} fill="#fff">
                {ghost.name[0]?.toUpperCase()}
              </text>
              <text textAnchor="middle" y={14} fontSize={11} fontWeight={700} fill={NAVY}>
                {ghost.name.length > 9 ? `${ghost.name.slice(0, 8)}…` : ghost.name}
              </text>
            </g>
          )}
        </svg>
      </div>

      <div className="hm-family-tree-panel__history" style={{ padding: '0 14px 12px', background: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: NAVY, fontWeight: 700 }}>
            {copy.history}
          </div>
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            style={{
              background: 'none',
              border: 'none',
              color: ACCENT,
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            {showHistory ? copy.hideHistory : copy.showHistory}
          </button>
        </div>

        {showHistory && (
          history.length === 0 ? (
            <div style={{ fontSize: 11.5, color: MUTED, padding: '6px 0 2px' }}>{copy.noHistory}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', position: 'relative' }}>
              <div
                style={{
                  position: 'absolute',
                  left: 15,
                  top: 6,
                  bottom: 6,
                  width: 2,
                  background: 'linear-gradient(180deg, #BEB4CD, rgba(190, 180, 205, 0.15))',
                  borderRadius: 2,
                }}
              />
              {history.map((ev) => (
                <div key={ev.id} style={{ display: 'flex', gap: 12, padding: '7px 0', alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: 32,
                      flexShrink: 0,
                      textAlign: 'center',
                      fontSize: 10,
                      fontWeight: 800,
                      color: NAVY,
                      zIndex: 1,
                      background: '#fff',
                      borderRadius: 8,
                      padding: '2px 0',
                    }}
                  >
                    {ev.year}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: ACCENT, letterSpacing: 0.4 }}>
                      {displayUppercase(ev.label, lang)}
                    </div>
                    <div style={{ fontSize: 12, color: NAVY, fontWeight: 500, lineHeight: 1.35 }}>{ev.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        <div style={{ fontSize: 10.5, color: '#A89F98', textAlign: 'center', marginTop: 10 }}>
          {people.length <= 1 ? copy.empty : copy.tapHint}
        </div>
      </div>
    </div>
  )
}
