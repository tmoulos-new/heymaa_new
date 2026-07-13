import { Navigate } from 'react-router-dom'
import { APP_ROUTE } from '../publicRoutes'

/** Legacy /auth URL → canonical /app/auth */
export function AuthPage() {
  return <Navigate to={`${APP_ROUTE}/auth`} replace />
}
