import type { PlanEntitlements, SubscriptionSnapshot } from '../lib/authApi'
import type { AccessExpiryInfo } from '../lib/accessExpiry'
import {
  nextUpgradePlanLabel,
  nextUpgradePlanSlot,
} from '../lib/planFeatures'
import {
  activePlanNameForSlot,
  displaySelectedPlanSlot,
  type PlanSlot,
} from '../lib/subscriptionPlans'
import {
  archivedThreadsLimit,
  chatContextDepth,
} from '../lib/planEntitlements'
import { voiceListenQuotaForSnapshot } from '../lib/voiceQuota'

type Props = {
  lang: string
  snapshot: SubscriptionSnapshot | null
  entitlements: PlanEntitlements | null
  accessExpiry: AccessExpiryInfo | null
  onUpgrade: () => void
  onManage?: () => void
}

function planHighlights(slot: PlanSlot, lang: string, ents: PlanEntitlements | null, snap: SubscriptionSnapshot | null): string[] {
  const voice = voiceListenQuotaForSnapshot(snap)
  const chatCtx = chatContextDepth(ents, snap)
  const archives = archivedThreadsLimit(ents, snap)
  if (slot === 'trial') {
    if (lang === 'el') return ['Δωρεάν δοκιμή HeyMaa', 'Βασικό chat με τη Maa', 'Οικογένεια & ορόσημα']
    if (lang === 'ro') return ['Probă gratuită HeyMaa', 'Chat de bază cu Maa', 'Familie & etape']
    return ['Free HeyMaa trial', 'Core chat with Maa', 'Family & milestones']
  }
  if (slot === 'starter') {
    if (lang === 'el') {
      return [
        `Φωνητική ακρόαση: ${voice}/μήνα`,
        `Ιστορικό chat: ~${chatCtx} μηνύματα`,
        `Αρχειοθετημένες συνομιλίες: ${archives}`,
        'Βίντεο αναμνήσεων',
      ]
    }
    if (lang === 'ro') {
      return [
        `Ascultare vocală: ${voice}/lună`,
        `Istoric chat: ~${chatCtx} mesaje`,
        `Conversații arhivate: ${archives}`,
        'Videouri cu amintiri',
      ]
    }
    return [
      `Voice listening: ${voice}/mo`,
      `Chat history: ~${chatCtx} messages`,
      `Archived chats: ${archives}`,
      'Memory videos',
    ]
  }
  if (slot === 'premium' || slot === 'annual') {
    if (lang === 'el') {
      return [
        `Φωνητική ακρόαση: ${voice}/μήνα`,
        'Εξαγωγή εγγράφων & άλμπουμ',
        `Περισσότερο ιστορικό chat (~${chatCtx})`,
        slot === 'annual' ? 'Ετήσια τιμολόγηση — καλύτερη αξία' : 'Πλήρη Premium προνόμια',
      ]
    }
    if (lang === 'ro') {
      return [
        `Ascultare vocală: ${voice}/lună`,
        'Export documente & album',
        `Istoric chat mai profund (~${chatCtx})`,
        slot === 'annual' ? 'Facturare anuală — cea mai bună valoare' : 'Beneficii Premium complete',
      ]
    }
    return [
      `Voice listening: ${voice}/mo`,
      'Document & album export',
      `Deeper chat history (~${chatCtx})`,
      slot === 'annual' ? 'Annual billing — best value' : 'Full Premium benefits',
    ]
  }
  return []
}

function upgradeTip(slot: PlanSlot, nextLabel: string, lang: string): string {
  if (slot === 'trial') {
    if (lang === 'el') {
      return `Αναβάθμισε σε ${nextLabel} για φωνή, βίντεο αναμνήσεων και περισσότερο ιστορικό όταν τελειώσει η δοκιμή.`
    }
    if (lang === 'ro') {
      return `Fă upgrade la ${nextLabel} pentru voce, videouri cu amintiri și mai mult istoric când se termină proba.`
    }
    return `Upgrade to ${nextLabel} for voice, memory videos, and more history when your trial ends.`
  }
  if (slot === 'starter') {
    if (lang === 'el') {
      return `Το ${nextLabel} ξεκλειδώνει εξαγωγές, περισσότερη φωνή και βαθύτερο ιστορικό για την οικογένειά σου.`
    }
    if (lang === 'ro') {
      return `${nextLabel} deblochează exporturi, mai multă voce și istoric mai profund pentru familia ta.`
    }
    return `${nextLabel} unlocks exports, more voice, and deeper history for your family.`
  }
  if (slot === 'premium') {
    if (lang === 'el') {
      return `Με το Ετήσιο Premium κλειδώνεις την ίδια εμπειρία με καλύτερη τιμή τον χρόνο.`
    }
    if (lang === 'ro') {
      return `Cu Premium anual păstrezi aceeași experiență la un preț anual mai bun.`
    }
    return `Annual Premium locks in the same experience at a better yearly price.`
  }
  if (lang === 'el') {
    return 'Έχεις το ανώτερο πλάνο — μπορείς να διαχειριστείς τη συνδρομή ανά πάσα στιγμή.'
  }
  if (lang === 'ro') {
    return 'Ai planul maxim — poți gestiona abonamentul oricând.'
  }
  return 'You’re on the top plan — manage billing anytime.'
}

