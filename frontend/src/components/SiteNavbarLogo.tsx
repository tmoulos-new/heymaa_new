import { AUTH_LOGO_SRC } from '../auth/authLogo'

/** Shared circular brand mark + wordmark for public navy navbar headers. */
export function SiteNavbarLogo({ alt = 'HeyMaa' }: { alt?: string }) {
  return (
    <div className="nb-logo">
      <div className="nb-logo-mark">
        <img src={AUTH_LOGO_SRC} alt={alt} />
      </div>
      <span className="nb-logo-text">
        Hey<span>Maa</span>
      </span>
    </div>
  )
}
