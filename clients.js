/* Clients — roster, profiles, coach notes, attendance, program + jump summary */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead, empty, modal, closeModal, toast, field, select, input, fmtDate, fmtTime, todayISO, addDays, daysBetween } = SB.ui;

  const STATUSES = [['lead', 'Lead / Prospect'], ['active', 'Active'], ['paused', 'Paused'], ['cancelled', 'Cancelled']];
  const LEVELS = ['Youth', 'Middle School', 'High School', 'College', 'Professional', 'Adult', 'Masters'];
  const statusBadge = s => `<span class="badge ${s === 'active' ? 'good' : s === 'lead' ? 'orange' : s === 'paused' ? 'warn' : ''}">${esc((STATUSES.find(x => x[0] === s) || [s, s || '—'])[1])}</span>`;

  function editClient(c, onSaved) {
    const isNew = !c;
    c = c || { status: 'active', startDate: todayISO() };
    const plans = SB.store.all('plans');
    const programs = SB.store.all('programs');
    modal({
      title: isNew ? 'New Client' : 'Edit ' + SB.store.clientName(c), wide: true,
      body: `<div class="form-grid">
        ${field('First name', input('first', c.first, 'required'))}
        ${field('Last name', input('last', c.last))}
        ${field('Email', input('email', c.email, 'type="email"'))}
        ${field('Phone', input('phone', c.phone, 'type="tel"'))}
        ${field('Sport', input('sport', c.sport, 'list="sport-list" placeholder="e.g. Basketball, General Fitness"'))}
        ${field('Level', select('level', [['', '—'], ...LEVELS], c.level))}
        ${field('Position / group', input('position', c.position))}
        ${field('School / team', input('team', c.team))}
        ${field('Parent / guardian (youth)', input('guardian', c.guardian))}
        ${field('Guardian phone', input('guardianPhone', c.guardianPhone, 'type="tel"'))}
        ${field('Emergency contact', input('emergency', c.emergency, 'placeholder="Name · phone"'), 'full')}
        ${field('Status', select('status', STATUSES, c.status))}
        ${field('Membership plan', select('planId', [['', 'No plan'], ...plans.map(p => [p.id, p.name])], c.planId))}
        ${field('Start date', input('startDate', c.startDate, 'type="date"'))}
        ${field('Next renewal / billing date', input('renewalDate', c.renewalDate, 'type="date"'))}
        ${field('Assigned program', select('programId', [['', 'None'], ...programs.map(p => [p.id, p.name])], c.programId))}
        ${field('Name as it appears in ForceDecks', input('forceDecksName', c.forceDecksName, 'placeholder="Only if it differs"'))}
        ${field('Goals', `<textarea class="input" name="goals">${esc(c.goals || '')}</textarea>`, 'full')}
        ${field('Injuries / limitations', `<textarea class="input" name="limitations" placeholder="Anything to train around">${esc(c.limitations || '')}</textarea>`, 'full')}
      </div>
      <datalist id="sport-list">${[...new Set(SB.store.all('clients').map(x => x.sport).filter(Boolean).concat(['Basketball', 'Football', 'Baseball', 'Softball', 'Soccer', 'Volleyball', 'Track & Field', 'Wrestling', 'General Fitness']))].map(s => `<option value="${esc(s)}">`).join('')}</datalist>`,
      foot: `${!isNew ? `<button class="btn danger" id="c-del">${icon('trash')}Delete</button><span class="spacer"></span>` : ''}
        <button class="btn" data-close>Cancel</button><button class="btn primary" id="c-save">${isNew ? 'Add Client' : 'Save'}</button>`,
      onMount(m) {
        m.querySelector('#c-save').addEventListener('click', () => {
          const d = SB.ui.formData(m);
          if (!d.first) { toast('First name is required', 'bad'); return; }
          if (d.programId && d.programId !== c.programId) d.programAssignedAt = todayISO();
          const saved = SB.store.upsert('clients', Object.assign(c, d));
          closeModal(); toast(isNew ? 'Client added' : 'Saved');
          onSaved ? onSaved(saved) : SB.refresh();
        });
        const del = m.querySelector('#c-del');
        if (del) del.addEventListener('click', async () => {
          const nt = SB.store.testsFor(c.id).length;
          if (!(await SB.ui.confirm(`Delete ${SB.store.clientName(c)}? This also removes ${nt} jump test${nt === 1 ? '' : 's'} and their session bookings.`))) return;
          SB.store.state.tests = SB.store.all('tests').filter(t => t.clientId !== c.id);
          SB.store.all('sessions').forEach(s => { s.roster = (s.roster || []).filter(r => r.clientId !== c.id); });
          SB.store.remove('clients', c.id);
          toast('Client deleted'); SB.go('#/clients');
        });
      }
    });
  }

  function attendanceFor(clientId) {
    const out = [];
    SB.store.all('sessions').forEach(s => (s.roster || []).forEach(r => { if (r.clientId === clientId) out.push({ s, status: r.status }); }));
    return out.sort((a, b) => (b.s.date + b.s.start).localeCompare(a.s.date + a.s.start));
  }

  SB.views.clients = {
    STATUSES, statusBadge, editClient, attendanceFor,
    render(el, { id, q }) {
      if (id) return this.renderDetail(el, id);
      const all = SB.store.all('clients');
      el.innerHTML = `
        ${pageHead({
          kicker: 'Business', title: 'Clients',
          sub: 'Everyone you train — athletes, adults and leads. Click a row to open the full profile.',
          actions: `<button class="btn primary" id="c-new">${icon('plus')}New Client</button><button class="btn" id="c-exp">${icon('download')}Export CSV</button>`
        })}
        <div class="content">
          <div class="toolbar">
            <input class="input" id="cq" placeholder="Search name, sport, team…" value="${esc(q.q || '')}">
            ${select('status', [['', 'All statuses'], ...STATUSES], q.status || '', 'id="cs"')}
            ${select('sport', [['', 'All sports'], ...[...new Set(all.map(c => c.sport).filter(Boolean))].sort()], '', 'id="csp"')}
            <span class="spacer"></span>
            <span class="hint" id="c-count"></span>
          </div>
          <div id="c-table"></div>
        </div>`;
      el.querySelector('#c-new').addEventListener('click', () => editClient(null, c => SB.go('#/clients/' + c.id)));
      el.querySelector('#c-exp').addEventListener('click', () => {
        const plans = SB.store.all('plans');
        const rows = [['First', 'Last', 'Email', 'Phone', 'Sport', 'Level', 'Status', 'Plan', 'Start', 'Renewal', 'Program'],
          ...all.map(c => [c.first, c.last, c.email, c.phone, c.sport, c.level, c.status, (plans.find(p => p.id === c.planId) || {}).name || '', c.startDate, c.renewalDate, (SB.store.get('programs', c.programId) || {}).name || ''])];
        SB.ui.download(`sbsc-clients-${todayISO()}.csv`, SB.ui.toCSV(rows), 'text/csv');
      });
      if (q.new) setTimeout(() => editClient(null, c => SB.go('#/clients/' + c.id)), 30);

      const draw = () => {
        const term = el.querySelector('#cq').value.toLowerCase();
        const st = el.querySelector('#cs').value, sp = el.querySelector('#csp').value;
        const rows = all.filter(c => (!term || [c.first, c.last, c.sport, c.team, c.email, c.position].join(' ').toLowerCase().includes(term)) && (!st || c.status === st) && (!sp || c.sport === sp));
        el.querySelector('#c-count').textContent = `${rows.length} of ${all.length}`;
        const T = todayISO();
        SB.ui.sortableTable(el.querySelector('#c-table'), {
          rows, onRow: c => SB.go('#/clients/' + c.id), initialSort: { key: 'name', dir: 1 },
          emptyHtml: empty(all.length ? 'No matches' : 'No clients yet', all.length ? '' : '<div>Add your first client to get started.</div>'),
          cols: [
            { key: 'name', label: 'Name', sort: c => SB.store.clientName(c).toLowerCase(), render: c => `<b>${esc(SB.store.clientName(c))}</b>${c.team ? `<div class="hint">${esc(c.team)}</div>` : ''}` },
            { key: 'sport', label: 'Sport', render: c => esc(c.sport || '—') },
            { key: 'level', label: 'Level', render: c => esc(c.level || '—') },
            { key: 'status', label: 'Status', render: c => statusBadge(c.status) },
            { key: 'plan', label: 'Plan', sort: c => (SB.store.get('plans', c.planId) || {}).name, render: c => esc((SB.store.get('plans', c.planId) || {}).name || '—') },
            { key: 'program', label: 'Program', sort: c => (SB.store.get('programs', c.programId) || {}).name, render: c => esc((SB.store.get('programs', c.programId) || {}).name || '—') },
            { key: 'renewal', label: 'Renewal', sort: c => c.renewalDate, render: c => {
              if (!c.renewalDate) return '<span class="muted">—</span>';
              const d = daysBetween(T, c.renewalDate);
              return `${fmtDate(c.renewalDate, { noYear: true })}${c.status === 'active' && d <= 7 ? ` <span class="badge ${d < 0 ? 'bad' : 'warn'}">${d < 0 ? 'overdue' : d + 'd'}</span>` : ''}`;
            } },
            { key: 'tests', label: 'Jumps', num: true, sort: c => SB.store.testsFor(c.id).length, render: c => SB.store.testsFor(c.id).length || '—' }
          ]
        });
      };
      ['#cq', '#cs', '#csp'].forEach(s => el.querySelector(s).addEventListener('input', draw));
      draw();
    },

    renderDetail(el, id) {
      const c = SB.store.clientById(id);
      if (!c) { el.innerHTML = `<div class="content">${empty('Client not found', '', '<a class="btn" href="#/clients">Back</a>')}</div>`; return; }
      const plan = SB.store.get('plans', c.planId);
      const prog = SB.store.get('programs', c.programId);
      const ss = SB.fd.sessionsFor(c.id);
      const rd = SB.fd.readiness(ss);
      const names = SB.fd.allMetricNames();
      const jh = SB.fd.keyCol('jh', names), rsi = SB.fd.keyCol('rsi', names), ppbm = SB.fd.keyCol('ppbm', names);
      const last = ss[ss.length - 1];
      const att = attendanceFor(c.id);
      const T = todayISO();
      const upcoming = att.filter(a => a.s.date >= T).reverse();
      const past = att.filter(a => a.s.date < T);
      const last30 = past.filter(a => a.s.date >= addDays(T, -30));
      const attended30 = last30.filter(a => a.status === 'attended').length;
      const notes = (c.log || []).slice().sort((a, b) => b.at.localeCompare(a.at));

      el.innerHTML = `
        ${pageHead({
          kicker: [c.sport, c.level, c.position].filter(Boolean).join(' · ') || 'Client',
          title: SB.store.clientName(c),
          sub: `${statusBadge(c.status)} ${c.startDate ? `<span style="margin-left:8px">Client since ${fmtDate(c.startDate)}</span>` : ''}`,
          actions: `<button class="btn primary" id="d-edit">${icon('edit')}Edit</button>
            <button class="btn" id="d-book">${icon('calendar')}Book a session</button>
            ${ss.length ? `<a class="btn" href="#/forcedecks/${c.id}">${icon('jump')}Jump report</a>` : ''}
            <a class="btn" href="#/clients">All clients</a>`
        })}
        <div class="content">
          <div class="grid three">
            <div class="card">
              <div class="card-head"><div class="card-title">Contact</div></div>
              <ul class="list">
                <li><span class="when">EMAIL</span><span class="grow">${c.email ? `<a href="mailto:${esc(c.email)}">${esc(c.email)}</a>` : '—'}</span></li>
                <li><span class="when">PHONE</span><span class="grow">${c.phone ? `<a href="tel:${esc(c.phone)}">${esc(c.phone)}</a>` : '—'}</span></li>
                ${c.team ? `<li><span class="when">TEAM</span><span class="grow">${esc(c.team)}</span></li>` : ''}
                ${c.guardian || c.guardianPhone ? `<li><span class="when">GUARDIAN</span><span class="grow">${esc(c.guardian || '')} ${c.guardianPhone ? `· <a href="tel:${esc(c.guardianPhone)}">${esc(c.guardianPhone)}</a>` : ''}</span></li>` : ''}
                ${c.emergency ? `<li><span class="when">EMERG.</span><span class="grow">${esc(c.emergency)}</span></li>` : ''}
              </ul>
            </div>
            <div class="card">
              <div class="card-head"><div class="card-title">Membership</div><a href="#/memberships">Plans →</a></div>
              <div class="kpi" style="padding-left:12px"><div class="label">${plan ? esc(plan.cadence || '') : 'No plan'}</div>
                <div class="value" style="font-size:30px">${plan ? esc(plan.name) : '—'}</div>
                <div class="hint">${plan ? SB.ui.money(plan.price) + (plan.cadence === 'monthly' ? ' / month' : '') : 'Assign a plan from Edit'}</div></div>
              <ul class="list mt-s">
                <li><span class="when">RENEWAL</span><span class="grow">${c.renewalDate ? fmtDate(c.renewalDate) : '—'}</span>
                  ${c.renewalDate && c.status === 'active' ? `<button class="btn sm" id="d-renew" title="Mark paid and roll the renewal date forward">${icon('check')}Mark renewed</button>` : ''}</li>
                <li><span class="when">ATTENDED</span><span class="grow">${attended30} session${attended30 === 1 ? '' : 's'} in the last 30 days${last30.length ? ` · ${Math.round(attended30 / last30.length * 100)}% show rate` : ''}</span></li>
              </ul>
            </div>
            <div class="card">
              <div class="card-head"><div class="card-title">Jump Snapshot</div>${ss.length ? SB.fd.readinessBadge(rd) : ''}</div>
              ${last ? `<div class="metric-cards" style="grid-template-columns:repeat(3,1fr)">
                ${[jh, rsi, ppbm].filter(Boolean).map(n => `<div class="metric-card" style="padding:10px"><div class="l" style="min-height:0">${esc(SB.fd.shortName(n))}</div><div class="v" style="font-size:28px">${SB.fd.fmtMetric(n, last.metrics[n])}</div></div>`).join('')}
              </div><p class="hint">Last test ${fmtDate(last.date)} · ${ss.length} session${ss.length === 1 ? '' : 's'} on file</p>`
                : empty('No jump tests', '<div>Import a ForceDecks CSV to link results.</div>')}
            </div>
          </div>

          <div class="grid two mt">
            <div class="card">
              <div class="card-head"><div class="card-title">Training Program</div>
                <div class="row">${prog && prog.pdf ? `<button class="btn sm" id="d-pdf">View PDF</button><button class="btn sm" id="d-pdfdl" title="Download PDF">${icon('download')}</button>` : ''}
                ${prog && !SB.views.programs.isPdfOnly(prog) ? `<button class="btn sm" id="d-print">${icon('print')}Print for ${esc(c.first || 'client')}</button><a class="btn sm" href="#/builder/${prog.id}">${icon('edit')}Open</a>` : ''}
                <button class="btn sm primary" id="d-prog">${prog ? 'Change' : 'Assign program'}</button></div></div>
              ${prog ? `<div class="title" style="font-family:Bebas;font-size:34px;line-height:1">${esc(prog.name)}</div>
                <div class="hint">${[prog.goal, SB.views.programs.isPdfOnly(prog) ? `PDF program${prog.pdf.pages ? ` · ${prog.pdf.pages} pages` : ''}` : `${SB.views.programs.weekCount(prog)} weeks · ${SB.views.programs.dayCount(prog)} days`].filter(Boolean).map(esc).join(' · ')}${c.programAssignedAt ? ` · assigned ${fmtDate(c.programAssignedAt)}` : ''}</div>
                ${c.programAssignedAt && SB.views.programs.weekCount(prog) ? (() => {
                  const wk = Math.floor(daysBetween(c.programAssignedAt, T) / 7) + 1; const tot = SB.views.programs.weekCount(prog);
                  return wk > tot ? `<div class="notice mt-s">Program finished (${tot} weeks). Time for the next block.</div>`
                    : `<div class="mt-s"><div class="hint">Week ${wk} of ${tot}</div><div style="height:8px;background:var(--line-2);border-radius:4px;overflow:hidden;margin-top:4px"><div style="height:100%;width:${Math.min(100, wk / tot * 100)}%;background:var(--orange)"></div></div></div>`;
                })() : ''}`
                : empty('No program assigned')}
              ${c.goals ? `<div class="card-title mt">Goals</div><p style="white-space:pre-wrap;margin:6px 0 0">${esc(c.goals)}</p>` : ''}
              ${c.limitations ? `<div class="card-title mt">Injuries / Limitations</div><p style="white-space:pre-wrap;margin:6px 0 0">${esc(c.limitations)}</p>` : ''}
            </div>
            <div class="card">
              <div class="card-head"><div class="card-title">Sessions</div><span class="card-sub">${upcoming.length} upcoming · ${past.length} past</span></div>
              ${att.length ? `<ul class="list">${[...upcoming.slice(0, 4), ...past.slice(0, 6)].map(a => `
                <li><span class="when">${fmtDate(a.s.date, { noYear: true }).toUpperCase()}<br>${fmtTime(a.s.start)}</span>
                <span class="grow"><span class="title">${esc(a.s.title)}</span><div class="sub">${esc(a.s.type || '')}</div></span>
                <span class="badge ${a.status === 'attended' ? 'good' : a.status === 'no-show' ? 'bad' : 'dark'}">${a.s.date >= T && a.status === 'booked' ? 'Booked' : esc(a.status)}</span></li>`).join('')}</ul>`
                : empty('No sessions yet', '<div>Book this client into a session.</div>')}
            </div>
          </div>

          <div class="card mt">
            <div class="card-head"><div class="card-title">Coach Notes</div></div>
            <div class="row" style="align-items:flex-start">
              <textarea class="input" id="note-text" placeholder="Add a note — progress, check-ins, conversations with parents…" style="min-height:60px;flex:1"></textarea>
              <button class="btn primary" id="note-add">${icon('plus')}Add</button>
            </div>
            ${notes.length ? `<ul class="list mt-s">${notes.map(n => `<li style="align-items:flex-start"><span class="when">${fmtDate(n.at.slice(0, 10), { noYear: true }).toUpperCase()}</span><span class="grow" style="white-space:pre-wrap">${esc(n.text)}</span><button class="btn sm ghost" data-note="${esc(n.at)}">${icon('x')}</button></li>`).join('')}</ul>` : ''}
            ${c.notes ? `<p class="hint mt-s">${esc(c.notes)}</p>` : ''}
          </div>
        </div>`;

      const $ = s => el.querySelector(s);
      $('#d-edit').addEventListener('click', () => editClient(c));
      $('#d-book').addEventListener('click', () => SB.views.schedule.bookClientModal(c));
      $('#d-prog').addEventListener('click', () => {
        modal({
          title: 'Assign Program',
          body: field('Program', select('programId', [['', 'None'], ...SB.store.all('programs').map(p => [p.id, p.name])], c.programId)),
          foot: `<button class="btn" data-close>Cancel</button><button class="btn primary" id="ap-save">Save</button>`,
          onMount(m) { m.querySelector('#ap-save').addEventListener('click', () => {
            const v = m.querySelector('[name=programId]').value;
            if (v !== c.programId) { c.programId = v; c.programAssignedAt = v ? todayISO() : ''; SB.store.upsert('clients', c); }
            closeModal(); SB.refresh();
          }); }
        });
      });
      const pr = $('#d-print'); if (pr) pr.addEventListener('click', () => SB.views.programs.printProgram(prog, c));
      const pv = $('#d-pdf'); if (pv) pv.addEventListener('click', () => SB.views.programs.viewPDF(prog));
      const pd = $('#d-pdfdl'); if (pd) pd.addEventListener('click', () => SB.views.programs.downloadPDF(prog));
      const rn = $('#d-renew'); if (rn) rn.addEventListener('click', () => {
        const next = SB.views.memberships.nextRenewal(c.renewalDate, plan);
        c.renewalDate = next;
        c.payments = (c.payments || []).concat([{ date: todayISO(), planId: c.planId, amount: plan ? plan.price : null }]);
        SB.store.upsert('clients', c); toast('Renewed — next date ' + fmtDate(next)); SB.refresh();
      });
      $('#note-add').addEventListener('click', () => {
        const t = $('#note-text').value.trim(); if (!t) return;
        c.log = (c.log || []).concat([{ at: new Date().toISOString(), text: t }]);
        SB.store.upsert('clients', c); SB.refresh();
      });
      el.querySelectorAll('[data-note]').forEach(b => b.addEventListener('click', () => {
        c.log = (c.log || []).filter(n => n.at !== b.dataset.note); SB.store.upsert('clients', c); SB.refresh();
      }));
    }
  };
})(window.SB);
