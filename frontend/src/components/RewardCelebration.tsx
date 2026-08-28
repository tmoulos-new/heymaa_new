import { useEffect, useState } from 'react'

type Props = {
  active: boolean
  onDone?: () => void
}

const COLORS = ['#E07B54', '#4ABEAA', '#2B3A67', '#BEB4CD', '#F5D0C8']

/** Lightweight CSS confetti burst — no extra dependencies. */
export function RewardCelebration({ active, onDone }: Props) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (!active) return
    setShow(true)
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate([40, 30, 60])
      }
    } catch {
      /* ignore */
    }
    const t = window.setTimeout(() => {
      setShow(false)
      onDone?.()
    }, 2200)
    return () => window.clearTimeout(t)
  }, [active, onDone])

  if (!show) return null

  const pieces = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    left: `${8 + ((i * 17) % 84)}%`,
    delay: `${(i % 7) * 0.04}s`,
    color: COLORS[i % COLORS.length],
    rotate: `${(i * 37) % 360}deg`,
    size: 6 + (i % 4) * 2,
  }))

  return (
    <div className="hm-reward-celebration" aria-hidden="true">
      {pieces.map((p) => (
        <span
          key={p.id}
          className="hm-reward-celebration__piece"
          style={{
            left: p.left,
            animationDelay: p.delay,
            background: p.color,
            width: p.size,
            height: p.size * 1.4,
            transform: `rotate(${p.rotate})`,
          }}
        />
      ))}
    </div>
  )
}
