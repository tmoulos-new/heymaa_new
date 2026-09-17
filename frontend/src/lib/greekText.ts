const GREEK_ACCENTED = /[ΆΈΉΊΌΎΏάέήίόύώϊΐϋΰΪΫ]/g
const GREEK_LETTER = /[α-ωά-ώΑ-ΩΆ-Ώ]/

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

function normalizeGreekName(text: string): string {
  return text.normalize('NFC').trim()
}

function greekKey(text: string): string {
  return stripGreekAccents(normalizeGreekName(text).toLowerCase())
}

function hasGreekLetters(text: string): boolean {
  return GREEK_LETTER.test(text)
}

/** Common Greek names → vocative (keys are accent-insensitive lowercase). */
const VOCATIVE_EXACT: Record<string, string> = {
  γεωργιος: 'Γεώργιε',
  γιωργος: 'Γιώργο',
  γιωργης: 'Γιώργη',
  μαρια: 'Μαρία',
  νικος: 'Νίκο',
  νικολαος: 'Νικόλαε',
  κωστας: 'Κώστα',
  κωνσταντινος: 'Κωνσταντίνε',
  δημητρης: 'Δημήτρη',
  δημητριος: 'Δημήτριε',
  γιαννης: 'Γιάννη',
  ιωαννης: 'Ιωάννη',
  ελενη: 'Ελένη',
  σοφια: 'Σοφία',
  κατερινα: 'Κατερίνα',
  ανδρεας: 'Ανδρέα',
  χρηστος: 'Χρήστο',
  μιχαλης: 'Μιχάλη',
  μιχαηλος: 'Μιχαήλε',
  παυλος: 'Παύλε',
  στεφανος: 'Στέφανε',
  αθανασιος: 'Αθανάσιε',
  θανασης: 'Θανάση',
  ευαγγελια: 'Ευαγγελία',
  βασιλικη: 'Βασιλική',
  αγγελικη: 'Αγγελική',
  αναστασια: 'Αναστασία',
  χριστινα: 'Χριστίνα',
  παναγιωτα: 'Παναγιώτα',
  πετρος: 'Πέτρο',
  μακης: 'Μάκη',
  μαρκος: 'Μάρκο',
  αλεξανδρος: 'Αλέξανδρε',
  αλεξης: 'Άλεξη',
  βαγγελης: 'Βαγγέλη',
  σωτηρης: 'Σωτήρη',
  σπυρος: 'Σπύρο',
  σπυριδων: 'Σπυρίδωνα',
  φωτης: 'Φώτη',
  φωτεινη: 'Φωτεινή',
  ολγα: 'Όλγα',
  ιρινα: 'Ιρίνα',
  νεκταρια: 'Νεκταρία',
  δεσποινα: 'Δέσποινα',
  αθηνα: 'Αθήνα',
  ηρακλης: 'Ηρακλή',
  λεωνιδας: 'Λεωνίδα',
  παρις: 'Πάρη',
  τζενη: 'Τζένη',
  μαμ: 'Μαμ',
  μαμα: 'Μαμά',
}

function applyVocativeRules(word: string): string {
  const lower = greekKey(word)
  if (!lower) return word

  if (lower.endsWith('ιος') && word.length > 3) {
    return word.slice(0, -2) + 'ε'
  }
  if (lower.endsWith('σης')) {
    return word.slice(0, -2) + 'η'
  }
  if (lower.endsWith('ης')) {
    return word.slice(0, -1)
  }
  if (lower.endsWith('ας')) {
    return word.slice(0, -1) + 'α'
  }
  if (lower.endsWith('ος')) {
    return word.slice(0, -2) + 'ο'
  }
  return word
}

function vocativeWord(word: string): string {
  const trimmed = word.trim()
  if (!trimmed || !hasGreekLetters(trimmed)) return trimmed

  const key = greekKey(trimmed)
  const exact = VOCATIVE_EXACT[key]
  if (exact) return exact

  return applyVocativeRules(trimmed)
}

/** Convert a Greek name to vocative for direct address (Γεια σου, Γεώργιε). */
export function greekVocative(name: string): string {
  const trimmed = normalizeGreekName(name)
  if (!trimmed || !hasGreekLetters(trimmed)) return trimmed

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return trimmed

  const first = vocativeWord(parts[0])
  if (parts.length === 1) return first
  return [first, ...parts.slice(1)].join(' ')
}

/** Use vocative when addressing the user in Greek; also when the name itself is Greek. */
export function nameInVocative(name: string, lang: string): string {
  const trimmed = normalizeGreekName(name)
  if (!trimmed) return name
  if (lang.startsWith('el') || hasGreekLetters(trimmed)) return greekVocative(trimmed)
  return name
}

export type GreekNameGender = 'girl' | 'boy' | 'surprise'

