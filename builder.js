/* Program Builder — phases → days → exercises, autosaves as you type */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead, field, select, toast } = SB.ui;

  const blankEx = (label = '') => ({ label, name: '', sets: 3, reps: '', tempo: '', rest: '', load: '', notes: '' });
  const blankDay = n => ({ name: 'Day ' + n, category: '', exercises: [blankEx('1A')] });
  const blankProgram = () => ({
    name: 'Untitled Program', tagline: '', goal: 'General Strength', level: 'Intermediate', audience: '',
    description: '', tags: [], phases: [{ name: 'Phase 1', weeks: 4, days: [blankDay(1)] }]
  });

  // Next label after the last row: "2A" → "3A"; as superset: "2A" → "2B"
  function nextLabel(rows, superset) {
    const last = rows[rows.length - 1];
    if (!last || !last.label) return superset ? '1B' : '1A';
    const m = String(last.label).match(/^(\d+)([A-Za-z]?)$/);
    if (!m) return '';
    const n = +m[1], l = (m[2] || 'A').toUpperCase();
    return superset ? n + String.fromCharCode(l.charCodeAt(0) + 1) : (n + 1) + 'A';
  }
  // Renumber so groups run 1,2,3… in order, keeping each row's letter
  function renumber(rows) {
    const map = new Map(); let k = 0;
    rows.forEach(r => {
      const m = String(r.label || '').match(/^(\d+)([A-Za-z]?)$/);
      const key = m ? m[1] : '__' + Math.random();
      if (!map.has(key)) map.set(key, ++k);
      r.label = map.get(key) + ((m && m[2]) ? m[2].toUpperCase() : 'A');
    });
  }

  SB.views.builder = {
    render(el, { id, q = {} }) {
      if (q.tab === 'quick') return SB.views.quick.render(el);
      let prog = id ? SB.store.get('programs', id) : null;
      if (id && !prog) { el.innerHTML = `<div class="content">${SB.ui.empty('Program not found', '', '<a class="btn" href="#/programs">Back to library</a>')}</div>`; return; }
      const isNew = !prog;
      let draft = prog ? JSON.parse(JSON.stringify(prog)) : blankProgram();
      if (!draft.phases || !draft.phases.length) draft.phases = [{ name: 'Phase 1', weeks: 4, days: [blankDay(1)] }];
      if (prog) SB._lastBuilderId = prog.id;
      let phaseIdx = 0;
      let saveTimer = null;

      el.innerHTML = `
        ${pageHead({
          kicker: 'Program Builder', title: isNew ? 'New Program' : draft.name,
          sub: 'Changes save automatically. Labels like 2A / 2B mark a superset.',
          actions: `<span class="badge" id="save-state" style="background:#222;color:#bbb">${isNew ? 'Not saved yet' : 'Saved'}</span>
            <button class="btn primary" id="b-save">${icon('check')}Save</button>
            <button class="btn" id="b-print">${icon('print')}Print / PDF</button>
            <button class="btn" id="b-assign">${icon('user')}Assign</button>
            <a class="btn" href="#/programs">Library</a>`
        })}
        <div class="content">
          ${SB.views.quick.subTabs('program')}
          <datalist id="ex-names">${SB.store.all('exercises').map(e => `<option value="${esc(e.name)}">${esc(e.category)}</option>`).join('')}</datalist>
          <div class="card">
            <div class="card-head"><div class="card-title">Program Details</div></div>
            <div class="form-grid" id="details">
              ${field('Program name', `<input class="input" name="name" value="${esc(draft.name)}">`)}
              ${field('Tagline (shows on the printed cover)', `<input class="input" name="tagline" value="${esc(draft.tagline || '')}" placeholder="e.g. A 6-Week Progressive Training Block">`)}
              ${field('Goal', select('goal', SB.views.programs.GOALS, draft.goal))}
              ${field('Level', select('level', SB.views.programs.LEVELS, draft.level))}
              ${field('Who it is for', `<input class="input" name="audience" value="${esc(draft.audience || '')}" placeholder="e.g. HS basketball, adult beginners">`)}
              ${field('Tags (comma separated)', `<input class="input" name="tags" value="${esc((draft.tags || []).join(', '))}" placeholder="template, in-season">`)}
              ${field('Notes / description', `<textarea class="input" name="description">${esc(draft.description || '')}</textarea>`, 'full')}
            </div>
          </div>
          <div class="card mt" id="pdf-card"></div>
          <div class="phase-tabs" id="phase-tabs"></div>
          <div id="phase-body"></div>
        </div>`;

      const $ = s => el.querySelector(s);
      SB.views.quick.wireSubTabs(el);
      const stateEl = $('#save-state');

      function persist(now) {
        clearTimeout(saveTimer);
        stateEl.textContent = 'Saving…';
        const run = () => {
          const saved = SB.store.upsert('programs', draft);
          draft.id = saved.id;
          SB._lastBuilderId = saved.id;
          if (isNew && !location.hash.includes(saved.id)) history.replaceState(null, '', '#/builder/' + saved.id);
          stateEl.textContent = 'Saved';
        };
        if (now) run(); else saveTimer = setTimeout(run, 500);
      }

      // Details
      $('#details').addEventListener('input', e => {
        const t = e.target; if (!t.name) return;
        if (t.name === 'tags') draft.tags = t.value.split(',').map(s => s.trim()).filter(Boolean);
        else draft[t.name] = t.value;
        if (t.name === 'name') el.querySelector('.page-head h1').textContent = t.value || 'Untitled Program';
        persist();
      });

      function drawPhaseTabs() {
        $('#phase-tabs').innerHTML = draft.phases.map((ph, i) =>
          `<button class="chip ${i === phaseIdx ? 'active' : ''}" data-ph="${i}">${esc(ph.name || 'Phase ' + (i + 1))} · ${ph.weeks || '?'} wk</button>`).join('') +
          `<button class="btn sm" id="add-phase">${icon('plus')}Add Phase</button>`;
        $('#phase-tabs').querySelectorAll('[data-ph]').forEach(b => b.addEventListener('click', () => { phaseIdx = +b.dataset.ph; drawAll(); }));
        $('#add-phase').addEventListener('click', () => {
          const prev = draft.phases[draft.phases.length - 1];
          // New phase starts as a copy of the previous one's days so progressions are quick to write
          const copy = prev ? JSON.parse(JSON.stringify(prev.days)) : [blankDay(1)];
          draft.phases.push({ name: 'Phase ' + (draft.phases.length + 1), weeks: prev ? prev.weeks : 4, days: copy });
          phaseIdx = draft.phases.length - 1; persist(true); drawAll(); toast('Phase added (copied from previous phase)');
        });
      }

      function exRow(x, di, ri) {
        return `<tr data-d="${di}" data-r="${ri}">
          <td class="w-xs"><input class="input" data-f="label" value="${esc(x.label || '')}" placeholder="1A"></td>
          <td><input class="input" data-f="name" list="ex-names" value="${esc(x.name || '')}" placeholder="Exercise"></td>
          <td class="w-xs"><input class="input" data-f="sets" value="${esc(x.sets ?? '')}" placeholder="3"></td>
          <td class="w-s"><input class="input" data-f="reps" value="${esc(x.reps || '')}" placeholder="8"></td>
          <td class="w-s"><input class="input" data-f="tempo" value="${esc(x.tempo || '')}" placeholder="3-1-1"></td>
          <td class="w-s"><input class="input" data-f="rest" value="${esc(x.rest || '')}" placeholder="90s"></td>
          <td class="w-s"><input class="input" data-f="load" value="${esc(x.load || '')}" placeholder="RPE 7"></td>
          <td><input class="input" data-f="notes" value="${esc(x.notes || '')}" placeholder="Cues / notes"></td>
          <td class="row-actions">
            <button class="btn" data-a="up" title="Move up">${icon('up')}</button>
            <button class="btn" data-a="down" title="Move down">${icon('down')}</button>
            <button class="btn" data-a="dup" title="Duplicate">${icon('copy')}</button>
            <button class="btn" data-a="del" title="Remove">${icon('x')}</button>
          </td></tr>`;
      }

      function drawPhase() {
        const ph = draft.phases[phaseIdx];
        const body = $('#phase-body');
        // Day numbering continues across phases (like the printed program)
        const offset = draft.phases.slice(0, phaseIdx).reduce((n, p) => n + p.days.length, 0);
        body.innerHTML = `
          <div class="card mt-s">
            <div class="form-grid" style="grid-template-columns:2fr 1fr auto auto;align-items:end">
              ${field('Phase name', `<input class="input" id="ph-name" value="${esc(ph.name || '')}">`)}
              ${field('Weeks', `<input class="input" id="ph-weeks" type="number" min="1" max="12" value="${esc(ph.weeks || '')}">`)}
              <button class="btn" id="ph-dup">${icon('copy')}Duplicate Phase</button>
              <button class="btn danger" id="ph-del" ${draft.phases.length < 2 ? 'disabled' : ''}>${icon('trash')}Delete Phase</button>
            </div>
          </div>
          ${ph.days.map((d, di) => `
            <div class="builder-day" data-day="${di}">
              <div class="day-bar">
                <span class="dn">DAY <b>${offset + di + 1}</b></span>
                <input class="input" data-day-f="category" value="${esc(d.category || '')}" placeholder="Focus / category (e.g. Lower Body — Strength)">
                <button class="btn sm" data-day-a="renumber" title="Renumber labels 1, 2, 3…">1·2·3</button>
                <button class="btn sm" data-day-a="dup">${icon('copy')}Duplicate</button>
                <button class="btn sm" data-day-a="del">${icon('trash')}</button>
              </div>
              <div style="overflow-x:auto">
                <table class="ex-table">
                  <thead><tr><th>#</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Tempo</th><th>Rest</th><th>Load</th><th>Notes</th><th></th></tr></thead>
                  <tbody>${d.exercises.map((x, ri) => exRow(x, di, ri)).join('')}</tbody>
                </table>
              </div>
              <div class="row" style="padding:10px 12px">
                <button class="btn sm" data-day-a="add">${icon('plus')}Exercise</button>
                <button class="btn sm" data-day-a="superset">${icon('plus')}Superset with last</button>
                <span class="hint">${d.exercises.length} exercise${d.exercises.length === 1 ? '' : 's'} · ${d.exercises.reduce((n, x) => n + (parseInt(x.sets) || 0), 0)} total sets</span>
              </div>
            </div>`).join('')}
          <div class="mt"><button class="btn primary" id="add-day">${icon('plus')}Add Day</button></div>`;

        body.querySelector('#ph-name').addEventListener('input', e => { ph.name = e.target.value; persist(); drawPhaseTabs(); });
        body.querySelector('#ph-weeks').addEventListener('input', e => { ph.weeks = Number(e.target.value) || ''; persist(); drawPhaseTabs(); });
        body.querySelector('#ph-dup').addEventListener('click', () => {
          const c = JSON.parse(JSON.stringify(ph)); c.name = (ph.name || 'Phase') + ' (Copy)';
          draft.phases.splice(phaseIdx + 1, 0, c); phaseIdx++; persist(true); drawAll();
        });
        body.querySelector('#ph-del').addEventListener('click', async () => {
          if (draft.phases.length < 2) return;
          if (await SB.ui.confirm(`Delete ${ph.name || 'this phase'} and all its days?`)) {
            draft.phases.splice(phaseIdx, 1); phaseIdx = Math.max(0, phaseIdx - 1); persist(true); drawAll();
          }
        });
        body.querySelector('#add-day').addEventListener('click', () => { ph.days.push(blankDay(ph.days.length + 1)); persist(true); drawPhase(); });

        body.querySelectorAll('[data-a]').forEach(b => b.addEventListener('click', () => {
          const tr = b.closest('tr'); const d = ph.days[+tr.dataset.d]; const r = +tr.dataset.r; const rows = d.exercises;
          const a = b.dataset.a;
          if (a === 'up' && r > 0) [rows[r - 1], rows[r]] = [rows[r], rows[r - 1]];
          if (a === 'down' && r < rows.length - 1) [rows[r + 1], rows[r]] = [rows[r], rows[r + 1]];
          if (a === 'dup') rows.splice(r + 1, 0, JSON.parse(JSON.stringify(rows[r])));
          if (a === 'del') rows.splice(r, 1);
          persist(true); drawPhase();
        }));
        body.querySelectorAll('[data-day-a]').forEach(b => b.addEventListener('click', async () => {
          const di = +b.closest('[data-day]').dataset.day; const d = ph.days[di]; const a = b.dataset.dayA;
          if (a === 'add') d.exercises.push(blankEx(nextLabel(d.exercises, false)));
          if (a === 'superset') d.exercises.push(blankEx(nextLabel(d.exercises, true)));
          if (a === 'renumber') renumber(d.exercises);
          if (a === 'dup') ph.days.splice(di + 1, 0, JSON.parse(JSON.stringify(d)));
          if (a === 'del') { if (!(await SB.ui.confirm('Delete this day and its exercises?'))) return; ph.days.splice(di, 1); }
          persist(true); drawPhase();
          if (a === 'add' || a === 'superset') {
            const inputs = el.querySelectorAll(`[data-day="${di}"] tbody tr:last-child [data-f="name"]`);
            if (inputs[0]) inputs[0].focus();
          }
        }));
      }

      // Field edits (delegated once; no re-render so focus is kept)
      $('#phase-body').addEventListener('input', e => {
        const t = e.target;
        const ph = draft.phases[phaseIdx];
        const tr = t.closest('tr[data-r]');
        if (tr && t.dataset.f) { ph.days[+tr.dataset.d].exercises[+tr.dataset.r][t.dataset.f] = t.value; persist(); return; }
        const dayEl = t.closest('[data-day]');
        if (dayEl && t.dataset.dayF) { ph.days[+dayEl.dataset.day][t.dataset.dayF] = t.value; persist(); }
      });

      // PDF version of this program (e.g. the designed SBSC PDF)
      function drawPdfCard() {
        const card = $('#pdf-card');
        const pdf = draft.pdf;
        card.innerHTML = `
          <div class="card-head"><div class="card-title">PDF Version</div><span class="card-sub">Attach the finished, designed PDF so it lives with this program</span></div>
          ${pdf ? `<div class="pdf-attach">
              <div class="mini">${pdf.hasThumb ? `<img id="pdf-mini" alt="">` : ''}</div>
              <div class="grow" style="flex:1;min-width:180px"><b>${esc(pdf.name)}</b><div class="hint">${SB.files.fmtSize(pdf.size)}${pdf.pages ? ` · ${pdf.pages} pages` : ''} · added ${SB.ui.fmtDate(pdf.uploadedAt.slice(0, 10))}</div></div>
              <button class="btn sm" id="pdf-view">View</button>
              <button class="btn sm" id="pdf-rep">${icon('upload')}Replace</button>
              <button class="btn sm ghost danger" id="pdf-rm">${icon('trash')}Remove</button>
            </div>`
            : `<div class="row"><button class="btn" id="pdf-add">${icon('upload')}Attach PDF</button><span class="hint">Optional. Clients and coaches can open it from the library and client profiles.</span></div>`}`;
        const pick = async () => {
          const [f] = await SB.ui.pickFile('.pdf,application/pdf'); if (!f) return;
          persist(true);
          try { await SB.views.programs.attachPDF(draft, f); toast('PDF attached'); drawPdfCard(); } catch (e) { toast(e.message, 'bad'); }
        };
        if (pdf) {
          if (pdf.hasThumb) SB.files.url(pdf.id + ':thumb').then(u => { const im = card.querySelector('#pdf-mini'); if (u && im) im.src = u; });
          card.querySelector('#pdf-view').addEventListener('click', () => SB.views.programs.viewPDF(draft));
          card.querySelector('#pdf-rep').addEventListener('click', pick);
          card.querySelector('#pdf-rm').addEventListener('click', async () => {
            if (!(await SB.ui.confirm('Remove the attached PDF? The built program stays.', { okText: 'Remove' }))) return;
            await SB.files.removePDF(draft.pdf); delete draft.pdf; persist(true); drawPdfCard();
          });
        } else card.querySelector('#pdf-add').addEventListener('click', pick);
      }
      drawPdfCard();

      function drawAll() { drawPhaseTabs(); drawPhase(); }
      drawAll();

      $('#b-save').addEventListener('click', () => { persist(true); toast('Program saved'); });
      $('#b-print').addEventListener('click', () => { persist(true); SB.views.programs.printProgram(draft); });
      $('#b-assign').addEventListener('click', () => { persist(true); SB.views.programs.assignModal(SB.store.get('programs', draft.id)); });
      const keyHandler = e => { if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); persist(true); toast('Program saved'); } };
      document.addEventListener('keydown', keyHandler);
      window.addEventListener('hashchange', () => { document.removeEventListener('keydown', keyHandler); if (saveTimer) persist(true); }, { once: true });
    }
  };
})(window.SB);
