import { useRef, useState, type DragEvent } from 'react'
import { ImagePlus } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'

export function Dropzone({
  bucket,
  imageKey,
  previewUrl,
  onUploaded,
  onClear,
  onError,
}: {
  bucket: 'offers' | 'promotions'
  imageKey: string
  previewUrl: string
  onUploaded: (key: string, url: string) => void
  onClear: () => void
  onError: (msg: string) => void
}) {
  const { uploadImage } = useAdmin()
  const fileRef = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [uploading, setUploading] = useState(false)

  const pick = () => fileRef.current?.click()

  const handleFile = async (file: File) => {
    setUploading(true)
    try {
      const { key, url } = await uploadImage(bucket, file)
      onUploaded(key, url)
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const onDrop = (e: DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const f = e.dataTransfer.files?.[0]
    if (f) void handleFile(f)
  }

  return (
    <div
      className={`dropzone${drag ? ' drag' : ''}${uploading ? ' uploading' : ''}`}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('.dz-clear')) return
        pick()
      }}
      onDragEnter={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={(e) => {
        e.preventDefault()
        setDrag(false)
      }}
      onDrop={onDrop}
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleFile(f)
        }}
      />
      {!imageKey || !previewUrl ? (
        <div className="dz-inner">
          <ImagePlus size={28} strokeWidth={1.5} />
          <span>Drop image here or click to browse</span>
          <span className="dz-hint">JPEG, PNG, WebP, GIF · max 5 MB</span>
        </div>
      ) : (
        <div className="dz-preview">
          <img src={previewUrl} alt="Preview" />
          <button
            type="button"
            className="sm ghost dz-clear"
            onClick={(e) => {
              e.stopPropagation()
              onClear()
              if (fileRef.current) fileRef.current.value = ''
            }}
          >
            Remove image
          </button>
        </div>
      )}
    </div>
  )
}
