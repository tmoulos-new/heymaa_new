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
  const el = lang === 'el'
  const voice = voiceListenQuotaForSnapshot(snap)
  const chatCtx = chatContextDepth(ents, snap)
  const archives = archivedThreadsLimit(ents, snap)
  if (slot === 'trial') {
    return el
      ? ['Δωρεάν δοκιμή HeyMaa', 'Βασικό chat με τη Maa', 'Οικογένεια & ορόσημα']
      : ['Free HeyMaa trial', 'Core chat with Maa', 'Family & milestones']
  }
  if (slot === 'starter') {
    return el
      ? [
          `Φωνητική ακρόαση: ${voice}/μήνα`,
          `Ιστορικό chat: ~${chatCtx} μηνύματα`,
          `Αρχειοθετημένες συνομιλίες: ${archives}`,
          'Βίντεο αναμνήσεων',
        ]
      : [
          `Voice listening: ${voice}/mo`,
          `Chat history: ~${chatCtx} messages`,
          `Archived chats: ${archives}`,
          'Memory videos',
        ]
  }
  if (slot === 'premium' || slot === 'annual') {
    return el
      ? [
          `Φωνητική ακρόαση: ${voice}/μήνα`,
          'Εξαγωγή εγγράφων & άλμπουμ',
          `Περισσότερο ιστορικό chat (~${chatCtx})`,
          slot === 'annual' ? 'Ετήσια τιμολόγηση — καλύτερη αξία' : 'Πλήρη Premium προνόμια',
        ]
      : [
          `Voice listening: ${voice}/mo`,
          'Document & album export',
          `Deeper chat history (~${chatCtx})`,
          slot === 'annual' ? 'Annual billing — best value' : 'Full Premium benefits',
        ]
  }
  return []
}

function upgradeTip(slot: PlanSlot, nextLabel: string, lang: string): string {
  const el = lang === 'el'
  if (slot === 'trial') {
    return el
      ? `Αναβάθμισε σε ${nextLabel} για φωνή, βίντεο αναμνήσεων και περισσότερο ιστορικό όταν τελειώσει η δοκιμή.`
      : `Upgrade to ${nextLabel} for voice, memory videos, and more history when your trial ends.`
  }
  if (slot === 'starter') {
    return el
      ? `Το ${nextLabel} ξεκλειδώνει εξαγωγές, περισσότερη φωνή και βαθύτερο ιστορικό για την οικογένειά σου.`
      : `${nextLabel} unlocks exports, more voice, and deeper history for your family.`
  }
  if (slot === 'premium') {
    return el
      ? `Με το Ετήσιο Premium κλειδώνεις την ίδια εμπειρία με καλύτερη τιμή τον χρόνο.`
      : `Annual Premium locks in the same experience at a better yearly price.`
  }
  return el
    ? 'Έχεις το ανώτερο πλάνο — μπορείς να διαχειριστείς τη συνδρομή ανά πάσα στιγμή.'
    : 'You’re on the top plan — manage billing anytime.'
}

function renewalCopy(info: AccessExpiryInfo | null, lang: string, isTrial: boolean): string {
  const el = lang === 'el'
  if (!info) {
    return el
      ? 'Η περίοδος ανανέωσης εμφανίζεται όταν υπάρχει ημερομηνία λήξης.'
      : 'Renewal timing appears when an end date is set.'
  }
  if (info.endsToday) {
    return el ? `Λήγει σήμερα · ${info.endLabel}` : `Ends today · ${info.endLabel}`
  }
  const unit = info.daysLeft === 1 ? (el ? 'ημέρα' : 'day') : el ? 'ημέρες' : 'days'
  if (isTrial || info.kind === 'trial' || info.kind === 'mixed') {
    return el
      ? `${info.daysLeft} ${unit} μέχρι τη λήξη της δοκιμής · ${info.endLabel}`
      : `${info.daysLeft} ${unit} until trial ends · ${info.endLabel}`
  }
  if (info.kind === 'grant') {
    return el
      ? `${info.daysLeft} ${unit} μέχρι να λήξει το δώρο · ${info.endLabel}`
      : `${info.daysLeft} ${unit} until gift ends · ${info.endLabel}`
  }
  return el
    ? `${info.daysLeft} ${unit} μέχρι ανανέωση · ${info.endLabel}`
    : `${info.daysLeft} ${unit} until renewal · ${info.endLabel}`
}

export function ProfileActivePlanCard({
  lang,
  snapshot,
  entitlements,
  accessExpiry,
  onUpgrade,
  onManage,
}: Props) {
  const el = lang === 'el'
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
      ? el
        ? 'Ακύρωση σε εξέλιξη'
        : 'Cancellation in progress'
      : snapshot?.subscription_active
        ? el
          ? 'Ενεργό'
          : 'Active'
        : el
          ? 'Περιορισμένη πρόσβαση'
          : 'Limited access'

  return (
    <section className="hm-plan-card" aria-label={el ? 'Το πλάνο σου' : 'Your plan'}>
      <div className="hm-plan-card__head">
        <div>
          <div className="hm-plan-card__eyebrow">{el ? 'Το πλάνο σου' : 'Your plan'}</div>
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
            ? el
              ? 'Γιατί να αναβαθμίσεις;'
              : 'Why upgrade?'
            : el
              ? 'Συμβουλή'
              : 'Tip'}
        </strong>
        <span>{tip}</span>
      </div>

      <div className="hm-plan-card__actions">
        {canUpgrade ? (
          <button type="button" className="hm-btn hm-btn--primary hm-btn--block" onClick={onUpgrade}>
            {el ? `Αναβάθμιση σε ${nextLabel}` : `Upgrade to ${nextLabel}`}
          </button>
        ) : (
          <button type="button" className="hm-btn hm-btn--primary hm-btn--block" onClick={onManage || onUpgrade}>
            {el ? 'Διαχείριση συνδρομής' : 'Manage subscription'}
          </button>
        )}
        {canUpgrade && onManage ? (
          <button type="button" className="hm-btn hm-btn--ghost hm-btn--block" onClick={onManage}>
            {el ? 'Δες όλα τα πλάνα' : 'See all plans'}
          </button>
        ) : null}
      </div>
    </section>
  )
}