/** Common Greek names → genitive (keys are accent-insensitive lowercase). */
const GENITIVE_EXACT: Record<string, string> = {
  γεωργιος: 'Γεωργίου',
  γιωργος: 'Γιώργου',
  γιωργης: 'Γιώργη',
  μαρια: 'Μαρίας',
  νικος: 'Νίκου',
  νικολαος: 'Νικολάου',
  κωστας: 'Κώστα',
  κωνσταντινος: 'Κωνσταντίνου',
  δημητρης: 'Δημήτρη',
  δημητριος: 'Δημητρίου',
  γιαννης: 'Γιάννη',
  ιωαννης: 'Ιωάννη',
  ελενη: 'Ελένης',
  σοφια: 'Σοφίας',
  κατερινα: 'Κατερίνας',
  ανδρεας: 'Ανδρέα',
  χρηστος: 'Χρήστου',
  μιχαλης: 'Μιχάλη',
  μιχαηλος: 'Μιχαήλου',
  παυλος: 'Παύλου',
  στεφανος: 'Στεφάνου',
  αθανασιος: 'Αθανασίου',
  θανασης: 'Θανάση',
  ευαγγελια: 'Ευαγγελίας',
  βασιλικη: 'Βασιλικής',
  αγγελικη: 'Αγγελικής',
  αναστασια: 'Αναστασίας',
  χριστινα: 'Χριστίνας',
  παναγιωτα: 'Παναγιώτας',
  πετρος: 'Πέτρου',
  μακης: 'Μάκη',
  μαρκος: 'Μάρκου',
  αλεξανδρος: 'Αλεξάνδρου',
  αλεξης: 'Αλέξη',
  βαγγελης: 'Βαγγέλη',
  σωτηρης: 'Σωτήρη',
  σπυρος: 'Σπύρου',
  σπυριδων: 'Σπυρίδωνα',
  φωτης: 'Φώτη',
  φωτεινη: 'Φωτεινής',
  ολγα: 'Όλγας',
  ιρινα: 'Ιρίνας',
  νεκταρια: 'Νεκταρίας',
  δεσποινα: 'Δέσποινας',
  αθηνα: 'Αθήνας',
  ηρακλης: 'Ηρακλή',
  λεωνιδας: 'Λεωνίδα',
  παρις: 'Πάρι',
  τζενη: 'Τζένης',
  πανος: 'Πάνου',
  μωρο: 'μωρού',
  εγκυμοσυνη: 'εγκυμοσύνης',
  μαμα: 'Μαμάς',
}

function looksFeminineGreekName(lower: string): boolean {
  if (!lower) return false
  if (lower.endsWith('ας') || lower.endsWith('ης') || lower.endsWith('ος') || lower.endsWith('ις')) return false
  return /[αηω]$/.test(lower)
}

function looksMasculineGreekName(lower: string): boolean {
  return /(ος|ης|ας|εας|ων|ις)$/.test(lower)
}

function applyGenitiveRules(word: string, gender?: GreekNameGender): string {
  const lower = greekKey(word)
  if (!lower) return word

  const feminine = gender === 'girl' || (gender !== 'boy' && looksFeminineGreekName(lower))
  if (feminine) {
    if (lower.endsWith('ου')) return word
    if (/[ηαω]$/.test(lower)) return `${word}ς`
    return word
  }

  if (lower.endsWith('ιος') && word.length > 3) return word.slice(0, -2) + 'ου'
  if (lower.endsWith('ος')) return word.slice(0, -2) + 'ου'
  if (lower.endsWith('ης') || lower.endsWith('ας') || lower.endsWith('ις')) return word.slice(0, -1)
  if (lower.endsWith('ων')) return `${word}α`
  if (lower.endsWith('ο')) return word.slice(0, -1) + 'ου'
  return word
}

function genitiveWord(word: string, gender?: GreekNameGender): string {
  const trimmed = word.trim()
  if (!trimmed || !hasGreekLetters(trimmed)) return trimmed

  const exact = GENITIVE_EXACT[greekKey(trimmed)]
  if (exact) {
    const first = trimmed[0]
    if (first && first === first.toLocaleUpperCase('el-GR')) {
      return exact.charAt(0).toLocaleUpperCase('el-GR') + exact.slice(1)
    }
    return exact.charAt(0).toLocaleLowerCase('el-GR') + exact.slice(1)
  }
  return applyGenitiveRules(trimmed, gender)
}

/** Convert a Greek name to genitive (Πάνος → Πάνου, Μαρία → Μαρίας). */
export function greekGenitive(name: string, gender?: GreekNameGender): string {
  const trimmed = normalizeGreekName(name)
  if (!trimmed || !hasGreekLetters(trimmed)) return trimmed

  const parts = trimmed.split(/\s+/).filter(Boolean)
  if (parts.length === 0) return trimmed

  const first = genitiveWord(parts[0], gender)
  if (parts.length === 1) return first
  return [first, ...parts.slice(1)].join(' ')
}

export function nameInGenitive(name: string, lang: string, gender?: GreekNameGender): string {
  const trimmed = normalizeGreekName(name)
  if (!trimmed) return name
  if (lang.startsWith('el') || hasGreekLetters(trimmed)) return greekGenitive(trimmed, gender)
  return name
}

/** του / της for a person name, or empty when gender cannot be inferred. */
export function greekGenitiveArticle(name: string, gender?: GreekNameGender): 'του' | 'της' | '' {
  if (gender === 'boy') return 'του'
  if (gender === 'girl') return 'της'
  const lower = greekKey(name)
  if (lower === 'μωρο' || lower.endsWith('ο')) return 'του'
  if (looksFeminineGreekName(lower)) return 'της'
  if (looksMasculineGreekName(lower)) return 'του'
  return ''
}
