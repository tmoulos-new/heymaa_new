import { readCachedSubscriptionActive, writeCachedSubscriptionActive } from './authApi'

describe('subscription active cache', () => {
  const token = 'test-token-abcdefghijklmnop'

  afterEach(() => {
    try { sessionStorage.clear() } catch { /* ignore */ }
  })

  it('round-trips true and false', () => {
    expect(readCachedSubscriptionActive(token)).toBeNull()
    writeCachedSubscriptionActive(token, true)
    expect(readCachedSubscriptionActive(token)).toBe(true)
    writeCachedSubscriptionActive(token, false)
    expect(readCachedSubscriptionActive(token)).toBe(false)
  })
})
