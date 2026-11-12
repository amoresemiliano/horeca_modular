/* Cache a static offline explanation only. Never cache API responses, credentials,
   PINs, employee identity, authenticated pages or punch requests. No offline queue. */
const OFFLINE = '/personal/fichaje/offline.html';
self.addEventListener('install', event => event.waitUntil(caches.open('personnel-offline-v1').then(cache => cache.add(OFFLINE))));
self.addEventListener('activate', event => event.waitUntil(Promise.all([self.clients.claim(), caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('personnel-offline-') && k !== 'personnel-offline-v1').map(k => caches.delete(k))))])));
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' || !new URL(event.request.url).pathname.startsWith('/personal/fichaje/')) return;
  event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE)));
});
self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  if (!payload || typeof payload.body !== 'string') return;
  event.waitUntil(self.registration.showNotification('HORECA Personal', {
    body: payload.body.slice(0, 250), icon: '/personal/fichaje/icon-192.png',
    tag: typeof payload.tag === 'string' ? payload.tag : 'personnel-reminder',
    data: { url: '/personal/fichaje/' }
  }));
});
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL('/personal/fichaje/', self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async clients => {
    const client = clients.find(item => item.url === url);
    if (client) return client.focus();
    return self.clients.openWindow(url);
  }));
});
