import { useEffect, useState } from 'react'

/** Local calendar YYYY-MM-DD (avoids UTC midnight shifting the birthday). */
export function calendarDayKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function parseLocalIsoDate(value?: string | null): Date | null {
  if (!value) return null
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim())
  if (match) {
    const y = Number(match[1])
    const m = Number(match[2])
    const d = Number(match[3])
    const dt = new Date(y, m - 1, d)
    if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) return null
    return dt
  }
  const fallback = new Date(value)
  return Number.isNaN(fallback.getTime()) ? null : fallback
}

/** Completed calendar months since birth, as of `now` (local date). */
export function ageMonthsFromBirthDate(
  birthDateStr?: string | null,
  now: Date = new Date(),
): number | null {
  const birth = parseLocalIsoDate(birthDateStr)
  if (!birth) return null
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
  if (now.getDate() < birth.getDate()) months -= 1
  return Math.max(0, months)
}

/** Recomputes when the local calendar day changes (midnight, focus, tab visible). */
export function useCalendarDay(): string {
  const [day, setDay] = useState(calendarDayKey)

  useEffect(() => {
    const sync = () => {
      const next = calendarDayKey()
      setDay((prev) => (prev === next ? prev : next))
    }
    const msUntilTomorrow = () => {
      const now = new Date()
      return Math.max(
        250,
        new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 2).getTime() - now.getTime(),
      )
    }
    let timer = window.setTimeout(sync, msUntilTomorrow())
    const onWake = () => {
      sync()
      window.clearTimeout(timer)
      timer = window.setTimeout(sync, msUntilTomorrow())
    }
    window.addEventListener('focus', onWake)
    document.addEventListener('visibilitychange', onWake)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('focus', onWake)
      document.removeEventListener('visibilitychange', onWake)
    }
  }, [day])

  return day
}
