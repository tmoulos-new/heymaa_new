import { clearAuthToken, getAuthToken, persistAuthSession } from './authStorage'

describe('authStorage persistence', () => {
  afterEach(() => {
    try { sessionStorage.clear() } catch { /* ignore */ }
    try { localStorage.clear() } catch { /* ignore */ }
  })

  it('keeps the login in localStorage after set', () => {
    persistAuthSession('access-token', 'refresh-token')
    sessionStorage.removeItem('hm_token')
    expect(getAuthToken()).toBe('access-token')
  })

  it('clears both stores on logout', () => {
    persistAuthSession('access-token', 'refresh-token')
    clearAuthToken()
    expect(getAuthToken()).toBeNull()
  })
})
