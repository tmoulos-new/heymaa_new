import type { AppNavTabId } from '../components/AppNavIcons'
import { stableSk } from './userDataRecovery'

const TOUR_SUFFIX = 'app_tour_v1'

export type AppTourStep = {
  id: string
  /** data-tour attribute value; omit for centered welcome / finish cards */
  target?: string
  /** Switch to this tab before highlighting (handled by MainApp) */
  tab?: AppNavTabId
  placement?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  title: Record<string, string>
  body: Record<string, string>
}

export const APP_TOUR_STEPS: AppTourStep[] = [
  {
    id: 'welcome',
    placement: 'center',
    title: {
      el: 'Καλώς ήρθες στο HeyMaa!',
      en: 'Welcome to HeyMaa!',
      ro: 'Bine ai venit la HeyMaa!',
    },
    body: {
      el: 'Μια γρήγορη ξενάγηση 1 λεπτού — θα δεις πού βρίσκεις chat, οικογένεια, αναμνήσεις και ρυθμίσεις.',
      en: 'A quick 1-minute tour — where to chat, manage family, save memories, and find settings.',
      ro: 'Un tur rapid de 1 minut — unde găsești chatul, familia, amintirile și setările.',
    },
  },
  {
    id: 'chat-tab',
    target: 'tab-chat',
    tab: 'chat',
    placement: 'top',
    title: {
      el: 'Το chat με την HeyMaa',
      en: 'Chat with HeyMaa',
      ro: 'Chat cu HeyMaa',
    },
    body: {
      el: 'Εδώ μιλάς με την AI βοηθό — ερωτήσεις για εγκυμοσύνη, μωρό, ύπνο, διατροφή.',
      en: 'Talk to your AI helper here — pregnancy, baby care, sleep, nutrition, and more.',
      ro: 'Aici vorbești cu asistenta AI — sarcină, îngrijirea bebelușului, somn, nutriție și altele.',
    },
  },
  {
    id: 'composer',
    target: 'chat-composer',
    tab: 'chat',
    placement: 'top',
    title: {
      el: 'Γράψε ή μίλησε',
      en: 'Type or speak',
      ro: 'Scrie sau vorbește',
    },
    body: {
      el: 'Πληκτρολόγησε ερώτηση, κράτα το μικρόφωνο για φωνή, ή πρόσθεσε φωτογραφία με το +.',
      en: 'Type a question, hold the mic for voice, or attach a photo with +.',
      ro: 'Tastează o întrebare, ține microfonul pentru voce sau atașează o poză cu +.',
    },
  },
  {
    id: 'notifications',
    target: 'header-notifications',
    tab: 'chat',
    placement: 'bottom',
    title: {
      el: 'Ειδοποιήσεις',
      en: 'Alerts',
      ro: 'Alerte',
    },
    body: {
      el: 'Καμπανάκι για δοκιμαστική περίοδο, συνδρομή και σημαντικές ενημερώσεις.',
      en: 'Bell icon for trial reminders, subscription, and important updates.',
      ro: 'Clopoțelul pentru reminder-uri de probă, abonament și actualizări importante.',
    },
  },
  {
    id: 'profile-tab',
    target: 'tab-profile',
    tab: 'profile',
    placement: 'top',
    title: {
      el: 'Το προφίλ σου',
      en: 'Your profile',
      ro: 'Profilul tău',
    },
    body: {
      el: 'Όνομα, πλάνο, πόντοι και ρυθμίσεις λογαριασμού. Οι πόντοι εμφανίζονται πάνω δεξιά — πάτα τους για το προφίλ, ή το avatar για ρυθμίσεις.',
      en: 'Name, plan, points, and account settings. Points sit top-right — tap them for your profile, or the avatar for settings.',
      ro: 'Nume, plan, puncte și setări cont. Punctele apar sus-dreapta — apasă pe ele pentru profil sau pe avatar pentru setări.',
    },
  },
  {
    id: 'family-tab',
    target: 'tab-family',
    tab: 'family',
    placement: 'top',
    title: {
      el: 'Οικογένεια',
      en: 'Family',
      ro: 'Familie',
    },
    body: {
      el: 'Πρόσθεσε παιδιά, σύντροφο, γονείς και κατοικίδια — το δέντρο ενημερώνεται αυτόματα.',
      en: 'Add children, partner, parents, and pets — your family tree updates automatically.',
      ro: 'Adaugă copii, partener, părinți și animale — arborele familial se actualizează automat.',
    },
  },
  {
    id: 'memories-tab',
    target: 'tab-memories',
    tab: 'memories',
    placement: 'top',
    title: {
      el: 'Αναμνήσεις',
      en: 'Memories',
      ro: 'Amintiri',
    },
    body: {
      el: 'Κράτα ημερολόγιο στιγμών με κείμενο και φωτογραφίες — οργανωμένα ανά μέλος της οικογένειας.',
      en: 'Keep a journal of moments with text and photos — organized by family member.',
      ro: 'Ține un jurnal de momente cu text și poze — organizat pe membru de familie.',
    },
  },
  {
    id: 'milestones-tab',
    target: 'tab-milestones',
    tab: 'milestones',
    placement: 'top',
    title: {
      el: 'Ορόσημα',
      en: 'Milestones',
      ro: 'Etape',
    },
    body: {
      el: 'Παρακολούθησε ανάπτυξη και σημαντικά βήματα — σημείωσε τι έχει πετύχει το μωρό σου.',
      en: 'Track development milestones — mark what your little one has achieved.',
      ro: 'Urmărește etapele de dezvoltare — bifează ce a reușit bebelușul tău.',
    },
  },
  {
    id: 'done',
    placement: 'center',
    title: {
      el: 'Έτοιμη/ος!',
      en: "You're all set!",
      ro: 'Ești gata!',
    },
    body: {
      el: 'Ξεκίνα με μια ερώτηση στο chat. Είμαστε δίπλα σου — πάντα.',
      en: 'Start with a question in chat. We are here for you — always.',
      ro: 'Începe cu o întrebare în chat. Suntem alături de tine — mereu.',
    },
  },
]

