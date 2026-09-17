import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import type { FamilyChild, FamilyMemberRecord } from '../lib/familyData'
import {
  albumPhotoFrameStyle,
  bookletLabelsForLang,
  clampAlbumPhotoFrame,
  defaultBookletDateRange,
  downloadMemoriesBooklet,
  formatBookletDateRangeLabel,
  frameFromMemory,
  memoriesInDateRange,
  prepareBookletContent,
  type AlbumPhotoFrame,
  type BookletFlipPage,
  type BookletMemory,
} from '../lib/memoriesBooklet'
import { displayUppercase } from '../lib/greekText'
import { AppModalPortal } from './AppModalPortal'
import { HmDateField } from './HmDateField'
import { AUTH_LOGO_SRC } from '../auth/authLogo'

const LINEN = '#F0EBE6'
const NAVY = '#2B3A67'
const NAVY_MUTED = 'rgba(43, 58, 103, 0.55)'
const PURPLE = '#BEB4CD'
const PURPLE_SOFT = '#D4C8E8'
const PAPER = '#FFFBF7'
const MAGENTA = '#de5a9e'

function OrnamentLine({ light = false }: { light?: boolean }) {
  return (
    <div
      style={{
        width: 52,
        height: 1,
        margin: '0 auto',
        background: light
          ? 'linear-gradient(90deg, transparent, rgba(255,251,247,.7), transparent)'
          : `linear-gradient(90deg, transparent, ${PURPLE_SOFT}, transparent)`,
      }}
    />
  )
}

function AlbumPagePhoto({
  memory,
  labels,
  dateLabel,
  align = 'left',
  onSaveFrame,
}: {
  memory: BookletMemory
  labels: ReturnType<typeof bookletLabelsForLang>
  dateLabel?: string
  align?: 'left' | 'right'
  onSaveFrame?: (m: BookletMemory, frame: AlbumPhotoFrame) => void
}) {
  const saved = frameFromMemory(memory)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<AlbumPhotoFrame>(saved)
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null)

  useEffect(() => {
    if (!editing) setDraft(frameFromMemory(memory))
  }, [memory, memory.focusX, memory.focusY, memory.zoom, editing])

  const shown = editing ? draft : saved

  const setZoom = (zoom: number) => {
    setDraft((d) => clampAlbumPhotoFrame({ ...d, zoom }))
  }

  return (
    <div
      style={{
        background: LINEN,
        padding: 0,
        border: 'none',
        boxShadow: 'none',
        width: '100%',
        flex: 1,
        minHeight: 0,
        minWidth: 0,
        boxSizing: 'border-box',
        display: 'flex',
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          background: '#EDE6DC',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          position: 'relative',
          touchAction: editing ? 'none' : 'auto',
          cursor: editing ? 'grab' : 'default',
        }}
        onPointerDown={(e) => {
          if (!editing) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drag.current = { x: e.clientX, y: e.clientY, fx: draft.x, fy: draft.y }
        }}
        onPointerMove={(e) => {
          if (!editing || !drag.current) return
          const rect = e.currentTarget.getBoundingClientRect()
          if (!rect.width || !rect.height) return
          const x = Math.min(100, Math.max(0, drag.current.fx - ((e.clientX - drag.current.x) / rect.width) * 100))
          const y = Math.min(100, Math.max(0, drag.current.fy - ((e.clientY - drag.current.y) / rect.height) * 100))
          setDraft((d) => ({ ...d, x, y }))
        }}
        onPointerUp={() => {
          drag.current = null
        }}
        onPointerCancel={() => {
          drag.current = null
        }}
      >
        <img
          src={memory.img}
          alt=""
          draggable={false}
          style={albumPhotoFrameStyle(shown, true)}
        />
        {editing && (
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: 22,
              height: 22,
              margin: '-11px 0 0 -11px',
              border: '2px solid #fff',
              borderRadius: '50%',
              boxShadow: '0 0 0 1px rgba(43,58,103,.45), 0 4px 10px rgba(0,0,0,.25)',
              pointerEvents: 'none',
            }}
          />
        )}
      </div>
      {dateLabel && !editing && (
        <div
          style={{
            position: 'absolute',
            left: align === 'left' ? 8 : undefined,
            right: align === 'right' ? 8 : undefined,
            bottom: 8,
            zIndex: 2,
            fontSize: 9,
            color: '#fff',
            fontWeight: 700,
            letterSpacing: '0.08em',
            textAlign: align,
            textShadow: '0 1px 4px rgba(0,0,0,.45)',
            pointerEvents: 'none',
          }}
        >
          {dateLabel}
        </div>
      )}
      <button
        type="button"
        title={labels.editPhoto}
        aria-label={labels.editPhoto}
        onClick={(e) => {
          e.stopPropagation()
          if (editing) {
            setDraft(saved)
            setEditing(false)
            return
          }
          setDraft(saved)
          setEditing(true)
        }}
        style={{
          position: 'absolute',
          top: 8,
          left: align === 'left' ? 8 : 'auto',
          right: align === 'right' ? 8 : 'auto',
          zIndex: 3,
          border: 'none',
          width: 28,
          height: 28,
          borderRadius: 999,
          background: editing ? NAVY : MAGENTA,
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          boxShadow: '0 3px 10px rgba(0,0,0,.2)',
        }}
      >
        {editing ? (
          <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>×</span>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20z"
              stroke="#fff"
              strokeWidth="1.8"
              strokeLinejoin="round"
            />
            <path d="M13.2 6.3l4.5 4.5" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        )}
      </button>
      {editing && (
        <div
          style={{
            position: 'absolute',
            left: 6,
            right: 6,
            bottom: 6,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            background: 'rgba(255,251,247,.92)',
            borderRadius: 999,
            padding: '4px 6px 4px 8px',
            boxShadow: '0 4px 12px rgba(43,58,103,.16)',
          }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            title={labels.zoomOut}
            aria-label={labels.zoomOut}
            onClick={() => setZoom(draft.zoom - 0.15)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              border: 'none',
              background: NAVY,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            −
          </button>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={draft.zoom}
            title={labels.focalHint}
            aria-label={labels.zoomIn}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, minWidth: 0, accentColor: MAGENTA, height: 18 }}
          />
          <button
            type="button"
            title={labels.zoomIn}
            aria-label={labels.zoomIn}
            onClick={() => setZoom(draft.zoom + 0.15)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 999,
              border: 'none',
              background: NAVY,
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              cursor: 'pointer',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            +
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              const next = clampAlbumPhotoFrame(draft)
              onSaveFrame?.(memory, next)
              setDraft(next)
              setEditing(false)
            }}
            style={{
              flexShrink: 0,
              padding: '5px 10px',
              border: 'none',
              borderRadius: 999,
              background: MAGENTA,
              color: '#fff',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 11,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {labels.savePhotoFrame}
          </button>
        </div>
      )}
    </div>
  )
}

