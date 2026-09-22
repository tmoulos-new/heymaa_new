import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AppAuthScreen } from '../auth/AppAuthScreen'
import {
  clearAuthToken,
  getAuthToken,
  isLocalDemoToken,
  restoreAuthSession,
} from '../lib/authApi'
import { resumePlanAfterAuth } from '../lib/planCheckoutFlow'
import { prefetchAppChunk } from '../lib/prefetchApp'

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
  const [existing, setExisting] = useState<string | null>(() => realAuthToken())
  const [sessionReady, setSessionReady] = useState(() => !!realAuthToken())
  const inviteFromUrl = (search.get('invite') || search.get('code') || '').trim()
  const mode = inviteFromUrl || search.get('mode') !== 'login' ? 'signup' : 'login'
  const wantsAuthForm = search.get('mode') === 'login' || search.get('mode') === 'signup'

  useEffect(() => {
    prefetchAppChunk()
  }, [])

  useEffect(() => {
    if (sessionReady) return
    let cancelled = false
    restoreAuthSession()
      .then((tk) => {
        if (cancelled) return
        setExisting(tk && !isLocalDemoToken(tk) ? tk : null)
        setSessionReady(true)
      })
      .catch(() => {
        if (!cancelled) setSessionReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [sessionReady])

  useEffect(() => {
    if (!existing || wantsAuthForm) return
    resumePlanAfterAuth(navigate)
  }, [existing, wantsAuthForm, navigate])

  if (!sessionReady) {
    return (
      <div
        style={{
          minHeight: 'calc(100dvh / var(--hm-app-zoom, 1))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#D4DCE8',
          fontFamily: "'DM Sans', sans-serif",
          color: '#2B3A67',
          fontSize: 15,
        }}
      >
        …
      </div>
    )
  }

  if (existing && !wantsAuthForm) {
    return (
      <div
        style={{
          minHeight: 'calc(100dvh / var(--hm-app-zoom, 1))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#D4DCE8',
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
      initialInvite={inviteFromUrl}
      onSuccess={() => resumePlanAfterAuth(navigate)}
    />
  )
}
