export function userInitials(name?: string | null, email?: string | null): string {
  const n = (name || '').trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return n.slice(0, 2).toUpperCase()
  }
  const e = (email || '').trim()
  if (e) return e.slice(0, 2).toUpperCase()
  return '?'
}

export function avatarBackground(id: string): string {
  let hue = 0
  for (let i = 0; i < id.length; i += 1) {
    hue = (hue + id.charCodeAt(i) * 37) % 360
  }
  return `hsl(${hue} 45% 42%)`
}

export function userDisplayName(name?: string | null, email?: string | null): string {
  const n = (name || '').trim()
  if (n) return n
  const e = (email || '').trim()
  if (e) return e.split('@')[0] || e
  return 'Admin'
}
