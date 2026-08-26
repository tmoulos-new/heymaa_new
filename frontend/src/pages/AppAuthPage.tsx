import { useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AppAuthScreen } from '../auth/AppAuthScreen'
import {
  LOCAL_DEMO_TOKEN,
  clearAuthToken,
  getAuthToken,
  isBrowserLocalHost,
  isLocalDemoToken,
  setAuthToken,
} from '../lib/authApi'
import { APP_ROUTE } from '../publicRoutes'
import { normalizeAppLang } from '../lib/appLang'
import { stableSk } from '../lib/userDataRecovery'
import { resumePlanAfterAuth } from '../lib/planCheckoutFlow'

function enterLocalDemo(): string {
  const lang = normalizeAppLang(localStorage.getItem('hm_pre_lang') || 'el', 'el')
  const profile = { name: 'Mama', childName: '', childAge: '', lang }
  setAuthToken(LOCAL_DEMO_TOKEN)
  localStorage.setItem(stableSk(LOCAL_DEMO_TOKEN, 'profile'), JSON.stringify(profile))
  return LOCAL_DEMO_TOKEN
}

export function AppAuthPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const existing = getAuthToken()
  const mode = search.get('mode') === 'login' ? 'login' : 'signup'
  const wantsAuthForm = search.get('mode') === 'login' || search.get('mode') === 'signup'

  useEffect(() => {
    if (!existing || wantsAuthForm) return
    resumePlanAfterAuth(navigate)
  }, [existing, wantsAuthForm, navigate])

  // Localhost without an explicit auth mode: skip the form and open the app shell.
  // /auth?mode=login|signup always shows the real form (needs Supabase).
  if (!existing && isBrowserLocalHost() && !wantsAuthForm) {
    enterLocalDemo()
    return <Navigate to={APP_ROUTE} replace />
  }

  if (existing && !wantsAuthForm) {
    return null
  }

  // Opening login/signup while a demo session exists: clear demo so the form can run.
  if (existing && isLocalDemoToken(existing) && wantsAuthForm) {
    clearAuthToken()
  }

  return (
    <AppAuthScreen
      initialMode={mode}
      onSuccess={() => resumePlanAfterAuth(navigate)}
    />
  )
}
