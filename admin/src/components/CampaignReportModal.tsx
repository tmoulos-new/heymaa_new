import { useEffect, useState } from 'react'
import { BarChart3, X } from 'lucide-react'
import { useAdmin } from '../context/AdminContext'

type ReportKpis = {
  recipients?: number
  delivered?: number
  unique_opens?: number
  total_opens?: number
  open_rate?: number
  unique_clicks?: number
  total_clicks?: number
  click_rate?: number
  bounced?: number
  bounce_rate?: number
  unsubscribes?: number
  unsubscribe_rate?: number
  push_attempted?: number
  push_delivered?: number
  push_failed?: number
  push_delivery_rate?: number
  campaigns?: number
}

type ReportPayload = {
  title?: string
  meta?: Record<string, unknown>
  kpis?: ReportKpis
  status_mix?: { opened?: number; not_opened?: number; bounced?: number; push_failed?: number }
  top_recipients?: Array<{ email?: string; name?: string; total_opens?: number; read_at?: string }>
  top_links?: Array<{ url?: string; clicks?: number }>
  clients?: Array<{ name?: string; count?: number }>
  devices?: { desktop?: number; mobile?: number; unknown?: number }
  timeline?: Array<{ day?: string; unique_opens?: number; unique_clicks?: number; reads?: number }>
  by_kind?: Array<{ kind?: string; sent?: number; opened?: number; clicked?: number; open_rate?: number }>
  campaigns?: Array<{
    id?: string
    title?: string
    recipients?: number
    reads?: number
    open_rate?: number
    push_delivered?: number
    push_attempted?: number
    created_at?: string
  }>
  tracking_note?: string | null
}

type Props = {
  open: boolean
  onClose: () => void
  path: string | null
  heading?: string
}

function pct(n?: number) {
  if (n == null || Number.isNaN(n)) return '0%'
  return `${Number(n).toFixed(2)}%`
}

function Stat({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="report-stat">
      <div className="report-stat__value">{value}</div>
      <div className="report-stat__label">{label}</div>
      {sub ? <div className="report-stat__sub">{sub}</div> : null}
    </div>
  )
}

