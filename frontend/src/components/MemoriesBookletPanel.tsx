import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import type { FamilyChild, FamilyMemberRecord } from '../lib/familyData'
import {
  bookletLabelsForLang,
  defaultBookletDateRange,
  downloadMemoriesBooklet,
  formatBookletDateRangeLabel,
  memoriesInDateRange,
  prepareBookletContent,
  type BookletFlipPage,
  type BookletMemory,
} from '../lib/memoriesBooklet'
import { displayUppercase } from '../lib/greekText'

const LINEN = '#F6F0E8'
const LINEN_DEEP = '#E8DFD2'
const ROSE = '#C97B84'
const ROSE_SOFT = '#E8B4B8'
const INK = '#2C2421'
const INK_SOFT = '#5C534C'
const GOLD = '#A8896A'
const PAPER = '#FFFBF7'

function OrnamentLine({ light = false }: { light?: boolean }) {
  return (
    <div
      style={{
        width: 52,
        height: 1,
        margin: '0 auto',
        background: light
          ? 'linear-gradient(90deg, transparent, rgba(255,251,247,.7), transparent)'
          : `linear-gradient(90deg, transparent, ${ROSE_SOFT}, transparent)`,
      }}
    />
  )
}

function FlipPageContent({
  page,
  labels,
  lang,
}: {
  page: BookletFlipPage
  labels: ReturnType<typeof bookletLabelsForLang>
  lang: string
}) {
  if (page.type === 'cover') {
    return (
      <div
        style={{
          height: '100%',
          minHeight: 420,
          borderRadius: 18,
          padding: '40px 28px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          background:
            'radial-gradient(ellipse at 30% 20%, rgba(243,224,226,.45), transparent 50%), radial-gradient(ellipse at 80% 85%, rgba(201,123,132,.32), transparent 45%), linear-gradient(165deg, #3A2F2C 0%, #5A3F42 42%, #C97B84 78%, #E8B4B8 100%)',
          color: PAPER,
          boxShadow: 'inset 0 0 0 1px rgba(255,251,247,.16)',
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 14,
            border: '1px solid rgba(255,251,247,.2)',
            borderRadius: 12,
            pointerEvents: 'none',
          }}
        />
        <OrnamentLine light />
        <div
          style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 28,
            fontStyle: 'italic',
            fontWeight: 500,
            margin: '18px 0 14px',
            letterSpacing: '0.04em',
            opacity: 0.92,
            animation: 'hm-book-float 3.2s ease-in-out infinite',
          }}
        >
          for keeps
        </div>
        <h1
          style={{
            fontFamily: "'Fraunces',Georgia,serif",
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
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 17,
            fontStyle: 'italic',
            opacity: 0.9,
            margin: '0 0 18px',
            maxWidth: 280,
            lineHeight: 1.4,
          }}
        >
          {labels.dedication}
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
    )
  }

  if (page.type === 'toc') {
    return (
      <div
        style={{
          height: '100%',
          minHeight: 420,
          padding: '30px 26px',
          background: `radial-gradient(ellipse at 12% 0%, ${ROSE_SOFT}33, transparent 45%), ${PAPER}`,
          position: 'relative',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 12,
            border: `1px solid rgba(201,123,132,.2)`,
            borderRadius: 10,
            pointerEvents: 'none',
          }}
        />
        <h2
          style={{
            fontFamily: "'Fraunces',Georgia,serif",
            fontSize: 24,
            color: INK,
            margin: '0 0 6px',
            fontWeight: 600,
          }}
        >
          {page.title}
        </h2>
        <p
          style={{
            fontFamily: "'Cormorant Garamond',Georgia,serif",
            fontSize: 15,
            fontStyle: 'italic',
            color: INK_SOFT,
            margin: '0 0 22px',
          }}
        >
          {page.periodLabel}
        </p>
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {page.items.map((item) => (
            <li
              key={`${item.icon}-${item.label}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                padding: '13px 0',
                borderBottom: `1px dashed rgba(168,137,106,.4)`,
                color: INK,
                fontSize: 16,
                fontFamily: "'Cormorant Garamond',Georgia,serif",
                fontWeight: 500,
              }}
            >
              <span>
                {item.icon} {item.label}
              </span>
              <span style={{ color: ROSE, fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 600 }}>
                {item.count}
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
        minHeight: 420,
        padding: '26px 22px',
        background: `radial-gradient(ellipse at 90% 100%, rgba(168,137,106,.1), transparent 40%), ${PAPER}`,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: 12,
          border: `1px solid rgba(201,123,132,.18)`,
          borderRadius: 10,
          pointerEvents: 'none',
        }}
      />
      <h2
        style={{
          fontFamily: "'Fraunces',Georgia,serif",
          fontSize: 18,
          color: INK,
          margin: '0 0 18px',
          paddingBottom: 10,
          borderBottom: `1px solid rgba(201,123,132,.35)`,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontWeight: 600,
        }}
      >
        <span>{page.icon}</span>
        <span style={{ flex: 1 }}>{page.label}</span>
        {page.partLabel && (
          <span style={{ fontSize: 11, color: GOLD, fontFamily: "'DM Sans',sans-serif", fontWeight: 600, letterSpacing: '0.06em' }}>
            {page.partLabel}
          </span>
        )}
      </h2>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      {page.memories.length === 0 ? (
        <p style={{ fontSize: 14, color: INK_SOFT, fontFamily: "'Cormorant Garamond',Georgia,serif", fontStyle: 'italic' }}>—</p>
      ) : (
        page.memories.map((m, i) => {
          const hasText = Boolean(m.text && m.text !== '📷')
          const photoCount = page.memories.filter((x) => x.img).length
          const tallPhoto = Boolean(m.img) && (photoCount <= 1 || !hasText)
          return (
          <article
            key={`${m.date}-${i}-${m.text?.slice(0, 12)}`}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              padding: '0 0 16px',
              marginBottom: i < page.memories.length - 1 ? 12 : 0,
              borderBottom: i < page.memories.length - 1 ? `1px solid ${LINEN_DEEP}` : 'none',
              flex: m.img && photoCount === 1 ? 1 : undefined,
              minHeight: 0,
            }}
          >
            {m.img ? (
              <div
                style={{
                  background: LINEN,
                  padding: '8px 8px 18px',
                  boxShadow: '0 6px 18px rgba(44,36,33,.08)',
                  border: `1px solid rgba(168,137,106,.22)`,
                  transform: 'rotate(-0.4deg)',
                  width: '100%',
                  maxWidth: '100%',
                  aspectRatio: tallPhoto ? '3 / 4' : '4 / 3',
                  maxHeight: tallPhoto ? 280 : photoCount >= 2 ? 140 : 200,
                  boxSizing: 'border-box',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  flexShrink: 0,
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
                  }}
                >
                  <img
                    src={m.img}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'contain',
                      objectPosition: 'center',
                      display: 'block',
                    }}
                  />
                </div>
              </div>
            ) : null}
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {!m.img && (
                <div style={{ width: 28, textAlign: 'center', fontSize: 20, flexShrink: 0, opacity: 0.8 }}>
                  {m.emoji || '✦'}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 0 }}>
                {hasText && (
                  <div
                    style={{
                      fontFamily: "'Cormorant Garamond',Georgia,serif",
                      fontSize: 17,
                      color: INK,
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
                    color: GOLD,
                    fontWeight: 600,
                    letterSpacing: '0.08em',
                  }}
                >
                  {displayUppercase(m.date, lang)}
                </div>
              </div>
            </div>
          </article>
          )
        })
      )}
      </div>
    </div>
  )
}

function BookletFlipbookModal({
  pages,
  labels,
  lang,
  onClose,
  onDownload,
}: {
  pages: BookletFlipPage[]
  labels: ReturnType<typeof bookletLabelsForLang>
  lang: string
  onClose: () => void
  onDownload: () => void
}) {
  const [index, setIndex] = useState(0)
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [animKey, setAnimKey] = useState(0)
  const total = pages.length
  const page = pages[index]

  const go = (next: number, d: 'next' | 'prev') => {
    if (next < 0 || next >= total) return
    setDir(d)
    setIndex(next)
    setAnimKey((k) => k + 1)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      if (e.key === 'ArrowRight') go(index + 1, 'next')
      if (e.key === 'ArrowLeft') go(index - 1, 'prev')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const pageLabel = labels.pageOf
    .replace('{current}', String(index + 1))
    .replace('{total}', String(total))

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        background: 'rgba(44, 36, 33, .62)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backdropFilter: 'blur(6px)',
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
          width: '100%',
          maxWidth: 440,
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}
      >
        <div
          style={{
            position: 'relative',
            borderRadius: 22,
            overflow: 'hidden',
            background: '#E8E0D6',
            boxShadow: '0 28px 60px rgba(20,24,40,.35), 0 0 0 1px rgba(255,255,255,.2)',
            flex: 1,
            minHeight: 0,
          }}
        >
          {/* Book spine accent */}
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: 10,
              background: `linear-gradient(90deg, rgba(43,58,103,.35), transparent)`,
              zIndex: 2,
              pointerEvents: 'none',
            }}
          />
          <div
            key={animKey}
            style={{
              animation: `${dir === 'next' ? 'hm-flip-in-next' : 'hm-flip-in-prev'} .38s ease`,
              transformOrigin: 'left center',
              height: '100%',
              overflow: 'auto',
              maxHeight: 'min(68vh, 560px)',
            }}
          >
            {page && <FlipPageContent page={page} labels={labels} lang={lang} />}
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
          <button
            type="button"
            disabled={index <= 0}
            onClick={() => go(index - 1, 'prev')}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              border: 'none',
              background: index <= 0 ? LINEN_DEEP : INK,
              color: index <= 0 ? '#A89F98' : '#fff',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: index <= 0 ? 'default' : 'pointer',
              minWidth: 88,
            }}
          >
            ← {labels.prevPage}
          </button>
          <div style={{ fontSize: 11.5, color: INK_SOFT, fontWeight: 600, textAlign: 'center', flex: 1 }}>
            {pageLabel}
          </div>
          <button
            type="button"
            disabled={index >= total - 1}
            onClick={() => go(index + 1, 'next')}
            style={{
              padding: '9px 12px',
              borderRadius: 10,
              border: 'none',
              background: index >= total - 1 ? LINEN_DEEP : ROSE,
              color: index >= total - 1 ? '#A89F98' : '#fff',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: index >= total - 1 ? 'default' : 'pointer',
              minWidth: 88,
            }}
          >
            {labels.nextPage} →
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              padding: '11px 12px',
              borderRadius: 12,
              border: '1.5px solid rgba(255,255,255,.35)',
              background: 'rgba(255,255,255,.14)',
              color: '#fff',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {labels.closePreview}
          </button>
          <button
            type="button"
            onClick={onDownload}
            style={{
              flex: 1.2,
              padding: '11px 12px',
              borderRadius: 12,
              border: 'none',
              background: GOLD,
              color: '#fff',
              fontFamily: "'DM Sans',sans-serif",
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(168,137,106,.35)',
            }}
          >
            ⬇ {labels.download}
          </button>
        </div>
      </div>
    </div>
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
}: {
  memories: BookletMemory[]
  userName: string
  lang: string
  familyChildren: FamilyChild[]
  members: FamilyMemberRecord[]
  onDownload?: () => void
  onSave?: () => void
  saving?: boolean
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

  const dateInputStyle: CSSProperties = {
    width: '100%',
    padding: '9px 11px',
    border: `1.5px solid ${LINEN_DEEP}`,
    borderRadius: 9,
    fontFamily: "'DM Sans',sans-serif",
    fontSize: 13,
    color: INK,
    background: PAPER,
    outline: 'none',
    boxSizing: 'border-box',
  }

  return (
    <div
      style={{
        marginBottom: 14,
        padding: '16px 14px',
        borderRadius: 14,
        background: `radial-gradient(ellipse at 10% 0%, ${ROSE_SOFT}44, transparent 50%), linear-gradient(145deg, ${LINEN} 0%, ${PAPER} 100%)`,
        border: `1px solid rgba(201,123,132,.22)`,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        <span style={{ fontSize: 22, lineHeight: 1, opacity: 0.85 }}>✦</span>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ fontFamily: "'Fraunces',Georgia,serif", fontSize: 15, color: INK, fontWeight: 600 }}>
              {lang === 'el' ? 'Άλμπουμ Αναμνήσεων' : 'Memories Album'}
            </div>
            {onSave && (
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#fff',
                  background: saving ? 'rgba(44,36,33,.45)' : INK,
                  border: 'none',
                  borderRadius: 999,
                  padding: '5px 12px',
                  cursor: saving ? 'default' : 'pointer',
                  fontFamily: "'DM Sans',sans-serif",
                  flexShrink: 0,
                }}
              >
                {saving ? savingLabel : saveLabel}
              </button>
            )}
          </div>
          <div
            style={{
              fontSize: 12.5,
              color: INK_SOFT,
              marginTop: 3,
              lineHeight: 1.45,
              fontFamily: "'Cormorant Garamond',Georgia,serif",
              fontStyle: 'italic',
            }}
          >
            {labels.bookletSubtitle}
          </div>
        </div>
      </div>

      <div
        style={{
          fontSize: 11,
          color: GOLD,
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
          <span style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>{labels.dateFrom}</span>
          <input
            type="date"
            value={fromDate}
            max={toDate || undefined}
            onChange={(e) => {
              setRangeTouched(true)
              setFromDate(e.target.value)
            }}
            style={dateInputStyle}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: INK }}>{labels.dateTo}</span>
          <input
            type="date"
            value={toDate}
            min={fromDate || undefined}
            onChange={(e) => {
              setRangeTouched(true)
              setToDate(e.target.value)
            }}
            style={dateInputStyle}
          />
        </label>
      </div>

      {rangeOk && (
        <div style={{ fontSize: 12, color: INK_SOFT, marginBottom: 10 }}>
          <strong style={{ color: INK }}>{periodText}</strong>
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
            color: INK,
            border: `1.5px solid ${INK}`,
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
            background: ROSE,
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
      <div style={{ fontSize: 10.5, color: GOLD, marginTop: 6, textAlign: 'center' }}>{labels.downloadHint}</div>

      {previewOpen && previewPages.length > 0 && (
        <BookletFlipbookModal
          pages={previewPages}
          labels={labels}
          lang={lang}
          onClose={() => setPreviewOpen(false)}
          onDownload={() => {
            handleDownload()
            setPreviewOpen(false)
          }}
        />
      )}
    </div>
  )
}
