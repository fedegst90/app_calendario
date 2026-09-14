const SettingsUI = (() => {
  const themeMedia = window.matchMedia('(prefers-color-scheme: dark)');
  let app;

  function init(a) {
    app = a;
    buildMenus();
    bindEvents();
    applyTheme();
    applyThemeColor(app.state.settings.themeColor || '#0d6efd');
    renderMarks();
    themeMedia.addEventListener('change', applyTheme);
  }

  function buildMenus() {
    document.getElementById('theme-menu').innerHTML = [
      ['auto', 'Automático'],
      ['light', 'Claro'],
      ['dark', 'Oscuro'],
    ]
      .map(
        ([v, label]) =>
          `<li><a class="dropdown-item" href="#" data-theme="${v}">${label}</a></li>`
      )
      .join('');

    renderColorMenu();
  }

  function renderColorMenu() {
    const menu = document.getElementById('color-menu');
    const colors = app.state.colors || [];
    menu.innerHTML = colors.length
      ? colors
          .map(
            (p) =>
              `<li><a class="dropdown-item d-flex align-items-center gap-2" href="#" data-app-color="${p.codigo}"><span class="subject-dot" style="background:${p.codigo}"></span>${UI.esc(p.nombre)}</a></li>`
          )
          .join('')
      : '<li><span class="dropdown-item-text text-muted">Sin colores definidos</span></li>';
  }

  function bindEvents() {
    document.getElementById('theme-menu').addEventListener('click', (e) => {
      const a = e.target.closest('[data-theme]');
      if (!a) return;
      e.preventDefault();
      app.state.settings.theme = a.dataset.theme;
      app.save([]);
      applyTheme();
      renderMarks();
    });

    document.getElementById('color-menu').addEventListener('click', (e) => {
      const a = e.target.closest('[data-app-color]');
      if (!a) return;
      e.preventDefault();
      app.state.settings.themeColor = a.dataset.appColor;
      app.save([]);
      applyThemeColor(a.dataset.appColor);
      renderMarks();
    });
  }

  function currentTheme() {
    const t = app.state.settings.theme;
    if (t === 'auto') return themeMedia.matches ? 'dark' : 'light';
    return t;
  }

  function applyTheme() {
    document.documentElement.setAttribute('data-bs-theme', currentTheme());
  }

  function applyThemeColor(hex) {
    const root = document.documentElement.style;
    root.setProperty('--bs-primary', hex);
    root.setProperty('--bs-primary-rgb', UI.hexToRgb(hex));
    root.setProperty('--calendar-active', hex);
    root.setProperty('--calendar-active-rgb', UI.hexToRgb(hex));
    root.setProperty('--calendar-active-dark', UI.shade(hex, -18));
  }

  function renderMarks() {
    document.querySelectorAll('#theme-menu [data-theme]').forEach((el) => {
      el.classList.toggle('active', el.dataset.theme === app.state.settings.theme);
    });
    document.querySelectorAll('#color-menu [data-app-color]').forEach((el) => {
      el.classList.toggle('active', el.dataset.appColor === app.state.settings.themeColor);
    });
  }

  return { init, applyTheme, applyThemeColor, renderColorMenu };
})();