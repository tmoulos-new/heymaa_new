/** Auth token storage — sessionStorage reduces XSS persistence vs localStorage. */

export const HM_TOKEN_KEY = 'hm_token'

export function getAuthToken(): string | null {
  try {
    return sessionStorage.getItem(HM_TOKEN_KEY) ?? localStorage.getItem(HM_TOKEN_KEY)
  } catch {
    return null
  }
}

export function setAuthToken(token: string): void {
  try {
    sessionStorage.setItem(HM_TOKEN_KEY, token)
    localStorage.removeItem(HM_TOKEN_KEY)
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearAuthToken(): void {
  try {
    sessionStorage.removeItem(HM_TOKEN_KEY)
    localStorage.removeItem(HM_TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

export function hasAuthToken(): boolean {
  return !!getAuthToken()
}
