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
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async () => {
    if (!email.trim() || !password) return
    setLoading(true)
    setError('')
    clearAuthError()
    try {
      await login(email.trim(), password)
      onSuccess()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && email.trim() && password) void submit()
  }

  return (
    <div className="gate-wrap">
      <div className="gate">
        <h1 className="logo">
          Hey<span>Maa</span> Admin
        </h1>
        <p className="sub">Sign in with your HeyMaa account</p>
        <input
          type="email"
          placeholder="Email"
          autoComplete="username"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={onKey}
        />
        <input
          type="password"
          placeholder="Password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={onKey}
        />
        <button
          type="button"
          disabled={!email.trim() || !password || loading}
          onClick={() => void submit()}
        >
          {loading ? 'Signing in…' : 'Enter dashboard →'}
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
