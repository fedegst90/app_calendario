// Almacenamiento local persistente (IndexedDB) para el modo offline.
// - states:  snapshot del estado completo del usuario (clave: uid)
// - pending: cola de sincronización con los cambios aún no subidos a Firebase
// Si IndexedDB no está disponible, todo degrada a localStorage (ver store.js).
const LocalDB = (() => {
  const DB_NAME = 'mi-calendario-offline';
  const DB_VERSION = 1;
  const STATES = 'states';
  const PENDING = 'pending';

  let dbp = null;

  function available() {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  }

  function open() {
    if (dbp) return dbp;
    dbp = new Promise((resolve, reject) => {
      if (!available()) {
        reject(new Error('IndexedDB no disponible'));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STATES)) {
          db.createObjectStore(STATES, { keyPath: 'uid' });
        }
        if (!db.objectStoreNames.contains(PENDING)) {
          const store = db.createObjectStore(PENDING, { keyPath: 'id', autoIncrement: true });
          store.createIndex('uid', 'uid', { unique: false });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
      req.onblocked = () => reject(new Error('IndexedDB bloqueado'));
    });
    // Si falló (p.ej. modo privado), se reintenta en el próximo uso
    dbp.catch(() => {
      dbp = null;
    });
    return dbp;
  }

  // Ejecuta `executor(store, set)` dentro de una transacción y resuelve con el
  // último valor pasado a `set()` cuando la transacción se completa.
  function run(storeName, mode, executor) {
    return open().then(
      (db) =>
        new Promise((resolve, reject) => {
          let value;
          let t;
          try {
            t = db.transaction(storeName, mode);
            executor(t.objectStore(storeName), (v) => {
              value = v;
            });
          } catch (err) {
            reject(err);
            return;
          }
          t.oncomplete = () => resolve(value);
          t.onerror = () => reject(t.error || new Error('Transacción fallida'));
          t.onabort = () => reject(t.error || new Error('Transacción abortada'));
        })
    );
  }

  // ------------------------------------------------------------ estados

  function saveState(uid, state) {
    return run(STATES, 'readwrite', (store) => {
      store.put({ uid, state, savedAt: Date.now() });
    });
  }

  function getState(uid) {
    return run(STATES, 'readonly', (store, set) => {
      const req = store.get(uid);
      req.onsuccess = () => set(req.result || null);
    });
  }

  function deleteState(uid) {
    return run(STATES, 'readwrite', (store) => {
      store.delete(uid);
    });
  }

  // ------------------------------------------------------------ pendientes

  // Deja UN solo pendiente por usuario (el estado completo es idempotente,
  // así que sobrescribir lo anterior es seguro: gana el último guardado).
  function setPending(uid, state, ts) {
    return run(PENDING, 'readwrite', (store) => {
      const req = store.index('uid').getAllKeys(uid);
      req.onsuccess = () => {
        (req.result || []).forEach((k) => store.delete(k));
        store.put({ uid, state, ts: ts || Date.now() });
      };
    });
  }

  function getPending(uid) {
    return run(PENDING, 'readonly', (store, set) => {
      const req = store.index('uid').getAll(uid);
      req.onsuccess = () => {
        const rows = req.result || [];
        if (!rows.length) {
          set(null);
          return;
        }
        set(rows.slice().sort((a, b) => (a.ts || 0) - (b.ts || 0)).pop());
      };
    });
  }

  function clearPending(uid) {
    return run(PENDING, 'readwrite', (store) => {
      const req = store.index('uid').getAllKeys(uid);
      req.onsuccess = () => {
        (req.result || []).forEach((k) => store.delete(k));
      };
    });
  }

  return { available, open, saveState, getState, deleteState, setPending, getPending, clearPending };
})();
