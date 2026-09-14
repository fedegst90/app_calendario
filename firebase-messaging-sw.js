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

/* ---------- Caché offline / PWA ---------- */

const CACHE = 'mi-calendario-v1';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './js/app.js',
  './js/store.js',
  './js/ui.js',
  './js/subjects.js',
  './js/week.js',
  './js/month.js',
  './js/settings.js',
  './js/push.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((cache) => cache.put(event.request, copy));
        return res;
      })
      .catch(() =>
        caches.match(event.request).then((cached) => cached || caches.match('./index.html'))
      )
  );
});

/* ---------- Firebase Cloud Messaging ---------- */

messaging.onBackgroundMessage(function (payload) {
  const n = (payload && payload.notification) || {};
  const title = n.title || 'Mi Calendario';
  const options = {
    body: n.body || 'Tenés algo nuevo en tu agenda.',
    icon: n.icon || 'icons/icon-192.svg',
    badge: 'icons/icon-192.svg',
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
      if (clients.openWindow) return clients.openWindow('./');
    })
  );
});