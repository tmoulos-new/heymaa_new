import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SubscriptionSnapshot } from '../lib/authApi'
import {
  buildAppNotifications,
  markNotificationsRead,
  readNotificationIds,
  type AppNotification,
} from '../lib/appNotifications'
import {
  disablePush,
  enablePush,
  fetchInbox,
  markInboxRead,
  pushPermission,
  pushSupported,
  subscribePush,
  type InboxNotification,
} from '../lib/inboxNotifications'
import { isIosDevice, isStandaloneDisplay } from '../lib/pushAlerts'
import { AppModalPortal } from './AppModalPortal'

type Props = {
  lang: string
  token: string
  trialEndsAt?: string | null
  subSnapshot: SubscriptionSnapshot | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenSubscriptionSheet: () => void
  onReadChange?: () => void
  onInboxChange?: (info: { unread: number; total: number }) => void
}

function BellIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9Z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  )
}

export function AppNotificationsBell({
  lang,
  token,
  trialEndsAt,
  subSnapshot,
  open,
  onOpenChange,
  onOpenSubscriptionSheet,
  onReadChange,
  onInboxChange,
}: Props) {
  const isEl = lang === 'el'
  const panelId = useId()
  const notifications = useMemo(
    () => buildAppNotifications(lang, trialEndsAt, subSnapshot),
    [lang, trialEndsAt, subSnapshot],
  )
  const [readIds, setReadIds] = useState<Set<string>>(() => readNotificationIds(token))
  const [inbox, setInbox] = useState<InboxNotification[]>([])
  const [pushState, setPushState] = useState(pushPermission)
  const [pushBusy, setPushBusy] = useState(false)
  const onInboxChangeRef = useRef(onInboxChange)
  onInboxChangeRef.current = onInboxChange
  const needsHomeScreen = isIosDevice() && !isStandaloneDisplay()

  useEffect(() => {
    setReadIds(readNotificationIds(token))
  }, [token])

  const refreshInbox = useCallback(async () => {
    if (!token) {
      setInbox([])
      onInboxChangeRef.current?.({ unread: 0, total: 0 })
      return
    }
    try {
      const data = await fetchInbox(token)
      setInbox(data.notifications)
      onInboxChangeRef.current?.({ unread: data.unread, total: data.notifications.length })
    } catch {
      /* inbox stays as last successful load */
    }
  }, [token])

  useEffect(() => {
    void refreshInbox()
  }, [refreshInbox])

  useEffect(() => {
    if (!token || pushPermission() !== 'granted') return
    void subscribePush(token).catch(() => undefined)
  }, [token])

  useEffect(() => {
    if (!token || typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type !== 'heymaa-pushsubscriptionchange') return
      if (pushPermission() !== 'granted') return
      void subscribePush(token).catch(() => undefined)
    }
    navigator.serviceWorker.addEventListener('message', onMessage)
    return () => navigator.serviceWorker.removeEventListener('message', onMessage)
  }, [token])

  const unreadCount = useMemo(() => {
    const local = notifications.filter((n) => !readIds.has(n.id)).length
    const remote = inbox.filter((n) => !n.read).length
    return local + remote
  }, [notifications, readIds, inbox])

  const markRead = useCallback(
    (ids: string[]) => {
      if (!ids.length) return
      markNotificationsRead(token, ids)
      setReadIds(readNotificationIds(token))
      onReadChange?.()
    },
    [token, onReadChange],
  )

  const runAction = (item: AppNotification) => {
    markRead([item.id])
    onOpenChange(false)
    if (item.action === 'subscription_sheet') {
      onOpenSubscriptionSheet()
    }
  }

  const openInboxItem = async (item: InboxNotification) => {
    if (!item.read) {
      try {
        await markInboxRead(token, [item.id])
      } catch {
        /* still close the row locally */
      }
      setInbox((cur) => cur.map((row) => (row.id === item.id ? { ...row, read: true } : row)))
      onInboxChangeRef.current?.({
        unread: inbox.filter((row) => !row.read && row.id !== item.id).length,
        total: inbox.length,
      })
    }
  }

  const allowPush = async () => {
    setPushBusy(true)
    try {
      const result = await enablePush(token)
      setPushState(result === 'unsupported' ? 'unsupported' : result)
    } catch {
      setPushState(pushPermission())
    } finally {
      setPushBusy(false)
    }
  }

  const turnOffPush = async () => {
    setPushBusy(true)
    try {
      await disablePush(token)
      setPushState(pushPermission())
    } catch {
      setPushState(pushPermission())
    } finally {
      setPushBusy(false)
    }
  }

  const empty = notifications.length === 0 && inbox.length === 0

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="hm-header-notif-btn"
        aria-label={isEl ? 'Ειδοποιήσεις εφαρμογής' : 'App alerts'}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => onOpenChange(!open)}
      >
        <BellIcon />
        {unreadCount > 0 ? (
          <span className="hm-header-notif-badge" aria-hidden="true">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <AppModalPortal>
          <div
            id={panelId}
            className="hm-notif-panel"
            role="region"
            aria-label={isEl ? 'Ειδοποιήσεις εφαρμογής' : 'App alerts'}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hm-notif-panel-head">
              <span>{isEl ? 'Ειδοποιήσεις' : 'Alerts'}</span>
              {!empty ? (
                <span className="hm-notif-panel-count">
                  {unreadCount > 0
                    ? (isEl ? `${unreadCount} ${unreadCount === 1 ? 'νέα' : 'νέες'}` : `${unreadCount} new`)
                    : (isEl ? 'Όλες διαβασμένες' : 'All read')}
                </span>
              ) : null}
            </div>

            {pushSupported() ? (
              <div className="hm-notif-item hm-notif-push-card">
                <div className="hm-notif-item-body">
                  <div className="hm-notif-item-title">
                    {isEl ? 'Ειδοποιήσεις στο κινητό' : 'Alerts on this phone'}
                  </div>
                  {pushState === 'granted' ? (
                    <>
                      <p className="hm-notif-item-text">
                        {isEl
                          ? 'Ενεργές — μπορείς να λαμβάνεις μηνύματα και όταν η HeyMaa είναι κλειστή.'
                          : 'On — you can get messages even when HeyMaa is closed.'}
                      </p>
                      <button
                        type="button"
                        className="hm-notif-action hm-notif-action--ghost"
                        disabled={pushBusy}
                        onClick={() => void turnOffPush()}
                      >
                        {pushBusy
                          ? (isEl ? 'Απενεργοποίηση…' : 'Turning off…')
                          : (isEl ? 'Απενεργοποίηση' : 'Turn off')}
                      </button>
                    </>
                  ) : pushState === 'denied' ? (
                    <p className="hm-notif-item-text">
                      {isEl
                        ? 'Έχεις μπλοκάρει τις ειδοποιήσεις στο browser. Άνοιξε τις ρυθμίσεις του προγράμματος περιήγησης για αυτόν τον ιστότοπο και επίτρεψέ τις.'
                        : 'Notifications are blocked in the browser. Open site settings for this page and allow notifications.'}
                    </p>
                  ) : needsHomeScreen ? (
                    <p className="hm-notif-item-text">
                      {isEl
                        ? 'Στο iPhone: Safari → Κοινή χρήση → Προσθήκη στην αρχική οθόνη. Μετά άνοιξε την HeyMaa από την Αρχική και πάτα «Να επιτρέπονται».'
                        : 'On iPhone: Safari → Share → Add to Home Screen. Then open HeyMaa from Home Screen and tap Allow.'}
                    </p>
                  ) : (
                    <>
                      <p className="hm-notif-item-text">
                        {isEl
                          ? 'Ενεργοποίησέ τες για να μη χάνεις σημαντικά μηνύματα όταν η εφαρμογή είναι κλειστή.'
                          : 'Turn these on so you don’t miss important updates when the app is closed.'}
                      </p>
                      <button
                        type="button"
                        className="hm-notif-action"
                        disabled={pushBusy}
                        onClick={() => void allowPush()}
                      >
                        {pushBusy
                          ? (isEl ? 'Ενεργοποίηση…' : 'Enabling…')
                          : (isEl ? 'Ενεργοποίηση ειδοποιήσεων' : 'Activate alerts')}
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : null}

            {empty ? (
              <div className="hm-notif-empty">
                <span className="hm-notif-empty-icon" aria-hidden="true">
                  🔔
                </span>
                <p>{isEl ? 'Δεν έχεις ενεργές ειδοποιήσεις.' : 'No active alerts right now.'}</p>
              </div>
            ) : (
              <div className="hm-notif-list">
                {inbox.map((item) => (
                  <InboxRow key={item.id} item={item} onOpen={() => void openInboxItem(item)} />
                ))}
                {notifications.map((item) => (
                  <NotificationRow
                    key={item.id}
                    item={item}
                    unread={!readIds.has(item.id)}
                    onOpen={() => markRead([item.id])}
                    onAction={() => runAction(item)}
                  />
                ))}
              </div>
            )}
          </div>
        </AppModalPortal>
      ) : null}
    </div>
  )
}

function InboxRow({ item, onOpen }: { item: InboxNotification; onOpen: () => void }) {
  const external = !!item.url && /^https?:\/\//i.test(item.url)
  const internal = !!item.url && item.url.startsWith('/')
  return (
    <div
      className={`hm-notif-item${item.read ? '' : ' hm-notif-item--unread'}`}
      onClick={onOpen}
    >
      <div className="hm-notif-item-dot" aria-hidden="true" />
      <div className="hm-notif-item-body">
        <div className="hm-notif-item-title">{item.title}</div>
        <p className="hm-notif-item-text">{item.body}</p>
        {external ? (
          <a className="hm-notif-action" href={item.url || '/'} onClick={onOpen}>
            Open
          </a>
        ) : null}
        {internal ? (
          <Link to={item.url || '/'} className="hm-notif-action" onClick={onOpen}>
            Open
          </Link>
        ) : null}
      </div>
    </div>
  )
}

function NotificationRow({
  item,
  unread,
  onOpen,
  onAction,
}: {
  item: AppNotification
  unread: boolean
  onOpen: () => void
  onAction: () => void
}) {
  return (
    <div
      className={`hm-notif-item${item.urgent ? ' hm-notif-item--urgent' : ''}${unread ? ' hm-notif-item--unread' : ''}`}
      onClick={() => {
        if (unread) onOpen()
      }}
    >
      <div className="hm-notif-item-dot" aria-hidden="true" />
      <div className="hm-notif-item-body">
        <div className="hm-notif-item-title">{item.title}</div>
        <p className="hm-notif-item-text">{item.body}</p>
        {item.actionLabel ? (
          item.action === 'subscription' ? (
            <Link to="/subscription" className="hm-notif-action" onClick={(e) => { e.stopPropagation(); onAction() }}>
              {item.actionLabel}
            </Link>
          ) : (
            <button type="button" className="hm-notif-action" onClick={(e) => { e.stopPropagation(); onAction() }}>
              {item.actionLabel}
            </button>
          )
        ) : null}
      </div>
    </div>
  )
}

export function notificationSummaryLabel(
  lang: string,
  count: number,
  unread: number,
): string {
  const isEl = lang === 'el'
  if (count === 0) return isEl ? 'Καμία' : 'None'
  if (unread > 0) {
    return isEl
      ? `${unread} ${unread === 1 ? 'νέα' : 'νέες'}`
      : `${unread} new`
  }
  return isEl ? 'Διαβασμένες' : 'Read'
}
