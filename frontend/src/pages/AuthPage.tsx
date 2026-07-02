import { Navigate, useNavigate } from 'react-router-dom'
import { AuthScreen, HM_TOKEN_KEY } from '../App'
import { APP_ROUTE } from '../publicRoutes'

export function AuthPage() {
  const navigate = useNavigate()
  const existing = localStorage.getItem(HM_TOKEN_KEY)
  if (existing) return <Navigate to={APP_ROUTE} replace />

  return (
    <AuthScreen
      onSuccess={() => {
        navigate(APP_ROUTE, { replace: true })
      }}
    />
  )
}
