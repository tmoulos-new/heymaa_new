import { useEffect, useRef, useState } from 'react'
import {
  albumPhotoFrameStyle,
  clampAlbumPhotoFrame,
  DEFAULT_ALBUM_PHOTO_FRAME,
  type AlbumPhotoFrame,
} from '../lib/memoriesBooklet'
import { AppDialog } from './AppDialog'

const NAVY = '#2B3A67'
const MAGENTA = '#de5a9e'

type Props = {
  open: boolean
  photo: string
  initialFrame?: AlbumPhotoFrame | null
  lang: string
  /** Match tree-card aspect: focus cards are a little taller. */
  focusCard?: boolean
  onCancel: () => void
  onSave: (frame: AlbumPhotoFrame) => void
}

export function FamilyPhotoCropDialog({
  open,
  photo,
  initialFrame,
  lang,
  focusCard = true,
  onCancel,
  onSave,
}: Props) {
  const el = lang === 'el'
  const [draft, setDraft] = useState<AlbumPhotoFrame>(() => clampAlbumPhotoFrame(initialFrame || DEFAULT_ALBUM_PHOTO_FRAME))
  const drag = useRef<{ x: number; y: number; fx: number; fy: number } | null>(null)

  useEffect(() => {
    if (open) setDraft(clampAlbumPhotoFrame(initialFrame || DEFAULT_ALBUM_PHOTO_FRAME))
  }, [open, photo, initialFrame])

  const setZoom = (zoom: number) => {
    setDraft((d) => clampAlbumPhotoFrame({ ...d, zoom }))
  }

  const previewW = 220
  const previewH = focusCard ? Math.round(previewW * (82 / 78)) : Math.round(previewW * (74 / 68))

  return (
    <AppDialog
      open={open}
      onClose={onCancel}
      size="md"
      align="center"
      ariaLabel={el ? 'Τοποθέτηση φωτογραφίας' : 'Place photo'}
    >
      <div className="hm-dialog-panel hm-dialog-panel--white hm-dialog-panel--pad-md">
        <h2 className="hm-dialog-title" style={{ fontSize: 16, marginBottom: 8 }}>
          {el ? 'Τοποθέτηση φωτογραφίας' : 'Place photo'}
        </h2>
        <p style={{ margin: '0 0 14px', fontSize: 13, lineHeight: 1.45, color: 'rgba(43,58,103,.62)' }}>
          {el
            ? 'Σύρε για να τοποθετήσεις τη φωτογραφία. Χρησιμοποίησε το ζουμ για εστίαση στο πρόσωπο.'
            : 'Drag to place the photo. Use zoom to focus on the face.'}
        </p>
        <div
          style={{
            width: previewW,
            height: previewH,
            margin: '0 auto 14px',
            borderRadius: 18,
            overflow: 'hidden',
            background: '#EDE6DC',
            position: 'relative',
            touchAction: 'none',
            cursor: 'grab',
            boxShadow: '0 8px 22px rgba(43,58,103,.16)',
          }}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            drag.current = { x: e.clientX, y: e.clientY, fx: draft.x, fy: draft.y }
          }}
          onPointerMove={(e) => {
            if (!drag.current) return
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
          <img src={photo} alt="" draggable={false} style={albumPhotoFrameStyle(draft, true)} />
          <div
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: '50%',
              top: '42%',
              width: 28,
              height: 28,
              margin: '-14px 0 0 -14px',
              border: '2px solid #fff',
              borderRadius: '50%',
              boxShadow: '0 0 0 1px rgba(43,58,103,.45), 0 4px 10px rgba(0,0,0,.25)',
              pointerEvents: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button
            type="button"
            aria-label={el ? 'Σμίκρυνση' : 'Zoom out'}
            onClick={() => setZoom(draft.zoom - 0.15)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: 'none',
              background: NAVY,
              color: '#fff',
              fontSize: 18,
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
            aria-label={el ? 'Ζουμ' : 'Zoom'}
            onChange={(e) => setZoom(Number(e.target.value))}
            style={{ flex: 1, minWidth: 0, accentColor: MAGENTA, height: 18 }}
          />
          <button
            type="button"
            aria-label={el ? 'Μεγέθυνση' : 'Zoom in'}
            onClick={() => setZoom(draft.zoom + 0.15)}
            style={{
              width: 36,
              height: 36,
              borderRadius: 999,
              border: 'none',
              background: NAVY,
              color: '#fff',
              fontSize: 18,
              fontWeight: 700,
              cursor: 'pointer',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            +
          </button>
        </div>
        <div className="hm-btn-row">
          <button type="button" className="hm-btn hm-btn--primary" onClick={() => onSave(clampAlbumPhotoFrame(draft))}>
            {el ? 'Αποθήκευση' : 'Save'}
          </button>
          <button type="button" className="hm-btn hm-btn--secondary" onClick={onCancel}>
            {el ? 'Άκυρο' : 'Cancel'}
          </button>
        </div>
      </div>
    </AppDialog>
  )
}