function FlipPageContent({
  page,
  labels,
  lang,
  side = 'right',
  onSavePhotoFrame,
}: {
  page: BookletFlipPage
  labels: ReturnType<typeof bookletLabelsForLang>
  lang: string
  side?: 'left' | 'right'
  onSavePhotoFrame?: (m: BookletMemory, frame: AlbumPhotoFrame) => void
}) {
  const align = side === 'left' ? 'left' : 'right'
  const BORDER = '1px solid rgba(43,58,103,.10)'

  if (page.type === 'cover') {
    return (
      <div
        style={{
        height: '100%',
        minHeight: 0,
        borderRadius: 0,
          padding: page.coverImg ? 0 : '40px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          background: page.coverImg
            ? NAVY
            : 'radial-gradient(ellipse at 30% 20%, rgba(248,229,214,.55), transparent 50%), radial-gradient(ellipse at 80% 85%, rgba(190,180,205,.35), transparent 45%), linear-gradient(165deg, #2B3A67 0%, #3D4F7A 42%, #BEB4CD 78%, #F8E5D6 100%)',
          color: PAPER,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {page.coverImg && (
          <>
            <img
              src={page.coverImg}
              alt=""
              style={{
                position: 'absolute',
                inset: 0,
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                objectPosition: 'center',
              }}
            />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background:
                  'linear-gradient(180deg, rgba(43,58,103,.28) 0%, rgba(43,58,103,.62) 42%, rgba(43,58,103,.88) 100%)',
              }}
            />
          </>
        )}
        <div
          style={{
            position: 'relative',
            zIndex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: page.coverImg ? '40px 28px' : 0,
            width: '100%',
            boxSizing: 'border-box',
          }}
        >
        <OrnamentLine light />
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 10,
            margin: '16px 0 16px',
            animation: 'hm-book-float 3.2s ease-in-out infinite',
          }}
        >
          <img
            src={AUTH_LOGO_SRC}
            alt="HeyMaa"
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              objectFit: 'cover',
              display: 'block',
              boxShadow: '0 8px 24px rgba(0,0,0,.28)',
              background: '#fff',
            }}
          />
          <div
            style={{
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 20,
              fontWeight: 600,
              letterSpacing: '0.02em',
            }}
          >
            Hey<span style={{ color: '#F8E5D6' }}>Maa</span>
          </div>
        </div>
        <h1
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 28,
            fontWeight: 600,
            lineHeight: 1.18,
            margin: '0 0 12px',
            maxWidth: 300,
          }}
        >
          {page.title}
        </h1>
        <p
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 17,
            fontStyle: 'italic',
            opacity: 0.9,
            margin: '0 0 18px',
            maxWidth: 280,
            lineHeight: 1.4,
          }}
        >
          {page.subtitle || labels.dedication}
        </p>
        <OrnamentLine light />
        <p style={{ fontSize: 14, opacity: 0.9, margin: '18px 0 0', fontWeight: 500, letterSpacing: '0.03em' }}>
          {page.periodLabel}
        </p>
        <p style={{ fontSize: 12, opacity: 0.78, marginTop: 18 }}>
          {labels.memoriesCount.replace('{count}', String(page.memoryCount))}
        </p>
        <p
          style={{
            marginTop: 36,
            fontSize: 10,
            letterSpacing: 1.6,
            opacity: 0.7,
          }}
        >
          {displayUppercase(page.madeWith, lang)}
        </p>
        </div>
      </div>
    )
  }

  if (page.type === 'toc') {
    return (
      <div
        style={{
          height: '100%',
          minHeight: 0,
          padding: '16px 16px 12px',
          background: PAPER,
          position: 'relative',
          overflow: 'hidden',
          boxSizing: 'border-box',
          textAlign: align,
        }}
      >
        <h2
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 18,
            color: NAVY,
            margin: '0 0 6px',
            fontWeight: 600,
            textAlign: align,
          }}
        >
          {page.title}
        </h2>
        <p
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 13,
            fontStyle: 'italic',
            color: NAVY_MUTED,
            margin: '0 0 16px',
            textAlign: align,
          }}
        >
          {page.periodLabel}
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {page.items.map((item, idx) => (
            <li
              key={`${item.label}-${item.meta}-${idx}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexDirection: align === 'right' ? 'row-reverse' : 'row',
                alignItems: 'baseline',
                gap: 12,
                padding: '10px 0',
                borderBottom: BORDER,
                color: NAVY,
                fontSize: 14,
                fontFamily: "'DM Sans',sans-serif",
                fontWeight: 500,
                textAlign: align,
              }}
            >
              <span>
                {item.icon} {item.label}
              </span>
              <span
                style={{
                  color: NAVY_MUTED,
                  fontFamily: "'DM Sans',sans-serif",
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {item.meta}
              </span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div
      style={{
        height: '100%',
        minHeight: 0,
        padding: '12px 12px 10px',
        background: PAPER,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
        textAlign: align,
      }}
    >
      <h2
        style={{
          fontFamily: "'DM Sans',sans-serif",
          fontSize: 16,
          color: NAVY,
          margin: '0 0 2px',
          paddingBottom: 6,
          borderBottom: BORDER,
          display: 'flex',
          alignItems: 'center',
          justifyContent: align === 'right' ? 'flex-end' : 'flex-start',
          gap: 8,
          fontWeight: 600,
          textAlign: align,
        }}
      >
        <span style={{ flex: align === 'right' ? undefined : 1 }}>{page.label}</span>
        {page.partLabel && (
          <span style={{ fontSize: 11, color: NAVY_MUTED, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, letterSpacing: '0.06em' }}>
            {page.partLabel}
          </span>
        )}
      </h2>
      {page.albumTitle ? (
        <p
          style={{
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 12,
            fontStyle: 'italic',
            color: NAVY_MUTED,
            margin: '0 0 8px',
            fontWeight: 500,
            textAlign: align,
          }}
        >
          {page.albumTitle}
        </p>
      ) : null}
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {page.memories.length === 0 ? (
        <p style={{ fontSize: 14, color: NAVY_MUTED, fontFamily: "'DM Sans',sans-serif", fontStyle: 'italic' }}>—</p>
      ) : (
        page.memories.map((m, i) => {
          const rawText = (m.text || '').trim()
          const hasText = Boolean(rawText && rawText !== '📷' && rawText !== page.label)
          return (
          <article
            key={`${m.date}-${i}-${m.text?.slice(0, 12)}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: 0,
              margin: 0,
              flex: 1,
              minHeight: 0,
              minWidth: 0,
              overflow: 'hidden',
            }}
          >
            {m.img ? (
              <AlbumPagePhoto
                memory={m}
                labels={labels}
                dateLabel={displayUppercase(m.date, lang)}
                align={align}
                onSaveFrame={onSavePhotoFrame}
              />
            ) : null}
            {!m.img && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', flexShrink: 0 }}>
              <div style={{ width: 28, textAlign: 'center', fontSize: 20, flexShrink: 0, opacity: 0.8 }}>
                {m.emoji || '✦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {hasText && (
                  <div
                    style={{
                      fontFamily: "'DM Sans',sans-serif",
                      fontSize: 17,
                      color: NAVY,
                      fontWeight: 500,
                      lineHeight: 1.4,
                      marginBottom: 6,
                    }}
                  >
                    {m.text}
                  </div>
                )}
                <div
                  style={{
                    fontSize: 10,
                    color: NAVY_MUTED,
                    fontWeight: 600,
                    textAlign: align,
                  }}
                >
                  {displayUppercase(m.date, lang)}
                </div>
              </div>
            </div>
            )}
          </article>
          )
        })
      )}
      </div>
    </div>
  )
}

