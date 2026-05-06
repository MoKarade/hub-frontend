// Service Worker — Web Push notifications natives pour le hub
// Reçoit les push events du backend (via VAPID) et affiche des notifs natives.

self.addEventListener('install', (event) => {
  // Active immediatement le SW (skip waiting) au lieu d'attendre le reload
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  // Claim tous les clients ouverts pour que le SW s'applique tout de suite
  event.waitUntil(self.clients.claim())
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let payload
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'Hub perso', body: event.data.text() }
  }

  const title = payload.title || 'Hub perso'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/icon.svg',
    badge: '/icon.svg',
    tag: payload.tag, // remplace une notif existante avec même tag
    requireInteraction: !!payload.requireInteraction,
    data: { url: payload.url || '/' },
    timestamp: Date.now(),
    vibrate: [100, 50, 100],
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Si un client est deja ouvert, focus + navigate
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          if ('navigate' in client) client.navigate(url)
          return
        }
      }
      // Sinon ouvre une nouvelle fenetre
      if (self.clients.openWindow) return self.clients.openWindow(url)
    })
  )
})
