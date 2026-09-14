const PushManager = (() => {
  // Key VAPID pública del proyecto. Se genera en Firebase Console → Configuración
  // del proyecto → Cloud Messaging → Configuración web → Clave pública VAPID.
  const VAPID_KEY = '__REEMPLAZA_CON_TU_VAPID_KEY__';

  const SW_PATH = 'firebase-messaging-sw.js';

  let messaging = null;
  let swReg = null;
  let enabled = false;
  let token = null;

  const icon =
    'data:image/svg+xml,' +
    encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>📅</text></svg>`);

  function init() {
    bindToggle();
    if (typeof firebase === 'undefined' || !firebase.messaging) return;
    try {
      messaging = firebase.messaging();
    } catch (err) {
      console.warn('Firebase Messaging no disponible:', err.message);
      return;
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(SW_PATH)
        .then((reg) => {
          swReg = reg;
          messaging.onMessage(handleForeground);
        })
        .catch((err) => console.warn('No se pudo registrar el service worker:', err.message));
    }
    syncState();
  }

  function bindToggle() {
    const btn = document.getElementById('btn-notifications');
    if (!btn) return;
    btn.addEventListener('click', () => toggle());
  }

  async function syncState() {
    const state = await Store.getFcmState();
    setState(!!(state && state.enabled), state && state.token);
    showBtn(true);
  }

  function setState(on, tok) {
    enabled = !!on;
    token = tok || null;
    const btn = document.getElementById('btn-notifications');
    const iconEl = document.getElementById('btn-notifications-icon');
    if (!btn) return;
    btn.classList.toggle('active', enabled);
    btn.title = enabled ? 'Desactivar notificaciones' : 'Activar notificaciones';
    if (iconEl) iconEl.className = enabled ? 'bi bi-bell-fill' : 'bi bi-bell';
    const label = btn.querySelector('.btn-label');
    if (label) label.textContent = enabled ? 'Notificaciones on' : 'Notificaciones';
  }

  function showBtn(show) {
    const btn = document.getElementById('btn-notifications');
    if (btn) btn.classList.toggle('d-none', !show);
  }

  async function toggle() {
    try {
      if (enabled) {
        await disable();
      } else {
        await enable();
      }
    } catch (err) {
      alert('No se pudo configurar las notificaciones: ' + err.message);
    }
  }

  async function enable() {
    if (!('Notification' in window)) {
      throw new Error('Este navegador no soporta notificaciones.');
    }
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') {
      throw new Error('Permiso denegado. Habilitalo desde el navegador e intentá de nuevo.');
    }
    const reg = swReg || (await navigator.serviceWorker.ready);
    if (!reg) throw new Error('Service worker no disponible.');
    if (!messaging) throw new Error('Firebase Messaging no está cargado.');

    const newToken = await messaging.getToken({ vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
    await Store.saveFcm({ enabled: true, token: newToken, updatedAt: Date.now() });
    setState(true, newToken);
  }

  async function disable() {
    try {
      if (messaging && token) await messaging.deleteToken(token);
    } catch (err) {}
    await Store.saveFcm({ enabled: false, token: null, updatedAt: Date.now() });
    setState(false, null);
  }

  function handleForeground(payload) {
    const n = (payload && payload.notification) || {};
    const title = n.title || 'Mi Calendario';
    const options = { body: n.body || '', icon: n.icon || icon };
    if (swReg && 'showNotification' in swReg) {
      swReg.showNotification(title, options);
    } else if ('Notification' in window && Notification.permission === 'granted') {
      new Notification(title, options);
    }
  }

  return { init };
})();