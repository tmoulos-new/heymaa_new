import { albumPhotoFrameStyle, type AlbumPhotoFrame } from '../lib/memoriesBooklet'
import { AVATAR_COLOR } from '../lib/familyTree'

export function FamilyPersonAvatar({
  size,
  name,
  photo,
  photoFrame,
  color,
  shadow = true,
}: {
  size: number
  name: string
  photo?: string | null
  photoFrame?: AlbumPhotoFrame | null
  color?: string
  shadow?: boolean
}) {
  const initial = name.trim() ? name.trim().charAt(0).toUpperCase() : '?'
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        overflow: 'hidden',
        flexShrink: 0,
        background: photo ? '#EDE6DC' : color || AVATAR_COLOR.self,
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'DM Sans',sans-serif",
        fontSize: Math.max(11, Math.round(size * 0.4)),
        fontWeight: 700,
        boxShadow: shadow ? '0 4px 12px rgba(43,58,103,0.08)' : 'none',
      }}
      aria-hidden="true"
    >
      {photo ? (
        <img src={photo} alt="" draggable={false} style={albumPhotoFrameStyle(photoFrame, true)} />
      ) : (
        initial
      )}
    </div>
  )
}
