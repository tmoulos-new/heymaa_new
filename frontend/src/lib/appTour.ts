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
    },
    body: {
      el: 'Μια γρήγορη ξενάγηση 1 λεπτού — θα δεις πού βρίσκεις chat, οικογένεια, αναμνήσεις και ρυθμίσεις.',
      en: 'A quick 1-minute tour — where to chat, manage family, save memories, and find settings.',
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
    },
    body: {
      el: 'Εδώ μιλάς με την AI σύμβουλο — ερωτήσεις για εγκυμοσύνη, μωρό, ύπνο, διατροφή.',
      en: 'Talk to your AI companion here — pregnancy, baby care, sleep, nutrition, and more.',
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
    },
    body: {
      el: 'Πληκτρολόγησε ερώτηση, κράτα το μικρόφωνο για φωνή, ή πρόσθεσε φωτογραφία με το +.',
      en: 'Type a question, hold the mic for voice, or attach a photo with +.',
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
    },
    body: {
      el: 'Καμπανάκι για δοκιμαστική περίοδο, συνδρομή και σημαντικές ενημερώσεις.',
      en: 'Bell icon for trial reminders, subscription, and important updates.',
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
    },
    body: {
      el: 'Όνομα, πλάνο, πόντοι και ρυθμίσεις λογαριασμού. Οι πόντοι εμφανίζονται πάνω δεξιά — πάτα τους για το προφίλ, ή το avatar για ρυθμίσεις.',
      en: 'Name, plan, points, and account settings. Points sit top-right — tap them for your profile, or the avatar for settings.',
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
    },
    body: {
      el: 'Πρόσθεσε παιδιά, σύντροφο, γονείς και κατοικίδια — το δέντρο ενημερώνεται αυτόματα.',
      en: 'Add children, partner, parents, and pets — your family tree updates automatically.',
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
    },
    body: {
      el: 'Κράτα ημερολόγιο στιγμών με κείμενο και φωτογραφίες — οργανωμένα ανά μέλος της οικογένειας.',
      en: 'Keep a journal of moments with text and photos — organized by family member.',
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
    },
    body: {
      el: 'Παρακολούθησε ανάπτυξη και σημαντικά βήματα — σημείωσε τι έχει πετύχει το μωρό σου.',
      en: 'Track development milestones — mark what your little one has achieved.',
    },
  },
  {
    id: 'done',
    placement: 'center',
    title: {
      el: 'Έτοιμη/ος!',
      en: "You're all set!",
    },
    body: {
      el: 'Ξεκίνα με μια ερώτηση στο chat. Είμαστε δίπλα σου — πάντα.',
      en: 'Start with a question in chat. We are here for you — always.',
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

export function tourText(
  map: Record<string, string>,
  lang: string,
  fallback = 'en',
): string {
  return map[lang] || map[fallback] || Object.values(map)[0] || ''
}