export function tourStorageKey(token: string): string {
  return stableSk(token, TOUR_SUFFIX)
}

export function hasCompletedAppTour(token: string): boolean {
  try {
    return localStorage.getItem(tourStorageKey(token)) === '1'
  } catch {
    return false
  }
}

export function markAppTourCompleted(token: string): void {
  try {
    localStorage.setItem(tourStorageKey(token), '1')
  } catch {
    /* ignore */
  }
}

export function resetAppTour(token: string): void {
  try {
    localStorage.removeItem(tourStorageKey(token))
  } catch {
    /* ignore */
  }
}

const JUST_ONBOARDED_KEY = 'hm_just_onboarded'
const FIRST_CHAT_GUIDE_SUFFIX = 'first_chat_guide_v1'

/** Set when onboarding finishes so the first in-app visit always runs the full tour. */
export function markJustOnboarded(): void {
  try {
    sessionStorage.setItem(JUST_ONBOARDED_KEY, '1')
  } catch {
    /* ignore */
  }
}

export function isJustOnboarded(): boolean {
  try {
    return sessionStorage.getItem(JUST_ONBOARDED_KEY) === '1'
  } catch {
    return false
  }
}

export function clearJustOnboarded(): void {
  try {
    sessionStorage.removeItem(JUST_ONBOARDED_KEY)
  } catch {
    /* ignore */
  }
}

export function firstChatGuideStorageKey(token: string): string {
  return stableSk(token, FIRST_CHAT_GUIDE_SUFFIX)
}

export function hasCompletedFirstChatGuide(token: string): boolean {
  try {
    return localStorage.getItem(firstChatGuideStorageKey(token)) === '1'
  } catch {
    return false
  }
}

export function markFirstChatGuideCompleted(token: string): void {
  try {
    localStorage.setItem(firstChatGuideStorageKey(token), '1')
    localStorage.removeItem(stableSk(token, 'first_chat_guide_pending_v1'))
  } catch {
    /* ignore */
  }
}

export function markFirstChatGuidePending(token: string): void {
  try {
    if (hasCompletedFirstChatGuide(token)) return
    localStorage.setItem(stableSk(token, 'first_chat_guide_pending_v1'), '1')
  } catch {
    /* ignore */
  }
}

export function isFirstChatGuidePending(token: string): boolean {
  try {
    return localStorage.getItem(stableSk(token, 'first_chat_guide_pending_v1')) === '1'
  } catch {
    return false
  }
}

export function tourText(
  map: Record<string, string>,
  lang: string,
  fallback = 'en',
): string {
  return map[lang] || map[fallback] || Object.values(map)[0] || ''
}
