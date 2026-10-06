import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AUTH_LOGO_SRC } from './authLogo'
import {
  apiDetail,
  API,
  checkEmail,
  applyAuthUserName,
  persistAuthSession,
  allowAuthSessionPersist,
  loginUser,
  registerUser,
} from '../lib/authApi'
import { normalizeAppLang, readStoredAppLang, writeStoredAppLang } from '../lib/appLang'
import { SUPPORTED_LANG_CODES } from '../lib/supportedLanguages'
import { authStrings, PRIVACY_URL, TERMS_URL, localizeAuthApiMessage, type AuthLang } from './authStrings'
import { EyeIcon, EyeOffIcon } from './passwordVisibilityIcons'
import { useStableMobileViewport } from '../lib/useStableMobileViewport'
import './appAuth.css'

function authUiLangFromStored(): AuthLang {
  return normalizeAppLang(readStoredAppLang('el'), 'el') as AuthLang
}

function nextAuthLang(current: AuthLang): AuthLang {
  const idx = SUPPORTED_LANG_CODES.indexOf(current)
  const next = SUPPORTED_LANG_CODES[(idx + 1) % SUPPORTED_LANG_CODES.length]
  return next as AuthLang
}

function authLangToggleLabel(current: AuthLang): string {
  const next = nextAuthLang(current)
  return next.toUpperCase()
}

type Mode = 'signup' | 'login'

