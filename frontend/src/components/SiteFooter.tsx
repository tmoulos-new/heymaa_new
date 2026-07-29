import { useTranslation } from 'react-i18next'
import { AUTH_LOGO_SRC } from '../auth/authLogo'
import { PRIVACY_URL, TERMS_URL } from '../auth/authStrings'
import { displayUppercase } from '../lib/greekText'

export function SiteFooter({ contentLang }: { contentLang: string }) {
  const { t } = useTranslation()
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
            <div className="nb-logo-mark">
              <img src={AUTH_LOGO_SRC} alt={t('footer.logoAlt')} />
            </div>
            <p className="footer-about-text">{t('footer.about')}</p>
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
                <a href={`tel:${t('footer.phoneTel')}`}>
                  <span aria-hidden="true">📞</span> {t('footer.phone')}
                </a>
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
                  <a
                    href={link.href}
                    {...(link.href.startsWith('http')
                      ? { target: '_blank', rel: 'noopener noreferrer' }
                      : {})}
                  >
                    {link.label}
                  </a>
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
