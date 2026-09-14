const UI = {
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