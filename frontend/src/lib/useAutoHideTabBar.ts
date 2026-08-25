import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

const TOP_SHOW_PX = 20
const MIN_DELTA_PX = 6
const HIDE_AFTER_DOWN_PX = 56

/**
 * Hide bottom tab bar while scrolling down; reveal on scroll up or near top.
 * Uses rAF + passive listener for smooth mobile scrolling.
 */
export function useAutoHideTabBar(scrollRef: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(true)
  const lastScrollTop = useRef(0)
  const downAccum = useRef(0)
  const visibleRef = useRef(true)

  const showTabBar = useCallback(() => {
    downAccum.current = 0
    if (!visibleRef.current) {
      visibleRef.current = true
      setVisible(true)
    }
  }, [])

  useEffect(() => {
    visibleRef.current = visible
  }, [visible])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    lastScrollTop.current = el.scrollTop
    downAccum.current = 0

    let ticking = false

    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        ticking = false
        const st = el.scrollTop
        const delta = st - lastScrollTop.current

        if (st <= TOP_SHOW_PX) {
          showTabBar()
        } else if (delta > MIN_DELTA_PX) {
          downAccum.current += delta
          if (downAccum.current >= HIDE_AFTER_DOWN_PX && visibleRef.current) {
            visibleRef.current = false
            setVisible(false)
          }
        } else if (delta < -MIN_DELTA_PX) {
          showTabBar()
        }

        lastScrollTop.current = st
      })
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [scrollRef, showTabBar])

  return { tabBarVisible: visible, showTabBar }
}
