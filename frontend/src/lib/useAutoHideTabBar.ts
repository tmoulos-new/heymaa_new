import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const TOP_SHOW_PX = 24
const HIDE_AFTER_DOWN_PX = 56
const SHOW_AFTER_UP_PX = 2
const MIN_REMAINING_SCROLL_PX = 80
const TOUCH_REVEAL_PX = 10
const IDLE_REVEAL_MS = 1600

function remainingScroll(el: HTMLElement) {
  return el.scrollHeight - el.clientHeight - el.scrollTop
}

function tabBarInsetPx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--hm-tabbar-inset')
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : 96
}

/**
 * Hide bottom tab bar while scrolling down; reveal on scroll up, near top,
 * or when the page can no longer scroll (common on Memories with a short feed).
 */
export function useAutoHideTabBar(scrollRef: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(true)
  const lastScrollTop = useRef(0)
  const downAccum = useRef(0)
  const upAccum = useRef(0)
  const visibleRef = useRef(true)
  const lastTouchY = useRef<number | null>(null)
  const idleTimer = useRef<number | null>(null)

  const clearIdle = useCallback(() => {
    if (idleTimer.current != null) {
      window.clearTimeout(idleTimer.current)
      idleTimer.current = null
    }
  }, [])

  const showTabBar = useCallback(() => {
    downAccum.current = 0
    upAccum.current = 0
    clearIdle()
    if (!visibleRef.current) {
      visibleRef.current = true
      setVisible(true)
    }
  }, [clearIdle])

  const hideTabBar = useCallback((el: HTMLElement) => {
    if (!visibleRef.current) return
    if (el.scrollTop <= TOP_SHOW_PX) return
    // Padding collapses when the bar hides; keep enough leftover scroll to reverse.
    if (remainingScroll(el) < MIN_REMAINING_SCROLL_PX + tabBarInsetPx()) return
    visibleRef.current = false
    setVisible(false)
    window.requestAnimationFrame(() => {
      lastScrollTop.current = el.scrollTop
      if (remainingScroll(el) < 8 || el.scrollTop <= TOP_SHOW_PX) {
        showTabBar()
      }
    })
  }, [showTabBar])

  const bumpIdleReveal = useCallback(() => {
    clearIdle()
    if (visibleRef.current) return
    idleTimer.current = window.setTimeout(() => {
      idleTimer.current = null
      showTabBar()
    }, IDLE_REVEAL_MS)
  }, [clearIdle, showTabBar])

  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    lastScrollTop.current = el.scrollTop
    downAccum.current = 0
    upAccum.current = 0

    let ticking = false

    const applyScroll = () => {
      ticking = false
      const st = el.scrollTop
      const delta = st - lastScrollTop.current
      lastScrollTop.current = st

      if (st <= TOP_SHOW_PX) {
        showTabBar()
        return
      }

      if (delta > 0) {
        upAccum.current = 0
        downAccum.current += delta
        if (downAccum.current >= HIDE_AFTER_DOWN_PX) hideTabBar(el)
      } else if (delta < 0) {
        downAccum.current = 0
        upAccum.current += -delta
        if (upAccum.current >= SHOW_AFTER_UP_PX) showTabBar()
      }

      if (!visibleRef.current) bumpIdleReveal()
    }

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(applyScroll)
    }

    const onTouchStart = (e: TouchEvent) => {
      lastTouchY.current = e.touches[0]?.clientY ?? null
    }

    const onTouchMove = (e: TouchEvent) => {
      const y = e.touches[0]?.clientY
      if (y == null || lastTouchY.current == null) return
      const dy = y - lastTouchY.current
      lastTouchY.current = y
      if (!visibleRef.current && dy > TOUCH_REVEAL_PX) {
        showTabBar()
      }
    }

    const onTouchEnd = () => {
      lastTouchY.current = null
      if (!visibleRef.current) bumpIdleReveal()
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: true })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchEnd, { passive: true })
    return () => {
      clearIdle()
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchEnd)
    }
  }, [scrollRef, showTabBar, hideTabBar, bumpIdleReveal, clearIdle])

  return { tabBarVisible: visible, showTabBar }
}
