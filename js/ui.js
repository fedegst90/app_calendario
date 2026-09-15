const UI = {
  // Último handler de confirmación activo del modal genérico de borrado
  _confirmHandler: null,

  esc(value) {
    const div = document.createElement('div');
    div.textContent = value == null ? '' : String(value);
    return div.innerHTML;
  },

  fmtDate(iso) {
    const [y, m, d] = iso.split('-');
    return `${d}/${m}/${y}`;
  },

  pad(n) {
    return String(n).padStart(2, '0');
  },

  toISO(y, m, d) {
    return `${y}-${this.pad(m)}-${this.pad(d)}`;
  },

  contrast(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    const yiq = (r * 299 + g * 587 + b * 114) / 1000;
    return yiq >= 150 ? '#212529' : '#fff';
  },

  hexToRgb(hex) {
    const c = hex.replace('#', '');
    const r = parseInt(c.substr(0, 2), 16);
    const g = parseInt(c.substr(2, 2), 16);
    const b = parseInt(c.substr(4, 2), 16);
    return `${r}, ${g}, ${b}`;
  },

  nameOfColor(palette, hex) {
    const p = (palette || []).find(
      (c) => c && c.codigo && c.codigo.toLowerCase() === String(hex || '').toLowerCase()
    );
    return p ? p.nombre : String(hex || '');
  },

  // Toast no bloqueante. kind: success | danger | warning | info.
  toast(message, kind) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const kindMap = {
      success: { cls: 'text-bg-success', icon: 'bi-check-circle' },
      danger: { cls: 'text-bg-danger', icon: 'bi-x-circle' },
      warning: { cls: 'text-bg-warning', icon: 'bi-exclamation-triangle' },
      info: { cls: 'text-bg-info', icon: 'bi-info-circle' },
    };
    const cfg = kindMap[kind] || kindMap.info;

    const t = document.createElement('div');
    t.className = 'toast align-items-center ' + cfg.cls + ' border-0';
    t.setAttribute('role', 'alert');
    t.setAttribute('aria-live', 'assertive');
    t.setAttribute('aria-atomic', 'true');

    const body = document.createElement('div');
    body.className = 'toast-body';
    const ic = document.createElement('i');
    ic.className = 'bi ' + cfg.icon + ' me-1';
    body.appendChild(ic);
    body.appendChild(document.createTextNode(message || ''));

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-close btn-close-white me-2 m-auto';
    btn.setAttribute('data-bs-dismiss', 'toast');
    btn.setAttribute('aria-label', 'Cerrar');

    const d = document.createElement('div');
    d.className = 'd-flex';
    d.appendChild(body);
    d.appendChild(btn);
    t.appendChild(d);

    container.appendChild(t);
    const inst = new bootstrap.Toast(t, { delay: 3500 });
    inst.show();
    t.addEventListener('hidden.bs.toast', () => t.remove());
  },

  // Diálogo de aviso no bloqueante (reemplaza a alert()).
  // opts: { text, title } o pasá text y title directamente.
  alertDialog(text, title) {
    const modalEl = document.getElementById('alertModal');
    const titleEl = document.getElementById('alert-modal-title');
    const textEl = document.getElementById('alert-modal-text');
    if (!modalEl) {
      console.warn('alertDialog: no se encontró el modal de avisos.');
      return;
    }
    if (titleEl) titleEl.textContent = title || 'Aviso';
    if (textEl) textEl.textContent = text || '';
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  },

  // Modal genérico de confirmación de borrado.
  // opts: { title, text, onConfirm }
  confirmDelete(opts) {
    const modalEl = document.getElementById('confirmDeleteModal');
    const titleEl = document.getElementById('confirm-delete-title');
    const textEl = document.getElementById('confirm-delete-text');
    const ok = document.getElementById('confirm-delete-ok');
    const onConfirm = opts && typeof opts.onConfirm === 'function' ? opts.onConfirm : null;

    if (!modalEl) {
      if (onConfirm) onConfirm();
      return;
    }

    if (titleEl) titleEl.textContent = (opts && opts.title) || 'Eliminar';
    if (textEl) textEl.textContent = (opts && opts.text) || '¿Eliminar este elemento?';

    if (ok) {
      if (UI._confirmHandler) ok.removeEventListener('click', UI._confirmHandler);
      UI._confirmHandler = () => {
        const m = bootstrap.Modal.getInstance(modalEl);
        if (m) m.hide();
        if (onConfirm) onConfirm();
      };
      ok.addEventListener('click', UI._confirmHandler);
    }

    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  },

  shade(hex, pct) {
    const c = hex.replace('#', '');
    const n = parseInt(c, 16);
    let r = (n >> 16) & 255;
    let g = (n >> 8) & 255;
    let b = n & 255;
    if (pct < 0) {
      const f = 1 + pct / 100;
      r *= f;
      g *= f;
      b *= f;
    } else {
      const f = pct / 100;
      r += (255 - r) * f;
      g += (255 - g) * f;
      b += (255 - b) * f;
    }
    return (
      '#' +
      ((1 << 24) + (Math.round(r) << 16) + (Math.round(g) << 8) + Math.round(b))
        .toString(16)
        .slice(1)
    );
  },
};

const PALETTES = [
  { id: 'rojo', nombre: 'Rojo', codigo: '#e74c3c' },
  { id: 'naranja', nombre: 'Naranja', codigo: '#f39c12' },
  { id: 'amarillo', nombre: 'Amarillo', codigo: '#f1c40f' },
  { id: 'verde', nombre: 'Verde', codigo: '#27ae60' },
  { id: 'turquesa', nombre: 'Turquesa', codigo: '#1abc9c' },
  { id: 'cian', nombre: 'Cian', codigo: '#3498db' },
  { id: 'azul', nombre: 'Azul', codigo: '#0d6efd' },
  { id: 'violeta', nombre: 'Violeta', codigo: '#6f42c1' },
  { id: 'rosa', nombre: 'Rosa', codigo: '#e84393' },
  { id: 'noche', nombre: 'Noche', codigo: '#343a40' },
  { id: 'gris', nombre: 'Gris', codigo: '#6c757d' },
  { id: 'marron', nombre: 'Marrón', codigo: '#a0522d' },
];

const TYPE_LABEL = {
  clase: 'Clase',
  consulta: 'Consulta',
  evaluacion: 'Evaluación',
  entrega: 'Entrega',
  evento: 'Evento',
};