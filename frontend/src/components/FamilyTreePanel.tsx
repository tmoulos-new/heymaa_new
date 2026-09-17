import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import { displayUppercase } from '../lib/greekText'
import type { FamilyChild, FamilyMemberRecord, FamilyPhotoFrame } from '../lib/familyData'
import { albumPhotoFrameStyle } from '../lib/memoriesBooklet'
import {
  TREE_FOCUS_NODE_H,
  TREE_FOCUS_NODE_W,
  TREE_NODE_H,
  TREE_NODE_W,
  avatarInitial,
  buildHistoryEvents,
  buildTreePeople,
  isFocusKind,
  layoutFamilyTree,
  placeMemberInTree,
  relationshipForGenerationDrop,
  relationshipLabel,
  type LaidOutNode,
  type TreeRowSlot,
} from '../lib/familyTree'

const ACCENT = '#BEB4CD'
const MUTED = 'rgba(43, 58, 103, 0.55)'
const BLOOD_LINE = 'rgba(43, 58, 103, 0.32)'
const DRAG_ARM_MS = 240
const DRAG_MOVE_PX = 8

function TreeFramedPhoto({
  href,
  frame,
  x,
  y,
  w,
  h,
  clipId,
}: {
  href: string
  frame?: FamilyPhotoFrame
  x: number
  y: number
  w: number
  h: number
  clipId: string
}) {
  const imgStyle = albumPhotoFrameStyle(frame, true) as CSSProperties
  return (
    <foreignObject x={x} y={y} width={w} height={h} clipPath={`url(#${clipId})`} pointerEvents="none">
      <div style={{ width: `${w}px`, height: `${h}px`, overflow: 'hidden', pointerEvents: 'none' }}>
        <img src={href} alt="" draggable={false} style={imgStyle} />
      </div>
    </foreignObject>
  )
}

