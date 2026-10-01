/** Build a simple CSV from an email/notification campaign report payload. */
export function reportToCsv(report: {
  title?: string
  kpis?: Record<string, unknown>
  status_mix?: Record<string, unknown>
  top_recipients?: Array<{ email?: string; name?: string; total_opens?: number; read_at?: string }>
  top_links?: Array<{ url?: string; clicks?: number }>
  timeline?: Array<{ day?: string; unique_opens?: number; unique_clicks?: number; reads?: number }>
}): string {
  const lines: string[] = []
  const esc = (v: unknown) => {
    const s = String(v ?? '')
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }

  lines.push('section,metric,value')
  lines.push(`meta,title,${esc(report.title || '')}`)
  const k = report.kpis || {}
  for (const [key, val] of Object.entries(k)) {
    lines.push(`kpi,${esc(key)},${esc(val)}`)
  }
  const mix = report.status_mix || {}
  for (const [key, val] of Object.entries(mix)) {
    lines.push(`status_mix,${esc(key)},${esc(val)}`)
  }

  if ((report.top_recipients || []).length) {
    lines.push('')
    lines.push('recipient_email,recipient_name,opens,read_at')
    for (const row of report.top_recipients || []) {
      lines.push(
        [esc(row.email), esc(row.name), esc(row.total_opens ?? 0), esc(row.read_at || '')].join(','),
      )
    }
  }

  if ((report.top_links || []).length) {
    lines.push('')
    lines.push('link_url,clicks')
    for (const row of report.top_links || []) {
      lines.push([esc(row.url), esc(row.clicks ?? 0)].join(','))
    }
  }

  if ((report.timeline || []).length) {
    lines.push('')
    lines.push('day,unique_opens,unique_clicks,reads')
    for (const row of report.timeline || []) {
      lines.push(
        [
          esc(row.day),
          esc(row.unique_opens ?? 0),
          esc(row.unique_clicks ?? 0),
          esc(row.reads ?? 0),
        ].join(','),
      )
    }
  }

  return lines.join('\n')
}

export function downloadTextFile(filename: string, content: string, mime = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
