const SubjectsView = (() => {
  let app;
  let selectedColor = '';
  let editingId = null;
  let deleteModal = null;
  let pendingDeleteId = null;

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

      if (editingId) {
        const sub = app.state.subjects.find((s) => s.id === editingId);
        if (sub) {
          sub.name = name;
          sub.detail = detail;
          sub.color = selectedColor;
        }
        cancelEdit();
      } else {
        app.state.subjects.push({
          id: Store.uid(),
          name,
          detail,
          color: selectedColor,
        });
      }
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
      const delBtn = e.target.closest('[data-del]');
      if (delBtn) {
        openDeleteModal(delBtn.dataset.del);
        return;
      }

      const editBtn = e.target.closest('[data-edit]');
      if (editBtn) startEdit(editBtn.dataset.edit);
    });

    document.getElementById('subject-delete-confirm').addEventListener('click', confirmDelete);

    document.getElementById('subject-cancel').addEventListener('click', () => {
      cancelEdit();
      document.getElementById('subject-form').reset();
      document.getElementById('subject-info').value = '';
      selectedColor = defaultColor();
      renderColorMenu();
    });
  }

  function openDeleteModal(id) {
    pendingDeleteId = id;
    const sub = app.state.subjects.find((s) => s.id === id);
    document.getElementById('subject-delete-name').textContent = sub ? sub.name : '';
    deleteModal = new bootstrap.Modal(document.getElementById('subjectDeleteModal'));
    deleteModal.show();
  }

  function confirmDelete() {
    if (!pendingDeleteId) return;
    const id = pendingDeleteId;
    pendingDeleteId = null;
    app.state.subjects = app.state.subjects.filter((s) => s.id !== id);
    app.state.weekly = app.state.weekly.filter((w) => w.subjectId !== id);
    app.state.events = app.state.events.filter((ev) => ev.subjectId !== id);
    app.save(['subjects', 'weekly', 'events']);
    if (editingId === id) cancelEdit();
    if (deleteModal) deleteModal.hide();
  }

  function startEdit(id) {
    const sub = app.state.subjects.find((s) => s.id === id);
    if (!sub) return;
    editingId = id;
    document.getElementById('subject-name').value = sub.name;
    document.getElementById('subject-info').value = sub.detail;
    selectedColor = sub.color;
    renderColorMenu();
    applyEditMode();
    document.getElementById('subject-name').focus();
  }

  function cancelEdit() {
    editingId = null;
    applyEditMode();
  }

  function applyEditMode() {
    const editing = !!editingId;
    document.getElementById('subject-form-title').textContent = editing
      ? 'Editar materia'
      : 'Nueva materia';
    document.getElementById('subject-submit').textContent = editing
      ? 'Guardar cambios'
      : 'Guardar materia';
    document.getElementById('subject-cancel').classList.toggle('d-none', !editing);
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
      <div class="list-group-item d-flex align-items-center gap-2${editingId === s.id ? ' list-group-item-primary' : ''}">
        <span class="subject-dot" style="background:${s.color}"></span>
        <div class="flex-grow-1">
          <div class="fw-semibold">${UI.esc(s.name)}</div>
          ${s.detail ? `<small class="text-muted">${UI.esc(s.detail)}</small>` : ''}
        </div>
        <i class="bi bi-pencil text-secondary" role="button" data-edit="${s.id}" title="Editar"></i>
        <i class="bi bi-trash text-danger" role="button" data-del="${s.id}" title="Eliminar"></i>
      </div>`
      )
      .join('');
  }

  return { init, render };
})();