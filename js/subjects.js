const SubjectsView = (() => {
  let app;
  let selectedColor = '';

  function defaultColor() {
    const colors = app.state.colors || [];
    const used = new Set(app.state.subjects.map((s) => s.color));
    const free = colors.find((c) => c && !used.has(c.codigo));
    const first = free || colors[0];
    return first ? first.codigo : '#0d6efd';
  }

  function init(a) {
    app = a;
    selectedColor = defaultColor();
    bindEvents();
    renderColorMenu();
    render();
  }

  function bindEvents() {
    document.getElementById('subject-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const name = document.getElementById('subject-name').value.trim();
      const detail = document.getElementById('subject-info').value.trim();
      if (!name) return;
      app.state.subjects.push({
        id: Store.uid(),
        name,
        detail,
        color: selectedColor,
      });
      app.save(['subjects']);
      e.target.reset();
      selectedColor = defaultColor();
      renderColorMenu();
    });

    document.getElementById('subject-color-menu').addEventListener('click', (e) => {
      const el = e.target.closest('[data-subject-color]');
      if (!el) return;
      e.preventDefault();
      selectedColor = el.dataset.subjectColor;
      renderColorMenu();
    });

    document.getElementById('subject-list').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-del]');
      if (!btn) return;
      const id = btn.dataset.del;
      if (!confirm('¿Eliminar esta materia y todos sus horarios y eventos?')) return;
      app.state.subjects = app.state.subjects.filter((s) => s.id !== id);
      app.state.weekly = app.state.weekly.filter((w) => w.subjectId !== id);
      app.state.events = app.state.events.filter((ev) => ev.subjectId !== id);
      app.save(['subjects', 'weekly', 'events']);
    });
  }

  function renderColorMenu() {
    const menu = document.getElementById('subject-color-menu');
    if (!menu) return;
    const colors = app.state.colors || [];
    menu.innerHTML = colors.length
      ? colors
          .map(
            (p) =>
              `<li><a class="dropdown-item d-flex align-items-center gap-2${p.codigo === selectedColor ? ' active' : ''}" href="#" data-subject-color="${p.codigo}"><span class="subject-dot" style="background:${p.codigo}"></span>${UI.esc(p.nombre)}</a></li>`
          )
          .join('')
      : '<li><span class="dropdown-item-text text-muted">Sin colores definidos</span></li>';

    const dot = document.getElementById('subject-color-dot');
    const txt = document.getElementById('subject-color-text');
    if (dot) dot.style.background = selectedColor;
    if (txt) txt.textContent = UI.nameOfColor(app.state.colors, selectedColor);
  }

  function render() {
    const list = document.getElementById('subject-list');
    if (!app.state.subjects.length) {
      list.innerHTML =
        '<div class="text-muted p-3">Aún no hay materias. Agregá la primera con el formulario.</div>';
      return;
    }
    list.innerHTML = app.state.subjects
      .map(
        (s) => `
      <div class="list-group-item d-flex align-items-center gap-2">
        <span class="subject-dot" style="background:${s.color}"></span>
        <div class="flex-grow-1">
          <div class="fw-semibold">${UI.esc(s.name)}</div>
          ${s.detail ? `<small class="text-muted">${UI.esc(s.detail)}</small>` : ''}
        </div>
        <i class="bi bi-trash text-danger" role="button" data-del="${s.id}" title="Eliminar"></i>
      </div>`
      )
      .join('');
  }

  return { init, render };
})();