export function BookletFlipbookModal({
  pages,
  labels,
  lang,
  onClose,
  onSave,
  onSavePhotoFrame,
}: {
  pages: BookletFlipPage[]
  labels: ReturnType<typeof bookletLabelsForLang>
  lang: string
  onClose: () => void
  onSave?: () => void
  onSavePhotoFrame?: (m: BookletMemory, frame: AlbumPhotoFrame) => void
}) {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [animKey, setAnimKey] = useState(0)
  const [singlePage, setSinglePage] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches,
  )
  const total = pages.length
  const spreadCount = total === 0 ? 0 : 1 + Math.ceil(Math.max(0, total - 1) / 2)
  const stepCount = singlePage ? total : spreadCount
  const safeIndex = stepCount === 0 ? 0 : Math.min(index, stepCount - 1)
  const isCover = singlePage ? safeIndex <= 0 : safeIndex <= 0
  const isLast = stepCount === 0 || safeIndex >= stepCount - 1
  const interiorStart = isCover || singlePage ? -1 : 1 + (safeIndex - 1) * 2
  const currentPage = singlePage ? pages[safeIndex] : undefined
  const currentSide: 'left' | 'right' = !singlePage || safeIndex <= 0 ? 'right' : safeIndex % 2 === 1 ? 'left' : 'right'
  const leftPage = singlePage || isCover ? undefined : pages[interiorStart]
  const rightPage = singlePage || isCover ? undefined : pages[interiorStart + 1]
  const coverPage = pages[0]
  const onePageLayout = singlePage || isCover
  const navBtn: CSSProperties = {
    padding: singlePage ? '10px 10px' : '10px 14px',
    borderRadius: 12,
    border: 'none',
    color: '#fff',
    fontFamily: "'DM Sans',sans-serif",
    fontSize: singlePage ? 12 : 13,
    fontWeight: 700,
    cursor: 'pointer',
    minWidth: singlePage ? 72 : 96,
    minHeight: 40,
    boxShadow: '0 6px 16px rgba(43,58,103,.22)',
  }

  const skipPageReset = useRef(true)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 720px)')
    const update = () => setSinglePage(mq.matches)
    update()
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])

  useEffect(() => {
    if (skipPageReset.current) {
      skipPageReset.current = false
      return
    }
    setIndex(0)
    setAnimKey((k) => k + 1)
  }, [singlePage])

  useEffect(() => {
    if (index !== safeIndex) setIndex(safeIndex)
  }, [index, safeIndex])

  const go = (next: number, d: 'next' | 'prev') => {
    if (next < 0 || next >= stepCount) return
    setDir(d)
    setIndex(next)
    setAnimKey((k) => k + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(safeIndex + 1, 'next')
      if (e.key === 'ArrowLeft') go(safeIndex - 1, 'prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, stepCount])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const pageLabel = singlePage || isCover
    ? labels.pageOf
        .replace('{current}', String(singlePage ? safeIndex + 1 : 1))
        .replace('{total}', String(total))
    : labels.pageOf
        .replace('{current}', rightPage ? `${interiorStart + 1}–${interiorStart + 2}` : String(interiorStart + 1))
        .replace('{total}', String(total))

  return (
    <AppModalPortal>
    <div
      role="dialog"
      aria-modal="true"
      className="hm-overlay"
      style={{
        background: 'rgba(43, 58, 103, .62)',
        backdropFilter: 'blur(6px)',
        overflow: 'hidden',
      }}
      onClick={onClose}
    >
      <style>{`
        @keyframes hm-book-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes hm-flip-in-next {
          from { transform: perspective(1200px) rotateY(-18deg) translateX(28px); opacity: 0; }
          to { transform: perspective(1200px) rotateY(0) translateX(0); opacity: 1; }
        }
        @keyframes hm-flip-in-prev {
          from { transform: perspective(1200px) rotateY(18deg) translateX(-28px); opacity: 0; }
          to { transform: perspective(1200px) rotateY(0) translateX(0); opacity: 1; }
        }
      `}</style>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: onePageLayout
            ? 'min(440px, calc(100vw - 24px), calc(100dvh - 150px))'
            : 'min(880px, calc(100vw - 32px), calc((100dvh - 150px) * 2))',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            aspectRatio: onePageLayout ? '1 / 1' : '2 / 1',
            borderRadius: 0,
            overflow: 'hidden',
            background: '#E8E0D6',
            boxShadow: '0 24px 48px rgba(20,24,40,.32)',
            flex: '0 0 auto',
          }}
        >
          <div
            key={animKey}
            style={{
              animation: `${dir === 'next' ? 'hm-flip-in-next' : 'hm-flip-in-prev'} .38s ease`,
              transformOrigin: isCover ? 'left center' : 'center center',
              height: '100%',
              width: '100%',
              overflow: 'hidden',
              display: 'flex',
            }}
          >
            {onePageLayout ? (
              (singlePage ? currentPage : coverPage) ? (
                <div style={{ flex: 1, minWidth: 0, height: '100%' }}>
                  <FlipPageContent
                    page={(singlePage ? currentPage : coverPage)!}
                    labels={labels}
                    lang={lang}
                    side={currentSide}
                    onSavePhotoFrame={onSavePhotoFrame}
                  />
                </div>
              ) : null
            ) : (
              <>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    height: '100%',
                    borderRight: '1px solid rgba(43,58,103,.10)',
                    background: PAPER,
                  }}
                >
                  {leftPage ? (
                    <FlipPageContent
                      page={leftPage}
                      labels={labels}
                      lang={lang}
                      side="left"
                      onSavePhotoFrame={onSavePhotoFrame}
                    />
                  ) : (
                    <div style={{ height: '100%', background: PAPER }} />
                  )}
                </div>
                <div
                  style={{
                    width: 10,
                    flexShrink: 0,
                    background:
                      'linear-gradient(90deg, rgba(43,58,103,.10), rgba(43,58,103,.02) 40%, rgba(43,58,103,.02) 60%, rgba(43,58,103,.10))',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, height: '100%', background: PAPER }}>
                  {rightPage ? (
                    <FlipPageContent
                      page={rightPage}
                      labels={labels}
                      lang={lang}
                      side="right"
                      onSavePhotoFrame={onSavePhotoFrame}
                    />
                  ) : (
                    <div style={{ height: '100%', background: PAPER }} />
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            background: 'rgba(255,255,255,.94)',
            borderRadius: 14,
            padding: '10px 12px',
            boxShadow: '0 8px 24px rgba(0,0,0,.12)',
          }}
        >
          {isCover || safeIndex <= 0 ? (
            <div style={{ minWidth: singlePage ? 72 : 96 }} />
          ) : (
            <button
              type="button"
              onClick={() => go(safeIndex - 1, 'prev')}
              style={{ ...navBtn, background: NAVY }}
            >
              ← {labels.prevPage}
            </button>
          )}
          <div style={{ fontSize: 11.5, color: NAVY_MUTED, fontWeight: 600, textAlign: 'center', flex: 1 }}>
            {pageLabel}
          </div>
          {isLast ? (
            <div style={{ minWidth: singlePage ? 72 : 96 }} />
          ) : (
            <button
              type="button"
              onClick={() => go(safeIndex + 1, 'next')}
              style={{ ...navBtn, background: MAGENTA }}
            >
              {labels.nextPage} →
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px 12px',
              borderRadius: 12,
              border: 'none',
              background: NAVY,
              color: '#fff',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(43,58,103,.28)',
            }}
          >
            ← {labels.backToAlbum}
          </button>
          {onSave && (
          <button
            type="button"
            onClick={onSave}
            style={{
              flex: 1.2,
              padding: '11px 12px',
              borderRadius: 12,
              border: 'none',
              background: MAGENTA,
              color: '#fff',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 6px 16px rgba(222,90,158,.35)',
            }}
          >
            {labels.saveAlbum}
          </button>
          )}

        </div>
      </div>
    </div>
    </AppModalPortal>
  )
}

