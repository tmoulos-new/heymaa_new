import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { apiDetail, getApiBase } from '../lib/api'
import { useToast } from './ToastContext'

interface AdminContextValue {
  secret: string
  login: (secret: string) => Promise<void>
  logout: () => void
  adminFetch: (path: string, opts?: RequestInit) => Promise<Record<string, unknown>>
  uploadImage: (bucket: 'offers' | 'promotions', file: File) => Promise<{ key: string; url: string }>
  onAuthError: (msg: string) => void
}

const AdminContext = createContext<AdminContextValue | null>(null)

const SECRET_KEY = 'hm_admin'

export function AdminProvider({
  children,
  onAuthError,
}: {
  children: ReactNode
  onAuthError: (msg: string) => void
}) {
  const [secret, setSecret] = useState(() => sessionStorage.getItem(SECRET_KEY) || '')
  const api = getApiBase()
  const { showToast } = useToast()

  const logout = useCallback(() => {
    sessionStorage.removeItem(SECRET_KEY)
    sessionStorage.removeItem('hm_admin_tab')
    setSecret('')
  }, [])

  const adminFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const headers = { ...(opts.headers as Record<string, string>), 'x-admin-secret': secret }
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
    [api, secret, logout, onAuthError, showToast],
  )

  const login = useCallback(
    async (value: string) => {
      const trimmed = value.trim()
      if (!trimmed) return
      const r = await fetch(`${api}/admin/health`, {
        headers: { 'x-admin-secret': trimmed },
      })
      let d: Record<string, unknown> = {}
      try {
        d = (await r.json()) as Record<string, unknown>
      } catch {
        /* empty */
      }
      if (!r.ok) throw new Error(apiDetail(d) || `HTTP ${r.status}`)
      sessionStorage.setItem(SECRET_KEY, trimmed)
      setSecret(trimmed)
    },
    [api],
  )

  const uploadImage = useCallback(
    async (bucket: 'offers' | 'promotions', file: File) => {
      const fd = new FormData()
      fd.append('file', file)
      const r = await fetch(`${api}/admin/upload/${bucket}`, {
        method: 'POST',
        headers: { 'x-admin-secret': secret },
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
    [api, secret],
  )

  const value = useMemo(
    () => ({ secret, login, logout, adminFetch, uploadImage, onAuthError }),
    [secret, login, logout, adminFetch, uploadImage, onAuthError],
  )

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>
}

export function useAdmin() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdmin must be used within AdminProvider')
  return ctx
}
