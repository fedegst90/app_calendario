const App = (() => {
  let state = null;
  let started = false;

  function init() {
    if (started) return;
    started = true;
    bindTabs();
    bindAuthButtons();
    Store.onStatus = (kind) => setSyncStatus(kind);
    showLoading(true);
    Store.onAuth = (user) => {
      if (user) {
        updateUserMenu(user);
        Store.load().then((loaded) => {
          state = loaded;
          showLoading(false);
          hideLogin();
          SubjectsView.init(App);
          WeekView.init(App);
          MonthView.init(App);
          SettingsUI.init(App);
          PushManager.init();
          switchTab('subjects');
          setSyncStatus(state && state.source === 'offline' ? 'offline' : 'ok');
        });
      } else {
        hideUserMenu();
        hideLoading();
        showLogin();
      }
    };
    Store.start();
  }

  function bindAuthButtons() {
    const btnLogin = document.getElementById('btn-google-login');
    const errEl = document.getElementById('login-error');
    if (btnLogin) {
      btnLogin.addEventListener('click', () => {
        if (errEl) errEl.classList.add('d-none');
        btnLogin.disabled = true;
        Store.signInWithGoogle()
          .catch((e) => {
            if (errEl) {
              errEl.textContent =
                'No se pudo iniciar sesión. Verificá que Google esté habilitado en Firebase Authentication y que entres con http://localhost (' +
                e.message +
                ')';
              errEl.classList.remove('d-none');
            }
          })
          .finally(() => {
            btnLogin.disabled = false;
          });
      });
    }
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) btnLogout.addEventListener('click', () => Store.signOut().catch(() => {}));
  }

  function bindTabs() {
    document.querySelectorAll('[data-tab]').forEach((btn) => {
      btn.addEventListener('click', () => switchTab(btn.dataset.tab));
    });
  }

  function switchTab(name) {
    document.querySelectorAll('.nav-pills [data-tab]').forEach((b) => {
      b.classList.toggle('active', b.dataset.tab === name);
    });
    document.querySelectorAll('.tab-panel').forEach((p) => {
      p.classList.add('d-none');
    });
    document.getElementById('panel-' + name).classList.remove('d-none');
  }

  function save(sheets) {
    Store.save(state, sheets);
    SubjectsView.render();
    WeekView.render();
    MonthView.render();
    PushManager.schedule();
  }

  function getSubject(id) {
    return state ? state.subjects.find((s) => s.id === id) : undefined;
  }

  function getEventsForDate(iso) {
    return state ? state.events.filter((ev) => ev.dates.includes(iso)) : [];
  }

  function showLoading(on) {
    const el = document.getElementById('loading');
    if (el) el.classList.toggle('d-none', !on);
  }

  function hideLoading() {
    showLoading(false);
  }

  function showLogin() {
    const el = document.getElementById('login-overlay');
    if (el) el.classList.remove('d-none');
  }

  function hideLogin() {
    const el = document.getElementById('login-overlay');
    if (el) el.classList.add('d-none');
  }

  function updateUserMenu(user) {
    const el = document.getElementById('navbar-user');
    const lo = document.getElementById('btn-logout');
    if (el) {
      el.classList.remove('d-none');
      el.textContent = user && user.name ? user.name : user && user.email ? user.email : 'Cuenta';
    }
    if (lo) lo.classList.remove('d-none');
  }

  function hideUserMenu() {
    const el = document.getElementById('navbar-user');
    const lo = document.getElementById('btn-logout');
    if (el) el.classList.add('d-none');
    if (lo) lo.classList.add('d-none');
  }

  function setSyncStatus(kind) {
    const el = document.getElementById('sync-status');
    if (!el) return;
    const map = {
      pending: { icon: 'bi-arrow-repeat spin', text: 'Guardando…', cls: 'text-bg-danger' },
      ok: { icon: 'bi-cloud-check', text: 'Sincronizado', cls: 'text-bg-success' },
      offline: { icon: 'bi-cloud-slash', text: 'Sin conexión', cls: 'text-bg-danger' },
    };
    const cfg = map[kind];
    el.classList.toggle('d-none', !cfg);
    el.classList.remove('text-bg-secondary', 'text-bg-success', 'text-bg-danger');
    if (cfg) {
      el.classList.add(cfg.cls);
      el.innerHTML = '<i class="bi ' + cfg.icon + '"></i><span class="btn-label">' + cfg.text + '</span>';
      el.title = cfg.text;
    } else {
      el.innerHTML = '';
      el.title = '';
    }
  }

  return {
    init,
    switchTab,
    save,
    getSubject,
    getEventsForDate,
    get state() {
      return state;
    },
  };
})();

document.addEventListener('DOMContentLoaded', () => App.init());