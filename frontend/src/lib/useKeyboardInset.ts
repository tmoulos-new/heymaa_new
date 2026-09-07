import { useEffect } from 'react'

/** Lift fixed bottom UI above the mobile software keyboard (iOS Safari / Android Chrome). */
export function useKeyboardInset(active: boolean) {
  useEffect(() => {
    if (!active) {
      document.documentElement.style.setProperty('--hm-keyboard-offset', '0px')
      return
    }
    const vv = window.visualViewport
    if (!vv) return

    const sync = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop)
      document.documentElement.style.setProperty('--hm-keyboard-offset', `${Math.round(inset)}px`)
    }

    sync()
    vv.addEventListener('resize', sync)
    vv.addEventListener('scroll', sync)
    return () => {
      vv.removeEventListener('resize', sync)
      vv.removeEventListener('scroll', sync)
      document.documentElement.style.setProperty('--hm-keyboard-offset', '0px')
    }
  }, [active])
}
