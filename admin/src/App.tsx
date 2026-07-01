import { useCallback, useState } from 'react'
import { AdminProvider, useAdmin } from './context/AdminContext'
import { ToastProvider } from './context/ToastContext'
import { LoginGate } from './components/LoginGate'
import { AdminShell } from './components/AdminShell'

function AdminRoot({
  authError,
  clearAuthError,
}: {
  authError: string
  clearAuthError: () => void
}) {
  const { secret } = useAdmin()

  if (!secret) {
    return (
      <LoginGate
        onSuccess={clearAuthError}
        authError={authError}
        clearAuthError={clearAuthError}
      />
    )
  }

  return <AdminShell />
}

export default function App() {
  const [authError, setAuthError] = useState('')
  const clearAuthError = useCallback(() => setAuthError(''), [])

  return (
    <ToastProvider>
      <AdminProvider onAuthError={setAuthError}>
        <AdminRoot authError={authError} clearAuthError={clearAuthError} />
      </AdminProvider>
    </ToastProvider>
  )
}
