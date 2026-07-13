import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AppAuthScreen } from '../auth/AppAuthScreen'
import { HM_TOKEN_KEY } from '../lib/authApi'
import { APP_ROUTE } from '../publicRoutes'

export function AppAuthPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const existing = localStorage.getItem(HM_TOKEN_KEY)
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
