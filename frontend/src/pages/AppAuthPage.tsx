import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AppAuthScreen } from '../auth/AppAuthScreen'
import {
  HM_TOKEN_KEY,
  LOCAL_DEMO_TOKEN,
  isBrowserLocalHost,
} from '../lib/authApi'
import { APP_ROUTE } from '../publicRoutes'
import { normalizeAppLang } from '../lib/appLang'
import { stableSk } from '../lib/userDataRecovery'

function enterLocalDemo(): string {
  const lang = normalizeAppLang(localStorage.getItem('hm_pre_lang') || 'el', 'el')
  const profile = { name: 'Mama', childName: '', childAge: '', lang }
  localStorage.setItem(HM_TOKEN_KEY, LOCAL_DEMO_TOKEN)
  localStorage.setItem(stableSk(LOCAL_DEMO_TOKEN, 'profile'), JSON.stringify(profile))
  return LOCAL_DEMO_TOKEN
}

export function AppAuthPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const existing = localStorage.getItem(HM_TOKEN_KEY)

  // Localhost without DB: skip auth and open the app shell directly.
  if (!existing && isBrowserLocalHost()) {
    enterLocalDemo()
    return <Navigate to={APP_ROUTE} replace />
  }

  if (existing) return <Navigate to={APP_ROUTE} replace />

  const mode = search.get('mode') === 'login' ? 'login' : 'signup'

  return (
    <AppAuthScreen
      initialMode={mode}
      onSuccess={() => {
        navigate(APP_ROUTE, { replace: true })
      }}
    />
  )
}
