/* SBSC Dashboard — shared UI helpers */
window.SB = window.SB || {};

(function (SB) {
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const ICONS = {
    home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    library: '<path d="M4 4h4v16H4zM10 4h4v16h-4zM16.5 4.5l3.8 1-3.9 15-3.8-1z"/>',
    builder: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    jump: '<path d="M3 20h18"/><path d="M6 16l4-8 4 5 4-9"/><circle cx="18" cy="4" r="1.2"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.9.7 3.1 2.4 3.5 5.2"/>',
    card: '<rect x="2.5" y="5" width="19" height="14" rx="2"/><path d="M2.5 10h19M6 15h4"/>',
    calendar: '<rect x="3" y="4.5" width="18" height="16" rx="2"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    download: '<path d="M12 4v12M7 11l5 5 5-5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/>',
    print: '<path d="M6 9V3h12v6"/><rect x="3" y="9" width="18" height="8" rx="1.5"/><path d="M6 14h12v7H6z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
    edit: '<path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4z"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    left: '<path d="M15 5l-7 7 7 7"/>',
    right: '<path d="M9 5l7 7-7 7"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1-4.4 4.2-6.5 8-6.5s7 2.1 8 6.5"/>'
  };
  const icon = (name, extra = '') =>
    `<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${ICONS[name] || ''}</svg>`;

  // ---------- Dates ----------
  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const toISO = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseISO = s => { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (iso, n) => { const d = parseISO(iso); d.setDate(d.getDate() + n); return toISO(d); };
  const daysBetween = (a, b) => Math.round((parseISO(b) - parseISO(a)) / 86400000);
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDate = (iso, opts = {}) => {
    if (!iso) return '—';
    const d = parseISO(iso); if (!d || isNaN(d)) return iso;
    const base = `${MONTHS[d.getMonth()]} ${d.getDate()}`;
    return opts.noYear ? base : `${base}, ${d.getFullYear()}`;
  };
  const fmtTime = t => {
    if (!t) return '';
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'pm' : 'am';
    const hh = ((h + 11) % 12) + 1;
    return m ? `${hh}:${pad(m)}${ap}` : `${hh}${ap}`;
  };
  const fmtNum = (v, d = 1) => (v == null || isNaN(v)) ? '—' : Number(v).toLocaleString(undefined, { minimumFractionDigits: d, maximumFractionDigits: d });
  const money = v => (v == null || isNaN(v)) ? '—' : '$' + Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 });

  // ---------- Toasts ----------
  function toast(msg, kind = '') {
    const el = document.createElement('div');
    el.className = 'toast ' + kind;
    el.textContent = msg;
    document.getElementById('toasts').appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; }, 2600);
    setTimeout(() => el.remove(), 3000);
  }

  // ---------- Modal ----------
  function modal({ title, body, foot = '', wide = false, onMount }) {
    closeModal();
    const wrap = document.createElement('div');
    wrap.className = 'modal-backdrop';
    wrap.id = 'modal';
    wrap.innerHTML = `
      <div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true">
        <div class="modal-head"><h3>${esc(title)}</h3><button data-close aria-label="Close">&times;</button></div>
        <div class="modal-body">${body}</div>
        ${foot ? `<div class="modal-foot">${foot}</div>` : ''}
      </div>`;
    wrap.addEventListener('mousedown', e => { if (e.target === wrap) closeModal(); });
    wrap.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeModal));
    document.body.appendChild(wrap);
    const first = wrap.querySelector('input, select, textarea');
    if (first) setTimeout(() => first.focus(), 30);
    if (onMount) onMount(wrap);
    return wrap;
  }
  function closeModal() { const m = document.getElementById('modal'); if (m) m.remove(); }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  function confirmBox(message, { title = 'Are you sure?', okText = 'Delete', danger = true } = {}) {
    return new Promise(resolve => {
      const m = modal({
        title,
        body: `<p style="margin:0">${esc(message)}</p>`,
        foot: `<button class="btn" data-close>Cancel</button><button class="btn ${danger ? 'dark' : 'primary'}" id="cf-ok">${esc(okText)}</button>`
      });
      m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => resolve(false)));
      m.querySelector('#cf-ok').addEventListener('click', () => { closeModal(); resolve(true); });
    });
  }

  // ---------- Forms ----------
  function formData(root) {
    const out = {};
    root.querySelectorAll('[name]').forEach(el => {
      if (el.type === 'checkbox') out[el.name] = el.checked;
      else if (el.type === 'number') out[el.name] = el.value === '' ? null : Number(el.value);
      else out[el.name] = el.value.trim();
    });
    return out;
  }
  const field = (label, inner, cls = '') => `<label class="field ${cls}"><span>${esc(label)}</span>${inner}</label>`;
  const input = (name, value = '', attrs = '') => `<input class="input" name="${name}" value="${esc(value)}" ${attrs}>`;
  const select = (name, options, value = '', attrs = '') =>
    `<select class="input" name="${name}" ${attrs}>${options.map(o => {
      const [v, l] = Array.isArray(o) ? o : [o, o];
      return `<option value="${esc(v)}" ${String(v) === String(value) ? 'selected' : ''}>${esc(l)}</option>`;
    }).join('')}</select>`;

  // ---------- Files ----------
  function download(filename, text, type = 'application/json') {
    const blob = new Blob([text], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function pickFile(accept, multiple = false) {
    return new Promise(resolve => {
      const inp = document.createElement('input');
      inp.type = 'file'; inp.accept = accept; inp.multiple = multiple;
      inp.onchange = () => resolve([...inp.files]);
      inp.click();
    });
  }
  const readText = file => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(file); });

  // ---------- CSV ----------
  function parseCSV(text) {
    text = text.replace(/^﻿/, '');
    // Detect delimiter from first non-empty line
    const firstLine = text.split(/\r?\n/).find(l => l.trim()) || '';
    const delim = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';'
      : (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
    const rows = []; let row = []; let cell = ''; let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
        else cell += ch;
      } else if (ch === '"') q = true;
      else if (ch === delim) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(c => String(c).trim() !== ''));
  }
  const toCSV = rows => rows.map(r => r.map(c => {
    const s = c == null ? '' : String(c);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(',')).join('\n');

  // ---------- Charts ----------
  const charts = [];
  function chart(canvas, config) {
    if (!window.Chart) return null;
    const c = new Chart(canvas, config);
    charts.push(c);
    return c;
  }
  function destroyCharts() { while (charts.length) { try { charts.pop().destroy(); } catch (e) { } } }
  if (window.Chart) {
    Chart.defaults.font.family = "'Barlow', system-ui, sans-serif";
    Chart.defaults.font.size = 12.5;
    Chart.defaults.color = '#6B6560';
    Chart.defaults.borderColor = '#EFEBE5';
    Chart.defaults.plugins.legend.labels.boxWidth = 12;
    Chart.defaults.plugins.tooltip.backgroundColor = '#141414';
    Chart.defaults.plugins.tooltip.titleFont = { family: "'Oswald'", weight: '600' };
    Chart.defaults.maintainAspectRatio = false;
  }
  // Brand-led categorical palette (orange first, then neutrals and supporting hues)
  const PALETTE = ['#FF5A1F', '#141414', '#2F7EBF', '#1F8A4C', '#B7791F', '#8E44AD', '#C0392B', '#6B6560', '#16A2A2', '#D35496'];

  // ---------- Page chrome ----------
  function pageHead({ kicker, title, sub = '', actions = '' }) {
    return `<section class="page-head">
      <div class="kicker">${esc(kicker)}</div>
      <h1>${esc(title)}</h1>
      ${sub ? `<p>${sub}</p>` : ''}
      ${actions ? `<div class="head-actions">${actions}</div>` : ''}
    </section>`;
  }
  const empty = (title, msg = '', action = '') => `<div class="empty"><strong>${esc(title)}</strong>${msg}${action ? `<div class="mt">${action}</div>` : ''}</div>`;

  // Sortable table helper: rows = array of objects, cols = [{key,label,num,render,sort}]
  function sortableTable(container, { cols, rows, onRow, initialSort, emptyHtml = '' }) {
    let sortKey = initialSort ? initialSort.key : null;
    let dir = initialSort ? initialSort.dir : 1;
    function draw() {
      const data = rows.slice();
      if (sortKey) {
        const col = cols.find(c => c.key === sortKey);
        const val = col.sort || (r => r[sortKey]);
        data.sort((a, b) => {
          const x = val(a), y = val(b);
          if (x == null && y == null) return 0; if (x == null) return 1; if (y == null) return -1;
          return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir;
        });
      }
      container.innerHTML = !data.length ? (emptyHtml || empty('Nothing here yet')) : `
        <div class="table-wrap"><table class="data">
          <thead><tr>${cols.map(c => `<th class="sortable ${c.num ? 'num' : ''}" data-k="${c.key}">${esc(c.label)}${sortKey === c.key ? (dir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('')}</tr></thead>
          <tbody>${data.map((r, i) => `<tr class="${onRow ? 'clickable' : ''}" data-i="${i}">${cols.map(c => `<td class="${c.num ? 'num' : ''}">${c.render ? c.render(r) : esc(r[c.key])}</td>`).join('')}</tr>`).join('')}</tbody>
        </table></div>`;
      container.querySelectorAll('th[data-k]').forEach(th => th.addEventListener('click', () => {
        const k = th.dataset.k; if (sortKey === k) dir = -dir; else { sortKey = k; dir = 1; } draw();
      }));
      if (onRow) container.querySelectorAll('tbody tr').forEach(tr => tr.addEventListener('click', e => {
        if (e.target.closest('button, a, input, select')) return;
        onRow(data[+tr.dataset.i]);
      }));
    }
    draw();
  }

  SB.ui = {
    esc, icon, toast, modal, closeModal, confirm: confirmBox, formData, field, input, select,
    download, pickFile, readText, parseCSV, toCSV, chart, destroyCharts, PALETTE, pageHead, empty, sortableTable,
    todayISO, toISO, parseISO, addDays, daysBetween, fmtDate, fmtTime, fmtNum, money, MONTHS
  };
})(window.SB);
