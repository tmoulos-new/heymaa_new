import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiDetail, getApiBase } from '../lib/api'
import type { AdminUser } from '../lib/types'
import { useToast } from './ToastContext'

interface AdminContextValue {
  token: string
  user: AdminUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  adminFetch: (path: string, opts?: RequestInit) => Promise<Record<string, unknown>>
  uploadImage: (bucket: 'offers' | 'promotions', file: File) => Promise<{ key: string; url: string }>
  onAuthError: (msg: string) => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

const TOKEN_KEY = 'hm_admin_token'

export function AdminProvider({
  children,
  onAuthError,
}: {
  children: ReactNode
  onAuthError: (msg: string) => void
}) {
  const [token, setToken] = useState(() => sessionStorage.getItem(TOKEN_KEY) || '')
  const [user, setUser] = useState<AdminUser | null>(null)
  const api = getApiBase()
  const { showToast } = useToast()

  const logout = useCallback(() => {
    sessionStorage.removeItem(TOKEN_KEY)
    setToken('')
    setUser(null)
  }, [])

  const adminFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const headers = { ...(opts.headers as Record<string, string>), 'x-token': token }
      const r = await fetch(`${api}${path}`, { ...opts, headers })
      let d: Record<string, unknown> = {}
      try {
        d = (await r.json()) as Record<string, unknown>
      } catch {
        /* empty */
      }
      if (!r.ok) {
        const msg = apiDetail(d) || `HTTP ${r.status}`
        if (r.status === 401 || r.status === 403) {
          logout()
          onAuthError(msg)
          showToast(msg, 'err')
        }
        throw new Error(msg)
      }
      return d
    },
    [api, token, logout, onAuthError, showToast],
  )

  const loadUser = useCallback(async () => {
    if (!token) {
      setUser(null)
      return
    }
    try {
      const d = await adminFetch('/admin/me')
      setUser((d.user as AdminUser) || null)
    } catch {
      setUser(null)
    }
  }, [token, adminFetch])

  useEffect(() => {
    void loadUser()
  }, [loadUser])

  const login = useCallback(
    async (email: string, password: string) => {
      const em = email.trim().toLowerCase()
      if (!em || !password) return
      const loginRes = await fetch(`${api}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: em, password }),
      })
      let loginData: Record<string, unknown> = {}
      try {
        loginData = (await loginRes.json()) as Record<string, unknown>
      } catch {
        /* empty */
      }
      if (!loginRes.ok) {
        throw new Error(apiDetail(loginData) || `HTTP ${loginRes.status}`)
      }
      const accessToken = String(loginData.token || '')
      if (!accessToken) throw new Error('Login failed: no token')

      const healthRes = await fetch(`${api}/admin/health`, {
        headers: { 'x-token': accessToken },
      })
      let healthData: Record<string, unknown> = {}
      try {
        healthData = (await healthRes.json()) as Record<string, unknown>
      } catch {
        /* empty */
      }
      if (!healthRes.ok) {
        throw new Error(apiDetail(healthData) || 'This account does not have admin access.')
      }

      sessionStorage.setItem(TOKEN_KEY, accessToken)
      setToken(accessToken)
      const admin = healthData.admin as Record<string, unknown> | undefined
      if (admin?.ok && admin.user_id) {
        setUser({
          id: String(admin.user_id),
          email: String(admin.email || ''),
          name: admin.name != null ? String(admin.name) : null,
          role: admin.role != null ? String(admin.role) : null,
        })
      }
    },
    [api],
  )

  const uploadImage = useCallback(
    async (bucket: 'offers' | 'promotions', file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${api}/admin/upload/${bucket}`, {
        method: 'POST',
        headers: { 'x-token': token },
        body: fd,
      })
      let d: Record<string, unknown> = {}
      try {
        d = (await r.json()) as Record<string, unknown>
      } catch {
        /* empty */
      }
      if (!r.ok) throw new Error(apiDetail(d) || `HTTP ${r.status}`)
      return { key: String(d.key), url: String(d.url) }
    },
    [api, token],
  )

  const value = useMemo(
    () => ({ token, user, login, logout, adminFetch, uploadImage, onAuthError }),
    [token, user, login, logout, adminFetch, uploadImage, onAuthError],
  )

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
