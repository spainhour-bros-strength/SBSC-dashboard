/* ForceDecks — import VALD ForceDecks CSV exports, every metric, trends, quadrant, readiness */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead, empty, modal, closeModal, toast, fmtDate, fmtNum, select, chart, PALETTE, todayISO } = SB.ui;

  /* ================= Metric knowledge ================= */
  const KEY_METRICS = [
    { id: 'jh', label: 'Jump Height (Imp-Mom)', re: [/^jump height \(imp-mom\)/i, /^jump height/i], dp: 1 },
    { id: 'rsi', label: 'RSI-modified', re: [/^rsi-modified \[/i, /^rsi-?mod/i, /rsi.?modified/i], dp: 2 },
    { id: 'ppbm', label: 'Peak Power / BM', re: [/^peak power \/ bm/i, /peak power.*bm/i], dp: 1 },
    { id: 'pp', label: 'Peak Power', re: [/^peak power \[w\]/i], dp: 0 },
    { id: 'cpf', label: 'Concentric Peak Force', re: [/^concentric peak force \[n\]/i], dp: 0 },
    { id: 'cpfbm', label: 'Conc. Peak Force / BM', re: [/^concentric peak force \/ bm/i], dp: 1 },
    { id: 'ebrfd', label: 'Eccentric Braking RFD', re: [/^eccentric braking rfd \[/i], dp: 0 },
    { id: 'cmd', label: 'Countermovement Depth', re: [/^countermovement depth/i], dp: 1 },
    { id: 'ct', label: 'Contraction Time', re: [/^contraction time/i], dp: 0 },
    { id: 'ftct', label: 'Flight Time : Contraction Time', re: [/^flight time ?: ?contraction time/i], dp: 2 }
  ];
  const META_COLS = [/^name$/i, /^athlete/i, /^externalid$/i, /^external id$/i, /^test ?type$/i, /^date$/i, /^test date$/i, /^time$/i,
    /^bw \[kg\]$/i, /^body ?weight/i, /^reps$/i, /^tags$/i, /^additional load/i, /^trial/i, /^test id$/i, /^group/i, /^sport/i, /^position/i];

  function findCol(names, key) {
    for (const re of key.re) { const n = names.find(x => re.test(x)); if (n) return n; }
    return null;
  }
  const unitOf = name => { const m = String(name).match(/\[([^\]]+)\]\s*$/) || String(name).match(/\((%)\)\s*$/); return m ? m[1] : ''; };
  const shortName = name => String(name).replace(/\s*\[[^\]]+\]\s*$/, '').replace(/\s*\(%\)\s*$/, '');
  function direction(name) {
    if (/asym/i.test(name)) return -1;
    if (/duration|contraction time|time to|movement time/i.test(name)) return -1;
    if (/depth|landing/i.test(name)) return 0;
    return 1;
  }
  const decimals = (name, v) => { const k = KEY_METRICS.find(k => findCol([name], k)); if (k) return k.dp; const a = Math.abs(v); return a >= 100 ? 0 : a >= 10 ? 1 : 2; };
  const fmtMetric = (name, v) => v == null || isNaN(v) ? '—' : fmtNum(v, decimals(name, v));

  /* ================= Data access ================= */
  function allMetricNames() {
    const set = new Set();
    SB.store.all('tests').forEach(t => Object.keys(t.metrics || {}).forEach(k => set.add(k)));
    const names = [...set];
    // key metrics first, then alphabetical
    const keyCols = KEY_METRICS.map(k => findCol(names, k)).filter(Boolean);
    return [...new Set([...keyCols, ...names.filter(n => !keyCols.includes(n)).sort()])];
  }
  const keyCol = (id, names = allMetricNames()) => findCol(names, KEY_METRICS.find(k => k.id === id));

  // Average all trials/tests on the same day into one "session"
  function sessionsFor(clientId) {
    const byDate = {};
    SB.store.testsFor(clientId).forEach(t => { (byDate[t.date] = byDate[t.date] || []).push(t); });
    return Object.keys(byDate).sort().map(date => {
      const ts = byDate[date];
      const metrics = {};
      const keys = new Set(); ts.forEach(t => Object.keys(t.metrics).forEach(k => keys.add(k)));
      keys.forEach(k => {
        const vals = ts.map(t => t.metrics[k]).filter(v => v != null && !isNaN(v));
        if (vals.length) metrics[k] = vals.reduce((a, b) => a + b, 0) / vals.length;
      });
      const bws = ts.map(t => t.bw).filter(v => v != null && !isNaN(v));
      return { date, tests: ts, n: ts.length, bw: bws.length ? bws.reduce((a, b) => a + b, 0) / bws.length : null, metrics, testType: ts[0].testType };
    });
  }

  function readiness(sessions, names = allMetricNames()) {
    const col = keyCol('rsi', names) || keyCol('jh', names);
    if (!col || !sessions.length) return null;
    const latest = sessions[sessions.length - 1];
    const value = latest.metrics[col];
    const prior = sessions.slice(0, -1).slice(-6).map(s => s.metrics[col]).filter(v => v != null);
    if (value == null) return null;
    if (prior.length < 2) return { level: 'none', label: 'Building baseline', value, baseline: null, pct: null, metric: col, needed: 2 - prior.length };
    const baseline = prior.reduce((a, b) => a + b, 0) / prior.length;
    const pct = (value - baseline) / baseline * 100;
    const level = pct >= -5 ? 'good' : pct >= -10 ? 'warn' : 'bad';
    return { level, label: level === 'good' ? 'Ready' : level === 'warn' ? 'Monitor' : 'Fatigued', value, baseline, pct, metric: col };
  }
  function readinessBadge(r) {
    if (!r) return '<span class="badge">No data</span>';
    if (r.level === 'none') return `<span class="badge">Baseline (${r.needed} more)</span>`;
    const cls = r.level === 'good' ? 'good' : r.level === 'warn' ? 'warn' : 'bad';
    return `<span class="badge ${cls}"><span class="dot"></span>${r.label} ${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%</span>`;
  }
  function latestReadiness() {
    const names = allMetricNames();
    const ids = [...new Set(SB.store.all('tests').map(t => t.clientId))];
    return ids.map(id => {
      const client = SB.store.clientById(id); if (!client) return null;
      const ss = sessionsFor(id); if (!ss.length) return null;
      return { client, latest: ss[ss.length - 1], sessions: ss, readiness: readiness(ss, names) };
    }).filter(Boolean).sort((a, b) => {
      const pa = a.readiness && a.readiness.pct != null ? a.readiness.pct : 999, pb = b.readiness && b.readiness.pct != null ? b.readiness.pct : 999;
      return pa - pb;
    });
  }

  /* ================= CSV import ================= */
  function parseDate(raw, fmt) {
    if (!raw) return null;
    const s = String(raw).trim().split(/[ T]/)[0];
    let m;
    if ((m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
    if ((m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/))) {
      let [a, b, y] = [+m[1], +m[2], m[3].length === 2 ? 2000 + +m[3] : +m[3]];
      let mo, d;
      if (a > 12) { d = a; mo = b; } else if (b > 12) { mo = a; d = b; } else if (fmt === 'DMY') { d = a; mo = b; } else { mo = a; d = b; }
      return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    }
    const dt = new Date(s);
    return isNaN(dt) ? null : SB.ui.toISO(dt);
  }

  function parseForceDecks(text) {
    const rows = SB.ui.parseCSV(text);
    const hi = rows.findIndex(r => r.some(c => /^(name|athlete( name)?)$/i.test(String(c).trim())) && r.some(c => /^(test )?date$/i.test(String(c).trim())));
    if (hi < 0) throw new Error('Could not find a header row with "Name" and "Date". Export the CSV from ForceDecks → Results/Tests.');
    const header = rows[hi].map(c => String(c).trim());
    const body = rows.slice(hi + 1).filter(r => r.length > 1);
    const col = re => header.findIndex(h => re.test(h));
    const ci = {
      name: col(/^(name|athlete( name)?)$/i), date: col(/^(test )?date$/i), time: col(/^time$/i), type: col(/^test ?type$/i),
      bw: col(/^(bw \[kg\]|body ?weight)/i), reps: col(/^reps$/i), tags: col(/^tags$/i), ext: col(/^external ?id$/i)
    };
    const metricIdx = [];
    header.forEach((h, i) => {
      if (!h || META_COLS.some(re => re.test(h))) return;
      const nums = body.map(r => r[i]).filter(v => v !== undefined && String(v).trim() !== '');
      if (nums.length && nums.filter(v => !isNaN(parseFloat(String(v).replace(',', '.')))).length / nums.length > 0.8) metricIdx.push(i);
    });
    // Ambiguous dates? Look for any value with first part > 12 to auto-detect
    const rawDates = body.map(r => r[ci.date]).filter(Boolean);
    const dmyHint = rawDates.some(d => { const m = String(d).match(/^(\d{1,2})[\/.-](\d{1,2})/); return m && +m[1] > 12; });
    const mdyHint = rawDates.some(d => { const m = String(d).match(/^(\d{1,2})[\/.-](\d{1,2})/); return m && +m[2] > 12; });
    return {
      header, ci, metricIdx, dateFormat: dmyHint && !mdyHint ? 'DMY' : 'MDY', ambiguousDates: !dmyHint && !mdyHint && rawDates.some(d => /\//.test(d)),
      rows: body.map(r => ({
        rawName: String(r[ci.name] || '').trim(),
        rawDate: r[ci.date],
        time: ci.time >= 0 ? String(r[ci.time] || '').trim().slice(0, 5) : '',
        testType: ci.type >= 0 ? String(r[ci.type] || '').trim() : 'CMJ',
        bw: ci.bw >= 0 ? parseFloat(r[ci.bw]) : null,
        reps: ci.reps >= 0 ? parseFloat(r[ci.reps]) : null,
        tags: ci.tags >= 0 ? String(r[ci.tags] || '') : '',
        externalId: ci.ext >= 0 ? String(r[ci.ext] || '') : '',
        metrics: Object.fromEntries(metricIdx.map(i => [header[i], parseFloat(String(r[i]).replace(',', '.'))]).filter(([, v]) => !isNaN(v)))
      })).filter(r => r.rawName)
    };
  }

  async function importFiles(files) {
    if (!files || !files.length) return;
    const parsed = [];
    for (const f of files) {
      try { parsed.push(Object.assign(parseForceDecks(await SB.ui.readText(f)), { file: f.name })); }
      catch (e) { toast(`${f.name}: ${e.message}`, 'bad'); }
    }
    if (!parsed.length) return;
    const rows = parsed.flatMap(p => p.rows);
    const metricCount = new Set(parsed.flatMap(p => p.metricIdx.map(i => p.header[i]))).size;
    const names = [...new Set(rows.map(r => r.rawName))].sort();
    const types = [...new Set(rows.map(r => r.testType).filter(Boolean))];
    const ambiguous = parsed.some(p => p.ambiguousDates);
    const fmt0 = parsed[0].dateFormat;
    const clients = SB.store.all('clients').slice().sort((a, b) => SB.store.clientName(a).localeCompare(SB.store.clientName(b)));
    const opts = [['__new', '➕ Create new client'], ['__skip', 'Skip this person'], ...clients.map(c => [c.id, SB.store.clientName(c)])];

    modal({
      title: 'Import ForceDecks Data', wide: true,
      body: `
        <div class="grid kpis" style="grid-template-columns:repeat(4,1fr)">
          <div class="card kpi"><div class="label">Rows</div><div class="value">${rows.length}</div></div>
          <div class="card kpi"><div class="label">People</div><div class="value">${names.length}</div></div>
          <div class="card kpi"><div class="label">Metrics</div><div class="value">${metricCount}</div></div>
          <div class="card kpi"><div class="label">Test types</div><div class="value" style="font-size:22px;padding-top:10px">${esc(types.join(', ') || '—')}</div></div>
        </div>
        <div class="row mt">
          <label class="field" style="min-width:260px"><span>Date format in this file</span>
            ${select('fmt', [['MDY', 'MM/DD/YYYY (US)'], ['DMY', 'DD/MM/YYYY']], fmt0, 'id="imp-fmt"')}</label>
          ${ambiguous ? '<span class="hint">Dates in this file could be read either way — check the format.</span>' : '<span class="hint">Detected automatically.</span>'}
        </div>
        <div class="card-title mt">Match people to clients</div>
        <p class="hint" style="margin-top:4px">Names that match an existing client are linked automatically. Unmatched names can become new clients.</p>
        <div class="table-wrap" style="max-height:42vh;overflow:auto"><table class="data">
          <thead><tr><th>Name in CSV</th><th class="num">Rows</th><th>Link to</th></tr></thead>
          <tbody>${names.map((n, i) => {
            const match = SB.store.findClientByName(n);
            return `<tr><td><b>${esc(n)}</b></td><td class="num">${rows.filter(r => r.rawName === n).length}</td>
              <td>${select('m' + i, opts, match ? match.id : '__new', `data-name="${esc(n)}"`)}</td></tr>`;
          }).join('')}</tbody></table></div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="imp-go">${icon('upload')}Import ${rows.length} rows</button>`,
      onMount(m) {
        m.querySelector('#imp-go').addEventListener('click', () => {
          const fmt = m.querySelector('#imp-fmt').value;
          const map = {};
          m.querySelectorAll('select[data-name]').forEach(s => { map[s.dataset.name] = s.value; });
          let created = 0;
          Object.entries(map).forEach(([n, v]) => {
            if (v !== '__new') return;
            const parts = n.split(/\s+/);
            const c = SB.store.upsert('clients', {
              first: parts[0] || n, last: parts.slice(1).join(' '), status: 'active', sport: '', level: '', email: '', phone: '',
              planId: '', startDate: todayISO(), renewalDate: '', programId: '', goals: '', notes: 'Created from ForceDecks import', forceDecksName: n
            });
            map[n] = c.id; created++;
          });
          // Remember the ForceDecks spelling on linked clients so future imports auto-match
          Object.entries(map).forEach(([n, id]) => {
            const c = SB.store.clientById(id);
            if (c && SB.store.normName(SB.store.clientName(c)) !== SB.store.normName(n) && !c.forceDecksName) { c.forceDecksName = n; SB.store.upsert('clients', c); }
          });
          const tests = rows.filter(r => map[r.rawName] && map[r.rawName] !== '__skip').map(r => ({
            clientId: map[r.rawName], rawName: r.rawName, date: parseDate(r.rawDate, fmt), time: r.time, testType: r.testType || 'CMJ',
            reps: r.reps, bw: isNaN(r.bw) ? null : r.bw, tags: r.tags, externalId: r.externalId, metrics: r.metrics, source: 'csv', importedAt: new Date().toISOString()
          })).filter(t => t.date);
          const { added, dupes } = SB.store.addTests(tests);
          closeModal();
          toast(`Imported ${added} test${added === 1 ? '' : 's'}${dupes ? ` · ${dupes} duplicates skipped` : ''}${created ? ` · ${created} new client${created === 1 ? '' : 's'}` : ''}`);
          SB.go('#/forcedecks');
          SB.refresh();
        });
      }
    });
  }

  /* ================= Chart plugins ================= */
  const quadrantPlugin = {
    id: 'sbQuadrant',
    afterDraw(c, args, opts) {
      if (!opts || opts.mx == null) return;
      const { ctx, chartArea: a, scales: { x, y } } = c;
      const px = x.getPixelForValue(opts.mx), py = y.getPixelForValue(opts.my);
      ctx.save();
      ctx.setLineDash([5, 5]); ctx.strokeStyle = '#B5ADA4'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = "600 11px 'Oswald'"; ctx.fillStyle = '#9A928A';
      const L = opts.labels;
      ctx.textAlign = 'right'; ctx.fillText(L[0], a.right - 6, a.top + 14); ctx.fillText(L[3], a.right - 6, a.bottom - 8);
      ctx.textAlign = 'left'; ctx.fillText(L[1], a.left + 6, a.top + 14); ctx.fillText(L[2], a.left + 6, a.bottom - 8);
      // point labels
      ctx.font = "600 11.5px 'Barlow'"; ctx.fillStyle = '#141414'; ctx.textAlign = 'left';
      c.data.datasets.forEach((ds, di) => {
        const meta = c.getDatasetMeta(di);
        meta.data.forEach((pt, i) => { const lbl = ds.data[i].label; if (lbl) ctx.fillText(lbl, pt.x + 8, pt.y + 4); });
      });
      ctx.restore();
    }
  };
  if (window.Chart) Chart.register(quadrantPlugin);

  const median = arr => { const s = arr.slice().sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  const mean = arr => arr.reduce((a, b) => a + b, 0) / arr.length;

  function quadrantChart(canvas, points, xName, yName) {
    const xs = points.map(p => p.x), ys = points.map(p => p.y);
    const mx = median(xs), my = median(ys);
    const xr = Math.max(...xs) - Math.min(...xs) || 1, yr = Math.max(...ys) - Math.min(...ys) || 1;
    return chart(canvas, {
      type: 'scatter',
      data: { datasets: [{ data: points, pointRadius: 7, pointHoverRadius: 9, backgroundColor: points.map(p => p.x >= mx && p.y >= my ? '#FF5A1F' : '#141414'), borderColor: '#fff', borderWidth: 1.5 }] },
      options: {
        layout: { padding: { right: 70 } },
        plugins: {
          legend: { display: false },
          sbQuadrant: { mx, my, labels: ['High output · efficient', 'Efficient · needs output', 'Develop both', 'High output · slow'] },
          tooltip: { callbacks: { label: c => `${c.raw.label}: ${fmtMetric(xName, c.raw.x)} / ${fmtMetric(yName, c.raw.y)}` } }
        },
        scales: {
          x: { title: { display: true, text: xName }, grace: '8%', suggestedMin: Math.min(...xs) - xr * 0.1, suggestedMax: Math.max(...xs) + xr * 0.1 },
          y: { title: { display: true, text: yName }, grace: '8%', suggestedMin: Math.min(...ys) - yr * 0.1, suggestedMax: Math.max(...ys) + yr * 0.1 }
        }
      }
    });
  }

  /* ================= View ================= */
  SB.fd = { sessionsFor, readiness, readinessBadge, latestReadiness, allMetricNames, keyCol, fmtMetric, shortName, importFiles, parseForceDecks, parseDate };

  SB.views.forcedecks = {
    render(el, { id, q }) {
      const tab = id ? 'athlete' : (q.tab || 'team');
      const tested = [...new Set(SB.store.all('tests').map(t => t.clientId))].map(cid => SB.store.clientById(cid)).filter(Boolean)
        .sort((a, b) => SB.store.clientName(a).localeCompare(SB.store.clientName(b)));
      el.innerHTML = `
        ${pageHead({
          kicker: 'Training · VALD ForceDecks', title: 'ForceDecks',
          sub: 'Drop in a ForceDecks CSV export. Every metric in the file is kept, so you can chart any of them over time.',
          actions: `<button class="btn primary" id="fd-import">${icon('upload')}Import CSV</button>
            ${SB.store.all('tests').length ? `<button class="btn" id="fd-export">${icon('download')}Export all tests</button>` : ''}`
        })}
        <div class="content">
          <div class="tabs">
            <button data-tab="team" class="${tab === 'team' ? 'active' : ''}">Team View</button>
            <button data-tab="athlete" class="${tab === 'athlete' ? 'active' : ''}">Athlete Report</button>
            <button data-tab="data" class="${tab === 'data' ? 'active' : ''}">All Tests</button>
          </div>
          <div id="fd-body"></div>
        </div>`;
      el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => {
        const t = b.dataset.tab;
        if (t === 'athlete') SB.go('#/forcedecks/' + (id || (tested[0] ? tested[0].id : '')));
        else SB.go('#/forcedecks?tab=' + t);
      }));
      el.querySelector('#fd-import').addEventListener('click', async () => importFiles(await SB.ui.pickFile('.csv,text/csv', true)));
      const ex = el.querySelector('#fd-export'); if (ex) ex.addEventListener('click', () => this.exportAll());
      const body = el.querySelector('#fd-body');

      if (!SB.store.all('tests').length) {
        body.innerHTML = `<div class="drop" id="drop"><strong>Drop ForceDecks CSV files here</strong><div class="hint mt-s">or click to choose · in ForceDecks go to Results → select tests → Export → CSV</div></div>
          <div class="notice neutral mt">Tip: export the <b>trial averages</b> or <b>all trials</b> — the dashboard averages multiple trials on the same day into one session. Uploads are stored only in this browser, never in the GitHub repo.</div>`;
        this.wireDrop(body.querySelector('#drop'));
        if (q.import) setTimeout(() => body.querySelector('#drop').click(), 50);
        return;
      }
      if (q.import) setTimeout(async () => importFiles(await SB.ui.pickFile('.csv,text/csv', true)), 50);
      if (tab === 'athlete') return this.renderAthlete(body, id, tested);
      if (tab === 'data') return this.renderData(body);
      this.renderTeam(body, q);
    },

    wireDrop(dz) {
      dz.addEventListener('click', async () => importFiles(await SB.ui.pickFile('.csv,text/csv', true)));
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); importFiles([...e.dataTransfer.files]); });
    },

    /* ---------- Team ---------- */
    renderTeam(body, q) {
      const names = allMetricNames();
      const rowsAll = latestReadiness();
      const sports = [...new Set(rowsAll.map(r => r.client.sport).filter(Boolean))].sort();
      const sport = q.sport || '';
      const rows = rowsAll.filter(r => !sport || r.client.sport === sport);
      const C = { jh: keyCol('jh', names), rsi: keyCol('rsi', names), ppbm: keyCol('ppbm', names), cpf: keyCol('cpf', names), ebrfd: keyCol('ebrfd', names) };
      const metricOpts = names.map(n => [n, shortName(n) + (unitOf(n) ? ` (${unitOf(n)})` : '')]);
      const qx = q.x && names.includes(q.x) ? q.x : (C.jh || names[0]);
      const qy = q.y && names.includes(q.y) ? q.y : (C.rsi || names[1] || names[0]);
      const rk = q.rank && names.includes(q.rank) ? q.rank : (C.jh || names[0]);
      const counts = { good: 0, warn: 0, bad: 0, none: 0 };
      rows.forEach(r => { counts[r.readiness ? r.readiness.level : 'none']++; });

      body.innerHTML = `
        <div class="toolbar">
          ${select('sport', [['', 'All sports / groups'], ...sports], sport, 'id="t-sport"')}
          <span class="hint">${rows.length} athlete${rows.length === 1 ? '' : 's'} · latest session each</span>
          <span class="spacer"></span>
          <span class="badge good">${counts.good} ready</span><span class="badge warn">${counts.warn} monitor</span><span class="badge bad">${counts.bad} fatigued</span>
        </div>
        <div class="card">
          <div class="card-head"><div class="card-title">Latest Results & Readiness</div><span class="card-sub">Readiness = latest ${esc(shortName(C.rsi || C.jh || ''))} vs the athlete's previous 6 sessions</span></div>
          <div id="team-table"></div>
        </div>
        <div class="grid two mt">
          <div class="card">
            <div class="card-head"><div class="card-title">Quadrant Profile</div>
              <div class="row">${select('x', metricOpts, qx, 'id="q-x" style="max-width:190px"')}<span class="hint">vs</span>${select('y', metricOpts, qy, 'id="q-y" style="max-width:190px"')}</div></div>
            <div class="chart-box tall"><canvas id="quad"></canvas></div>
            <p class="hint">Dashed lines = group median. Orange = above median on both.</p>
          </div>
          <div class="card">
            <div class="card-head"><div class="card-title">Ranking</div>${select('rank', metricOpts, rk, 'id="rank" style="max-width:240px"')}</div>
            <div class="chart-box tall"><canvas id="rankc"></canvas></div>
          </div>
        </div>`;

      const setQ = patch => { const p = Object.assign({}, q, patch); delete p.import; SB.go('#/forcedecks?' + new URLSearchParams(p).toString()); };
      body.querySelector('#t-sport').addEventListener('change', e => setQ({ sport: e.target.value }));
      body.querySelector('#q-x').addEventListener('change', e => setQ({ x: e.target.value }));
      body.querySelector('#q-y').addEventListener('change', e => setQ({ y: e.target.value }));
      body.querySelector('#rank').addEventListener('change', e => setQ({ rank: e.target.value }));

      const cols = [
        { key: 'name', label: 'Athlete', sort: r => SB.store.clientName(r.client), render: r => `<b style="white-space:nowrap">${esc(SB.store.clientName(r.client))}</b>${r.client.sport ? `<div class="hint">${esc(r.client.sport)}</div>` : ''}` },
        { key: 'date', label: 'Last Test', sort: r => r.latest.date, render: r => fmtDate(r.latest.date, { noYear: true }) + (r.latest.date === todayISO() ? ' <span class="badge orange">today</span>' : '') },
        { key: 'ready', label: 'Readiness', sort: r => r.readiness && r.readiness.pct != null ? r.readiness.pct : 999, render: r => readinessBadge(r.readiness) },
        { key: 'bw', label: 'BW (kg)', num: true, sort: r => r.latest.bw, render: r => fmtNum(r.latest.bw, 1) },
        ...['jh', 'rsi', 'ppbm', 'cpf', 'ebrfd'].filter(k => C[k]).map(k => ({
          key: k, label: shortName(C[k]), num: true, sort: r => r.latest.metrics[C[k]],
          render: r => {
            const v = r.latest.metrics[C[k]]; const prev = r.sessions.length > 1 ? r.sessions[r.sessions.length - 2].metrics[C[k]] : null;
            const ch = prev ? (v - prev) / prev * 100 : null;
            return `${fmtMetric(C[k], v)}${ch != null ? `<div class="delta ${ch * direction(C[k]) > 1 ? 'up' : ch * direction(C[k]) < -1 ? 'down' : 'flat'}" style="font-size:12px">${ch >= 0 ? '+' : ''}${ch.toFixed(1)}%</div>` : ''}`;
          }
        })),
        { key: 'n', label: 'Sessions', num: true, sort: r => r.sessions.length, render: r => r.sessions.length }
      ];
      SB.ui.sortableTable(body.querySelector('#team-table'), { cols, rows, onRow: r => SB.go('#/forcedecks/' + r.client.id), initialSort: { key: 'ready', dir: 1 } });

      const pts = rows.map(r => ({ x: r.latest.metrics[qx], y: r.latest.metrics[qy], label: SB.store.clientName(r.client).split(' ').map((p, i) => i ? p[0] + '.' : p).join(' ') }))
        .filter(p => p.x != null && p.y != null);
      if (pts.length >= 2) quadrantChart(body.querySelector('#quad'), pts, qx, qy);
      else body.querySelector('#quad').parentElement.innerHTML = empty('Need 2+ athletes', '<div>The quadrant compares athletes against each other.</div>');

      const ranked = rows.map(r => ({ n: SB.store.clientName(r.client), v: r.latest.metrics[rk] })).filter(r => r.v != null)
        .sort((a, b) => direction(rk) < 0 ? a.v - b.v : b.v - a.v);
      const avg = ranked.length ? mean(ranked.map(r => r.v)) : 0;
      chart(body.querySelector('#rankc'), {
        type: 'bar',
        data: { labels: ranked.map(r => r.n), datasets: [{ data: ranked.map(r => r.v), backgroundColor: ranked.map(r => (r.v - avg) * (direction(rk) || 1) >= 0 ? '#FF5A1F' : '#141414'), borderRadius: 4, maxBarThickness: 26 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => fmtMetric(rk, c.raw) + ' ' + unitOf(rk) } } },
          scales: { x: { title: { display: true, text: `${shortName(rk)} ${unitOf(rk) ? '(' + unitOf(rk) + ')' : ''} · group avg ${fmtMetric(rk, avg)}` }, beginAtZero: !/depth/i.test(rk) }, y: { grid: { display: false } } } }
      });
    },

    /* ---------- Athlete ---------- */
    renderAthlete(body, id, tested) {
      if (!tested.length) { body.innerHTML = empty('No athletes tested yet'); return; }
      const client = SB.store.clientById(id) || tested[0];
      const ss = sessionsFor(client.id);
      const names = allMetricNames();
      const clientMetrics = names.filter(n => ss.some(s => s.metrics[n] != null));
      const params = new URLSearchParams((location.hash.split('?')[1]) || '');
      const selDate = params.get('date') && ss.find(s => s.date === params.get('date')) ? params.get('date') : (ss.length ? ss[ss.length - 1].date : null);
      const si = ss.findIndex(s => s.date === selDate);
      const cur = ss[si], prev = si > 0 ? ss[si - 1] : null;
      const rd = readiness(ss.slice(0, si + 1), names);
      const metricOpts = clientMetrics.map(n => [n, shortName(n) + (unitOf(n) ? ` (${unitOf(n)})` : '')]);
      const tm = params.get('m') && clientMetrics.includes(params.get('m')) ? params.get('m') : (keyCol('jh', clientMetrics) || clientMetrics[0]);
      const tm2 = params.get('m2') && clientMetrics.includes(params.get('m2')) ? params.get('m2') : '';

      // Group comparison: latest session of every tested athlete
      const group = latestReadiness().map(r => r.latest);
      const pctRank = (n, v) => { const vals = group.map(g => g.metrics[n]).filter(x => x != null); if (vals.length < 3 || v == null) return null;
        const d = direction(n) || 1; return Math.round(vals.filter(x => d > 0 ? x <= v : x >= v).length / vals.length * 100); };

      const go = patch => { const p = Object.fromEntries(params); Object.assign(p, patch); SB.go(`#/forcedecks/${client.id}?` + new URLSearchParams(p)); };

      if (!cur) { body.innerHTML = empty('No sessions for this athlete'); return; }
      const keyCards = ['jh', 'rsi', 'ppbm', 'cpf', 'ebrfd', 'cmd', 'ct'].map(k => keyCol(k, clientMetrics)).filter(Boolean);
      const best = n => { const vals = ss.slice(0, si + 1).map(s => s.metrics[n]).filter(v => v != null); if (!vals.length) return null; return (direction(n) < 0 ? Math.min : Math.max)(...vals); };

      body.innerHTML = `
        <div class="toolbar">
          ${select('client', tested.map(c => [c.id, SB.store.clientName(c)]), client.id, 'id="a-client" style="min-width:220px"')}
          ${select('date', ss.slice().reverse().map(s => [s.date, fmtDate(s.date) + (s.n > 1 ? ` · ${s.n} trials` : '')]), selDate, 'id="a-date"')}
          <span class="spacer"></span>
          <a class="btn" href="#/clients/${client.id}">${icon('user')}Client profile</a>
          <button class="btn" id="a-print">${icon('print')}Print report</button>
        </div>
        <div class="grid" style="grid-template-columns:minmax(0,1fr) 300px;align-items:start" id="a-top">
          <div class="metric-cards">
            <div class="metric-card"><div class="l">Body Weight</div><div class="v">${fmtNum(cur.bw, 1)}<small>kg</small></div>
              <div class="c">${prev && prev.bw && cur.bw ? `${cur.bw - prev.bw >= 0 ? '+' : ''}${(cur.bw - prev.bw).toFixed(1)} kg vs prev` : '&nbsp;'}</div></div>
            ${keyCards.map(n => {
              const v = cur.metrics[n], p = prev ? prev.metrics[n] : null, ch = p ? (v - p) / p * 100 : null, b = best(n);
              const cls = ch == null ? 'flat' : ch * direction(n) > 1 ? 'up' : ch * direction(n) < -1 ? 'down' : 'flat';
              return `<div class="metric-card"><div class="l">${esc(shortName(n))}</div><div class="v">${fmtMetric(n, v)}<small>${esc(unitOf(n))}</small></div>
                <div class="c"><span class="delta ${cls}">${ch == null ? 'First test' : (ch >= 0 ? '+' : '') + ch.toFixed(1) + '% vs prev'}</span>${b != null && b === v && si > 0 ? ' · <span class="badge orange">PB</span>' : ''}</div></div>`;
            }).join('')}
          </div>
          <div class="card">
            <div class="card-title">Readiness</div>
            <div class="readiness-ring mt-s">
              <div class="score" style="color:${!rd || rd.level === 'none' ? 'var(--gray-text)' : rd.level === 'good' ? 'var(--good)' : rd.level === 'warn' ? 'var(--warn)' : 'var(--bad)'}">${rd && rd.pct != null ? (rd.pct >= 0 ? '+' : '') + rd.pct.toFixed(1) + '%' : '—'}</div>
              <div>${readinessBadge(rd)}</div>
            </div>
            <p class="hint">${rd && rd.baseline != null ? `${esc(shortName(rd.metric))} ${fmtMetric(rd.metric, rd.value)} vs baseline ${fmtMetric(rd.metric, rd.baseline)} (avg of previous ${Math.min(6, si)} sessions).` : 'Needs at least 3 sessions to compare against a baseline.'}</p>
            <p class="hint" style="margin-bottom:0">Ready ≥ −5% · Monitor −5 to −10% · Fatigued &lt; −10%</p>
          </div>
        </div>
        <div class="card mt">
          <div class="card-head"><div class="card-title">Trend</div>
            <div class="row">${select('m', metricOpts, tm, 'id="a-m" style="max-width:240px"')}<span class="hint">compare</span>${select('m2', [['', '— none —'], ...metricOpts], tm2, 'id="a-m2" style="max-width:240px"')}</div></div>
          <div class="chart-box"><canvas id="trend"></canvas></div>
        </div>
        <div class="grid two mt">
          <div class="card">
            <div class="card-head"><div class="card-title">Profile vs Group</div><span class="card-sub">Percentile among all tested athletes' latest session</span></div>
            <div class="chart-box"><canvas id="prof"></canvas></div>
          </div>
          <div class="card">
            <div class="card-head"><div class="card-title">Session History</div><span class="card-sub">${ss.length} session${ss.length === 1 ? '' : 's'}</span></div>
            <div id="hist"></div>
          </div>
        </div>
        <div class="card mt">
          <div class="card-head"><div class="card-title">All Metrics · ${fmtDate(cur.date)}</div><input class="input" id="m-search" placeholder="Filter metrics…" style="max-width:240px"></div>
          <div id="all-m"></div>
        </div>`;

      body.querySelector('#a-client').addEventListener('change', e => SB.go('#/forcedecks/' + e.target.value));
      body.querySelector('#a-date').addEventListener('change', e => go({ date: e.target.value }));
      body.querySelector('#a-m').addEventListener('change', e => go({ m: e.target.value }));
      body.querySelector('#a-m2').addEventListener('change', e => go({ m2: e.target.value }));
      body.querySelector('#a-print').addEventListener('click', () => window.print());
      if (window.innerWidth < 980) body.querySelector('#a-top').style.gridTemplateColumns = '1fr';

      // Trend chart with 3-session rolling average
      const series = ss.map(s => s.metrics[tm] ?? null);
      const roll = series.map((_, i) => { const w = series.slice(Math.max(0, i - 2), i + 1).filter(v => v != null); return w.length ? mean(w) : null; });
      const ds = [
        { label: shortName(tm), data: series, borderColor: '#FF5A1F', backgroundColor: '#FF5A1F', pointRadius: ss.map(s => s.date === selDate ? 7 : 4), tension: .25, yAxisID: 'y' },
        { label: '3-session avg', data: roll, borderColor: '#141414', borderDash: [5, 4], pointRadius: 0, tension: .25, yAxisID: 'y' }
      ];
      if (tm2) ds.push({ label: shortName(tm2), data: ss.map(s => s.metrics[tm2] ?? null), borderColor: '#2F7EBF', backgroundColor: '#2F7EBF', pointRadius: 3, tension: .25, yAxisID: 'y2' });
      chart(body.querySelector('#trend'), {
        type: 'line', data: { labels: ss.map(s => fmtDate(s.date, { noYear: true })), datasets: ds },
        options: { spanGaps: true, interaction: { mode: 'index', intersect: false },
          plugins: { tooltip: { callbacks: { label: c => `${c.dataset.label}: ${fmtMetric(c.dataset.yAxisID === 'y2' ? tm2 : tm, c.raw)}` } } },
          scales: { y: { title: { display: true, text: `${shortName(tm)} ${unitOf(tm) ? '(' + unitOf(tm) + ')' : ''}` } },
            ...(tm2 ? { y2: { position: 'right', grid: { display: false }, title: { display: true, text: `${shortName(tm2)} ${unitOf(tm2) ? '(' + unitOf(tm2) + ')' : ''}` } } } : {}) } }
      });

      // Percentile profile
      const profMetrics = ['jh', 'rsi', 'ppbm', 'cpfbm', 'ebrfd', 'ct', 'cmd'].map(k => keyCol(k, clientMetrics)).filter(n => n && !/depth/i.test(n));
      const prof = profMetrics.map(n => ({ n, p: pctRank(n, cur.metrics[n]) })).filter(x => x.p != null);
      if (prof.length) chart(body.querySelector('#prof'), {
        type: 'bar', data: { labels: prof.map(x => shortName(x.n)), datasets: [{ data: prof.map(x => x.p), backgroundColor: prof.map(x => x.p >= 50 ? '#FF5A1F' : '#141414'), borderRadius: 4, maxBarThickness: 24 }] },
        options: { indexAxis: 'y', plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => `${c.raw}th percentile` } } },
          scales: { x: { min: 0, max: 100, title: { display: true, text: 'Percentile (higher = better; time metrics inverted)' } }, y: { grid: { display: false } } } }
      });
      else body.querySelector('#prof').parentElement.innerHTML = empty('Need 3+ tested athletes', '<div>Percentiles compare this athlete to everyone else you test.</div>');

      // History
      const jh = keyCol('jh', clientMetrics), rsi = keyCol('rsi', clientMetrics);
      const hist = ss.map((s, i) => ({ s, i, r: readiness(ss.slice(0, i + 1), names) })).reverse();
      SB.ui.sortableTable(body.querySelector('#hist'), {
        rows: hist, onRow: h => go({ date: h.s.date }),
        cols: [
          { key: 'd', label: 'Date', sort: h => h.s.date, render: h => `${h.s.date === selDate ? '▶ ' : ''}${fmtDate(h.s.date, { noYear: true })}` },
          ...(jh ? [{ key: 'jh', label: 'JH', num: true, sort: h => h.s.metrics[jh], render: h => fmtMetric(jh, h.s.metrics[jh]) }] : []),
          ...(rsi ? [{ key: 'rsi', label: 'RSI-mod', num: true, sort: h => h.s.metrics[rsi], render: h => fmtMetric(rsi, h.s.metrics[rsi]) }] : []),
          { key: 'r', label: 'Readiness', sort: h => h.r && h.r.pct, render: h => readinessBadge(h.r) },
          { key: 'x', label: '', render: h => `<button class="btn sm ghost danger" data-del="${h.s.date}" title="Delete this session">${icon('trash')}</button>` }
        ]
      });
      body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
        if (!(await SB.ui.confirm(`Delete all ${client.first}'s tests on ${fmtDate(b.dataset.del)}?`))) return;
        SB.store.state.tests = SB.store.all('tests').filter(t => !(t.clientId === client.id && t.date === b.dataset.del));
        SB.store.save(); toast('Session deleted'); SB.go('#/forcedecks/' + client.id);
      }));

      // All metrics table
      const drawAll = () => {
        const term = body.querySelector('#m-search').value.toLowerCase();
        const groupAvg = n => { const v = group.map(g => g.metrics[n]).filter(x => x != null); return v.length ? mean(v) : null; };
        const rows = clientMetrics.filter(n => !term || n.toLowerCase().includes(term)).map(n => {
          const v = cur.metrics[n], p = prev ? prev.metrics[n] : null;
          return { n, v, p, ch: p ? (v - p) / Math.abs(p) * 100 : null, b: best(n), g: groupAvg(n), pr: pctRank(n, v) };
        });
        SB.ui.sortableTable(body.querySelector('#all-m'), {
          rows, cols: [
            { key: 'n', label: 'Metric', render: r => `${esc(shortName(r.n))} <span class="hint">${esc(unitOf(r.n))}</span>` },
            { key: 'v', label: 'Value', num: true, render: r => `<b>${fmtMetric(r.n, r.v)}</b>` },
            { key: 'p', label: 'Previous', num: true, render: r => fmtMetric(r.n, r.p) },
            { key: 'ch', label: 'Change', num: true, render: r => r.ch == null ? '—' : `<span class="delta ${direction(r.n) === 0 ? 'flat' : r.ch * direction(r.n) > 1 ? 'up' : r.ch * direction(r.n) < -1 ? 'down' : 'flat'}">${r.ch >= 0 ? '+' : ''}${r.ch.toFixed(1)}%</span>` },
            { key: 'b', label: 'Personal Best', num: true, render: r => fmtMetric(r.n, r.b) },
            { key: 'g', label: 'Group Avg', num: true, render: r => fmtMetric(r.n, r.g) },
            { key: 'pr', label: 'Percentile', num: true, render: r => r.pr == null ? '—' : r.pr + 'th' },
            { key: 't', label: '', render: r => `<button class="btn sm ghost" data-trend="${esc(r.n)}">Chart</button>` }
          ]
        });
        body.querySelectorAll('[data-trend]').forEach(b => b.addEventListener('click', () => go({ m: b.dataset.trend })));
      };
      body.querySelector('#m-search').addEventListener('input', drawAll);
      drawAll();
    },

    /* ---------- All tests ---------- */
    renderData(body) {
      const names = allMetricNames();
      const tests = SB.store.all('tests').slice().sort((a, b) => (b.date + (b.time || '')).localeCompare(a.date + (a.time || '')));
      const shown = names.slice(0, 12);
      body.innerHTML = `
        <div class="toolbar"><input class="input" id="d-q" placeholder="Filter by athlete…"><span class="hint">${tests.length} rows · ${names.length} metrics (first 12 shown — export for all)</span>
          <span class="spacer"></span><button class="btn" id="d-exp">${icon('download')}Export CSV</button></div>
        <div id="d-table"></div>`;
      const draw = () => {
        const term = body.querySelector('#d-q').value.toLowerCase();
        const rows = tests.filter(t => !term || SB.store.clientName(SB.store.clientById(t.clientId)).toLowerCase().includes(term));
        SB.ui.sortableTable(body.querySelector('#d-table'), {
          rows: rows.slice(0, 500), onRow: t => SB.go('#/forcedecks/' + t.clientId + '?date=' + t.date),
          cols: [
            { key: 'c', label: 'Athlete', sort: t => SB.store.clientName(SB.store.clientById(t.clientId)), render: t => esc(SB.store.clientName(SB.store.clientById(t.clientId))) },
            { key: 'date', label: 'Date', render: t => fmtDate(t.date) + (t.time ? ` <span class="hint">${esc(t.time)}</span>` : '') },
            { key: 'testType', label: 'Type' },
            { key: 'bw', label: 'BW', num: true, render: t => fmtNum(t.bw, 1) },
            ...shown.map(n => ({ key: n, label: shortName(n), num: true, sort: t => t.metrics[n], render: t => fmtMetric(n, t.metrics[n]) })),
            { key: 'x', label: '', render: t => `<button class="btn sm ghost danger" data-del="${t.id}">${icon('trash')}</button>` }
          ]
        });
        body.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', async () => {
          if (!(await SB.ui.confirm('Delete this test row?'))) return;
          SB.store.remove('tests', b.dataset.del); SB.refresh();
        }));
      };
      body.querySelector('#d-q').addEventListener('input', draw);
      body.querySelector('#d-exp').addEventListener('click', () => this.exportAll());
      draw();
    },

    exportAll() {
      const names = allMetricNames();
      const tests = SB.store.all('tests').slice().sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
      const rows = [['Name', 'Date', 'Time', 'Test Type', 'BW [KG]', 'Reps', 'Tags', ...names],
        ...tests.map(t => [SB.store.clientName(SB.store.clientById(t.clientId)), t.date, t.time || '', t.testType || '', t.bw ?? '', t.reps ?? '', t.tags || '', ...names.map(n => t.metrics[n] ?? '')])];
      SB.ui.download(`sbsc-forcedecks-${todayISO()}.csv`, SB.ui.toCSV(rows), 'text/csv');
    }
  };
})(window.SB);
