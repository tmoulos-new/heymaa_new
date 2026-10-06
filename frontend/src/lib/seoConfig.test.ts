/**
 * @jest-environment jsdom
 */
import { seoConfigForPath } from '../components/SeoHead'

describe('seoConfigForPath', () => {
  it('indexes public marketing and legal URLs', () => {
    expect(seoConfigForPath('/').robots).toBe('index,follow')
    expect(seoConfigForPath('/').canonicalPath).toBe('/')
    expect(seoConfigForPath('/privacy').robots).toBe('index,follow')
    expect(seoConfigForPath('/terms').canonicalPath).toBe('/terms')
  })

  it('noindexes private and utility routes', () => {
    expect(seoConfigForPath('/app').robots).toBe('noindex,nofollow')
    expect(seoConfigForPath('/app/auth').robots).toBe('noindex,nofollow')
    expect(seoConfigForPath('/checkout/success').robots).toBe('noindex,nofollow')
    expect(seoConfigForPath('/subscription').robots).toBe('noindex,nofollow')
    expect(seoConfigForPath('/admin').robots).toBe('noindex,nofollow')
  })

  it('does not keep landing canonical on private routes', () => {
    expect(seoConfigForPath('/checkout').canonicalPath).not.toBe('/')
    expect(seoConfigForPath('/app').canonicalPath).toBe('/app')
  })

  it('noindexes unknown paths without advertising landing SEO', () => {
    const seo = seoConfigForPath('/this-page-does-not-exist')
    expect(seo.robots).toBe('noindex,nofollow')
    expect(seo.canonicalPath).toBe('/this-page-does-not-exist')
    expect(seo.title).toMatch(/not found/i)
  })
})
