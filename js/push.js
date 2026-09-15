const PushManager = (() => {
  // Key VAPID pública del proyecto. Se genera en Firebase Console → Configuración
  // del proyecto → Cloud Messaging → Configuración web → Clave pública VAPID.
  const VAPID_KEY = 'BKzJ0hHigttR33EP4ODl914a6nz9oDCO9TFm8FY3-cbl4LiLAA_zVSPQKVymcATcf4up1TkxeMf7mFML4pt7770';

  const SW_PATH = 'firebase-messaging-sw.js';
  const TICK_MS = 30000;
  const WEEK_MS = 7 * 24 * 3600 * 1000;

  let messaging = null;
  let swReg = null;
  let enabled = false;
  let token = null;
  let tickId = null;

  const icon =
    'data:image/svg+xml,' +
    encodeURIComponent(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='0.9em' font-size='90'>📅</text></svg>`);

  // --------------------------------------------------- FCM (push externo)

  function init() {
    bindToggle();
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(SW_PATH)
        .then((reg) => {
          swReg = reg;
          if (messaging) messaging.onMessage(handleForeground);
        })
        .catch((err) => console.warn('No se pudo registrar el service worker:', err.message));
    }
    if (typeof firebase !== 'undefined' && firebase.messaging) {
      try {
        messaging = firebase.messaging();
      } catch (err) {
        console.warn('Firebase Messaging no disponible:', err.message);
      }
    }
    syncState();
    schedule();
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
      UI.alertDialog('No se pudo configurar las notificaciones: ' + err.message, 'Notificaciones');
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
    UI.toast('Notificaciones activadas', 'success');
  }

  async function disable() {
    try {
      if (messaging && token) await messaging.deleteToken(token);
    } catch (err) {}
    await Store.saveFcm({ enabled: false, token: null, updatedAt: Date.now() });
    setState(false, null);
    UI.toast('Notificaciones desactivadas', 'success');
  }

  function handleForeground(payload) {
    const n = (payload && payload.notification) || {};
    notifyUser(n.title || 'Mi Calendario', n.body || '');
  }

  function notifyUser(title, body) {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = { body: body || '', icon };
    if (swReg && 'showNotification' in swReg) {
      swReg.showNotification(title, options);
    } else {
      new Notification(title, options);
    }
  }

  // Pide el permiso de notificaciones si hace falta (para recordatorios locales).
  async function ensurePermission() {
    if (typeof PwaInstall !== 'undefined' && PwaInstall.isIOS && PwaInstall.isIOS()) {
      if (!PwaInstall.isStandalone()) {
        UI.alertDialog(
          'En iPhone/iPad las notificaciones se activan después de instalar la app: tocá el botón "Instalar" o usá Compartir → Añadir a pantalla de inicio.',
          'Notificaciones'
        );
        return false;
      }
      if (self.Notification) return await requestPermission();
    }
    if (!('Notification' in window)) {
      UI.alertDialog('Este navegador no soporta notificaciones.', 'Notificaciones');
      return false;
    }
    if (Notification.permission === 'denied') {
      UI.alertDialog('Notificaciones bloqueadas. Habilitalas desde la configuración del navegador.', 'Notificaciones');
      return false;
    }
    if (Notification.permission === 'granted') return true;
    return requestPermission();
  }

  async function requestPermission() {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') UI.alertDialog('Permiso denegado: no se mostrarán recordatorios.', 'Notificaciones');
    return perm === 'granted';
  }

  // -------------------------------------------- recordatorios programados

  function schedule() {
    if (tickId) return;
    tick();
    tickId = setInterval(tick, TICK_MS);
  }

  function parseTime(hm) {
    if (!hm) return null;
    const parts = String(hm).split(':');
    if (parts.length !== 2) return null;
    const h = +parts[0];
    const m = +parts[1];
    if (!isFinite(h) || !isFinite(m)) return null;
    return { h, m };
  }

  // Próxima ocurrencia (estrictamente futura) de un día (0=Lu .. 6=Do) a las "HH:MM"
  function nextWeeklyMs(day, hm) {
    const p = parseTime(hm);
    if (!p) return null;
    const now = new Date();
    const dayNow = (now.getDay() + 6) % 7;
    let diff = day - dayNow;
    if (diff < 0) diff += 7;
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    d.setDate(d.getDate() + diff);
    d.setHours(p.h, p.m, 0, 0);
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 7);
    return d.getTime();
  }

  // Timestamp de un evento puntual "YYYY-MM-DD" a las "HH:MM" (hora local)
  function eventAtMs(iso, hm) {
    const p = parseTime(hm);
    if (!p || !iso) return null;
    const parts = String(iso).split('-');
    if (parts.length !== 3) return null;
    const d = new Date(+parts[0], +parts[1] - 1, +parts[2], p.h, p.m, 0, 0);
    return isFinite(d.getTime()) ? d.getTime() : null;
  }

  function tick() {
    const state = App.state;
    if (!state) return;
    const now = Date.now();

    // Horarios de la semana (se repiten cada semana en el día/hora elegidos)
    (state.weekly || []).forEach((w) => {
      if (!w.notify || w.notifyDay == null) return;
      const at = nextWeeklyMs(w.notifyDay, w.notify);
      if (at == null) return;
      const prev = at - WEEK_MS;
      if (prev <= now + 2000 && prev >= now - TICK_MS - 2000) {
        const sub = App.getSubject(w.subjectId);
        const subName = sub ? sub.name : 'Sin materia';
        notifyUser(subName, `Tenés ${TYPE_LABEL[w.type] || w.type} a las ${UI.pad(w.start)}:00.`);
      }
    });

    // Eventos del mes (una sola vez, en el día/hora elegidos)
    (state.events || []).forEach((ev) => {
      if (!ev.notify || !ev.notifyDate) return;
      const at = eventAtMs(ev.notifyDate, ev.notify);
      if (at == null) return;
      if (at <= now + 2000 && at >= now - TICK_MS - 2000) {
        notifyUser(ev.title, `${UI.fmtDate(ev.notifyDate)} a las ${ev.notify}.`);
      }
    });
  }

  return { init, schedule, ensurePermission };
})();