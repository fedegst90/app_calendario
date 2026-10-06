const Store = (() => {
  const KEY = 'app_calendario_v1';
  const META_KEY = 'app_calendario_meta';

  // Config de Firebase del proyecto appcalendario-6fa48
  const FIREBASE_CONFIG = {
    apiKey: 'AIzaSyBiT1rFCFh8WH2heBaEEvgi_o-hV4MwJAA',
    authDomain: 'appcalendario-6fa48.firebaseapp.com',
    databaseURL: 'https://appcalendario-6fa48-default-rtdb.firebaseio.com',
    projectId: 'appcalendario-6fa48',
    storageBucket: 'appcalendario-6fa48.firebasestorage.app',
    messagingSenderId: '75228187416',
    appId: '1:75228187416:web:824a8fac72aef8f2a22c6d',
  };

  const DEFAULT_STATE = {
    subjects: [],
    weekly: [],
    events: [],
    colors: [],
    settings: { theme: 'auto', themeColor: '#0d6efd' },
  };

  const SESSION_KEY = 'app_calendario_session';
  const FCM_CACHE_KEY = 'app_calendario_fcm_cache';
  const FCM_PENDING_KEY = 'app_calendario_fcm_pending';
  const REMOTE_TIMEOUT_MS = 8000;

  let onStatus = null;
  let onAuth = null;
  let currentUser = null;
  let app = null;
  let dbRef = null;
  let timer = null;
  let flushing = false;
  let queueWrite = null;
  let retryTimer = null;
  let pendingTs = null;
  let memPending = null; // respaldo en memoria si IndexedDB no está disponible
  let offlineToastShown = false;

  try {
    if (typeof firebase !== 'undefined') {
      app = firebase.initializeApp(FIREBASE_CONFIG);
      dbRef = firebase.database(app).ref('users');
    }
  } catch (err) {
    app = null;
    dbRef = null;
  }

  // ------------------------------------------------ estado / notificaciones

  function setStatus(kind) {
    if (typeof onStatus === 'function') onStatus(kind);
  }

  // Las promesas de Firebase no rechazan cuando no hay red: se quedan penjando
  // hasta reconectar. Con timeout la app nunca queda trabada en "Cargando…".
  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Sin respuesta de Firebase (timeout)')), ms);
      promise.then(
        (v) => {
          clearTimeout(t);
          resolve(v);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        }
      );
    });
  }

  function isOffline() {
    return typeof navigator !== 'undefined' && navigator.onLine === false;
  }

  function uidKey() {
    return currentUser ? currentUser.uid : null;
  }

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || 'null');
    } catch (err) {
      return null;
    }
  }

  function writeJson(key, value) {
    try {
      if (value == null) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch (err) {}
  }

  function scopedKey(base) {
    const uid = uidKey();
    return uid ? base + '_' + uid : base;
  }

  // ------------------------------------------------ utilidades de datos

  function fallbackColors() {
    return (PALETTES || []).map((p) => ({ id: p.id, nombre: p.nombre, codigo: p.codigo }));
  }

  function str(v) {
    return v == null ? '' : String(v);
  }

  function num(v) {
    const n = Number(v);
    return isFinite(n) ? n : 0;
  }

  // Horario en minutos desde medianoche. Los datos viejos guardaban la hora
  // entera (6..22): si viene en ese rango se asume que son horas y se pasa a
  // minutos; lo nuevo ya llega en minutos (>= 6*60).
  function mins(v) {
    const n = num(v);
    return n > 0 && n < 24 ? Math.round(n * 60) : Math.round(n);
  }

  // RTDB almacena los arrays como objetos con claves numéricas (los guardamos
  // como mapas con la id de cada item); esto los reconvierte a arrays.
  function toArray(v) {
    if (Array.isArray(v)) return v;
    if (v && typeof v === 'object') return Object.keys(v).map((k) => v[k]);
    return v;
  }

  function fromMap(v) {
    const arr = toArray(v);
    return Array.isArray(arr) ? arr.filter((it) => it && typeof it === 'object') : [];
  }

  function toMap(arr) {
    const o = {};
    (arr || []).forEach((it) => {
      if (it && typeof it === 'object' && it.id != null) o[String(it.id)] = it;
    });
    return o;
  }

  function parseDates(v) {
    v = toArray(v);
    if (Array.isArray(v)) return v.map(str);
    if (typeof v === 'string') {
      const t = v.trim();
      if (!t) return [];
      try {
        const a = JSON.parse(t);
        return Array.isArray(a) ? a.map(str) : [str(a)];
      } catch (err) {
        return [str(t)];
      }
    }
    return v == null ? [] : [str(v)];
  }

  function normalize(state) {
    const settings = { ...DEFAULT_STATE.settings, ...(state.settings || {}) };
    return {
      subjects: (state.subjects || []).map((s) => ({
        id: str(s.id),
        name: str(s.name),
        detail: str(s.detail),
        color: str(s.color),
      })),
      weekly: (state.weekly || []).map((w) => {
        const wNotif = str(w.notify) || null;
        return {
          id: str(w.id),
          subjectId: str(w.subjectId),
          day: num(w.day),
          start: mins(w.start),
          end: mins(w.end),
          type: str(w.type) || 'clase',
          notify: wNotif,
          notifyDay: wNotif ? (w.notifyDay != null ? num(w.notifyDay) : num(w.day)) : null,
          description: str(w.description),
        };
      }),
      events: (state.events || []).map((ev) => {
        const evNotif = str(ev.notify) || null;
        return {
          id: str(ev.id),
          title: str(ev.title),
          subjectId: str(ev.subjectId) || null,
          type: str(ev.type) || 'evento',
          dates: parseDates(ev.dates),
          notify: evNotif,
          notifyDate: evNotif ? str(ev.notifyDate) || (parseDates(ev.dates)[0] || null) : null,
        };
      }),
      colors:
        state.colors && state.colors.length
          ? state.colors
              .map((c) => ({
                id: str(c && c.id),
                nombre: str(c && c.nombre),
                codigo: str(c && c.codigo),
              }))
              .filter((c) => c.codigo)
          : fallbackColors(),
      settings,
    };
  }

  // ------------------------------------------------ caché local (por usuario)

  function localKey() {
    return KEY + (currentUser ? '_' + currentUser.uid : '');
  }

  function saveLocal(state) {
    try {
      localStorage.setItem(localKey(), JSON.stringify(state));
    } catch (err) {}
  }

  function loadLocal() {
    try {
      const raw = localStorage.getItem(localKey()) || localStorage.getItem(KEY);
      return normalize(raw ? JSON.parse(raw) : {});
    } catch (err) {
      return normalize({});
    }
  }

  // ------------------------------------------- snapshot + cola (IndexedDB)

  // Guarda el estado en IndexedDB (y en localStorage como respaldo inmediato).
  async function saveSnapshot(state) {
    saveLocal(state);
    const uid = uidKey();
    if (!uid || typeof LocalDB === 'undefined') return;
    try {
      await LocalDB.saveState(uid, state);
    } catch (err) {}
  }

  // Lee el último snapshot: primero IndexedDB, si no, localStorage (migración).
  async function loadSnapshot() {
    const uid = uidKey();
    if (uid && typeof LocalDB !== 'undefined') {
      try {
        const rec = await LocalDB.getState(uid);
        if (rec && rec.state) return normalize(rec.state);
      } catch (err) {}
    }
    return loadLocal();
  }

  // Cambios hechos sin conexión: quedan encolados hasta poder subirlos.
  function setPending(state) {
    const ts = Date.now();
    memPending = state;
    pendingTs = ts;
    const uid = uidKey();
    if (!uid || typeof LocalDB === 'undefined') return Promise.resolve();
    return LocalDB.setPending(uid, state, ts).catch(() => {});
  }

  async function getPendingState() {
    const uid = uidKey();
    if (uid && typeof LocalDB !== 'undefined') {
      try {
        const rec = await LocalDB.getPending(uid);
        if (rec && rec.state) {
          memPending = rec.state;
          pendingTs = rec.ts || null;
          return memPending;
        }
      } catch (err) {}
    }
    return memPending;
  }

  // Borra la cola solo si nadie encoló algo más nuevo mientras subíamos.
  async function clearPending(expectedTs) {
    const uid = uidKey();
    if (uid && typeof LocalDB !== 'undefined') {
      try {
        const rec = await LocalDB.getPending(uid);
        if (rec && expectedTs != null && rec.ts !== expectedTs) return false;
        await LocalDB.clearPending(uid);
      } catch (err) {
        return false;
      }
    }
    if (expectedTs != null && pendingTs != null && pendingTs !== expectedTs) return false;
    memPending = null;
    pendingTs = null;
    return true;
  }

  // Meta con tema/color del último usuario activo (para pintar sin parpadeo antes del login)
  function saveMeta(state) {
    try {
      localStorage.setItem(
        META_KEY,
        JSON.stringify({
          theme: (state.settings && state.settings.theme) || 'auto',
          themeColor: (state.settings && state.settings.themeColor) || '#0d6efd',
        })
      );
    } catch (err) {}
  }

  function getLocalSettings() {
    try {
      const meta = JSON.parse(localStorage.getItem(META_KEY) || '{}');
      return { theme: meta.theme || 'auto', themeColor: meta.themeColor || '#0d6efd' };
    } catch (err) {
      return {};
    }
  }

  // ------------------------------------------------ autenticación

  function start() {
    bindConnectivity();
    if (!app || !firebase.auth) {
      notifyAuth(null);
      return;
    }
    let resolved = false;
    firebase.auth().onAuthStateChanged((user) => {
      resolved = true;
      currentUser = user
        ? { uid: user.uid, email: user.email || '', name: user.displayName || '' }
        : null;
      notifyAuth(currentUser);
    });

    // Sin conexión la sesión persistida a veces no llega a resolverse:
    // usamos la última conocida para entrar igual a los datos locales.
    setTimeout(() => {
      if (resolved || !isOffline()) return;
      const cached = readJson(SESSION_KEY);
      if (cached && cached.uid && !currentUser) {
        currentUser = cached;
        notifyAuth(currentUser);
      }
    }, 4000);
  }

  // Cambios de conectividad: al reconectar se reenvía todo lo pendiente.
  function bindConnectivity() {
    if (typeof window === 'undefined' || window.__storeNetBound) return;
    window.__storeNetBound = true;
    window.addEventListener('online', async () => {
      const pending = await getPendingState();
      const fcmPending = readJson(scopedKey(FCM_PENDING_KEY));
      if (pending || fcmPending) {
        setStatus('pending');
        if (typeof UI !== 'undefined' && UI.toast) {
          UI.toast('Conexión restablecida: sincronizando cambios…', 'info');
        }
      }
      flush();
    });
    window.addEventListener('offline', () => {
      setStatus('offline');
      offlineToastShown = false;
      if (typeof UI !== 'undefined' && UI.toast) {
        UI.toast('Sin conexión: la app sigue funcionando y se sincroniza sola al reconectar.', 'warning');
      }
    });
  }

  function notifyAuth(user) {
    writeJson(SESSION_KEY, user);
    if (typeof onAuth === 'function') onAuth(user);
  }

  function signInWithGoogle() {
    if (!app || !firebase.auth) return Promise.reject(new Error('Firebase Auth no disponible'));
    const provider = new firebase.auth.GoogleAuthProvider();
    return firebase.auth().signInWithPopup(provider).catch((err) => {
      // Si el navegador bloquea el popup, cambia automáticamente al flujo redirect
      if (err && (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request')) {
        return firebase.auth().signInWithRedirect(provider);
      }
      throw err;
    });
  }

  function signOut() {
    if (!app || !firebase.auth) return Promise.resolve();
    return firebase.auth().signOut();
  }

  function getUser() {
    return currentUser;
  }

  // ------------------------------------------------ lectura / escritura

  function refUser() {
    return currentUser && dbRef ? dbRef.child(currentUser.uid) : null;
  }

  function serializeWeekly(w) {
    return {
      id: w.id,
      subjectId: w.subjectId,
      day: w.day,
      start: w.start,
      end: w.end,
      type: w.type,
      notify: (w.notify && w.notifyDay != null) ? w.notify : null,
      notifyDay: (w.notify && w.notifyDay != null) ? w.notifyDay : null,
      description: w.description || '',
    };
  }

  function serializeEvent(ev) {
    return {
      id: ev.id,
      title: ev.title,
      subjectId: ev.subjectId || '',
      type: ev.type,
      dates: ev.dates || [],
      notify: (ev.notify && ev.notifyDate) ? ev.notify : null,
      notifyDate: (ev.notify && ev.notifyDate) ? ev.notifyDate : null,
    };
  }

  async function load() {
    const userRef = refUser();
    if (!userRef) return null;

    // 1) Cambios sin sincronizar: manda la copia local (se reenvían solos).
    const pending = await getPendingState();
    if (pending) {
      const st = normalize(pending);
      const off = isOffline();
      st.source = off ? 'offline' : 'pending';
      setStatus(off ? 'offline' : 'pending');
      if (!off) setTimeout(() => flush(), 500);
      return st;
    }

    // 2) Sin conexión: la caché local responde al instante, sin tocar la red.
    if (isOffline()) {
      const local = await loadSnapshot();
      local.source = 'offline';
      setStatus('offline');
      return local;
    }

    try {
      const snap = await withTimeout(userRef.once('value'), REMOTE_TIMEOUT_MS);
      const data = snap.val();

      // Primer ingreso del usuario: migra caché local (si hubiera) y siembra la config en la base
      if (!data) {
        const legacy = loadLocal();
        const initState = normalize({ ...legacy, settings: getLocalSettings() });
        await withTimeout(
          userRef.set({
            materias: toMap(initState.subjects || []),
            horarios: toMap((initState.weekly || []).map(serializeWeekly)),
            eventos: toMap((initState.events || []).map(serializeEvent)),
            colors: fallbackColors(),
            settings: initState.settings || {},
          }),
          REMOTE_TIMEOUT_MS
        );
        await saveSnapshot(initState);
        saveMeta(initState);
        initState.source = 'remote';
        setStatus('ok');
        return initState;
      }

      const palette = fromMapShaped(data.colors);
      const state = normalize({
        subjects: fromMap(data.materias),
        weekly: fromMap(data.horarios),
        events: fromMap(data.eventos),
        colors: palette.length ? palette : undefined,
        settings: { ...getLocalSettings(), ...(data.settings || {}) },
      });
      state.source = 'remote';
      await saveSnapshot(state);
      saveMeta(state);
      setStatus('ok');
      return state;
    } catch (err) {
      // Falla o timeout de red: se trabaja con lo último guardado en el dispositivo
      const local = await loadSnapshot();
      local.source = 'offline';
      setStatus('offline');
      return local;
    }
  }

  function fromMapShaped(v) {
    return fromMap(v)
      .map((c) => ({ id: str(c.id), nombre: str(c.nombre), codigo: str(c.codigo) }))
      .filter((c) => c.codigo);
  }

  // Guarda TODO del usuario de una sola vez: snapshot local (IndexedDB +
  // localStorage) y, si hay red, subida a Firebase (sino queda en la cola).
  function save(state) {
    saveMeta(state);
    const snapshot = saveSnapshot(state);
    if (!refUser()) {
      setStatus('offline');
      return;
    }
    clearTimeout(timer);
    setStatus('pending');
    queueWrite = Promise.resolve(snapshot)
      .then(() => setPending(state))
      .catch(() => {});
    timer = setTimeout(() => {
      Promise.resolve(queueWrite)
        .then(() => flush())
        .catch(() => {});
    }, 700);
  }

  // Sube a Firebase lo que haya en la cola. Si no hay red, no pasa nada:
  // el 'online' (o el próximo arranque) lo reintenta.
  async function flush() {
    if (flushing) return;
    flushing = true;
    clearTimeout(retryTimer);
    try {
      if (queueWrite) await queueWrite;
      const userRef = refUser();
      const state = await getPendingState();
      if (!state) {
        // Nada de datos pendiente: igual reintenta el estado FCM si quedó fuera
        if (!isOffline() && userRef) await flushFcm();
        return;
      }
      if (!userRef || isOffline()) {
        setStatus('offline');
        return;
      }
      setStatus('pending');
      try {
        const ts = pendingTs;
        await withTimeout(
          userRef.update({
            materias: toMap(state.subjects || []),
            horarios: toMap((state.weekly || []).map(serializeWeekly)),
            eventos: toMap((state.events || []).map(serializeEvent)),
            settings: state.settings || {},
          }),
          REMOTE_TIMEOUT_MS
        );
        const cleared = await clearPending(ts);
        if (!cleared) {
          // Mientras subía entró un cambio nuevo: se sube enseguida
          retryTimer = setTimeout(() => {
            flush();
          }, 500);
          return;
        }
        await flushFcm();
        offlineToastShown = false;
        setStatus('ok');
      } catch (err) {
        setStatus('offline');
        if (!isOffline() && !offlineToastShown) {
          offlineToastShown = true;
          if (typeof UI !== 'undefined' && UI.toast) {
            UI.toast('Sin conexión: los cambios quedaron guardados en el dispositivo y se sincronizan solos.', 'danger');
          }
        }
        // Reintento periódico mientras siga habiendo pendientes
        retryTimer = setTimeout(() => {
          flush();
        }, 30000);
      }
    } finally {
      flushing = false;
    }
  }

  function uid() {
    // Prefijo 'id' para que la clave nunca sea puramente numérica (RTDB la
    // reinterpretaría como un índice de array y rompería los datos).
    return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ------------------------------------------------ notificaciones push (FCM)

  async function getFcmState() {
    const r = refUser();
    const cache = readJson(scopedKey(FCM_CACHE_KEY));
    if (!r || isOffline()) return cache;
    try {
      const snap = await withTimeout(r.child('fcm').once('value'), REMOTE_TIMEOUT_MS);
      const value = snap.val() || null;
      writeJson(scopedKey(FCM_CACHE_KEY), value);
      return value;
    } catch (err) {
      // Sin red: el último estado conocido (para que el botón no mienta)
      return cache;
    }
  }

  async function saveFcm(state) {
    const value = state || { enabled: false, token: null, updatedAt: Date.now() };
    writeJson(scopedKey(FCM_CACHE_KEY), value);
    const r = refUser();
    if (!r) throw new Error('No hay usuario autenticado');
    if (isOffline()) {
      // Sin conexión: queda marcado y se sube al reconectar
      writeJson(scopedKey(FCM_PENDING_KEY), value);
      return;
    }
    try {
      await withTimeout(r.child('fcm').set(value), REMOTE_TIMEOUT_MS);
      writeJson(scopedKey(FCM_PENDING_KEY), null);
    } catch (err) {
      // Sin conexión: queda marcado y se sube al reconectar
      writeJson(scopedKey(FCM_PENDING_KEY), value);
    }
  }

  async function flushFcm() {
    const pending = readJson(scopedKey(FCM_PENDING_KEY));
    const r = refUser();
    if (!pending || !r || isOffline()) return;
    try {
      await withTimeout(r.child('fcm').set(pending), REMOTE_TIMEOUT_MS);
      writeJson(scopedKey(FCM_PENDING_KEY), null);
    } catch (err) {}
  }

  return {
    start,
    load,
    save,
    flush,
    uid,
    signInWithGoogle,
    signOut,
    getUser,
    getFcmState,
    saveFcm,
    set onStatus(fn) {
      onStatus = fn;
    },
    set onAuth(fn) {
      onAuth = fn;
    },
  };
})();