import { titleFromConversation } from './chatThreadTitle'

describe('titleFromConversation', () => {
  it('skips a greeting and uses the real topic question', () => {
    const title = titleFromConversation(
      [
        { role: 'user', content: 'Γεια σου' },
        { role: 'assistant', content: 'Γεια! Πώς πάει;' },
        { role: 'user', content: 'Ο Πάνος ξυπνά κάθε ώρα τη νύχτα, τι να κάνω για τον ύπνο;' },
      ],
      'Past',
    )
    expect(title.toLowerCase()).toContain('ύπνο')
    expect(title.toLowerCase()).not.toContain('γεια')
  })

  it('prefers a topical later turn over a short first question', () => {
    const title = titleFromConversation(
      [
        { role: 'user', content: 'Quick question' },
        { role: 'assistant', content: 'Sure — tell me more.' },
        {
          role: 'user',
          content: 'When should I start solids and how do I introduce puree without allergies?',
        },
      ],
      'Past',
    )
    expect(title.toLowerCase()).toMatch(/solid|puree|allerg/)
  })

  it('falls back when empty', () => {
    expect(titleFromConversation([], 'Past conversations')).toBe('Past conversations')
  })
})
