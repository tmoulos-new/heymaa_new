import { useState } from 'react'
import { AUTH_LOGO_SRC } from './authLogo'
import {
  apiDetail,
  API,
  checkEmail,
  HM_TOKEN_KEY,
  loginUser,
  registerUser,
} from '../lib/authApi'
import { authStrings, PRIVACY_URL, TERMS_URL, type AuthLang } from './authStrings'
import './appAuth.css'

function GoogleIcon() {
  return (
    <svg className="app-auth-google-icon" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

type Mode = 'signup' | 'login'

export function AppAuthScreen({
  onSuccess,
  initialMode = 'signup',
}: {
  onSuccess: (token: string) => void
  initialMode?: Mode
}) {
  const [lang, setLang] = useState<AuthLang>(() => {
    const stored = localStorage.getItem('hm_pre_lang')
    return stored === 'en' ? 'en' : 'el'
  })
  const s = authStrings(lang)
  const [mode, setMode] = useState<Mode>(initialMode)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [wantChild, setWantChild] = useState(false)
  const [pregnantOrMom, setPregnantOrMom] = useState(false)
  const [newsletter, setNewsletter] = useState(false)
  const [privacy, setPrivacy] = useState(false)
  const [terms, setTerms] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [forgotSent, setForgotSent] = useState(false)

  const persistLang = (next: AuthLang) => {
    setLang(next)
    localStorage.setItem('hm_pre_lang', next)
  }

  const handleSignup = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedName = name.trim()
    if (!trimmedName) {
      setError(s.errName)
      return
    }
    if (password.length < 6) {
      setError(s.errPasswordMin)
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
        want_child: wantChild,
        pregnancy_or_mom: pregnantOrMom,
        consent_marketing: newsletter,
        consent_privacy: privacy,
        consent_terms: terms,
        lang,
      })
      localStorage.setItem(HM_TOKEN_KEY, res.data.token)
      onSuccess(res.data.token)
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } }
      setError(apiDetail(err.response?.data, s.errRegister))
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail || password.length < 1) return
    setLoading(true)
    setError('')
    try {
      const res = await loginUser(trimmedEmail, password)
      localStorage.setItem(HM_TOKEN_KEY, res.data.token)
      onSuccess(res.data.token)
    } catch (e: unknown) {
      const err = e as { response?: { data?: unknown } }
      setError(apiDetail(err.response?.data, s.errLogin))
    } finally {
      setLoading(false)
    }
  }

  const handleForgot = async () => {
    const trimmedEmail = email.trim().toLowerCase()
    if (!trimmedEmail) {
      setError(lang === 'el' ? 'Συμπλήρωσε το email σου.' : 'Enter your email first.')
      return
    }
    setLoading(true)
    setError('')
    try {
      await fetch(`${API}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmedEmail }),
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
      <button
        type="button"
        className="app-auth-lang"
        onClick={() => persistLang(lang === 'el' ? 'en' : 'el')}
      >
        {lang === 'el' ? 'EN' : 'EL'}
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
          <input
            id="auth-password"
            className="app-auth-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={s.passwordPh}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            disabled={loading}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void (mode === 'signup' ? handleSignup() : handleLogin())
            }}
          />
        </div>

        {mode === 'login' && (
          forgotSent ? (
            <p className="app-auth-error" style={{ color: '#2d9e6b' }}>
              {lang === 'el' ? 'Στείλαμε email επαναφοράς κωδικού ✓' : 'Password reset email sent ✓'}
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
                  checked={wantChild}
                  onChange={(e) => setWantChild(e.target.checked)}
                  disabled={loading}
                />
                <span>{s.wantChild}</span>
              </label>
              <label className="app-auth-check">
                <input
                  type="checkbox"
                  checked={pregnantOrMom}
                  onChange={(e) => setPregnantOrMom(e.target.checked)}
                  disabled={loading}
                />
                <span>{s.pregnantOrMom}</span>
              </label>
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
                  checked={privacy}
                  onChange={(e) => setPrivacy(e.target.checked)}
                  disabled={loading}
                />
                <span>
                  {s.privacy}{' '}
                  <a href={PRIVACY_URL} target="_blank" rel="noreferrer">
                    {s.privacyLink}
                  </a>
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
                  <a href={TERMS_URL} target="_blank" rel="noreferrer">
                    {s.termsLink}
                  </a>
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

        <div className="app-auth-divider">{s.or}</div>

        <button
          type="button"
          className="app-auth-google"
          disabled={loading}
          onClick={() => setError(s.googleSoon)}
        >
          <GoogleIcon />
          {s.google}
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
