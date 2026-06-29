import { useState, type KeyboardEvent } from 'react'
import { useAdmin } from '../context/AdminContext'

export function LoginGate({
  onSuccess,
  authError,
  clearAuthError,
}: {
  onSuccess: () => void
  authError: string
  clearAuthError: () => void
}) {
  const { login } = useAdmin()
  const [secret, setSecret] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!secret.trim()) return
    setLoading(true)
    setError('')
    clearAuthError()
    try {
      await login(secret.trim())
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && secret.trim()) void submit()
  }

  return (
    <div className="gate-wrap">
      <div className="gate">
        <h1 className="logo">
          Hey<span>Maa</span> Admin
        </h1>
        <p className="sub">Enter admin secret to continue</p>
        <input
          type="password"
          placeholder="Admin secret"
          autoComplete="current-password"
          value={secret}
          onChange={(e) => setSecret(e.target.value)}
          onKeyDown={onKey}
        />
        <button type="button" disabled={!secret.trim() || loading} onClick={() => void submit()}>
          {loading ? 'Checking…' : 'Enter dashboard →'}
        </button>
        {(error || authError) && (
          <div className="msg err" style={{ marginTop: 14, textAlign: 'left' }}>
            {error || authError}
          </div>
        )}
      </div>
    </div>
  )
}
