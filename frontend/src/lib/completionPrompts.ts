/**
 * Soft prompts that tempt moms to finish high-value app setup after first chat.
 * One at a time, snoozeable, auto-cleared when the action is done.
 */
import { normalizeAppLang, type AppLangCode } from './appLang'
import { stableSk } from './userDataRecovery'

export type CompletionKind = 'memory' | 'document' | 'milestone' | 'partner'

type PromptCopy = { title: string; body: string; cta: string; later: string }

const COPY: Record<CompletionKind, Record<AppLangCode, PromptCopy>> = {
  memory: {
    en: {
      title: 'Save your first memory',
      body: 'A photo, a first smile, or a short note — memories keep HeyMaa personal and unlock richer answers.',
      cta: 'Add a memory',
      later: 'Later',
    },
    el: {
      title: 'Αποθήκευσε την πρώτη σου ανάμνηση',
      body: 'Μια φωτογραφία, ένα χαμόγελο ή μια μικρή σημείωση — οι αναμνήσεις κάνουν τη HeyMaa πιο προσωπική.',
      cta: 'Πρόσθεσε ανάμνηση',
      later: 'Αργότερα',
    },
    ro: {
      title: 'Salvează prima amintire',
      body: 'O poză, un zâmbet sau o notă scurtă — amintirile fac HeyMaa mai personală și răspunsurile mai bune.',
      cta: 'Adaugă amintire',
      later: 'Mai târziu',
    },
  },
  document: {
    en: {
      title: 'Note your first family document',
      body: 'Keep vaccines, discharge papers, or IDs in one calm list — no file upload required.',
      cta: 'Add a document',
      later: 'Later',
    },
    el: {
      title: 'Καταχώρισε το 1ο οικογενειακό έγγραφο',
      body: 'Εμβόλια, εξιτήρια ή ταυτότητες σε μία ήρεμη λίστα — χωρίς ανέβασμα αρχείου.',
      cta: 'Πρόσθεσε έγγραφο',
      later: 'Αργότερα',
    },
    ro: {
      title: 'Notează primul document de familie',
      body: 'Vaccinuri, externe sau acte într-o listă calmă — fără încărcare de fișier.',
      cta: 'Adaugă document',
      later: 'Mai târziu',
    },
  },
  milestone: {
    en: {
      title: 'Tick a development milestone',
      body: 'Mark what your baby already does — HeyMaa uses it for better timing and tips.',
      cta: 'Open milestones',
      later: 'Later',
    },
    el: {
      title: 'Τίκαρε ένα ορόσημο ανάπτυξης',
      body: 'Σημείωσε τι έχει ήδη πετύχει το μωρό — η HeyMaa το χρησιμοποιεί για καλύτερες συμβουλές.',
      cta: 'Άνοιξε ορόσημα',
      later: 'Αργότερα',
    },
    ro: {
      title: 'Bifează un reper de dezvoltare',
      body: 'Notează ce face deja bebelușul — HeyMaa folosește asta pentru sfaturi mai bune.',
      cta: 'Deschide reperele',
      later: 'Mai târziu',
    },
  },
  partner: {
    en: {
      title: 'Add your partner',
      body: 'A complete family tree helps chat remember who is who — and feels more like home.',
      cta: 'Add partner',
      later: 'Later',
    },
    el: {
      title: 'Πρόσθεσε τον/την σύντροφό σου',
      body: 'Ένα πλήρες οικογενειακό δέντρο βοηθάει το chat να θυμάται ποιος είναι ποιος.',
      cta: 'Πρόσθεσε σύντροφο',
      later: 'Αργότερα',
    },
    ro: {
      title: 'Adaugă partenerul',
      body: 'Un arbore de familie complet ajută chatul să țină minte cine este cine.',
      cta: 'Adaugă partener',
      later: 'Mai târziu',
    },
  },
}

const ORDER: CompletionKind[] = ['memory', 'document', 'milestone', 'partner']

function doneKey(token: string, kind: CompletionKind) {
  return stableSk(token, `completion_done_v1_${kind}`)
}

function snoozeKey(token: string, kind: CompletionKind) {
  return stableSk(token, `completion_snooze_v1_${kind}`)
}

export function isCompletionDone(token: string, kind: CompletionKind): boolean {
  try {
    return localStorage.getItem(doneKey(token, kind)) === '1'
  } catch {
    return false
  }
}

export function markCompletionDone(token: string, kind: CompletionKind): void {
  try {
    localStorage.setItem(doneKey(token, kind), '1')
    sessionStorage.removeItem(snoozeKey(token, kind))
  } catch {
    /* ignore */
  }
}

export function snoozeCompletion(token: string, kind: CompletionKind): void {
  try {
    sessionStorage.setItem(snoozeKey(token, kind), '1')
  } catch {
    /* ignore */
  }
}

export function isCompletionSnoozed(token: string, kind: CompletionKind): boolean {
  try {
    return sessionStorage.getItem(snoozeKey(token, kind)) === '1'
  } catch {
    return false
  }
}

export type CompletionState = {
  hasMemory: boolean
  hasDocument: boolean
  hasMilestoneTick: boolean
  hasPartner: boolean
  hasChild: boolean
}

/** Auto-complete kinds that are already satisfied in data. */
export function syncCompletionFromState(token: string, state: CompletionState): void {
  if (state.hasMemory) markCompletionDone(token, 'memory')
  if (state.hasDocument) markCompletionDone(token, 'document')
  if (state.hasMilestoneTick) markCompletionDone(token, 'milestone')
  if (state.hasPartner) markCompletionDone(token, 'partner')
  if (!state.hasChild) markCompletionDone(token, 'milestone')
}

export function pickNextCompletion(token: string, state: CompletionState): CompletionKind | null {
  syncCompletionFromState(token, state)
  for (const kind of ORDER) {
    if (kind === 'milestone' && !state.hasChild) continue
    if (isCompletionDone(token, kind)) continue
    if (isCompletionSnoozed(token, kind)) continue
    return kind
  }
  return null
}

export function completionPromptCopy(lang: string, kind: CompletionKind): PromptCopy {
  const code = normalizeAppLang(lang, 'en')
  return COPY[kind][code] || COPY[kind].en
}
