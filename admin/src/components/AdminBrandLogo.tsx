import logoCircle from '../assets/logo-circle.png'

export const ADMIN_LOGO_SRC = logoCircle

/** Circular brand mark + HeyMaa wordmark (matches site header). */
export function AdminBrandLogo({
  alt = 'HeyMaa',
  showText = true,
  className = '',
}: {
  alt?: string
  showText?: boolean
  className?: string
}) {
  return (
    <div className={`admin-brand${className ? ` ${className}` : ''}`}>
      <div className="admin-brand-mark">
        <img src={ADMIN_LOGO_SRC} alt={alt} />
      </div>
      {showText ? (
        <span className="admin-brand-text">
          Hey<span>Maa</span>
        </span>
      ) : null}
    </div>
  )
}