export function MemoriesBookletPanel({
  memories,
  userName,
  lang,
  familyChildren,
  members,
  onDownload,
  onSave,
  saving,
  onRemovePhoto: _onRemovePhoto,
  onDeleteMemory: _onDeleteMemory,
  variant = 'card',
  journalName,
  onClose,
}: {
  memories: BookletMemory[]
  userName: string
  lang: string
  familyChildren: FamilyChild[]
  members: FamilyMemberRecord[]
  onDownload?: () => void
  onSave?: () => void
  saving?: boolean
  onRemovePhoto?: (m: BookletMemory) => void
  onDeleteMemory?: (m: BookletMemory) => void
  /** card = inline tab block; sheet = inside album modal */
  variant?: 'card' | 'sheet'
  journalName?: string
  onClose?: () => void
}) {
  const el = lang === 'el'
  const saveLabel = el ? 'Αποθήκευση' : 'Save'
  const savingLabel = el ? 'Αποθήκευση…' : 'Saving…'
  const labels = useMemo(() => bookletLabelsForLang(lang), [lang])
  const defaults = useMemo(() => defaultBookletDateRange(memories, lang), [memories, lang])
  const [fromDate, setFromDate] = useState(defaults.fromDate)
  const [toDate, setToDate] = useState(defaults.toDate)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [rangeTouched, setRangeTouched] = useState(false)

  useEffect(() => {
    if (rangeTouched) return
    setFromDate(defaults.fromDate)
    setToDate(defaults.toDate)
  }, [defaults.fromDate, defaults.toDate, rangeTouched])

  const rangeOk = Boolean(fromDate && toDate)
  const normalizedFrom = rangeOk && fromDate > toDate ? toDate : fromDate
  const normalizedTo = rangeOk && fromDate > toDate ? fromDate : toDate
  const countInPeriod = rangeOk
    ? memoriesInDateRange(memories, normalizedFrom, normalizedTo, lang).length
    : 0
  const periodText = rangeOk
    ? formatBookletDateRangeLabel(normalizedFrom, normalizedTo, lang)
    : ''

  const previewPages = useMemo(() => {
    if (!previewOpen || !rangeOk) return []
    return prepareBookletContent({
      userName,
      memories,
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      lang,
      children: familyChildren,
      members,
      labels,
    }).pages
  }, [
    previewOpen,
    rangeOk,
    userName,
    memories,
    normalizedFrom,
    normalizedTo,
    lang,
    familyChildren,
    members,
    labels,
  ])

  const handleDownload = () => {
    if (!rangeOk) return
    const ok = downloadMemoriesBooklet({
      userName,
      memories,
      fromDate: normalizedFrom,
      toDate: normalizedTo,
      lang,
      children: familyChildren,
      members,
      labels,
    })
    if (ok) onDownload?.()
  }

  return (
    <div
      className={variant === 'card' ? 'hm-tab-card' : 'hm-memory-album-sheet'}
      style={variant === 'card' ? { marginBottom: 14, padding: '16px 14px' } : undefined}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22, lineHeight: 1, opacity: 0.85 }}>✦</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div className="hm-tab-card-title" style={{ marginBottom: 0 }}>
              {lang === 'el' ? 'Άλμπουμ Αναμνήσεων' : 'Memories Album'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              {onSave && (
                <button
                  type="button"
                  onClick={onSave}
                  disabled={saving}
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: '#fff',
                    background: saving ? 'rgba(44,36,33,.45)' : NAVY,
                    border: 'none',
                    borderRadius: 999,
                    padding: '5px 12px',
                    cursor: saving ? 'default' : 'pointer',
                    fontFamily: "'DM Sans',sans-serif",
                  }}
                >
                  {saving ? savingLabel : saveLabel}
                </button>
              )}
              {onClose && (
                <button
                  type="button"
                  className="hm-memory-modal__close"
                  onClick={onClose}
                  aria-label={lang === 'el' ? 'Κλείσιμο' : 'Close'}
                >
                  ×
                </button>
              )}
            </div>
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: 'rgba(43,58,103,.55)',
              marginTop: 3,
              lineHeight: 1.45,
              fontFamily: "'DM Sans',sans-serif",
            }}
          >
            {journalName
              ? `${rangeOk ? countInPeriod : memories.length} ${lang === 'el' ? 'αναμνήσεις' : 'memories'} · ${journalName}`
              : labels.bookletSubtitle}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          color: NAVY_MUTED,
          letterSpacing: 0.6,
          marginBottom: 8,
          fontWeight: 600,
        }}
      >
        {displayUppercase(labels.pickPeriod, lang)}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: NAVY }}>{labels.dateFrom}</span>
          <HmDateField
            lang={lang}
            value={fromDate}
            max={toDate || undefined}
            onChange={(iso) => {
              setRangeTouched(true)
              setFromDate(iso)
            }}
            variant="input"
            size="sm"
            ariaLabel={labels.dateFrom}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: NAVY }}>{labels.dateTo}</span>
          <HmDateField
            lang={lang}
            value={toDate}
            min={fromDate || undefined}
            onChange={(iso) => {
              setRangeTouched(true)
              setToDate(iso)
            }}
            variant="input"
            size="sm"
            ariaLabel={labels.dateTo}
          />
        </label>
      </div>

      {rangeOk && (
        <div style={{ fontSize: 12, color: NAVY_MUTED, marginBottom: 10 }}>
          <strong style={{ color: NAVY }}>{periodText}</strong>
          {' · '}
          {countInPeriod} {lang === 'el' ? 'στιγμές' : 'moments'}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          disabled={!rangeOk}
          onClick={() => setPreviewOpen(true)}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: PAPER,
            color: NAVY,
            border: `1.5px solid ${NAVY}`,
            borderRadius: 10,
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: rangeOk ? 'pointer' : 'default',
            opacity: rangeOk ? 1 : 0.5,
          }}
        >
          ✦ {labels.preview}
        </button>
        <button
          type="button"
          disabled={!rangeOk}
          onClick={handleDownload}
          style={{
            flex: 1,
            padding: '10px 14px',
            background: PURPLE,
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontFamily: "'DM Sans',sans-serif",
            fontSize: 13,
            fontWeight: 700,
            cursor: rangeOk ? 'pointer' : 'default',
            opacity: rangeOk ? 1 : 0.5,
          }}
        >
          ⬇ {labels.download}
        </button>
      </div>
      <div style={{ fontSize: 10.5, color: NAVY_MUTED, marginTop: 6, textAlign: 'center' }}>{labels.downloadHint}</div>

      {previewOpen && previewPages.length > 0 && (
        <BookletFlipbookModal
          pages={previewPages}
          labels={labels}
          lang={lang}
          onClose={() => setPreviewOpen(false)}
          onSave={() => {
            onSave?.()
            setPreviewOpen(false)
          }}
        />
      )}
    </div>
  )
}
