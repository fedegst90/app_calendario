importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyBiT1rFCFh8WH2heBaEEvgi_o-hV4MwJAA',
  authDomain: 'appcalendario-6fa48.firebaseapp.com',
  databaseURL: 'https://appcalendario-6fa48-default-rtdb.firebaseio.com',
  projectId: 'appcalendario-6fa48',
  storageBucket: 'appcalendario-6fa48.firebasestorage.app',
  messagingSenderId: '75228187416',
  appId: '1:75228187416:web:824a8fac72aef8f2a22c6d',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  const n = (payload && payload.notification) || {};
  const title = n.title || 'Mi Calendario';
  const options = {
    body: n.body || 'Tenés algo nuevo en tu agenda.',
    icon: n.icon || 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>📅</text></svg>`),
    badge: n.badge,
    data: payload.data || {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (list) {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});