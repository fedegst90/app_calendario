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

  let onStatus = null;
  let onAuth = null;
  let currentUser = null;
  let app = null;
  let dbRef = null;
  let timer = null;

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
          start: num(w.start),
          end: num(w.end),
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
    if (!app || !firebase.auth) {
      notifyAuth(null);
      return;
    }
    firebase.auth().onAuthStateChanged((user) => {
      currentUser = user
        ? { uid: user.uid, email: user.email || '', name: user.displayName || '' }
        : null;
      notifyAuth(currentUser);
    });
  }

  function notifyAuth(user) {
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

    try {
      const snap = await userRef.once('value');
      const data = snap.val();

      // Primer ingreso del usuario: migra caché local (si hubiera) y siembra la config en la base
      if (!data) {
        const legacy = loadLocal();
        const initState = normalize({ ...legacy, settings: getLocalSettings() });
        await userRef.set({
          materias: toMap(initState.subjects || []),
          horarios: toMap((initState.weekly || []).map(serializeWeekly)),
          eventos: toMap((initState.events || []).map(serializeEvent)),
          colors: fallbackColors(),
          settings: initState.settings || {},
        });
        saveLocal(initState);
        saveMeta(initState);
        initState.source = 'remote';
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
      saveLocal(state);
      saveMeta(state);
      return state;
    } catch (err) {
      const local = loadLocal();
      local.source = 'offline';
      return local;
    }
  }

  function fromMapShaped(v) {
    return fromMap(v)
      .map((c) => ({ id: str(c.id), nombre: str(c.nombre), codigo: str(c.codigo) }))
      .filter((c) => c.codigo);
  }

  // Guarda TODO del usuario de una sola vez (un write al nodo users/{uid}, debounced)
  function save(state) {
    saveLocal(state);
    saveMeta(state);
    if (!refUser()) {
      setStatus('offline');
      return;
    }
    clearTimeout(timer);
    setStatus('pending');
    timer = setTimeout(() => {
      setStatus('pending');
      refUser()
        .update({
          materias: toMap(state.subjects || []),
          horarios: toMap((state.weekly || []).map(serializeWeekly)),
          eventos: toMap((state.events || []).map(serializeEvent)),
          settings: state.settings || {},
        })
        .then(() => setStatus('ok'))
        .catch(() => setStatus('offline'));
    }, 700);
  }

  function uid() {
    // Prefijo 'id' para que la clave nunca sea puramente numérica (RTDB la
    // reinterpretaría como un índice de array y rompería los datos).
    return 'id' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  // ------------------------------------------------ notificaciones push (FCM)

  async function getFcmState() {
    const r = refUser();
    if (!r) return null;
    try {
      const snap = await r.child('fcm').once('value');
      return snap.val() || null;
    } catch (err) {
      return null;
    }
  }

  function saveFcm(state) {
    const r = refUser();
    if (!r) return Promise.reject(new Error('No hay usuario autenticado'));
    return r.child('fcm').set(state || { enabled: false, token: null, updatedAt: Date.now() });
  }

  return {
    start,
    load,
    save,
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