function renewalCopy(info: AccessExpiryInfo | null, lang: string, isTrial: boolean): string {
  if (!info) {
    if (lang === 'el') return 'Η περίοδος ανανέωσης εμφανίζεται όταν υπάρχει ημερομηνία λήξης.'
    if (lang === 'ro') return 'Perioada de reînnoire apare când există o dată de expirare.'
    return 'Renewal timing appears when an end date is set.'
  }
  if (info.endsToday) {
    if (lang === 'el') return `Λήγει σήμερα · ${info.endLabel}`
    if (lang === 'ro') return `Expiră azi · ${info.endLabel}`
    return `Ends today · ${info.endLabel}`
  }
  const unit =
    info.daysLeft === 1
      ? lang === 'el'
        ? 'ημέρα'
        : lang === 'ro'
          ? 'zi'
          : 'day'
      : lang === 'el'
        ? 'ημέρες'
        : lang === 'ro'
          ? 'zile'
          : 'days'
  if (isTrial || info.kind === 'trial' || info.kind === 'mixed') {
    if (lang === 'el') return `${info.daysLeft} ${unit} μέχρι τη λήξη της δοκιμής · ${info.endLabel}`
    if (lang === 'ro') return `${info.daysLeft} ${unit} până la finalul probei · ${info.endLabel}`
    return `${info.daysLeft} ${unit} until trial ends · ${info.endLabel}`
  }
  if (info.kind === 'grant') {
    if (lang === 'el') return `${info.daysLeft} ${unit} μέχρι να λήξει το δώρο · ${info.endLabel}`
    if (lang === 'ro') return `${info.daysLeft} ${unit} până expiră cadoul · ${info.endLabel}`
    return `${info.daysLeft} ${unit} until gift ends · ${info.endLabel}`
  }
  if (lang === 'el') return `${info.daysLeft} ${unit} μέχρι ανανέωση · ${info.endLabel}`
  if (lang === 'ro') return `${info.daysLeft} ${unit} până la reînnoire · ${info.endLabel}`
  return `${info.daysLeft} ${unit} until renewal · ${info.endLabel}`
}

export function ProfileActivePlanCard({
  lang,
  snapshot,
  entitlements,
  accessExpiry,
  onUpgrade,
  onManage,
}: Props) {
  const slot = displaySelectedPlanSlot(snapshot)
  const planName = activePlanNameForSlot(slot, [], lang)
  const nextSlot = nextUpgradePlanSlot(snapshot)
  const nextLabel = nextUpgradePlanLabel(snapshot, lang)
  const highlights = planHighlights(slot, lang, entitlements, snapshot)
  const tip = upgradeTip(slot, nextLabel, lang)
  const isTrial = slot === 'trial' || !!snapshot?.is_trial
  const renewal = renewalCopy(accessExpiry, lang, isTrial)
  const canUpgrade = nextSlot != null
  const status =
    snapshot?.cancel_status === 'pending' || snapshot?.cancel_status === 'approved'
      ? lang === 'el'
        ? 'Ακύρωση σε εξέλιξη'
        : lang === 'ro'
          ? 'Anulare în curs'
          : 'Cancellation in progress'
      : snapshot?.subscription_active
        ? lang === 'el'
          ? 'Ενεργό'
          : lang === 'ro'
            ? 'Activ'
            : 'Active'
        : lang === 'el'
          ? 'Περιορισμένη πρόσβαση'
          : lang === 'ro'
            ? 'Acces limitat'
            : 'Limited access'

  return (
    <section
      className="hm-plan-card"
      aria-label={lang === 'el' ? 'Το πλάνο σου' : lang === 'ro' ? 'Planul tău' : 'Your plan'}
    >
      <div className="hm-plan-card__head">
        <div>
          <div className="hm-plan-card__eyebrow">
            {lang === 'el' ? 'Το πλάνο σου' : lang === 'ro' ? 'Planul tău' : 'Your plan'}
          </div>
          <h3 className="hm-plan-card__title">{planName}</h3>
        </div>
        <span className={`hm-plan-card__badge${accessExpiry?.urgent ? ' is-urgent' : ''}`}>
          {status}
        </span>
      </div>

      <p className="hm-plan-card__renewal">{renewal}</p>

      <ul className="hm-plan-card__feats">
        {highlights.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>

      <div className="hm-plan-card__tip" role="note">
        <strong>
          {canUpgrade
            ? lang === 'el'
              ? 'Γιατί να αναβαθμίσεις;'
              : lang === 'ro'
                ? 'De ce să faci upgrade?'
                : 'Why upgrade?'
            : lang === 'el'
              ? 'Συμβουλή'
              : lang === 'ro'
                ? 'Sfat'
                : 'Tip'}
        </strong>
        <span>{tip}</span>
      </div>

      <div className="hm-plan-card__actions">
        {canUpgrade ? (
          <button type="button" className="hm-btn hm-btn--primary hm-btn--block" onClick={onUpgrade}>
            {lang === 'el'
              ? `Αναβάθμιση σε ${nextLabel}`
              : lang === 'ro'
                ? `Upgrade la ${nextLabel}`
                : `Upgrade to ${nextLabel}`}
          </button>
        ) : (
          <button type="button" className="hm-btn hm-btn--primary hm-btn--block" onClick={onManage || onUpgrade}>
            {lang === 'el'
              ? 'Διαχείριση συνδρομής'
              : lang === 'ro'
                ? 'Gestionează abonamentul'
                : 'Manage subscription'}
          </button>
        )}
        {canUpgrade && onManage ? (
          <button type="button" className="hm-btn hm-btn--ghost hm-btn--block" onClick={onManage}>
            {lang === 'el'
              ? 'Δες όλα τα πλάνα'
              : lang === 'ro'
                ? 'Vezi toate planurile'
                : 'See all plans'}
          </button>
        ) : null}
      </div>
    </section>
  )
}
