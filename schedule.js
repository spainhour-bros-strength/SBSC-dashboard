/* Schedule & Sign-Up — month calendar, sessions, rosters, attendance */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead, empty, modal, closeModal, toast, field, select, input, fmtDate, fmtTime, todayISO, toISO, parseISO, addDays, MONTHS } = SB.ui;

  const TYPES = ['Small Group', '1-on-1', 'Team Training', 'Force Plate Testing', 'Open Gym', 'Evaluation', 'Speed & Agility', 'Class'];
  const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const spots = s => (s.capacity ? s.capacity - (s.roster || []).filter(r => r.status !== 'waitlist').length : Infinity);

  function sessionModal(s, presetDate) {
    const isNew = !s;
    s = s || { title: '', type: 'Small Group', date: presetDate || todayISO(), start: '16:00', end: '17:00', capacity: 10, coach: (SB.store.settings().coaches || [])[0] || '', location: '', notes: '', roster: [] };
    const T = todayISO();
    const coaches = SB.store.settings().coaches || [];
    const clients = SB.store.all('clients').filter(c => c.status !== 'cancelled').sort((a, b) => SB.store.clientName(a).localeCompare(SB.store.clientName(b)));

    const rosterHtml = () => {
      const r = s.roster || [];
      const booked = r.filter(x => x.status !== 'waitlist').length;
      const avail = clients.filter(c => !r.some(x => x.clientId === c.id));
      return `
        <div class="card-head" style="margin:18px 0 8px"><div class="card-title">Roster · ${booked}${s.capacity ? ' / ' + s.capacity : ''}</div>
          ${s.capacity && booked >= s.capacity ? '<span class="badge bad">Full — new sign-ups go to waitlist</span>' : ''}</div>
        <div class="row">
          <select class="input" id="r-add" style="flex:1">${[['', 'Sign up a client…'], ...avail.map(c => [c.id, SB.store.clientName(c) + (c.status === 'lead' ? ' (lead)' : '')])].map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('')}</select>
          <button class="btn primary" id="r-add-btn">${icon('plus')}Add</button>
        </div>
        ${r.length ? `<ul class="list mt-s">${r.map(x => {
          const c = SB.store.clientById(x.clientId);
          return `<li><span class="grow"><a class="title" href="#/clients/${x.clientId}">${esc(SB.store.clientName(c))}</a>${c && c.limitations ? `<div class="sub">⚠ ${esc(c.limitations.slice(0, 70))}</div>` : ''}</span>
            ${x.status === 'waitlist' ? '<span class="badge warn">Waitlist</span>' : `
            <button class="btn sm ${x.status === 'attended' ? 'primary' : ''}" data-st="attended" data-c="${x.clientId}">${icon('check')}Here</button>
            <button class="btn sm ${x.status === 'no-show' ? 'dark' : ''}" data-st="no-show" data-c="${x.clientId}">No-show</button>`}
            <button class="btn sm ghost" data-rm="${x.clientId}" title="Remove">${icon('x')}</button></li>`;
        }).join('')}</ul>` : '<p class="hint">Nobody signed up yet.</p>'}
        ${r.length && s.date <= T ? `<button class="btn sm mt-s" id="r-all">${icon('check')}Mark everyone here</button>` : ''}`;
    };

    const m = modal({
      title: isNew ? 'New Session' : s.title || 'Session', wide: true,
      body: `<div class="form-grid" id="s-form">
          ${field('Title', input('title', s.title, 'placeholder="e.g. Athlete Development"'))}
          ${field('Type', `<input class="input" name="type" list="type-list" value="${esc(s.type || '')}"><datalist id="type-list">${TYPES.map(t => `<option value="${esc(t)}">`).join('')}</datalist>`)}
          ${field('Date', input('date', s.date, 'type="date"'))}
          <div class="form-grid" style="grid-template-columns:1fr 1fr;gap:10px">${field('Start', input('start', s.start, 'type="time"'))}${field('End', input('end', s.end, 'type="time"'))}</div>
          ${field('Capacity (blank = no limit)', input('capacity', s.capacity, 'type="number" min="1"'))}
          ${field('Coach', `<input class="input" name="coach" list="coach-list" value="${esc(s.coach || '')}"><datalist id="coach-list">${coaches.map(c => `<option value="${esc(c)}">`).join('')}</datalist>`)}
          ${field('Location', input('location', s.location, 'placeholder="Main floor, turf…"'))}
          ${isNew ? field('Repeat weekly', select('repeat', [['0', 'Does not repeat'], ['4', 'Every week for 4 weeks'], ['8', 'Every week for 8 weeks'], ['12', 'Every week for 12 weeks']], '0')) : '<div></div>'}
          ${field('Notes / plan for the session', `<textarea class="input" name="notes">${esc(s.notes || '')}</textarea>`, 'full')}
        </div>
        <div id="roster">${rosterHtml()}</div>`,
      foot: `${!isNew ? `<button class="btn danger" id="s-del">${icon('trash')}Delete</button>${s.seriesId ? `<button class="btn danger ghost" id="s-del-series">Delete future in series</button>` : ''}<span class="spacer"></span>` : ''}
        <button class="btn" data-close>Close</button><button class="btn primary" id="s-save">${isNew ? 'Create Session' : 'Save'}</button>`
    });

    function readForm() {
      const d = SB.ui.formData(m.querySelector('#s-form'));
      const repeat = Number(d.repeat || 0); delete d.repeat;
      if (!d.title) d.title = d.type || 'Session';
      return { d, repeat };
    }
    function saveSession(close) {
      const { d, repeat } = readForm();
      Object.assign(s, d);
      if (isNew && repeat > 1) {
        const seriesId = SB.store.uid('ser');
        for (let i = 0; i < repeat; i++) {
          const copy = JSON.parse(JSON.stringify(s));
          copy.id = i === 0 ? s.id : undefined; copy.seriesId = seriesId; copy.date = addDays(s.date, i * 7);
          copy.roster = i === 0 ? s.roster : (s.roster || []).map(r => ({ clientId: r.clientId, status: 'booked' }));
          const saved = SB.store.upsert('sessions', copy);
          if (i === 0) s.id = saved.id;
        }
        s.seriesId = seriesId;
        toast(`Created ${repeat} weekly sessions`);
      } else {
        SB.store.upsert('sessions', s);
        if (close) toast(isNew ? 'Session created' : 'Saved');
      }
      if (close) { closeModal(); SB.refresh(); }
    }

    function wireRoster() {
      const root = m.querySelector('#roster');
      root.querySelector('#r-add-btn').addEventListener('click', () => {
        const id = root.querySelector('#r-add').value; if (!id) return;
        const booked = (s.roster || []).filter(x => x.status !== 'waitlist').length;
        s.roster = (s.roster || []).concat([{ clientId: id, status: s.capacity && booked >= s.capacity ? 'waitlist' : 'booked', at: new Date().toISOString() }]);
        if (!isNew || s.id) SB.store.upsert('sessions', s);
        redraw();
      });
      root.querySelectorAll('[data-st]').forEach(b => b.addEventListener('click', () => {
        const x = s.roster.find(r => r.clientId === b.dataset.c);
        x.status = x.status === b.dataset.st ? 'booked' : b.dataset.st;
        if (s.id) SB.store.upsert('sessions', s); redraw();
      }));
      root.querySelectorAll('[data-rm]').forEach(b => b.addEventListener('click', () => {
        const wasBooked = s.roster.find(r => r.clientId === b.dataset.rm).status !== 'waitlist';
        s.roster = s.roster.filter(r => r.clientId !== b.dataset.rm);
        // Promote first person on the waitlist
        if (wasBooked) { const w = s.roster.find(r => r.status === 'waitlist'); if (w) { w.status = 'booked'; toast(`${SB.store.clientName(SB.store.clientById(w.clientId))} moved off the waitlist`); } }
        if (s.id) SB.store.upsert('sessions', s); redraw();
      }));
      const all = root.querySelector('#r-all');
      if (all) all.addEventListener('click', () => { s.roster.forEach(r => { if (r.status !== 'waitlist') r.status = 'attended'; }); if (s.id) SB.store.upsert('sessions', s); redraw(); });
    }
    function redraw() { m.querySelector('#roster').innerHTML = rosterHtml(); wireRoster(); }
    wireRoster();

    m.querySelector('#s-save').addEventListener('click', () => saveSession(true));
    // Saving on close too, so roster changes on an existing session are never lost
    m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => { if (!isNew) SB.refresh(); }));
    const del = m.querySelector('#s-del');
    if (del) del.addEventListener('click', async () => { if (await SB.ui.confirm('Delete this session?')) { SB.store.remove('sessions', s.id); SB.refresh(); } });
    const dels = m.querySelector('#s-del-series');
    if (dels) dels.addEventListener('click', async () => {
      const future = SB.store.all('sessions').filter(x => x.seriesId === s.seriesId && x.date >= s.date);
      if (await SB.ui.confirm(`Delete ${future.length} session(s) in this series from ${fmtDate(s.date)} on?`)) {
        SB.store.state.sessions = SB.store.all('sessions').filter(x => !(x.seriesId === s.seriesId && x.date >= s.date));
        SB.store.save(); SB.refresh();
      }
    });
  }

  function bookClientModal(c) {
    const T = todayISO();
    const list = SB.store.all('sessions').filter(s => s.date >= T && s.date <= addDays(T, 28))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
    modal({
      title: 'Book ' + SB.store.clientName(c), wide: true,
      body: list.length ? `<ul class="list">${list.map(s => {
        const on = (s.roster || []).find(r => r.clientId === c.id);
        const left = spots(s);
        return `<li><span class="when">${fmtDate(s.date, { noYear: true }).toUpperCase()}<br>${fmtTime(s.start)}</span>
          <span class="grow"><span class="title">${esc(s.title)}</span><div class="sub">${esc(s.type || '')}${s.coach ? ' · ' + esc(s.coach) : ''} · ${left === Infinity ? 'open' : left > 0 ? left + ' spot' + (left === 1 ? '' : 's') + ' left' : 'full'}</div></span>
          ${on ? `<span class="badge ${on.status === 'waitlist' ? 'warn' : 'good'}">${on.status === 'waitlist' ? 'Waitlisted' : 'Booked'}</span>`
            : `<button class="btn sm ${left > 0 ? 'primary' : ''}" data-book="${s.id}">${left > 0 ? 'Book' : 'Waitlist'}</button>`}</li>`;
      }).join('')}</ul>` : empty('No sessions in the next 4 weeks', '<div>Create sessions on the schedule first.</div>'),
      foot: `<a class="btn" href="#/schedule">Open schedule</a><button class="btn primary" data-close>Done</button>`,
      onMount(m) {
        m.querySelectorAll('[data-book]').forEach(b => b.addEventListener('click', () => {
          const s = SB.store.get('sessions', b.dataset.book);
          s.roster = (s.roster || []).concat([{ clientId: c.id, status: spots(s) > 0 ? 'booked' : 'waitlist', at: new Date().toISOString() }]);
          SB.store.upsert('sessions', s); toast('Booked'); bookClientModal(c);
        }));
        m.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => SB.refresh()));
      }
    });
  }

  SB.views.schedule = {
    sessionModal, bookClientModal,
    render(el, { q }) {
      const view = q.view === 'list' ? 'list' : 'month';
      const T = todayISO();
      const ym = q.m && /^\d{4}-\d{2}$/.test(q.m) ? q.m : T.slice(0, 7);
      const [Y, M] = ym.split('-').map(Number);
      el.innerHTML = `
        ${pageHead({
          kicker: 'Business', title: 'Schedule & Sign-Up',
          sub: 'Create sessions, sign clients up, and take attendance. Click any day to add a session.',
          actions: `<button class="btn primary" id="s-new">${icon('plus')}New Session</button>`
        })}
        <div class="content">
          <div class="tabs">
            <button data-v="month" class="${view === 'month' ? 'active' : ''}">Month</button>
            <button data-v="list" class="${view === 'list' ? 'active' : ''}">Upcoming List</button>
          </div>
          <div id="s-body"></div>
        </div>`;
      el.querySelector('#s-new').addEventListener('click', () => sessionModal(null));
      el.querySelectorAll('[data-v]').forEach(b => b.addEventListener('click', () => SB.go('#/schedule?view=' + b.dataset.v + (q.m ? '&m=' + q.m : ''))));
      const body = el.querySelector('#s-body');
      if (view === 'list') return this.renderList(body);

      const first = new Date(Y, M - 1, 1);
      const start = addDays(toISO(first), -((first.getDay() + 6) % 7));
      const prevM = toISO(new Date(Y, M - 2, 1)).slice(0, 7), nextM = toISO(new Date(Y, M, 1)).slice(0, 7);
      const sessions = SB.store.all('sessions');
      const byDate = {};
      sessions.forEach(s => (byDate[s.date] = byDate[s.date] || []).push(s));
      Object.values(byDate).forEach(a => a.sort((x, y) => (x.start || '').localeCompare(y.start || '')));
      const days = Array.from({ length: 42 }, (_, i) => addDays(start, i));
      const lastRowNeeded = days.slice(35).some(d => d.slice(0, 7) === ym) ? 42 : 35;
      const monthSessions = sessions.filter(s => s.date.slice(0, 7) === ym);
      const att = monthSessions.flatMap(s => s.roster || []).filter(r => r.status === 'attended').length;

      body.innerHTML = `
        <div class="cal-head">
          <button class="btn icon" id="c-prev">${icon('left')}</button>
          <h2>${MONTHS[M - 1].toUpperCase()} ${Y}</h2>
          <button class="btn icon" id="c-next">${icon('right')}</button>
          <button class="btn sm" id="c-today">Today</button>
          <span class="spacer"></span>
          <span class="hint">${monthSessions.length} sessions · ${monthSessions.reduce((n, s) => n + (s.roster || []).length, 0)} sign-ups · ${att} check-ins</span>
        </div>
        <div class="cal">
          ${DOW.map(d => `<div class="dow">${d}</div>`).join('')}
          ${days.slice(0, lastRowNeeded).map(d => `
            <div class="day ${d.slice(0, 7) !== ym ? 'other' : ''} ${d === T ? 'today' : ''}" data-date="${d}">
              <span class="n">${parseISO(d).getDate()}</span>
              ${(byDate[d] || []).slice(0, 4).map(s => `<span class="ev ${spots(s) <= 0 ? 'full' : ''} ${d < T ? 'past' : ''}" data-s="${s.id}" title="${esc(s.title)}">${fmtTime(s.start)} ${esc(s.title)} · ${(s.roster || []).length}${s.capacity ? '/' + s.capacity : ''}</span>`).join('')}
              ${(byDate[d] || []).length > 4 ? `<span class="hint" style="font-size:11px">+${byDate[d].length - 4} more</span>` : ''}
            </div>`).join('')}
        </div>`;
      const nav = m => SB.go('#/schedule?m=' + m);
      body.querySelector('#c-prev').addEventListener('click', () => nav(prevM));
      body.querySelector('#c-next').addEventListener('click', () => nav(nextM));
      body.querySelector('#c-today').addEventListener('click', () => nav(T.slice(0, 7)));
      body.querySelectorAll('.day').forEach(d => d.addEventListener('click', e => {
        const ev = e.target.closest('[data-s]');
        if (ev) sessionModal(SB.store.get('sessions', ev.dataset.s));
        else sessionModal(null, d.dataset.date);
      }));
    },

    renderList(body) {
      const T = todayISO();
      const list = SB.store.all('sessions').filter(s => s.date >= addDays(T, -1) && s.date <= addDays(T, 21))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      if (!list.length) { body.innerHTML = empty('No upcoming sessions', '<div>Create your recurring sessions with "Repeat weekly".</div>'); return; }
      const byDate = {}; list.forEach(s => (byDate[s.date] = byDate[s.date] || []).push(s));
      body.innerHTML = Object.entries(byDate).map(([d, ss]) => `
        <div class="card" style="margin-bottom:14px">
          <div class="card-head"><div class="card-title">${d === T ? 'Today · ' : ''}${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][parseISO(d).getDay()]} ${fmtDate(d, { noYear: true })}</div></div>
          <ul class="list">${ss.map(s => {
            const n = (s.roster || []).filter(r => r.status !== 'waitlist').length, w = (s.roster || []).filter(r => r.status === 'waitlist').length;
            return `<li class="clickable" data-s="${s.id}" style="cursor:pointer">
              <span class="when">${fmtTime(s.start)}${s.end ? '–' + fmtTime(s.end) : ''}</span>
              <span class="grow"><span class="title">${esc(s.title)}</span><div class="sub">${esc(s.type || '')}${s.coach ? ' · ' + esc(s.coach) : ''}${s.location ? ' · ' + esc(s.location) : ''}</div></span>
              ${w ? `<span class="badge warn">${w} waitlist</span>` : ''}
              <span class="badge ${s.capacity && n >= s.capacity ? 'bad' : 'dark'}">${n}${s.capacity ? '/' + s.capacity : ''}</span>
              <button class="btn sm">Roster</button></li>`;
          }).join('')}</ul>
        </div>`).join('');
      body.querySelectorAll('[data-s]').forEach(li => li.addEventListener('click', () => sessionModal(SB.store.get('sessions', li.dataset.s))));
    }
  };
})(window.SB);
