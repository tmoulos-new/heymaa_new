const GREEK_ACCENTED = /[ΆΈΉΊΌΎΏάέήίόύώϊΐϋΰΪΫ]/g

const GREEK_ACCENT_MAP: Record<string, string> = {
  ά: 'α',
  έ: 'ε',
  ή: 'η',
  ί: 'ι',
  ό: 'ο',
  ύ: 'υ',
  ώ: 'ω',
  Ά: 'Α',
  Έ: 'Ε',
  Ή: 'Η',
  Ί: 'Ι',
  Ό: 'Ο',
  Ύ: 'Υ',
  Ώ: 'Ω',
  ϊ: 'ι',
  ΐ: 'ι',
  ϋ: 'υ',
  ΰ: 'υ',
  Ϊ: 'Ι',
  Ϋ: 'Υ',
}

/** Remove tonos from Greek letters (typography rule for all-caps). */
export function stripGreekAccents(text: string): string {
  return text.replace(GREEK_ACCENTED, (ch) => GREEK_ACCENT_MAP[ch] ?? ch)
}

/** Uppercase Greek text without accent marks on capitals. */
export function greekUppercase(text: string): string {
  return stripGreekAccents(text.toLocaleUpperCase('el-GR'))
}

/** Locale-aware uppercase: Greek drops tonos on capitals. */
export function displayUppercase(text: string, lang: string): string {
  if (lang.startsWith('el')) return greekUppercase(text)
  return text.toLocaleUpperCase(lang || 'en')
}
