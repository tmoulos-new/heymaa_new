import React, { useCallback, useEffect, useId, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { SubscriptionSnapshot } from '../lib/authApi'
import {
  buildAppNotifications,
  markNotificationsRead,
  readNotificationIds,
  type AppNotification,
} from '../lib/appNotifications'

type Props = {
  lang: string
  token: string
  trialEndsAt?: string | null
  subSnapshot: SubscriptionSnapshot | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onOpenSubscriptionSheet: () => void
  onReadChange?: () => void
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
}: Props) {
  const isEl = lang === 'el'
  const panelId = useId()
  const notifications = useMemo(
    () => buildAppNotifications(lang, trialEndsAt, subSnapshot),
    [lang, trialEndsAt, subSnapshot],
  )
  const [readIds, setReadIds] = useState<Set<string>>(() => readNotificationIds(token))

  useEffect(() => {
    setReadIds(readNotificationIds(token))
  }, [token])

  const unreadCount = useMemo(
    () => notifications.filter((n) => !readIds.has(n.id)).length,
    [notifications, readIds],
  )

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
        <div
          id={panelId}
          className="hm-notif-panel"
          role="region"
          aria-label={isEl ? 'Ειδοποιήσεις εφαρμογής' : 'App alerts'}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="hm-notif-panel-head">
            <span>{isEl ? 'Ειδοποιήσεις' : 'Alerts'}</span>
            {notifications.length > 0 ? (
              <span className="hm-notif-panel-count">
                {unreadCount > 0
                  ? (isEl ? `${unreadCount} ${unreadCount === 1 ? 'νέα' : 'νέες'}` : `${unreadCount} new`)
                  : (isEl ? 'Όλες διαβασμένες' : 'All read')}
              </span>
            ) : null}
          </div>

          {notifications.length === 0 ? (
            <div className="hm-notif-empty">
              <span className="hm-notif-empty-icon" aria-hidden="true">
                🔔
              </span>
              <p>{isEl ? 'Δεν έχεις ενεργές ειδοποιήσεις.' : 'No active alerts right now.'}</p>
            </div>
          ) : (
            <div className="hm-notif-list">
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
      ) : null}
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
