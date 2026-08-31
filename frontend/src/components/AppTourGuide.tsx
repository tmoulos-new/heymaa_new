import type { CSSProperties } from 'react'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { AppModalPortal } from './AppModalPortal'
import { useBodyScrollLock } from '../lib/useBodyScrollLock'
import {
  APP_TOUR_STEPS,
  tourText,
  type AppTourStep,
} from '../lib/appTour'

type Rect = { top: number; left: number; width: number; height: number }

type Props = {
  open: boolean
  stepIndex: number
  lang: string
  userName?: string
  onNext: () => void
  onBack: () => void
  onSkip: () => void
}

function padRect(rect: DOMRect, padding: number): Rect {
  return {
    top: Math.max(0, rect.top - padding),
    left: Math.max(0, rect.left - padding),
    width: rect.width + padding * 2,
    height: rect.height + padding * 2,
  }
}

function measureTarget(selector: string): Rect | null {
  const el = document.querySelector(`[data-tour="${selector}"]`)
  if (!el) return null
  return padRect(el.getBoundingClientRect(), 8)
}

export function AppTourGuide({
  open,
  stepIndex,
  lang,
  userName,
  onNext,
  onBack,
  onSkip,
}: Props) {
  const step: AppTourStep | undefined = APP_TOUR_STEPS[stepIndex]
  const isCenter = !step?.target || step.placement === 'center'
  const isEl = lang === 'el'
  const isLast = stepIndex >= APP_TOUR_STEPS.length - 1
  const isFirst = stepIndex === 0

  const [spot, setSpot] = useState<Rect | null>(null)
  const [tooltipStyle, setTooltipStyle] = useState<CSSProperties>({})

  useBodyScrollLock(open && isCenter)

  const remeasure = useCallback(() => {
    if (!open || !step?.target) {
      setSpot(null)
      return
    }
    const el = document.querySelector(`[data-tour="${step.target}"]`)
    if (el) {
      el.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
    }
    window.requestAnimationFrame(() => {
      const next = measureTarget(step.target!)
      setSpot(next)
    })
  }, [open, step?.target])

  useLayoutEffect(() => {
    remeasure()
  }, [remeasure, stepIndex])

  useEffect(() => {
    if (!open || isCenter) return
    const onResize = () => remeasure()
    window.addEventListener('resize', onResize)
    window.addEventListener('scroll', onResize, true)
    const timers = [80, 160, 280, 420, 640].map((ms) => window.setTimeout(remeasure, ms))
    return () => {
      timers.forEach((t) => window.clearTimeout(t))
      window.removeEventListener('resize', onResize)
      window.removeEventListener('scroll', onResize, true)
    }
  }, [open, isCenter, remeasure])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onSkip()
      if (e.key === 'ArrowRight' || e.key === 'Enter') onNext()
      if (e.key === 'ArrowLeft' && !isFirst) onBack()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, isFirst, onBack, onNext, onSkip])

  useLayoutEffect(() => {
    if (!open || isCenter || !spot) {
      setTooltipStyle({})
      return
    }
    const margin = 14
    const cardW = Math.min(340, window.innerWidth - 32)
    const placement = step?.placement || 'bottom'
    let top = spot.top + spot.height + margin
    let left = spot.left + spot.width / 2 - cardW / 2

    if (placement === 'top') {
      top = spot.top - margin - 180
    }
    if (placement === 'bottom' && step?.target?.startsWith('header-')) {
      top = spot.top + spot.height + margin
    }

    left = Math.max(16, Math.min(left, window.innerWidth - cardW - 16))
    top = Math.max(16, Math.min(top, window.innerHeight - 200))

    setTooltipStyle({
      position: 'fixed',
      top,
      left,
      width: cardW,
      zIndex: 10002,
    })
  }, [open, isCenter, spot, step?.placement, step?.target])

  if (!open || !step) return null

  const useCenter = isCenter || (!!step.target && !spot)

  const title = tourText(step.title, lang)
  const bodyRaw = tourText(step.body, lang)
  const body = bodyRaw

  const welcomeTitle =
    step.id === 'welcome' && userName
      ? isEl
        ? `Καλώς ήρθες, ${userName}!`
        : `Welcome, ${userName}!`
      : title

  return (
    <AppModalPortal>
      <div
        className="hm-tour-root"
        role="dialog"
        aria-modal="true"
        aria-labelledby="hm-tour-title"
        aria-describedby="hm-tour-body"
      >
        {!useCenter && spot ? (
          <>
            <button
              type="button"
              className="hm-tour-backdrop hm-tour-backdrop--dim"
              aria-label={isEl ? 'Παράλειψη ξενάγησης' : 'Skip tour'}
              onClick={onSkip}
            />
            <div
              className="hm-tour-spotlight"
              style={{
                top: spot.top,
                left: spot.left,
                width: spot.width,
                height: spot.height,
              }}
              aria-hidden="true"
            />
          </>
        ) : (
          <button
            type="button"
            className="hm-tour-backdrop hm-tour-backdrop--solid"
            aria-label={isEl ? 'Παράλειψη ξενάγησης' : 'Skip tour'}
            onClick={onSkip}
          />
        )}

        <div
          className={`hm-tour-card${useCenter ? ' hm-tour-card--center' : ''}`}
          style={useCenter ? undefined : tooltipStyle}
        >
          <div className="hm-tour-progress" aria-hidden="true">
            {APP_TOUR_STEPS.map((s, i) => (
              <span
                key={s.id}
                className={`hm-tour-dot${i === stepIndex ? ' hm-tour-dot--active' : i < stepIndex ? ' hm-tour-dot--done' : ''}`}
              />
            ))}
          </div>

          <h2 id="hm-tour-title" className="hm-tour-title">
            {welcomeTitle}
          </h2>
          <p id="hm-tour-body" className="hm-tour-body">
            {body}
          </p>

          <div className="hm-tour-actions">
            {!isFirst ? (
              <button type="button" className="hm-btn hm-btn--ghost hm-btn--sm" onClick={onBack}>
                {isEl ? 'Πίσω' : 'Back'}
              </button>
            ) : (
              <button type="button" className="hm-btn hm-btn--ghost hm-btn--sm" onClick={onSkip}>
                {isEl ? 'Παράλειψη' : 'Skip'}
              </button>
            )}
            <button
              type="button"
              className="hm-btn hm-btn--primary hm-btn--sm hm-tour-next"
              onClick={onNext}
            >
              {isLast
                ? isEl
                  ? 'Ξεκίνα →'
                  : 'Get started →'
                : isFirst
                  ? isEl
                    ? 'Ξενάγηση →'
                    : 'Show me →'
                  : isEl
                    ? 'Επόμενο →'
                    : 'Next →'}
            </button>
          </div>

          {!isFirst && !isLast ? (
            <button type="button" className="hm-tour-skip-link" onClick={onSkip}>
              {isEl ? 'Παράλειψη ξενάγησης' : 'Skip tour'}
            </button>
          ) : null}
        </div>
      </div>
    </AppModalPortal>
  )
}
