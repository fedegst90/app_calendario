const MonthView = (() => {
  const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

  let app;
  let current = new Date();
  const today = new Date();
  const selectedDates = new Set();
  let eventModal = null;

  function init(a) {
    app = a;
    bindEvents();
    render();
  }

  function bindEvents() {
    document.getElementById('month-prev').addEventListener('click', () => {
      current = new Date(current.getFullYear(), current.getMonth() - 1, 1);
      render();
    });

    document.getElementById('month-next').addEventListener('click', () => {
      current = new Date(current.getFullYear(), current.getMonth() + 1, 1);
      render();
    });

    document.getElementById('month-grid').addEventListener('click', (e) => {
      const cell = e.target.closest('[data-date]');
      if (!cell) return;
      const date = cell.dataset.date;
      if (selectedDates.has(date)) selectedDates.delete(date);
      else selectedDates.add(date);
      render();
    });

    document.getElementById('btn-clear-selection').addEventListener('click', () => {
      selectedDates.clear();
      render();
    });

    document.getElementById('btn-new-event').addEventListener('click', () => {
      fillEventModal();
      eventModal = new bootstrap.Modal(document.getElementById('eventModal'));
      eventModal.show();
    });

    document.getElementById('event-save').addEventListener('click', () => {
      const title = document.getElementById('event-title').value.trim();
      const subjectId = document.getElementById('event-subject').value;
      const type = document.getElementById('event-type').value;
      const notify = document.getElementById('event-notify').value || null;
      const notifyDate = notify ? document.getElementById('event-notify-date').value || null : null;

      if (!title) {
        alert('Ingresá un título para el evento.');
        return;
      }
      if (!selectedDates.size) {
        alert('Seleccioná al menos un día en el calendario del mes.');
        return;
      }
      app.state.events.push({
        id: Store.uid(),
        title,
        subjectId: subjectId || null,
        type,
        dates: [...selectedDates].sort(),
        notify,
        notifyDate,
      });
      selectedDates.clear();
      if (notify) PushManager.ensurePermission();
      app.save(['events']);
      eventModal.hide();
      render();
    });

    document.getElementById('month-events').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-del]');
      if (!btn) return;
      if (!confirm('¿Eliminar este evento?')) return;
      app.state.events = app.state.events.filter((ev) => ev.id !== btn.dataset.del);
      app.save(['events']);
    });
  }

  function eventColor(ev) {
    const sub = app.getSubject(ev.subjectId);
    return sub ? sub.color : '#adb5bd';
  }

  function eventSubjectName(ev) {
    const sub = app.getSubject(ev.subjectId);
    return sub ? sub.name : '';
  }

  function fillEventModal() {
    document.getElementById('event-title').value = '';
    document.getElementById('event-type').value = 'evaluacion';
    document.getElementById('event-notify').value = '';
    document.getElementById('event-notify-date').value = [...selectedDates].sort()[0] || '';

    const sel = document.getElementById('event-subject');
    const opts = app.state.subjects
      .map((s) => `<option value="${s.id}">${UI.esc(s.name)}</option>`)
      .join('');
    sel.innerHTML = opts || '<option value="">Sin materia</option>';
    sel.disabled = !app.state.subjects.length;

    const dates = [...selectedDates].sort();
    document.getElementById('event-dates-text').innerHTML = dates.length
      ? `<i class="bi bi-calendar-check me-1"></i><strong>Días:</strong> ${dates
          .map(UI.fmtDate)
          .join(', ')}`
      : '<i class="bi bi-info-circle me-1"></i>No hay días seleccionados. Marcá uno o varios días en el calendario y volvé a abrir este modal.';
  }

  function render() {
    const y = current.getFullYear();
    const m = current.getMonth();

    document.getElementById('month-title').textContent = `${MONTHS[m]} ${y}`;

    const firstDow = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    let html = DAY_NAMES.map((d) => `<div class="month-day-head">${d}</div>`).join('');

    for (let i = 0; i < firstDow; i++) {
      html += '<div class="month-day empty"></div>';
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const iso = UI.toISO(y, m + 1, d);
      const evs = app.getEventsForDate(iso);
      const isToday = y === today.getFullYear() && m === today.getMonth() && d === today.getDate();
      const isSelected = selectedDates.has(iso);
      const classes = [
        'month-day',
        isToday ? 'today' : '',
        isSelected ? 'selected' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const evHtml = evs
        .map(
          (ev) => {
            const subName = eventSubjectName(ev);
            const subLabel = subName ? ` <em class="month-ev-sub">(${UI.esc(subName)})</em>` : '';
            return `<span class="month-ev" style="border-left:3px solid ${eventColor(ev)}">${UI.esc(ev.title)}${subLabel}</span>`;
          }
        )
        .join('');

      html += `<div class="${classes}" data-date="${iso}">
        <span class="month-day-num">${d}</span>
        <div class="d-flex flex-column gap-1">${evHtml}</div>
      </div>`;
    }

    document.getElementById('month-grid').innerHTML = html;

    const info = document.getElementById('selection-info');
    info.textContent = selectedDates.size
      ? `${selectedDates.size} día(s) seleccionado(s)`
      : 'Tocá uno o varios días para seleccionarlos y asignarlos a un evento.';

    document
      .getElementById('btn-clear-selection')
      .classList.toggle('d-none', selectedDates.size === 0);

    renderEventsList(y, m);
  }

  function renderEventsList(y, m) {
    const prefix = `${y}-${UI.pad(m + 1)}`;
    const evs = app.state.events
      .filter((ev) => ev.dates.some((d) => d.startsWith(prefix)))
      .sort((a, b) => a.dates[0].localeCompare(b.dates[0]));

    const box = document.getElementById('month-events');
    if (!evs.length) {
      box.innerHTML = '<div class="text-muted p-3">Sin eventos este mes.</div>';
      return;
    }
    box.innerHTML = evs
      .map(
        (ev) => {
          const subName = eventSubjectName(ev);
          const subLabel = subName ? `<em class="text-secondary">${UI.esc(subName)}</em> · ` : '';
          return `
      <div class="list-group-item d-flex align-items-center gap-2">
        <span class="subject-dot" style="background:${eventColor(ev)}"></span>
        <div class="flex-grow-1">
          <div class="fw-semibold">${UI.esc(ev.title)} <span class="badge text-bg-light border">${UI.esc(TYPE_LABEL[ev.type] || ev.type)}</span></div>
          <small class="text-muted">${subLabel}${ev.dates.map(UI.fmtDate).join(', ')}${ev.notify ? ` · <i class="bi bi-bell-fill"></i> ${UI.fmtDate(ev.notifyDate)} ${UI.esc(ev.notify)}` : ''}</small>
        </div>
        <i class="bi bi-trash text-danger" role="button" data-del="${ev.id}" title="Eliminar"></i>
      </div>`;
        }
      )
      .join('');
  }

  return { init, render };
})();