export function CampaignReportModal({ open, onClose, path, heading }: Props) {
  const { adminFetch } = useAdmin()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [report, setReport] = useState<ReportPayload | null>(null)

  useEffect(() => {
    if (!open || !path) {
      setReport(null)
      setError('')
      return
    }
    let cancelled = false
    setLoading(true)
    setError('')
    void adminFetch(path)
      .then((d) => {
        if (cancelled) return
        setReport((d.report as ReportPayload) || null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : 'Could not load report')
        setReport(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [open, path, adminFetch])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const k = report?.kpis || {}
  const mix = report?.status_mix || {}
  const kind = String(report?.meta?.kind || '')
  const isNotification = kind === 'notification' || kind === 'notifications_period'
  const showClicks = k.click_rate != null || k.unique_clicks != null
  const showPush = isNotification || k.push_attempted != null || k.push_delivered != null
  const showDevices =
    !!report?.devices &&
    ((report.devices.desktop || 0) + (report.devices.mobile || 0) + (report.devices.unknown || 0) > 0)
  const opened = Number(mix.opened || 0)
  const notOpened = Number(mix.not_opened || 0)
  const bounced = Number(mix.bounced || mix.push_failed || 0)
  const mixTotal = Math.max(1, opened + notOpened + bounced)
  const openLabel = isNotification ? 'Reads' : 'Opens'

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal report-modal"
        role="dialog"
        aria-modal="true"
        aria-label={heading || 'Campaign report'}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-head">
          <div className="report-modal__titles">
            <h2>
              <BarChart3 size={18} />
              {heading || 'Campaign report'}
            </h2>
            <p className="muted">
              {report?.title || (loading ? 'Loading…' : '—')}
            </p>
          </div>
          <button type="button" className="ghost sm" onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body report-modal__body">
          {error ? <div className="msg err">{error}</div> : null}
          {report?.tracking_note ? <p className="report-modal__note">{report.tracking_note}</p> : null}

          {loading && !report ? <p className="muted" style={{ margin: 0 }}>Loading report…</p> : null}

          {report ? (
            <>
              <div className="report-kpi-grid">
                <Stat
                  label="Recipients"
                  value={k.recipients ?? 0}
                  sub={
                    k.campaigns != null
                      ? `${k.campaigns} campaigns`
                      : k.delivered != null
                        ? `Delivered ${k.delivered}`
                        : undefined
                  }
                />
                <Stat
                  label={openLabel}
                  value={pct(k.open_rate)}
                  sub={`${k.unique_opens ?? 0} unique · ${k.total_opens ?? 0} total`}
                />
                {showClicks ? (
                  <Stat
                    label="Clicks"
                    value={pct(k.click_rate)}
                    sub={`${k.unique_clicks ?? 0} unique · ${k.total_clicks ?? 0} total`}
                  />
                ) : null}
                {showPush ? (
                  <Stat
                    label="Push delivered"
                    value={`${k.push_delivered ?? 0}/${k.push_attempted ?? 0}`}
                    sub={
                      k.push_delivery_rate != null
                        ? `${pct(k.push_delivery_rate)} delivery`
                        : k.push_failed
                          ? `${k.push_failed} failed`
                          : undefined
                    }
                  />
                ) : null}
                {!showClicks && !showPush ? (
                  <Stat label="Bounced" value={k.bounced ?? 0} sub={k.bounce_rate != null ? pct(k.bounce_rate) : undefined} />
                ) : null}
              </div>

              <div className={`report-panels${showDevices ? '' : ' report-panels--one'}`}>
                <section className="report-panel">
                  <h3>Status</h3>
                  <ul className="report-panel__list">
                    <li>
                      <span>{openLabel}</span>
                      <strong>
                        {opened} ({((opened / mixTotal) * 100).toFixed(1)}%)
                      </strong>
                    </li>
                    <li>
                      <span>{isNotification ? 'Unread' : `Not ${openLabel.toLowerCase()}`}</span>
                      <strong>
                        {notOpened} ({((notOpened / mixTotal) * 100).toFixed(1)}%)
                      </strong>
                    </li>
                    <li>
                      <span>{isNotification ? 'Push failed' : 'Bounced / failed'}</span>
                      <strong>
                        {bounced} ({((bounced / mixTotal) * 100).toFixed(1)}%)
                      </strong>
                    </li>
                  </ul>
                </section>
                {showDevices ? (
                  <section className="report-panel">
                    <h3>Desktop / Mobile</h3>
                    <ul className="report-panel__list">
                      <li>
                        <span>Desktop</span>
                        <strong>{report.devices?.desktop ?? 0}</strong>
                      </li>
                      <li>
                        <span>Mobile</span>
                        <strong>{report.devices?.mobile ?? 0}</strong>
                      </li>
                      <li>
                        <span>Unknown</span>
                        <strong>{report.devices?.unknown ?? 0}</strong>
                      </li>
                    </ul>
                  </section>
                ) : null}
              </div>

              {report.by_kind && report.by_kind.length > 0 ? (
                <section className="report-panel">
                  <h3>By email type</h3>
                  <div className="report-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Kind</th>
                          <th>Sent</th>
                          <th>Opened</th>
                          <th>Clicked</th>
                          <th>Open rate</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.by_kind.map((row) => (
                          <tr key={row.kind}>
                            <td>{row.kind}</td>
                            <td>{row.sent ?? 0}</td>
                            <td>{row.opened ?? 0}</td>
                            <td>{row.clicked ?? 0}</td>
                            <td>{pct(row.open_rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {report.campaigns && report.campaigns.length > 0 ? (
                <section className="report-panel">
                  <h3>Campaigns in period</h3>
                  <div className="report-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Title</th>
                          <th>Recipients</th>
                          <th>Reads</th>
                          <th>Read rate</th>
                          <th>Push</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.campaigns.map((row) => (
                          <tr key={row.id || row.title}>
                            <td>{row.title || '—'}</td>
                            <td>{row.recipients ?? 0}</td>
                            <td>{row.reads ?? 0}</td>
                            <td>{pct(row.open_rate)}</td>
                            <td>
                              {row.push_delivered ?? 0}/{row.push_attempted ?? 0}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <div className="report-panels">
                <section className="report-panel">
                  <h3>Top recipients</h3>
                  {(report.top_recipients || []).length === 0 ? (
                    <p className="muted" style={{ margin: 0 }}>
                      No {openLabel.toLowerCase()} yet.
                    </p>
                  ) : (
                    <div className="report-table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Email</th>
                            <th>Name</th>
                            <th>{openLabel}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(report.top_recipients || []).map((row) => (
                            <tr key={`${row.email}-${row.read_at || row.total_opens}`}>
                              <td>{row.email || '—'}</td>
                              <td>{row.name || '—'}</td>
                              <td>{row.total_opens ?? (row.read_at ? 1 : 0)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>

                {report.top_links || (report.clients && report.clients.length > 0) ? (
                  <section className="report-panel">
                    <h3>{report.top_links ? 'Top links' : 'Mostly viewed on'}</h3>
                    {report.top_links ? (
                      (report.top_links || []).length === 0 ? (
                        <p className="muted" style={{ margin: 0 }}>No clicks yet.</p>
                      ) : (
                        <div className="report-table-wrap">
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>URL</th>
                                <th>Clicks</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(report.top_links || []).map((row) => (
                                <tr key={row.url}>
                                  <td style={{ wordBreak: 'break-all' }}>{row.url}</td>
                                  <td>{row.clicks ?? 0}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    ) : (
                      <div className="report-table-wrap">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Client</th>
                              <th>Events</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(report.clients || []).map((row) => (
                              <tr key={row.name}>
                                <td>{row.name}</td>
                                <td>{row.count ?? 0}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </section>
                ) : null}
              </div>

              {(report.timeline || []).length > 0 ? (
                <section className="report-panel">
                  <h3>Activity by day</h3>
                  <div className="report-table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Day</th>
                          <th>{openLabel}</th>
                          <th>Clicks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(report.timeline || []).map((row) => (
                          <tr key={row.day}>
                            <td>{row.day}</td>
                            <td>{row.unique_opens ?? row.reads ?? 0}</td>
                            <td>{row.unique_clicks ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}