export function AppAuthScreen({
  onSuccess,
  initialMode = 'signup',
  initialInvite = '',
}: {
  onSuccess: (token: string) => void
  initialMode?: Mode
  initialInvite?: string
}) {
  const [lang, setLang] = useState<AuthLang>(() => authUiLangFromStored())
  const s = authStrings(lang)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [inviteCode, setInviteCode] = useState(() => initialInvite.trim())
  const [newsletter, setNewsletter] = useState(false)
  const [pushAlerts, setPushAlerts] = useState(true)
  const [privacy, setPrivacy] = useState(false)
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)
  useStableMobileViewport()

  useEffect(() => {
    const next = initialInvite.trim()
    if (next) setInviteCode(next)
  }, [initialInvite])

  const persistLang = (next: AuthLang) => {
    setLang(next)
    writeStoredAppLang(next)
  }

  const handleSignup = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(s.errName)
      return
    }
    if (!trimmedEmail) {
      setError(s.errEmail)
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError(s.errEmailInvalid)
      return
    }
    if (password.length < 6) {
      setError(s.errPasswordMin)
      return
    }
    if (password !== confirmPassword) {
      setError(s.errPasswordMismatch)
      return
    }
    if (!privacy) {
      setError(s.errPrivacy)
      return
    }
    if (!terms) {
      setError(s.errTerms)
      return
    }
    setLoading(true)
    setError('')
    try {
      const exists = await checkEmail(trimmedEmail)
      if (exists.data.exists) {
        setError(s.errEmailExists)
        setMode('login')
        return
      }
      const res = await registerUser({
        email: trimmedEmail,
        password,
        name: trimmedName,
        invite_code: inviteCode.trim() || undefined,
        want_child: false,
        pregnancy_or_mom: false,
        consent_marketing: newsletter,
        push_alerts_opt_in: pushAlerts,
        consent_privacy: privacy,
        consent_terms: terms,
        lang,
      })
      try {
        const { writeSignupPushOptIn } = await import('../lib/pushAlerts')
        writeSignupPushOptIn(pushAlerts)
      } catch {
        /* ignore */
      }
      allowAuthSessionPersist()
      persistAuthSession(res.data.token, res.data.refresh_token)
      applyAuthUserName(res.data.token, trimmedName || res.data.name)
      try {
        const { trackSignUp } = await import('../lib/analytics')
        trackSignUp('email')
      } catch {
        /* ignore analytics failures */
      }
      onSuccess(res.data.token)
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } }
      const raw = apiDetail(err.response?.data, s.errRegister)
      setError(localizeAuthApiMessage(raw, lang))
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError(s.errEmail)
      return
    }
    if (password.length < 1) {
      setError(s.errLogin)
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await loginUser(trimmedEmail, password)
      allowAuthSessionPersist()
      persistAuthSession(res.data.token, res.data.refresh_token)
      applyAuthUserName(res.data.token, res.data.name)
      try {
        const { trackLogin } = await import('../lib/analytics')
        trackLogin('email')
      } catch {
        /* ignore analytics failures */
      }
      onSuccess(res.data.token)
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } }
      const raw = apiDetail(err.response?.data, s.errLogin)
      setError(localizeAuthApiMessage(raw, lang))
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError(lang === 'el' ? 'Συμπλήρωσε το email σου.' : lang === 'ro' ? 'Introdu mai întâi emailul.' : 'Enter your email first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail, lang }),
      })
      setForgotSent(true)
    } catch {
      setError(s.errConnection)
    } finally {
      setLoading(false)
    }
  }

  const logoSrc = AUTH_LOGO_SRC
  const canRegister = privacy && terms

  return (
    <div className="app-auth-page">
      <Link to="/" className="app-auth-close" aria-label={s.closeHome}>
        ×
      </Link>

      <button
        type="button"
        className="app-auth-lang"
        onClick={() => persistLang(nextAuthLang(lang))}
        aria-label={authLangToggleLabel(lang)}
      >
        {authLangToggleLabel(lang)}
      </button>

      <div className="app-auth-logo-wrap">
        <img src={logoSrc} alt="HeyMaa" />
      </div>

      <div className="app-auth-card">
        <h1 className="app-auth-title">{mode === 'signup' ? s.signupTitle : s.loginTitle}</h1>

        {mode === 'signup' && (
          <div className="app-auth-field">
            <label className="app-auth-label" htmlFor="auth-name">
              {s.name}
            </label>
            <input
              id="auth-name"
              className="app-auth-input"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={s.namePh}
              autoComplete="name"
              disabled={loading}
            />
          </div>
        )}

        <div className="app-auth-field">
          <label className="app-auth-label" htmlFor="auth-email">
            {s.email}
          </label>
          <input
            id="auth-email"
            className="app-auth-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={s.emailPh}
            autoComplete="email"
            disabled={loading}
          />
        </div>

        <div className="app-auth-field">
          <label className="app-auth-label" htmlFor="auth-password">
            {s.password}
          </label>
          <div className="app-auth-password-wrap">
            <input
              id="auth-password"
              className="app-auth-input"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={s.passwordPh}
              autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
              disabled={loading}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void (mode === 'signup' ? handleSignup() : handleLogin())
              }}
            />
            <button
              type="button"
              className="app-auth-password-toggle"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={
                showPassword
                  ? lang === 'el'
                    ? 'Απόκρυψη κωδικού'
                    : lang === 'ro'
                      ? 'Ascunde parola'
                      : 'Hide password'
                  : lang === 'el'
                    ? 'Εμφάνιση κωδικού'
                    : lang === 'ro'
                      ? 'Arată parola'
                      : 'Show password'
              }
              tabIndex={-1}
            >
              {showPassword ? <EyeOffIcon /> : <EyeIcon />}
            </button>
          </div>
        </div>

        {mode === 'signup' && (
          <div className="app-auth-field">
            <label className="app-auth-label" htmlFor="auth-confirm-password">
              {s.confirmPassword}
            </label>
            <div className="app-auth-password-wrap">
              <input
                id="auth-confirm-password"
                className="app-auth-input"
                type={showConfirmPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={s.confirmPasswordPh}
                autoComplete="new-password"
                disabled={loading}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleSignup()
                }}
              />
              <button
                type="button"
                className="app-auth-password-toggle"
                onClick={() => setShowConfirmPassword((v) => !v)}
                aria-label={
                  showConfirmPassword
                    ? lang === 'el'
                      ? 'Απόκρυψη κωδικού'
                      : lang === 'ro'
                        ? 'Ascunde parola'
                        : 'Hide password'
                    : lang === 'el'
                      ? 'Εμφάνιση κωδικού'
                      : lang === 'ro'
                        ? 'Arată parola'
                        : 'Show password'
                }
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
              </button>
            </div>
          </div>
        )}

        {mode === 'login' && (
          forgotSent ? (
            <p className="app-auth-error" style={{ color: '#2d9e6b' }}>
              {lang === 'el'
                ? 'Στείλαμε email επαναφοράς κωδικού ✓'
                : lang === 'ro'
                  ? 'Am trimis emailul de resetare a parolei ✓'
                  : 'Password reset email sent ✓'}
            </p>
          ) : (
            <button type="button" className="app-auth-forgot" onClick={() => void handleForgot()}>
              {s.forgot}
            </button>
          )
        )}

        {mode === 'signup' && (
          <>
            <div className="app-auth-invite">
              <div className="app-auth-invite-title">
                <span aria-hidden>🎁</span>
                {s.inviteTitle}
              </div>
              <input
                className="app-auth-input"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder={s.invitePh}
                disabled={loading}
              />
            </div>

            <div className="app-auth-checks">
              <label className="app-auth-check">
                <input
                  type="checkbox"
                  checked={newsletter}
                  onChange={(e) => setNewsletter(e.target.checked)}
                  disabled={loading}
                />
                <span>{s.newsletter}</span>
              </label>
              <label className="app-auth-check">
                <input
                  type="checkbox"
                  checked={pushAlerts}
                  onChange={(e) => setPushAlerts(e.target.checked)}
                  disabled={loading}
                />
                <span>{s.pushAlerts}</span>
              </label>
              <label className="app-auth-check">
                <input
                  type="checkbox"
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                  disabled={loading}
                />
                <span>
                  {s.privacy}{' '}
                  <Link
                    to={`${PRIVACY_URL}?from=signup`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {s.privacyLink}
                  </Link>
                </span>
              </label>
              <label className="app-auth-check">
                <input
                  type="checkbox"
                  checked={terms}
                  onChange={(e) => setTerms(e.target.checked)}
                  disabled={loading}
                />
                <span>
                  {s.terms}{' '}
                  <Link
                    to={`${TERMS_URL}?from=signup`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {s.termsLink}
                  </Link>
                </span>
              </label>
            </div>
          </>
        )}

        {error && <div className="app-auth-error">{error}</div>}

        <button
          type="button"
          className="app-auth-primary"
          disabled={loading || (mode === 'signup' && !canRegister)}
          onClick={() => void (mode === 'signup' ? handleSignup() : handleLogin())}
        >
          {loading
            ? mode === 'signup'
              ? s.registering
              : s.loggingIn
            : mode === 'signup'
              ? s.register
              : s.loginBtn}
        </button>

        <div className="app-auth-footer">
          {mode === 'signup' ? (
            <>
              {s.hasAccount}
              <button type="button" onClick={() => { setMode('login'); setError('') }}>
                {s.login}
              </button>
            </>
          ) : (
            <>
              {s.noAccount}
              <button type="button" onClick={() => { setMode('signup'); setError('') }}>
                {s.signup}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
