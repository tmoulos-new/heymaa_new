import { useEffect, useId, useRef, useState } from 'react'
import { AppSheet } from './AppSheet'
import { RewardCelebration } from './RewardCelebration'
import { displayUppercase } from '../lib/greekText'
import {
  claimGift,
  clearPendingGiftCode,
  previewGift,
  type GiftClaimResult,
  type GiftPreview,
} from '../lib/giftApi'

type Props = {
  open: boolean
  lang: string
  token: string
  code: string
  onClose: () => void
  onClaimed: (result: GiftClaimResult) => void
}

function describeGift(gift: GiftPreview | null, isEl: boolean) {
  if (!gift) return isEl ? 'Το δώρο σου από την HeyMaa' : 'Your HeyMaa gift'
  const parts: string[] = []
  if (gift.gift_type === 'free_plan_days' || gift.gift_type === 'combo') {
    const slot = String(gift.plan_slot || 'starter')
    const plan = slot.charAt(0).toUpperCase() + slot.slice(1)
    parts.push(
      isEl
        ? `${gift.days || 0} ημέρες ${plan}`
        : `${gift.days || 0} days of ${plan}`,
    )
  }
  if (gift.gift_type === 'bonus_points' || gift.gift_type === 'combo') {
    parts.push(isEl ? `+${gift.points || 0} πόντοι` : `+${gift.points || 0} points`)
  }
  return parts.join(isEl ? ' και ' : ' and ') || (gift.label || (isEl ? 'Δώρο' : 'Gift'))
}

export function GiftClaimSheet({ open, lang, token, code, onClose, onClaimed }: Props) {
  const isEl = lang === 'el'
  const titleId = useId()
  const busyRef = useRef(false)
  const closeTimerRef = useRef<number | null>(null)
  const [preview, setPreview] = useState<GiftPreview | null>(null)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [claiming, setClaiming] = useState(false)
  const [error, setError] = useState('')
  const [celebrate, setCelebrate] = useState(false)
  const [done, setDone] = useState(false)
  const [successLine, setSuccessLine] = useState('')

  useEffect(() => {
    if (!open || !code) return
    busyRef.current = false
    setClaiming(false)
    setError('')
    setCelebrate(false)
    setDone(false)
    setSuccessLine('')
    setLoadingPreview(true)
    void previewGift(code)
      .then((g) => {
        setPreview(g)
        if (g.claimable === false) setError(g.reason || (isEl ? 'Μη διαθέσιμο δώρο' : 'Gift unavailable'))
      })
      .catch((e: unknown) => {
        setPreview(null)
        setError(e instanceof Error ? e.message : isEl ? 'Το δώρο δεν βρέθηκε' : 'Gift not found')
      })
      .finally(() => setLoadingPreview(false))
  }, [open, code, isEl])

  useEffect(() => () => {
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
  }, [])

  if (!code) return null

  const locked = claiming || done
  const giftLine = describeGift(preview, isEl)

  const finishSuccess = (result: GiftClaimResult) => {
    clearPendingGiftCode()
    setDone(true)
    setCelebrate(true)
    setClaiming(false)
    const bits: string[] = []
    if (result.grant?.days) {
      const slot = String(result.grant.plan_slot || 'starter')
      const plan = slot.charAt(0).toUpperCase() + slot.slice(1)
      bits.push(isEl ? `${result.grant.days} ημέρες ${plan}` : `${result.grant.days} days of ${plan}`)
    }
    if (result.points) {
      bits.push(isEl ? `+${result.points} πόντοι` : `+${result.points} points`)
    }
    setSuccessLine(bits.join(isEl ? ' και ' : ' and ') || (isEl ? 'Το δώρο ενεργοποιήθηκε' : 'Gift activated'))
    onClaimed(result)
    if (closeTimerRef.current != null) window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null
      onClose()
    }, 1600) as unknown as number
  }

  const handleClaim = async () => {
    if (busyRef.current || done) return
    busyRef.current = true
    setClaiming(true)
    setError('')
    try {
      const result = await claimGift(token, code)
      finishSuccess(result)
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : isEl ? 'Αποτυχία διεκδίκησης' : 'Claim failed'
      if (/already claimed/i.test(message)) {
        clearPendingGiftCode()
        finishSuccess({ gift_type: preview?.gift_type, code })
        return
      }
      busyRef.current = false
      setClaiming(false)
      setError(message)
    }
  }

  const handleClose = () => {
    if (claiming && !done) return
    onClose()
  }

  return (
    <>
      <RewardCelebration active={celebrate} />
      <AppSheet
        open={open}
        onClose={handleClose}
        dialog
        closeOnBackdrop={!locked}
        preventClose={claiming && !done}
        titleId={titleId}
      >
        <div className="hm-reward-sheet">
          <div className="hm-reward-sheet__emoji" aria-hidden="true">
            🎁
          </div>
          <p className="hm-reward-sheet__kicker">
            {displayUppercase(
              done
                ? (isEl ? 'Το δώρο ενεργοποιήθηκε' : 'Gift activated')
                : (isEl ? 'Έχεις ένα δώρο' : 'You have a gift'),
              lang,
            )}
          </p>
          <h2 id={titleId} className="hm-reward-sheet__title">
            {done ? successLine : (preview?.label || (isEl ? 'Δώρο HeyMaa' : 'HeyMaa gift'))}
          </h2>
          {done || loadingPreview ? null : (
            <>
              <p className="hm-reward-sheet__level">{giftLine}</p>
              <p className="hm-reward-sheet__body">
                {isEl
                  ? 'Πάτα για να το ενεργοποιήσεις στον λογαριασμό σου.'
                  : 'Tap to activate this on your account.'}
              </p>
            </>
          )}
          {loadingPreview ? (
            <p className="hm-reward-sheet__body">{isEl ? 'Φόρτωση…' : 'Loading…'}</p>
          ) : null}
          {error ? <p className="hm-reward-sheet__error">{error}</p> : null}
          <div className="hm-reward-sheet__actions">
            <button
              type="button"
              className={`hm-reward-sheet__claim${done ? ' hm-reward-sheet__claim--done' : ''}`}
              disabled={(claiming && !done) || loadingPreview || (!!error && !done && preview?.claimable === false)}
              aria-busy={claiming && !done}
              onClick={() => {
                if (done) handleClose()
                else void handleClaim()
              }}
            >
              {claiming && !done
                ? isEl
                  ? 'Ενεργοποίηση…'
                  : 'Activating…'
                : done
                  ? isEl
                    ? 'Τέλεια!'
                    : 'Done!'
                  : isEl
                    ? 'Πάρε το δώρο σου! 🎁'
                    : 'Claim your gift! 🎁'}
            </button>
            {done ? null : (
              <button type="button" className="hm-reward-sheet__later" onClick={handleClose} disabled={claiming}>
                {isEl ? 'Αργότερα' : 'Later'}
              </button>
            )}
          </div>
        </div>
      </AppSheet>
    </>
  )
}