type DragState = {
  memberIndex: number
  pointerId: number
  startSvgX: number
  startSvgY: number
  startClientX: number
  startClientY: number
  x: number
  y: number
  moved: boolean
  armed: boolean
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
  lang,
  dragging,
  onPointerDown,
}: {
  node: LaidOutNode
  lang: string
  dragging: boolean
  onPointerDown?: (e: ReactPointerEvent, node: LaidOutNode) => void
}) {
  const initial = avatarInitial(node.name)
  const focus = isFocusKind(node.kind)
  const w = focus ? TREE_FOCUS_NODE_W : TREE_NODE_W
  const h = focus ? TREE_FOCUS_NODE_H : TREE_NODE_H
  const movable = node.memberIndex != null
  const editable = node.kind !== 'pregnancy'
  const hasPhoto = Boolean(node.photo)
  const rx = focus ? 18 : 14
  const x = -w / 2
  const y = -h / 2
  const clipId = `hm-avatar-${node.id.replace(/[^a-zA-Z0-9_-]/g, '_')}`
  const fadeId = `${clipId}-fade`
  const roleLabel = relationshipLabel(node.role, lang, true)

  return (
    <g
      transform={`translate(${node.x}, ${node.y})`}
      style={{
        cursor: movable ? (dragging ? 'grabbing' : 'grab') : editable ? 'pointer' : 'default',
        opacity: dragging ? 0.35 : 1,
      }}
      onPointerDown={(e) => onPointerDown?.(e, node)}
    >
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} rx={rx} />
        </clipPath>
        <linearGradient id={fadeId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="40%" stopColor="#1a2238" stopOpacity="0" />
          <stop offset="100%" stopColor="#1a2238" stopOpacity="0.72" />
        </linearGradient>
      </defs>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={rx}
        fill={node.color}
        filter="url(#hm-ft-shadow)"
      />
      {hasPhoto ? (
        <TreeFramedPhoto
          href={node.photo!}
          frame={node.photoFrame}
          x={x}
          y={y}
          w={w}
          h={h}
          clipId={clipId}
        />
      ) : (
        <text
          textAnchor="middle"
          dominantBaseline="central"
          y={focus ? -12 : -10}
          fontSize={focus ? 20 : 17}
          fontWeight={700}
          fill="#fff"
          fontFamily="'DM Sans', sans-serif"
        >
          {initial}
        </text>
      )}
      <rect x={x} y={y} width={w} height={h} rx={rx} fill={`url(#${fadeId})`} />
      {editable && (
        <>
          <circle
            cx={w / 2 - 11}
            cy={-h / 2 + 11}
            r={7}
            fill="#fff"
            stroke={ACCENT}
            strokeWidth={1.25}
          />
          <text
            x={w / 2 - 11}
            y={-h / 2 + 11.5}
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
        <text
          x={0}
          y={-h / 2 + 11}
          textAnchor="middle"
          fontSize={9}
          fill="#fff"
          opacity={0.85}
        >
          ⋮⋮
        </text>
      )}
      <text
        textAnchor="middle"
        y={focus ? 14 : 12}
        fontSize={focus ? 11.5 : 10.5}
        fontWeight={700}
        fill="#fff"
        fontFamily="'DM Sans', sans-serif"
      >
        {node.name.length > (focus ? 10 : 9) ? `${node.name.slice(0, focus ? 9 : 8)}…` : node.name}
      </text>
      <text
        textAnchor="middle"
        y={focus ? 28 : 26}
        fontSize={8.5}
        fill="rgba(255,255,255,0.9)"
        fontFamily="'DM Sans', sans-serif"
      >
        {roleLabel.length > 12 ? `${roleLabel.slice(0, 11)}…` : roleLabel}
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
  selfPhotoFrame,
  onNodeSelect,
  onEditNode,
  onPlaceMembers,
}: {
  userName: string
  lang: string
  familyChildren: FamilyChild[]
  members: FamilyMemberRecord[]
  pregnancyActive: boolean
  memoryCounts?: Record<string, number>
  selfPhoto?: string
  selfPhotoFrame?: FamilyPhotoFrame
  onNodeSelect?: (ref?: string) => void
  onEditNode?: (node: LaidOutNode) => void
  onPlaceMembers?: (nextMembers: FamilyMemberRecord[]) => void
}) {
  const el = lang === 'el'
  const svgRef = useRef<SVGSVGElement | null>(null)
  const armTimerRef = useRef<number | null>(null)
  const dragRef = useRef<DragState | null>(null)
  const [showTree, setShowTree] = useState(true)
  const [showHistory, setShowHistory] = useState(true)
  const [drag, setDrag] = useState<DragState | null>(null)
  const [hoverSlot, setHoverSlot] = useState<TreeRowSlot | null>(null)
  dragRef.current = drag

  const copy = useMemo(
    () => ({
      title: el ? 'Οικογενειακό Δέντρο' : 'Family Tree',
      subtitle: el
        ? 'Επίλεξε, μετακίνησε ή διέγραψε μέλη, κατοικίδια και συγγενείς'
        : 'Choose, move, or delete members, pets, and relatives',
      you: el ? 'Εσύ' : 'You',
      pregnancy: el ? 'Εγκυμοσύνη' : 'Pregnancy',
      child: el ? 'Παιδί' : 'Child',
      history: el ? 'Χρονολόγιο' : 'Timeline',
      hideHistory: el ? 'Απόκρυψη' : 'Hide',
      showHistory: el ? 'Εμφάνιση' : 'Show',
      tapHint: el
        ? 'Πάτα για επεξεργασία · κράτα και σύρε για μετακίνηση'
        : 'Tap to edit · hold and drag to move',
      empty: el
        ? 'Πρόσθεσε σύντροφο, παιδιά ή μέλη για να γεμίσει το δέντρο'
        : 'Add a partner, kids, or members to grow the tree',
      noHistory: el ? 'Πρόσθεσε ημερομηνίες γέννησης για να φανεί η ιστορία' : 'Add birth dates to reveal family history',
      dropHere: el ? 'Άφησε εδώ' : 'Drop here',
      hide: el ? 'Απόκρυψη' : 'Hide',
      show: el ? 'Εμφάνιση' : 'Show',
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
        selfPhotoFrame,
      }),
    [userName, copy, pregnancyActive, familyChildren, members, memoryCounts, selfPhoto, selfPhotoFrame],
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

  const clearArmTimer = () => {
    if (armTimerRef.current != null) {
      window.clearTimeout(armTimerRef.current)
      armTimerRef.current = null
    }
  }

  const releasePointer = (pointerId: number) => {
    try {
      svgRef.current?.releasePointerCapture(pointerId)
    } catch {
      /* ignore */
    }
  }

  const capturePointer = (pointerId: number) => {
    const svg = svgRef.current
    if (!svg) return
    try {
      svg.setPointerCapture(pointerId)
    } catch {
      /* pointer already up */
    }
  }

  useEffect(() => () => clearArmTimer(), [])

  // If the finger starts scrolling the page, drop the pending tree drag so the
  // tree cannot steal the gesture with pointer capture / touch-action:none.
  useEffect(() => {
    if (!drag || drag.moved || drag.armed) return

    const abortPending = () => {
      clearArmTimer()
      setDrag(null)
      setHoverSlot(null)
    }

    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      const dx = e.clientX - drag.startClientX
      const dy = e.clientY - drag.startClientY
      if (Math.hypot(dx, dy) < DRAG_MOVE_PX) return
      if (Math.abs(dy) >= Math.abs(dx)) abortPending()
    }

    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== drag.pointerId) return
      abortPending()
    }

    const scroller = document.querySelector('.hm-app-body')
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointercancel', onCancel)
    scroller?.addEventListener('scroll', abortPending, { passive: true })
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointercancel', onCancel)
      scroller?.removeEventListener('scroll', abortPending)
    }
  }, [drag])

  const onPointerDown = (e: ReactPointerEvent, node: LaidOutNode) => {
    if (node.memberIndex == null || !svgRef.current || !onPlaceMembers) {
      activateNode(node)
      return
    }
    const svg = svgRef.current
    const p = clientToSvg(svg, e.clientX, e.clientY)
    clearArmTimer()
    const pointerId = e.pointerId
    setDrag({
      memberIndex: node.memberIndex,
      pointerId,
      startSvgX: p.x,
      startSvgY: p.y,
      startClientX: e.clientX,
      startClientY: e.clientY,
      x: node.x,
      y: node.y,
      moved: false,
      armed: false,
    })
    armTimerRef.current = window.setTimeout(() => {
      armTimerRef.current = null
      const current = dragRef.current
      if (!current || current.pointerId !== pointerId || current.moved) return
      capturePointer(pointerId)
      setDrag((prev) => (prev && prev.pointerId === pointerId ? { ...prev, armed: true } : prev))
    }, DRAG_ARM_MS)
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    if (!drag || !svgRef.current || e.pointerId !== drag.pointerId) return
    const clientDx = e.clientX - drag.startClientX
    const clientDy = e.clientY - drag.startClientY
    const clientDist = Math.hypot(clientDx, clientDy)

    if (!drag.moved && !drag.armed) {
      if (clientDist < DRAG_MOVE_PX) return
      if (Math.abs(clientDy) >= Math.abs(clientDx)) {
        clearArmTimer()
        setDrag(null)
        setHoverSlot(null)
        return
      }
      clearArmTimer()
      capturePointer(drag.pointerId)
    }

    const p = clientToSvg(svgRef.current, e.clientX, e.clientY)
    const dx = p.x - drag.startSvgX
    const dy = p.y - drag.startSvgY
    const node = layout.nodes.find((n) => n.memberIndex === drag.memberIndex)
    if (!node) return
    const x = node.x + dx
    const y = node.y + dy
    const band = resolveBand(y)
    setHoverSlot(band?.slot ?? null)
    setDrag({ ...drag, x, y, moved: true, armed: true })
  }

  const finishDrag = (e: ReactPointerEvent, cancelled = false) => {
    clearArmTimer()
    if (!drag || e.pointerId !== drag.pointerId) return
    releasePointer(e.pointerId)

    const node = layout.nodes.find((n) => n.memberIndex === drag.memberIndex)
    if (cancelled || !drag.moved || !node || !onPlaceMembers) {
      if (!cancelled && !drag.moved) activateNode(node)
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
            <button
              type="button"
              className="hm-family-tree-panel__visibility-toggle"
              onClick={() => setShowTree((v) => !v)}
            >
              {showTree ? copy.hide : copy.show}
            </button>
          </div>
        </div>
        {showTree && (
          <div style={{ fontSize: 11.5, color: MUTED, marginTop: 4, lineHeight: 1.45 }}>{copy.subtitle}</div>
        )}
      </div>

      {showTree && (
      <>
      <div className="hm-family-tree-panel__canvas">
        <svg
          ref={svgRef}
          className={`hm-family-tree-panel__svg${drag?.armed || drag?.moved ? ' hm-family-tree-panel__svg--dragging' : ''}`}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMidYMin meet"
          onPointerMove={onPointerMove}
          onPointerUp={(e) => finishDrag(e, false)}
          onPointerCancel={(e) => finishDrag(e, true)}
        >
          <defs>
            <filter id="hm-ft-shadow" x="-25%" y="-25%" width="150%" height="150%">
              <feDropShadow dx="0" dy="2" stdDeviation="2.5" floodColor="rgba(43,58,103,.08)" />
            </filter>
          </defs>

          <g className="hm-family-tree-edges" pointerEvents="none">
            {layout.edges.map((e, i) => (
              <line
                key={`edge-${i}`}
                x1={e.x1}
                y1={e.y1}
                x2={e.x2}
                y2={e.y2}
                stroke={e.kind === 'spouse' ? ACCENT : BLOOD_LINE}
                strokeWidth={e.kind === 'spouse' ? 2 : 1.5}
                strokeLinecap={e.kind === 'spouse' ? 'round' : 'butt'}
                opacity={drag?.moved || drag?.armed ? 0.35 : 1}
              />
            ))}

            {layout.edges
              .filter((e) => e.kind === 'spouse')
              .map((e, i) => (
                <text
                  key={`heart-${i}`}
                  x={(e.x1 + e.x2) / 2}
                  y={(e.y1 + e.y2) / 2 + 3}
                  textAnchor="middle"
                  fontSize={9}
                  fill={ACCENT}
                  opacity={drag?.moved || drag?.armed ? 0.35 : 0.9}
                >
                  ♡
                </text>
              ))}
          </g>

          {drag &&
            hoverSlot &&
            layout.genBands
              .filter((b) => b.slot === hoverSlot)
              .map((b) => (
                <g key={`drop-${b.slot}`} pointerEvents="none">
                  <rect
                    x={12}
                    y={b.yTop}
                    width={layout.width - 24}
                    height={b.yBottom - b.yTop}
                    rx={10}
                    fill="rgba(190,180,205,.14)"
                    stroke={ACCENT}
                    strokeWidth={1.25}
                    strokeDasharray="5 4"
                  />
                  <text
                    x={layout.width / 2}
                    y={(b.yTop + b.yBottom) / 2 + 4}
                    textAnchor="middle"
                    fontSize={10}
                    fontWeight={700}
                    fill={ACCENT}
                    fontFamily="'DM Sans', sans-serif"
                  >
                    {displayUppercase(copy.dropHere, lang)}
                  </text>
                </g>
              ))}

          <g className="hm-family-tree-cards">
            {layout.nodes.map((n) => (
              <TreeCard
                key={n.id}
                node={n}
                lang={lang}
                dragging={!!drag && drag.memberIndex === n.memberIndex && (drag.moved || drag.armed)}
                onPointerDown={onPointerDown}
              />
            ))}
          </g>

          {drag && (drag.moved || drag.armed) && ghost && (
            <g transform={`translate(${drag.x}, ${drag.y})`} style={{ pointerEvents: 'none' }}>
              {(() => {
                const gw = isFocusKind(ghost.kind) ? TREE_FOCUS_NODE_W : TREE_NODE_W
                const gh = isFocusKind(ghost.kind) ? TREE_FOCUS_NODE_H : TREE_NODE_H
                const gx = -gw / 2
                const gy = -gh / 2
                return (
                  <>
                    {ghost.photo ? (
                      <defs>
                        <clipPath id="hm-ft-ghost-clip">
                          <rect x={gx} y={gy} width={gw} height={gh} rx={18} />
                        </clipPath>
                      </defs>
                    ) : null}
                    <rect
                      x={gx}
                      y={gy}
                      width={gw}
                      height={gh}
                      rx={18}
                      fill={ghost.color}
                      opacity={0.95}
                      filter="url(#hm-ft-shadow)"
                    />
                    {ghost.photo ? (
                      <TreeFramedPhoto
                        href={ghost.photo}
                        frame={ghost.photoFrame}
                        x={gx}
                        y={gy}
                        w={gw}
                        h={gh}
                        clipId="hm-ft-ghost-clip"
                      />
                    ) : (
                      <text textAnchor="middle" dominantBaseline="central" y={-10} fontSize={18} fontWeight={700} fill="#fff">
                        {avatarInitial(ghost.name)}
                      </text>
                    )}
                    <text textAnchor="middle" y={14} fontSize={11} fontWeight={700} fill="#fff">
                      {ghost.name.length > 9 ? `${ghost.name.slice(0, 8)}…` : ghost.name}
                    </text>
                  </>
                )
              })()}
            </g>
          )}
        </svg>
      </div>

      <div className="hm-family-tree-panel__history">
        <div className="hm-family-tree-panel__history-head">
          <div className="hm-family-tree-panel__history-title">{copy.history}</div>
          <button
            type="button"
            className="hm-family-tree-panel__history-toggle"
            onClick={() => setShowHistory((v) => !v)}
          >
            {showHistory ? copy.hideHistory : copy.showHistory}
          </button>
        </div>

        {showHistory &&
          (history.length === 0 ? (
            <div className="hm-family-tree-panel__history-empty">{copy.noHistory}</div>
          ) : (
            <div className="hm-family-tree-panel__timeline">
              <div className="hm-family-tree-panel__timeline-rail" />
              {history.map((ev) => (
                <div key={ev.id} className="hm-family-tree-panel__timeline-row">
                  <div className="hm-family-tree-panel__timeline-year">{ev.year}</div>
                  <div className="hm-family-tree-panel__timeline-body">
                    <div className="hm-family-tree-panel__timeline-label">
                      {displayUppercase(ev.label, lang)}
                    </div>
                    <div className="hm-family-tree-panel__timeline-detail">{ev.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          ))}

        <div className="hm-family-tree-panel__hint">
          {people.length <= 1 ? copy.empty : copy.tapHint}
        </div>
      </div>
      </>
      )}
    </div>
  )
}
