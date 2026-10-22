/* Program Library — browse, duplicate, assign, print, and manage the exercise library */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead, empty, modal, closeModal, toast, field, select, download, pickFile, readText } = SB.ui;

  const GOALS = ['General Strength', 'Hypertrophy', 'Speed & Power', 'In-Season', 'Off-Season', 'Return to Play', 'Youth Development', 'Fat Loss / Conditioning', 'Other'];
  const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

  const dayCount = p => (p.phases || []).reduce((n, ph) => n + (ph.days || []).length, 0);
  const weekCount = p => (p.phases || []).reduce((n, ph) => n + (Number(ph.weeks) || 0), 0);
  const exCount = p => (p.phases || []).reduce((n, ph) => n + (ph.days || []).reduce((m, d) => m + (d.exercises || []).length, 0), 0);

  const isPdfOnly = p => !!p.pdf && dayCount(p) === 0;
  const cleanName = f => f.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/\b\w/g, ch => ch.toUpperCase());

  async function duplicate(p) {
    const copy = JSON.parse(JSON.stringify(p));
    delete copy.id; delete copy.createdAt;
    copy.name = p.name + ' (Copy)';
    copy.tags = (copy.tags || []).filter(t => t !== 'template');
    if (p.pdf) copy.pdf = await SB.files.copyPDF(p.pdf).catch(() => null);
    return SB.store.upsert('programs', copy);
  }

  async function deleteProgram(p) {
    const n = SB.store.all('clients').filter(c => c.programId === p.id).length;
    if (!(await SB.ui.confirm(`Delete "${p.name}"${p.pdf ? ' and its PDF' : ''}?${n ? ` ${n} client(s) will be unassigned.` : ''}`))) return false;
    SB.store.all('clients').filter(c => c.programId === p.id).forEach(c => { c.programId = ''; });
    if (p.pdf) await SB.files.removePDF(p.pdf).catch(() => { });
    SB.store.remove('programs', p.id); toast('Program deleted');
    return true;
  }

  /* ---------- PDF programs ---------- */
  async function viewPDF(p) {
    const u = p.pdf && await SB.files.url(p.pdf.id);
    if (!u) { toast('PDF not found on this device — restore a backup that includes it.', 'bad'); return; }
    modal({
      title: p.name, wide: true,
      body: `<iframe src="${u}#view=FitH" title="${esc(p.name)}" style="width:100%;height:72vh;border:1px solid var(--line);border-radius:8px;background:#fff"></iframe>
        <p class="hint" style="margin-bottom:0">${esc(p.pdf.name)} · ${SB.files.fmtSize(p.pdf.size)}${p.pdf.pages ? ` · ${p.pdf.pages} pages` : ''}. On a phone, use Open in new tab to scroll every page.</p>`,
      foot: `<a class="btn" href="${u}" target="_blank" rel="noopener">Open in new tab</a>
        <button class="btn" id="pv-dl">${icon('download')}Download</button>
        <button class="btn primary" id="pv-assign">${icon('user')}Assign</button>`,
      onMount(m) {
        m.querySelector('#pv-dl').addEventListener('click', () => downloadPDF(p));
        m.querySelector('#pv-assign').addEventListener('click', () => assignModal(p));
      }
    });
  }
  async function downloadPDF(p) {
    const b = p.pdf && await SB.files.get(p.pdf.id);
    if (!b) { toast('PDF not found on this device', 'bad'); return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = p.pdf.name || (p.name + '.pdf');
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  // Upload one or more PDFs → one library entry each
  async function uploadPDFs(files) {
    files = (files || []).filter(f => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (!files.length) { toast('Choose PDF files', 'bad'); return; }
    const big = files.filter(f => f.size > 40 * 1048576);
    modal({
      title: files.length === 1 ? 'Add PDF Program' : `Add ${files.length} PDF Programs`, wide: true,
      body: `
        <p class="hint" style="margin-top:0">Each PDF becomes its own program in the library. You can assign it to clients, view it, and download it.</p>
        ${big.length ? `<div class="notice">${big.length} file(s) are over 40 MB. They will still upload, but large files fill up storage and slow down backups.</div>` : ''}
        <div class="table-wrap mt-s"><table class="data">
          <thead><tr><th>File</th><th>Program name</th><th>Goal</th><th>Level</th></tr></thead>
          <tbody>${files.map((f, i) => `<tr>
            <td><b>${esc(f.name)}</b><div class="hint">${SB.files.fmtSize(f.size)}</div></td>
            <td><input class="input" data-i="${i}" data-f="name" value="${esc(cleanName(f.name))}"></td>
            <td>${select('g' + i, [['', '—'], ...GOALS], '', `data-i="${i}" data-f="goal"`)}</td>
            <td>${select('l' + i, [['', '—'], ...LEVELS], '', `data-i="${i}" data-f="level"`)}</td>
          </tr>`).join('')}</tbody></table></div>
        <label class="field mt"><span>Tagline / description (optional, applies to all)</span><input class="input" id="up-desc" placeholder="e.g. 6-week hypertrophy block"></label>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="up-go">${icon('upload')}Add to library</button>`,
      onMount(m) {
        m.querySelector('#up-go').addEventListener('click', async e => {
          const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Saving…';
          const desc = m.querySelector('#up-desc').value.trim();
          const meta = files.map(() => ({}));
          m.querySelectorAll('[data-f]').forEach(el => { meta[+el.dataset.i][el.dataset.f] = el.value.trim(); });
          let ok = 0;
          for (let i = 0; i < files.length; i++) {
            btn.textContent = `Saving ${i + 1} of ${files.length}…`;
            try {
              const pdf = await SB.files.savePDF(files[i]);
              SB.store.upsert('programs', {
                name: meta[i].name || cleanName(files[i].name), tagline: desc, goal: meta[i].goal || '', level: meta[i].level || '',
                audience: '', description: '', tags: ['pdf'], phases: [], pdf
              });
              ok++;
            } catch (err) { toast(`${files[i].name}: ${err.message}`, 'bad'); }
          }
          closeModal();
          if (ok) toast(`Added ${ok} PDF program${ok === 1 ? '' : 's'}`);
          SB.go('#/programs'); SB.refresh();
        });
      }
    });
  }

  // Attach or replace the PDF on any program (used by the builder and the PDF details modal)
  async function attachPDF(p, file) {
    const pdf = await SB.files.savePDF(file);
    if (p.pdf) await SB.files.removePDF(p.pdf).catch(() => { });
    p.pdf = pdf;
    SB.store.upsert('programs', p);
    return pdf;
  }

  function pdfDetailsModal(p) {
    modal({
      title: 'Edit PDF Program', wide: true,
      body: `<div class="form-grid" id="pd-form">
          ${field('Program name', `<input class="input" name="name" value="${esc(p.name)}">`)}
          ${field('Tagline', `<input class="input" name="tagline" value="${esc(p.tagline || '')}">`)}
          ${field('Goal', select('goal', [['', '—'], ...GOALS], p.goal))}
          ${field('Level', select('level', [['', '—'], ...LEVELS], p.level))}
          ${field('Who it is for', `<input class="input" name="audience" value="${esc(p.audience || '')}">`)}
          ${field('Tags (comma separated)', `<input class="input" name="tags" value="${esc((p.tags || []).join(', '))}">`)}
          ${field('Notes / description', `<textarea class="input" name="description">${esc(p.description || '')}</textarea>`, 'full')}
        </div>
        <div class="card mt" style="box-shadow:none">
          <div class="card-head" style="margin-bottom:6px"><div class="card-title">PDF File</div></div>
          <div class="row"><span class="grow">${esc(p.pdf.name)} · ${SB.files.fmtSize(p.pdf.size)}${p.pdf.pages ? ` · ${p.pdf.pages} pages` : ''} · added ${SB.ui.fmtDate(p.pdf.uploadedAt.slice(0, 10))}</span>
            <button class="btn sm" id="pd-replace">${icon('upload')}Replace PDF</button></div>
          <p class="hint" style="margin-bottom:0">Want the exercises in the builder too? <a href="#" id="pd-build">Build an editable version</a>; the PDF stays attached.</p>
        </div>`,
      foot: `<button class="btn danger" id="pd-del">${icon('trash')}Delete</button><span class="spacer"></span>
        <button class="btn" data-close>Cancel</button><button class="btn primary" id="pd-save">Save</button>`,
      onMount(m) {
        const save = () => {
          const d = SB.ui.formData(m.querySelector('#pd-form'));
          d.tags = d.tags.split(',').map(s => s.trim()).filter(Boolean);
          Object.assign(p, d); SB.store.upsert('programs', p);
        };
        m.querySelector('#pd-save').addEventListener('click', () => { save(); closeModal(); toast('Saved'); SB.refresh(); });
        m.querySelector('#pd-replace').addEventListener('click', async () => {
          const [f] = await pickFile('.pdf,application/pdf'); if (!f) return;
          save(); await attachPDF(p, f); toast('PDF replaced'); closeModal(); SB.refresh();
        });
        m.querySelector('#pd-build').addEventListener('click', e => {
          e.preventDefault(); save();
          p.phases = [{ name: 'Phase 1', weeks: 4, days: [{ name: 'Day 1', category: '', exercises: [{ label: '1A', name: '', sets: 3, reps: '', tempo: '', rest: '', load: '', notes: '' }] }] }];
          SB.store.upsert('programs', p); SB.go('#/builder/' + p.id);
        });
        m.querySelector('#pd-del').addEventListener('click', async () => { if (await deleteProgram(p)) { closeModal(); SB.refresh(); } });
      }
    });
  }

  // Fill <img data-thumb="pdfId"> placeholders from storage
  function loadThumbs(root) {
    root.querySelectorAll('img[data-thumb]').forEach(async img => {
      const u = await SB.files.url(img.dataset.thumb + ':thumb').catch(() => null);
      if (u) { img.src = u; img.closest('.prog-thumb').classList.add('loaded'); }
    });
  }

  function assignModal(p) {
    const clients = SB.store.all('clients').filter(c => c.status !== 'cancelled')
      .sort((a, b) => SB.store.clientName(a).localeCompare(SB.store.clientName(b)));
    if (!clients.length) { toast('Add a client first'); return; }
    modal({
      title: `Assign ${p.name}`,
      body: `<p class="hint" style="margin-top:0">Pick who is running this program. It replaces their current assignment.</p>
        <div class="stack" style="max-height:50vh;overflow:auto">${clients.map(c => `
          <label class="row" style="padding:6px 0;border-bottom:1px solid var(--line-2)">
            <input type="checkbox" value="${c.id}" ${c.programId === p.id ? 'checked' : ''}>
            <span style="flex:1"><b>${esc(SB.store.clientName(c))}</b> <span class="hint">${esc(c.sport || '')}</span></span>
            ${c.programId && c.programId !== p.id ? `<span class="badge">${esc((SB.store.get('programs', c.programId) || {}).name || '')}</span>` : ''}
          </label>`).join('')}</div>`,
      foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="as-save">Save</button>`,
      onMount(m) {
        m.querySelector('#as-save').addEventListener('click', () => {
          m.querySelectorAll('input[type=checkbox]').forEach(cb => {
            const c = SB.store.clientById(cb.value);
            if (cb.checked && c.programId !== p.id) { c.programId = p.id; c.programAssignedAt = SB.ui.todayISO(); SB.store.upsert('clients', c); }
            if (!cb.checked && c.programId === p.id) { c.programId = ''; SB.store.upsert('clients', c); }
          });
          closeModal(); toast('Assignments saved'); SB.refresh();
        });
      }
    });
  }

  /* ---------- Branded print (landscape letter, matches SBSC program PDFs) ---------- */
  function printProgram(p, client) {
    const root = document.getElementById('print-root');
    const phases = p.phases || [];
    const name = (p.name || 'Program').toUpperCase();
    let pages = `
      <section class="pp pp-cover">
        <div class="stripe"><img src="assets/img/logo-black.png" alt=""></div>
        <div class="txt">
          <div class="k">Spainhour Bros Strength Co.</div>
          <h1>${esc(name)}</h1>
          ${p.tagline ? `<div class="tl">${esc(p.tagline)}</div>` : ''}
          ${client ? `<div class="tl" style="color:var(--orange)">Prepared for ${esc(SB.store.clientName(client))}</div>` : ''}
          <div class="ph">${phases.map(ph => `<div><b>${esc(ph.name || 'Phase')}</b>${ph.weeks || '?'} weeks · ${(ph.days || []).length} days</div>`).join('')}</div>
        </div>
      </section>`;
    let dayNum = 0;
    phases.forEach(ph => {
      const weeks = Math.max(1, Math.min(6, Number(ph.weeks) || 1));
      (ph.days || []).forEach(d => {
        dayNum++;
        const rows = d.exercises || [];
        const rowH = Math.max(0.24, Math.min(0.42, 5.6 / Math.max(1, rows.length)));
        pages += `
          <section class="pp pp-day">
            <div class="hdr">
              <div class="row"><span class="dn">DAY <b>${dayNum}</b></span><span class="cat">${esc(d.category || d.name || '')} · ${esc(ph.name || '')}</span></div>
              <div class="mark">${esc(name)}</div>
            </div>
            <table>
              <thead><tr><th style="width:5%"></th><th style="width:27%;text-align:left">Exercise</th><th>Sets</th><th>Reps</th><th>Tempo</th><th>Rest</th>
                ${Array.from({ length: weeks }, (_, i) => `<th class="wk">Wk ${i + 1} WT</th>`).join('')}</tr></thead>
              <tbody>${rows.map(x => `<tr style="height:${rowH}in">
                <td class="lbl">${esc(x.label || '')}</td>
                <td class="ex">${esc(x.name || '')}${x.notes ? `<div style="font-weight:400;font-size:8.5pt;color:var(--gray-text)">${esc(x.notes)}</div>` : ''}</td>
                <td>${esc(x.sets ?? '')}</td><td>${esc(x.reps || '')}</td><td>${esc(x.tempo || '')}</td><td>${esc(x.rest || '')}</td>
                ${Array.from({ length: weeks }, () => `<td>${esc(x.load || '')}</td>`).join('')}
              </tr>`).join('')}</tbody>
            </table>
            <div class="ft"><span>Spainhour Bros Strength Co.</span><span>${esc(name)} · Day ${dayNum}</span></div>
          </section>`;
      });
    });
    root.innerHTML = pages;
    document.body.classList.add('printing');
    // Let images/fonts paint before opening the print dialog
    setTimeout(() => window.print(), 350);
  }

  function exerciseModal(ex) {
    const cats = [...new Set(SB.store.all('exercises').map(e => e.category))].sort();
    modal({
      title: ex ? 'Edit Exercise' : 'Add Exercise',
      body: `<div class="form-grid">
        ${field('Name', `<input class="input" name="name" value="${esc(ex ? ex.name : '')}" required>`, 'full')}
        ${field('Category', `<input class="input" name="category" list="cat-list" value="${esc(ex ? ex.category : '')}"><datalist id="cat-list">${cats.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`, 'full')}
        ${field('Coaching cues / video link', `<textarea class="input" name="cues">${esc(ex ? ex.cues || '' : '')}</textarea>`, 'full')}
      </div>`,
      foot: `${ex ? `<button class="btn danger" id="ex-del">${icon('trash')}Delete</button><span class="spacer"></span>` : ''}<button class="btn" data-close>Cancel</button><button class="btn primary" id="ex-save">Save</button>`,
      onMount(m) {
        m.querySelector('#ex-save').addEventListener('click', () => {
          const d = SB.ui.formData(m);
          if (!d.name) { toast('Name is required', 'bad'); return; }
          SB.store.upsert('exercises', Object.assign(ex || {}, d, { category: d.category || 'Other' }));
          closeModal(); SB.refresh();
        });
        const del = m.querySelector('#ex-del');
        if (del) del.addEventListener('click', () => { SB.store.remove('exercises', ex.id); closeModal(); SB.refresh(); });
      }
    });
  }

  SB.views.programs = {
    GOALS, LEVELS, printProgram, duplicate, assignModal, dayCount, weekCount,
    isPdfOnly, viewPDF, downloadPDF, uploadPDFs, attachPDF, deleteProgram, pdfDetailsModal,
    render(el, { q }) {
      const tab = q.tab === 'exercises' ? 'exercises' : 'programs';
      el.innerHTML = `
        ${pageHead({
          kicker: 'Training', title: 'Program Library',
          sub: 'Every program you have built or uploaded. Add your finished program PDFs, assign programs to clients, or print built ones in the SBSC format.',
          actions: `<button class="btn primary" id="up-pdf">${icon('upload')}Upload PDF</button>
                    <a class="btn" href="#/builder">${icon('plus')}Build Program</a>
                    <button class="btn" id="imp">${icon('upload')}Import Program File</button>`
        })}
        <div class="content">
          <div class="tabs">
            <button class="${tab === 'programs' ? 'active' : ''}" data-tab="programs">Programs (${SB.store.all('programs').length})</button>
            <button class="${tab === 'exercises' ? 'active' : ''}" data-tab="exercises">Exercise Library (${SB.store.all('exercises').length})</button>
          </div>
          <div id="tab-body"></div>
        </div>`;
      el.querySelectorAll('[data-tab]').forEach(b => b.addEventListener('click', () => SB.go('#/programs' + (b.dataset.tab === 'exercises' ? '?tab=exercises' : ''))));
      el.querySelector('#up-pdf').addEventListener('click', async () => uploadPDFs(await pickFile('.pdf,application/pdf', true)));
      if (q.upload) setTimeout(async () => uploadPDFs(await pickFile('.pdf,application/pdf', true)), 50);
      el.querySelector('#imp').addEventListener('click', async () => {
        const [f] = await pickFile('.json,application/json');
        if (!f) return;
        try {
          const p = JSON.parse(await readText(f));
          if (!p || !Array.isArray(p.phases)) throw new Error('Not an SBSC program file');
          delete p.id; p.name = p.name || 'Imported Program';
          SB.store.upsert('programs', p); toast('Program imported'); SB.refresh();
        } catch (e) { toast(e.message, 'bad'); }
      });
      const body = el.querySelector('#tab-body');
      if (tab === 'exercises') return this.renderExercises(body);
      this.renderPrograms(body);
    },

    renderPrograms(body) {
      body.innerHTML = `
        <div class="toolbar">
          <input class="input" id="pq" placeholder="Search programs…">
          ${select('type', [['', 'All types'], ['pdf', 'PDF programs'], ['built', 'Built in dashboard']], '', 'id="pt"')}
          ${select('goal', [['', 'All goals'], ...GOALS], '', 'id="pg"')}
          ${select('level', [['', 'All levels'], ...LEVELS], '', 'id="pl"')}
        </div>
        <div class="drop" id="pdf-drop" style="padding:16px;margin-bottom:16px"><strong>Drop program PDFs here</strong><div class="hint">or click to choose · each PDF becomes a program you can assign to clients</div></div>
        <div id="prog-grid"></div>`;
      const dz = body.querySelector('#pdf-drop');
      dz.addEventListener('click', async () => uploadPDFs(await pickFile('.pdf,application/pdf', true)));
      dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('over'); });
      dz.addEventListener('dragleave', () => dz.classList.remove('over'));
      dz.addEventListener('drop', e => { e.preventDefault(); dz.classList.remove('over'); uploadPDFs([...e.dataTransfer.files]); });

      const draw = () => {
        const term = body.querySelector('#pq').value.toLowerCase();
        const type = body.querySelector('#pt').value;
        const goal = body.querySelector('#pg').value, level = body.querySelector('#pl').value;
        const list = SB.store.all('programs').filter(p =>
          (!term || [p.name, p.tagline, p.description, (p.tags || []).join(' '), p.pdf ? p.pdf.name : ''].join(' ').toLowerCase().includes(term)) &&
          (!type || (type === 'pdf' ? !!p.pdf : dayCount(p) > 0)) &&
          (!goal || p.goal === goal) && (!level || p.level === level))
          .sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        const grid = body.querySelector('#prog-grid');
        if (!list.length) { grid.innerHTML = empty('No programs match', '', `<a class="btn primary" href="#/builder">${icon('plus')}Build one</a>`); return; }
        grid.innerHTML = `<div class="grid cards">${list.map(p => {
          const assigned = SB.store.all('clients').filter(c => c.programId === p.id).length;
          const pdfOnly = isPdfOnly(p);
          return `<div class="card prog-card">
            ${p.pdf ? `<div class="prog-thumb ${p.pdf.landscape === false ? 'portrait' : ''}" data-act="view" data-id="${p.id}" title="View PDF">
                ${p.pdf.hasThumb ? `<img data-thumb="${p.pdf.id}" alt="">` : ''}
                <div class="thumb-fallback"><div class="k">${esc(p.goal || 'Program PDF')}</div><h3>${esc(p.name)}</h3></div>
                <span class="badge dark pdf-tag">PDF${p.pdf.pages ? ' · ' + p.pdf.pages + ' pg' : ''}</span>
              </div>
              <div class="body" style="padding-bottom:4px"><div class="title" style="font-family:Bebas;font-size:26px;line-height:1">${esc(p.name)}</div></div>`
              : `<div class="band"><div class="k">${esc(p.goal || 'Program')}</div><h3>${esc(p.name)}</h3></div>`}
            <div class="body" ${p.pdf ? 'style="padding-top:6px"' : ''}>
              <div class="meta">
                ${p.pdf && p.goal ? `<span class="badge">${esc(p.goal)}</span>` : ''}
                ${p.level ? `<span class="badge">${esc(p.level)}</span>` : ''}
                ${!pdfOnly ? `<span class="badge">${weekCount(p)} wks</span><span class="badge">${dayCount(p)} days</span><span class="badge">${exCount(p)} exercises</span>` : ''}
                ${p.pdf && !pdfOnly ? '<span class="badge orange">+ PDF</span>' : ''}
                ${(p.tags || []).includes('template') ? '<span class="badge orange">Template</span>' : ''}
                ${assigned ? `<span class="badge dark">${assigned} assigned</span>` : ''}
              </div>
              <div class="desc">${esc(p.tagline || p.description || '')}</div>
            </div>
            <div class="actions">
              ${pdfOnly
                ? `<button class="btn sm primary" data-act="view" data-id="${p.id}">View PDF</button>
                   <button class="btn sm" data-act="assign" data-id="${p.id}">${icon('user')}Assign</button>
                   <button class="btn sm" data-act="details" data-id="${p.id}">${icon('edit')}Details</button>
                   <button class="btn sm ghost" data-act="pdfdl" data-id="${p.id}" title="Download PDF">${icon('download')}</button>`
                : `<a class="btn sm primary" href="#/builder/${p.id}">${icon('edit')}Edit</a>
                   <button class="btn sm" data-act="assign" data-id="${p.id}">${icon('user')}Assign</button>
                   ${p.pdf ? `<button class="btn sm" data-act="view" data-id="${p.id}">View PDF</button>` : ''}
                   <button class="btn sm" data-act="print" data-id="${p.id}">${icon('print')}Print</button>
                   <button class="btn sm" data-act="dup" data-id="${p.id}">${icon('copy')}Duplicate</button>
                   <button class="btn sm ghost" data-act="export" data-id="${p.id}" title="Export program file">${icon('download')}</button>`}
              <button class="btn sm ghost danger" data-act="del" data-id="${p.id}" title="Delete">${icon('trash')}</button>
            </div>
          </div>`;
        }).join('')}</div>`;
        loadThumbs(grid);
        grid.querySelectorAll('[data-act]').forEach(b => b.addEventListener('click', async () => {
          const p = SB.store.get('programs', b.dataset.id);
          const act = b.dataset.act;
          if (act === 'assign') assignModal(p);
          if (act === 'print') printProgram(p);
          if (act === 'view') viewPDF(p);
          if (act === 'pdfdl') downloadPDF(p);
          if (act === 'details') pdfDetailsModal(p);
          if (act === 'dup') { const c = await duplicate(p); toast('Duplicated'); SB.go('#/builder/' + c.id); }
          if (act === 'export') download(`${(p.name || 'program').replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.sbsc-program.json`, JSON.stringify(Object.assign({}, p, { pdf: undefined }), null, 2));
          if (act === 'del' && await deleteProgram(p)) draw();
        }));
      };
      ['#pq', '#pt', '#pg', '#pl'].forEach(s => body.querySelector(s).addEventListener('input', draw));
      draw();
    },

    renderExercises(body) {
      body.innerHTML = `
        <div class="toolbar">
          <input class="input" id="eq" placeholder="Search exercises…">
          <span class="spacer"></span>
          <button class="btn primary" id="add-ex">${icon('plus')}Add Exercise</button>
        </div>
        <div id="ex-list"></div>`;
      const draw = () => {
        const term = body.querySelector('#eq').value.toLowerCase();
        const list = SB.store.all('exercises').filter(e => !term || (e.name + ' ' + e.category).toLowerCase().includes(term));
        const cats = [...new Set(list.map(e => e.category))].sort();
        body.querySelector('#ex-list').innerHTML = !list.length ? empty('No exercises found') : `<div class="grid cards">${cats.map(c => `
          <div class="card"><div class="card-head"><div class="card-title">${esc(c)}</div><span class="badge">${list.filter(e => e.category === c).length}</span></div>
            <ul class="list">${list.filter(e => e.category === c).sort((a, b) => a.name.localeCompare(b.name)).map(e =>
              `<li style="padding:6px 0"><span class="grow">${esc(e.name)}${e.cues ? ' <span class="hint">· cues</span>' : ''}</span><button class="btn sm ghost" data-ex="${e.id}">${icon('edit')}</button></li>`).join('')}</ul>
          </div>`).join('')}</div>`;
        body.querySelectorAll('[data-ex]').forEach(b => b.addEventListener('click', () => exerciseModal(SB.store.get('exercises', b.dataset.ex))));
      };
      body.querySelector('#eq').addEventListener('input', draw);
      body.querySelector('#add-ex').addEventListener('click', () => exerciseModal(null));
      draw();
    }
  };
})(window.SB);
