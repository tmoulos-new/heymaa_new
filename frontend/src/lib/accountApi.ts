import { getApiBase } from './authApi'
import { apiDetail } from './authApi'

const API = getApiBase()

export async function exportAccountData(token: string): Promise<void> {
  const res = await fetch(`${API}/auth/export-data`, {
    headers: { 'x-token': token },
  })
  if (!res.ok) {
    let body: unknown = null
    try {
      body = await res.json()
    } catch {
      /* ignore */
    }
    throw new Error(apiDetail(body, res.statusText || 'Export failed'))
  }
  const blob = await res.blob()
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  const filename = match?.[1] || `heymaa-data-${Date.now()}.json`
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export async function deleteAccount(token: string, password: string): Promise<void> {
  const res = await fetch(`${API}/auth/delete-account`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-token': token },
    body: JSON.stringify({ password }),
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    /* ignore */
  }
  if (!res.ok) {
    throw new Error(apiDetail(body, res.statusText || 'Delete failed'))
  }
}
