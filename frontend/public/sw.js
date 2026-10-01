/* HeyMaa Web Push service worker. Shows a system notification, then opens the app. */
self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch (e) {
    data = { title: 'HeyMaa', body: event.data ? event.data.text() : '' }
  }
  const title = data.title || 'HeyMaa'
  const options = {
    body: data.body || '',
    icon: '/logo192.png',
    badge: '/logo192.png',
    tag: data.tag || 'heymaa',
    data: { url: data.url || '/app' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = (event.notification.data && event.notification.data.url) || '/app'
  const target = /^https?:\/\//i.test(raw) ? raw : new URL(raw, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(target)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
      return undefined
    }),
  )
})

/* Re-subscribe when the browser rotates the push endpoint. */
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const reg = self.registration
        const oldEndpoint = event.oldSubscription && event.oldSubscription.endpoint
        let sub = event.newSubscription
        if (!sub) {
          const keyRes = await fetch('/me/push/public-key', { credentials: 'same-origin' }).catch(() => null)
          // Without auth headers we cannot refresh server-side from SW alone.
          // Clients re-subscribe on next app open when permission is still granted.
          if (!keyRes || !keyRes.ok) return
        }
        // Notify open clients so the logged-in app can POST the new subscription.
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
        for (const client of clients) {
          client.postMessage({
            type: 'heymaa-pushsubscriptionchange',
            oldEndpoint: oldEndpoint || null,
          })
        }
      } catch (e) {
        /* ignore */
      }
    })(),
  )
})
