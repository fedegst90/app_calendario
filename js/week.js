const WeekView = (() => {
  const HOUR_START = 6;
  const HOUR_END = 22;
  const HOUR_PX = 56;
  const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const MAX_DESC = 300;

  let app;
  let modal = null;
  let detailModal = null;
  let detailId = null;
  let editingId = null;

  function init(a) {
    app = a;
    buildSelects();
    bindEvents();
    render();
  }

  function buildSelects() {
    const day = document.getElementById('week-day');
    day.innerHTML = DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('');

    const nDay = document.getElementById('week-notify-day');
    nDay.innerHTML = DAYS.map((d, i) => `<option value="${i}">${d}</option>`).join('');

    const start = document.getElementById('week-start');
    let opts = '';
    for (let h = HOUR_START; h < HOUR_END; h++) {
      opts += `<option value="${h}"${h === 8 ? ' selected' : ''}>${UI.pad(h)}:00</option>`;
    }
    start.innerHTML = opts;

    const end = document.getElementById('week-end');
    opts = '';
    for (let h = HOUR_START + 1; h <= HOUR_END; h++) {
      opts += `<option value="${h}"${h === 10 ? ' selected' : ''}>${UI.pad(h)}:00</option>`;
    }
    end.innerHTML = opts;
  }

  function fillSubjectSelect() {
    const sel = document.getElementById('week-subject');
    const opts = app.state.subjects
      .map((s) => `<option value="${s.id}">${UI.esc(s.name)}</option>`)
      .join('');
    sel.innerHTML = opts || '<option value="">Sin materias</option>';
    sel.disabled = !app.state.subjects.length;
  }

  function bindEvents() {
    document.getElementById('week-add').addEventListener('click', () => {
      if (!app.state.subjects.length) {
        UI.alertDialog('Primero agregá una materia en la pestaña Materias.');
        return;
      }
      editingId = null;
      document.getElementById('week-modal-title').textContent = 'Nuevo horario semanal';
      fillSubjectSelect();
      const daySel = document.getElementById('week-day');
      document.getElementById('week-notify-day').value = daySel.value;
      document.getElementById('week-notify').value = '';
      document.getElementById('week-description-edit').value = '';
      updateEditDescCount();
      modal = new bootstrap.Modal(document.getElementById('weekModal'));
      modal.show();
    });

    document.getElementById('week-save').addEventListener('click', () => {
      const subjectId = document.getElementById('week-subject').value;
      const day = +document.getElementById('week-day').value;
      const start = +document.getElementById('week-start').value;
      const end = +document.getElementById('week-end').value;
      const type = document.getElementById('week-type').value;
      const notify = document.getElementById('week-notify').value || null;
      const notifyDay = notify ? +document.getElementById('week-notify-day').value : null;
      const description = document.getElementById('week-description-edit').value.trim().slice(0, MAX_DESC);

      if (!subjectId) {
        UI.alertDialog('Primero agregá una materia en la pestaña Materias.');
        return;
      }
      if (end <= start) {
        UI.alertDialog('La hora de fin debe ser mayor a la de inicio.');
        return;
      }

      if (editingId) {
        const item = app.state.weekly.find((w) => w.id === editingId);
        if (item) {
          item.subjectId = subjectId;
          item.day = day;
          item.start = start;
          item.end = end;
          item.type = type;
          item.notify = notify;
          item.notifyDay = notifyDay;
          item.description = description;
        }
      } else {
        app.state.weekly.push({
          id: Store.uid(),
          subjectId,
          day,
          start,
          end,
          type,
          notify,
          notifyDay,
          description,
        });
      }
      if (notify) PushManager.ensurePermission();
      app.save(['weekly']);
      UI.toast('Horario guardado', 'success');
      if (modal) modal.hide();
      render();
    });

    document.getElementById('weekModal').addEventListener('hidden.bs.modal', () => {
      editingId = null;
    });

    document.getElementById('week-grid').addEventListener('click', (e) => {
      const el = e.target.closest('[data-wid]');
      if (!el) return;
      openDetail(el.dataset.wid);
    });

    document.getElementById('week-detail-delete').addEventListener('click', () => {
      if (!detailId) return;
      const id = detailId;
      const item = app.state.weekly.find((w) => w.id === id);
      const sub = item ? app.getSubject(item.subjectId) : null;
      UI.confirmDelete({
        title: 'Eliminar horario',
        text: `¿Eliminar el horario de ${UI.esc(sub ? sub.name : '')} el día ${DAYS[item && item.day] != null ? DAYS[item.day] : ''}?`,
        onConfirm: () => {
          app.state.weekly = app.state.weekly.filter((w) => w.id !== id);
          detailId = null;
          app.save(['weekly']);
          UI.toast('Horario eliminado', 'success');
        },
      });
    });
    document.getElementById('week-detail-edit').addEventListener('click', () => {
      if (!detailId) return;
      const id = detailId;
      if (detailModal) detailModal.hide();
      detailId = null;
      startEdit(id);
    });

    document.getElementById('week-description-edit').addEventListener('input', updateEditDescCount);
  }

  function updateEditDescCount() {
    const ta = document.getElementById('week-description-edit');
    const c = document.getElementById('week-description-edit-count');
    if (ta && c) c.textContent = ta.value.length;
  }

  function openDetail(id) {
    const item = app.state.weekly.find((w) => w.id === id);
    if (!item) return;
    detailId = id;

    const sub = app.getSubject(item.subjectId);
    const info = document.getElementById('week-detail-info');
    info.innerHTML = `
      <div class="d-flex align-items-center gap-2 mb-2">
        <span class="subject-dot" style="background:${sub ? sub.color : '#adb5bd'}"></span>
        <strong>${UI.esc(sub ? sub.name : 'Sin materia')}</strong>
      </div>
      <ul class="list-unstyled mb-0">
        <li><i class="bi bi-calendar-week me-1"></i>Día: ${DAYS[item.day]}</li>
        <li><i class="bi bi-clock me-1"></i>Horario: ${UI.pad(item.start)}:00 - ${UI.pad(item.end)}:00</li>
        <li><i class="bi bi-tag me-1"></i>Tipo: ${TYPE_LABEL[item.type] || item.type}</li>
        ${item.notify ? `<li><i class="bi bi-bell me-1"></i>Recordatorio: ${item.notifyDay != null ? DAYS[item.notifyDay] : DAYS[item.day]} ${UI.esc(item.notify)}</li>` : ''}
      </ul>`;

    document.getElementById('week-description').value = item.description || '';
    detailModal = new bootstrap.Modal(document.getElementById('weekDetailModal'));
    detailModal.show();
  }

  function startEdit(id) {
    const item = app.state.weekly.find((w) => w.id === id);
    if (!item) return;
    editingId = id;
    document.getElementById('week-modal-title').textContent = 'Editar horario';
    fillSubjectSelect();
    document.getElementById('week-subject').value = item.subjectId;
    document.getElementById('week-day').value = String(item.day);
    document.getElementById('week-start').value = String(item.start);
    document.getElementById('week-end').value = String(item.end);
    document.getElementById('week-type').value = item.type;
    document.getElementById('week-notify').value = item.notify || '';
    document.getElementById('week-notify-day').value = item.notifyDay != null ? String(item.notifyDay) : String(item.day);
    document.getElementById('week-description-edit').value = item.description || '';
    updateEditDescCount();
    modal = new bootstrap.Modal(document.getElementById('weekModal'));
    modal.show();
  }

  // Asigna a cada bloque una columna para que los que coinciden en hora
  // compartan la franja lado a lado (al estilo del Mes).
  function layoutDay(items) {
    const sorted = [...items].sort((a, b) => a.start - b.start || b.end - a.end);
    const result = [];
    let i = 0;

    while (i < sorted.length) {
      const cluster = [];
      let clusterEnd = -1;
      let j = i;

      while (j < sorted.length) {
        const it = sorted[j];
        if (cluster.length && it.start >= clusterEnd) break;
        cluster.push(it);
        clusterEnd = Math.max(clusterEnd, it.end);
        j++;
      }

      const colEnds = [];
      cluster.forEach((it) => {
        let col = 0;
        while (col < colEnds.length && colEnds[col] > it.start) col++;
        colEnds[col] = it.end;
        it._col = col;
      });
      const total = cluster.reduce((m, it) => Math.max(m, it._col + 1), 0);
      cluster.forEach((it) => {
        it._total = total;
        result.push(it);
      });

      i = j;
    }
    return result;
  }

  function renderBlocks(day) {
    const items = app.state.weekly.filter((w) => w.day === day);
    if (!items.length) return '';

    return layoutDay(items)
      .map((w) => {
        const sub = app.getSubject(w.subjectId);
        const color = sub ? sub.color : '#adb5bd';
        const name = sub ? sub.name : 'Sin materia';
        const top = (w.start - HOUR_START) * HOUR_PX;
        const height = (w.end - w.start) * HOUR_PX;
        const pct = 100 / w._total;
        const left = w._col * pct;
        return `
        <div class="wk-block" data-wid="${w.id}"
             style="top:${top}px;height:${height}px;left:calc(${left}% + 2px);width:calc(${pct}% - 4px);background:${color};color:${UI.contrast(color)}">
          <div class="wk-block-title">${UI.esc(name)}</div>
          <div class="wk-block-type">${TYPE_LABEL[w.type] || w.type} · ${UI.pad(w.start)}:00-${UI.pad(w.end)}:00</div>
          ${w.description ? `<div class="wk-block-desc" title="${UI.esc(w.description)}">${UI.esc(w.description)}</div>` : ''}
          ${w.notify ? `<div class="wk-block-notify"><i class="bi bi-bell-fill"></i> ${DAYS[w.notifyDay] || DAYS[w.day]} ${UI.esc(w.notify)}</div>` : ''}
        </div>`;
      })
      .join('');
  }

  function render() {
    fillSubjectSelect();

    const numRows = HOUR_END - HOUR_START + 1;
    const grid = document.getElementById('week-grid');
    grid.style.setProperty('--numrows', numRows);
    grid.innerHTML = `<div class="wk-corner" style="grid-row:1;grid-column:1"></div>`;

    DAYS.forEach((d, i) => {
      grid.innerHTML += `<div class="wk-header" style="grid-row:1;grid-column:${i + 2}">${d}</div>`;
    });

    for (let h = 0; h < numRows; h++) {
      const hour = HOUR_START + h;
      grid.innerHTML += `<div class="wk-time" style="grid-row:${h + 2};grid-column:1">${UI.pad(hour)}:00</div>`;
    }

    DAYS.forEach((d, i) => {
      grid.innerHTML += `<div class="wk-day" data-day="${i}" style="grid-row:2/${numRows + 2};grid-column:${i + 2}">${renderBlocks(i)}</div>`;
    });
  }

  return { init, render };
})();