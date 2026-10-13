import {
  clearCachedSubscriptionActive,
  readCachedSubscriptionActive,
  writeCachedSubscriptionActive,
} from './authApi'

describe('subscription active cache', () => {
  const token = 'test-token-abcdefghijklmnop'

  afterEach(() => {
    try { sessionStorage.clear() } catch { /* ignore */ }
    try { localStorage.clear() } catch { /* ignore */ }
  })

  it('round-trips true and false', () => {
    expect(readCachedSubscriptionActive(token)).toBeNull()
    writeCachedSubscriptionActive(token, true)
    expect(readCachedSubscriptionActive(token)).toBe(true)
    writeCachedSubscriptionActive(token, false)
    expect(readCachedSubscriptionActive(token)).toBe(false)
  })

  it('survives sessionStorage clear via localStorage', () => {
    writeCachedSubscriptionActive(token, true)
    sessionStorage.clear()
    expect(readCachedSubscriptionActive(token)).toBe(true)
    clearCachedSubscriptionActive(token)
    expect(readCachedSubscriptionActive(token)).toBeNull()
  })
})
