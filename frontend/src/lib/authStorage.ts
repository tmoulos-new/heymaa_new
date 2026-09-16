/** Persist login across visits. HttpOnly cookies remain the API backup. */

export const HM_TOKEN_KEY = 'hm_token'
export const HM_REFRESH_KEY = 'hm_refresh'

function readStore(store: Storage, key: string): string | null {
  try {
    const v = store.getItem(key)
    return v && v.trim() ? v : null
  } catch {
    return null
  }
}

function writeStore(store: Storage, key: string, value: string) {
  try {
    store.setItem(key, value)
  } catch {
    /* ignore quota / private mode */
  }
}

function removeStore(store: Storage, key: string) {
  try {
    store.removeItem(key)
  } catch {
    /* ignore */
  }
}

export function getAuthToken(): string | null {
  const session = readStore(sessionStorage, HM_TOKEN_KEY)
  const local = readStore(localStorage, HM_TOKEN_KEY)
  if (session && !local) writeStore(localStorage, HM_TOKEN_KEY, session)
  return session ?? local
}

export function getRefreshToken(): string | null {
  return readStore(localStorage, HM_REFRESH_KEY) ?? readStore(sessionStorage, HM_REFRESH_KEY)
}

export function setAuthToken(token: string): void {
  writeStore(sessionStorage, HM_TOKEN_KEY, token)
  writeStore(localStorage, HM_TOKEN_KEY, token)
}

export function setRefreshToken(token: string): void {
  writeStore(sessionStorage, HM_REFRESH_KEY, token)
  writeStore(localStorage, HM_REFRESH_KEY, token)
}

export function persistAuthSession(token: string, refreshToken?: string | null): void {
  setAuthToken(token)
  if (refreshToken && refreshToken.trim()) setRefreshToken(refreshToken.trim())
}

export function clearAuthToken(): void {
  removeStore(sessionStorage, HM_TOKEN_KEY)
  removeStore(localStorage, HM_TOKEN_KEY)
  removeStore(sessionStorage, HM_REFRESH_KEY)
  removeStore(localStorage, HM_REFRESH_KEY)
}

export function hasAuthToken(): boolean {
  return !!getAuthToken()
}
