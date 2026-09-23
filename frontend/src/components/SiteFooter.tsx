import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AUTH_LOGO_SRC } from '../auth/authLogo'
import { PRIVACY_URL, TERMS_URL } from '../auth/authStrings'
import { displayUppercase } from '../lib/greekText'
import { homeDisplayLocale } from '../i18n'

function FooterAboutText({ text }: { text: string }) {
  const parts = text.split(/<\/?company>/)
  if (parts.length !== 3) return <>{text}</>
  return (
    <>
      {parts[0]}
      <a
        className="footer-about-link"
        href="https://caredirect.com"
        target="_blank"
        rel="noopener noreferrer"
      >
        {parts[1]}
      </a>
      {parts[2]}
    </>
  )
}

export function SiteFooter({
  contentLang,
  landingLng,
}: {
  contentLang: string;
  landingLng?: string;
}) {
  const lng = landingLng ?? homeDisplayLocale(contentLang)
  const { t: tBase } = useTranslation()
  const t = (key: string, opts?: Record<string, unknown>) =>
    tBase(key, { ns: 'home', lng, ...opts })
  const email = t('footer.email')

  const infoLinks = [
    { label: t('footer.linkPrivacy'), href: PRIVACY_URL },
    { label: t('footer.linkTerms'), href: TERMS_URL },
  ]

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-grid">
          <div className="footer-about">
            <div className="footer-brand">
              <div className="nb-logo-mark">
                <img src={AUTH_LOGO_SRC} alt={t('footer.logoAlt')} />
              </div>
              <span className="footer-logo-text" aria-hidden="true">
                Hey<span>Maa</span>
              </span>
            </div>
            <p className="footer-about-text">
              <FooterAboutText text={String(t('footer.about'))} />
            </p>
            <div className="footer-social">
              <a
                className="footer-social-link"
                href="https://www.facebook.com/heymaaAI/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label={t('footer.facebook')}
              >
                <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
                  <path
                    fill="currentColor"
                    d="M14.5 8.5V6.8c0-.7.1-1.1 1.2-1.1H17V3h-2.4C11.8 3 11 4.6 11 6.6v1.9H9v2.8h2V21h3.5v-9.7h2.4l.4-2.8h-2.8z"
                  />
                </svg>
              </a>
            </div>
          </div>

          <div className="footer-col">
            <h3 className="footer-col-title">
              {displayUppercase(t('footer.contactTitle'), contentLang)}
            </h3>
            <ul className="footer-list">
              <li>
                <a href={`mailto:${email}`}>
                  <span aria-hidden="true">✉️</span> {email}
                </a>
              </li>
              <li>
                <div className="footer-phone">
                  <a href={`tel:${t('footer.phoneTel')}`}>
                    <span aria-hidden="true">📞</span>
                    <span>
                      <span className="footer-phone__label">{t('footer.phoneLabel')}</span>
                      <span className="footer-phone__num">{t('footer.phone')}</span>
                    </span>
                  </a>
                  <p className="footer-phone__hours">{t('footer.phoneHours')}</p>
                </div>
              </li>
              <li>
                <span className="footer-list-static">
                  <span aria-hidden="true">📍</span> {t('footer.address')}
                </span>
              </li>
            </ul>
          </div>

          <div className="footer-col">
            <h3 className="footer-col-title">
              {displayUppercase(t('footer.infoTitle'), contentLang)}
            </h3>
            <ul className="footer-list">
              {infoLinks.map((link) => (
                <li key={link.label}>
                  {link.href.startsWith('http') ? (
                    <a href={link.href} target="_blank" rel="noopener noreferrer">
                      {link.label}
                    </a>
                  ) : (
                    <Link to={link.href}>{link.label}</Link>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="footer-bottom">{t('footer.copy')}</div>
      </div>
    </footer>
  )
}
