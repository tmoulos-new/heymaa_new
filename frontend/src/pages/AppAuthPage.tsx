import { useEffect } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { AppAuthScreen } from '../auth/AppAuthScreen'
import {
  clearAuthToken,
  getAuthToken,
  isLocalDemoToken,
} from '../lib/authApi'
import { resumePlanAfterAuth } from '../lib/planCheckoutFlow'

function realAuthToken(): string | null {
  const existing = getAuthToken()
  if (!existing) return null
  if (isLocalDemoToken(existing)) {
    clearAuthToken()
    return null
  }
  return existing
}

export function AppAuthPage() {
  const navigate = useNavigate()
  const [search] = useSearchParams()
  const existing = realAuthToken()
  const mode = search.get('mode') === 'login' ? 'login' : 'signup'
  const wantsAuthForm = search.get('mode') === 'login' || search.get('mode') === 'signup'

  useEffect(() => {
    if (!existing || wantsAuthForm) return
    resumePlanAfterAuth(navigate)
  }, [existing, wantsAuthForm, navigate])

  if (existing && !wantsAuthForm) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#F5F0EB',
          fontFamily: "'DM Sans', sans-serif",
          color: '#2B3A67',
          fontSize: 15,
        }}
      >
        …
      </div>
    )
  }

  return (
    <AppAuthScreen
      initialMode={mode}
      onSuccess={() => resumePlanAfterAuth(navigate)}
    />
  )
}
