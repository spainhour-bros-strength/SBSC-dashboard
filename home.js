/* Home — business + training snapshot */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead, fmtDate, fmtTime, todayISO, addDays, money, empty } = SB.ui;

  SB.views.home = {
    render(el) {
      const s = SB.store.state;
      const T = todayISO();
      const weekEnd = addDays(T, 6);
      const active = s.clients.filter(c => c.status === 'active');
      const leads = s.clients.filter(c => c.status === 'lead');
      const upcoming = s.sessions.filter(x => x.date >= T && x.date <= weekEnd)
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
      const booked = upcoming.reduce((n, x) => n + (x.roster || []).length, 0);
      const cap = upcoming.reduce((n, x) => n + (Number(x.capacity) || 0), 0);
      const tests30 = s.tests.filter(t => t.date >= addDays(T, -30));
      const mrr = SB.views.memberships.mrr();
      const renewals = SB.views.memberships.renewalsDue(14);
      const readiness = SB.fd.latestReadiness();
      const flagged = readiness.filter(r => r.readiness && r.readiness.level !== 'good').slice(0, 6);

      const firstRun = s.settings.firstRun && !s.clients.length;

      el.innerHTML = `
        ${pageHead({
          kicker: 'Spainhour Bros Strength Co.',
          title: 'Dashboard',
          sub: `${fmtDate(T)} · Your gym at a glance.`,
          actions: `
            <a class="btn primary" href="#/schedule">${icon('calendar')}Schedule</a>
            <a class="btn" href="#/forcedecks?import=1">${icon('upload')}Import ForceDecks CSV</a>
            <a class="btn" href="#/builder">${icon('builder')}New Program</a>`
        })}
        <div class="content stack">
          ${firstRun ? `
          <div class="card">
            <div class="card-head"><div class="card-title">Welcome — getting started</div></div>
            <p style="margin-top:0">The dashboard is empty and ready for real clients. The exercise library and one starter program template are already loaded.</p>
            <div class="row">
              <a class="btn primary" href="#/clients?new=1">${icon('plus')}Add your first client</a>
              <a class="btn" href="#/memberships">${icon('card')}Set up membership plans</a>
              <button class="btn" id="demo-btn">Explore with demo data</button>
              <button class="btn ghost" id="dismiss-btn">Dismiss</button>
            </div>
            <p class="hint mt-s">Demo data adds fake clients, jump tests and sessions so you can see every tab working. You can wipe it from Settings at any time.</p>
          </div>` : ''}

          <div class="grid kpis">
            <div class="card kpi"><div class="label">Active Members</div><div class="value">${active.length}</div><div class="delta flat">${leads.length} lead${leads.length === 1 ? '' : 's'} in pipeline</div></div>
            <div class="card kpi"><div class="label">Est. Monthly Revenue</div><div class="value">${money(mrr)}</div><div class="delta flat">from active monthly plans</div></div>
            <div class="card kpi"><div class="label">Sessions · Next 7 Days</div><div class="value">${upcoming.length}</div><div class="delta flat">${booked} booked${cap ? ` of ${cap} spots` : ''}</div></div>
            <div class="card kpi"><div class="label">Jump Tests · 30 Days</div><div class="value">${tests30.length}</div><div class="delta flat">${new Set(tests30.map(t => t.clientId)).size} athletes tested</div></div>
          </div>

          <div class="grid two">
            <div class="card">
              <div class="card-head"><div class="card-title">Upcoming Sessions</div><a href="#/schedule">Full schedule →</a></div>
              ${upcoming.length ? `<ul class="list">${upcoming.slice(0, 7).map(x => {
                const n = (x.roster || []).length;
                const full = x.capacity && n >= x.capacity;
                return `<li>
                  <div class="when">${x.date === T ? 'TODAY' : fmtDate(x.date, { noYear: true }).toUpperCase()}<br>${fmtTime(x.start)}</div>
                  <div class="grow"><div class="title">${esc(x.title)}</div><div class="sub">${esc(x.type || '')}${x.coach ? ' · ' + esc(x.coach) : ''}</div></div>
                  <span class="badge ${full ? 'bad' : 'dark'}">${n}${x.capacity ? '/' + x.capacity : ''}</span>
                </li>`;
              }).join('')}</ul>` : empty('No sessions this week', '<div>Create one from the schedule.</div>')}
            </div>

            <div class="card">
              <div class="card-head"><div class="card-title">Jump Readiness Flags</div><a href="#/forcedecks">ForceDecks →</a></div>
              ${flagged.length ? `<ul class="list">${flagged.map(r => `
                <li>
                  <div class="grow"><a class="title" href="#/forcedecks/${r.client.id}">${esc(SB.store.clientName(r.client))}</a>
                  <div class="sub">Last test ${fmtDate(r.latest.date, { noYear: true })} · RSI-mod ${SB.ui.fmtNum(r.readiness.value, 2)} vs baseline ${SB.ui.fmtNum(r.readiness.baseline, 2)}</div></div>
                  ${SB.fd.readinessBadge(r.readiness)}
                </li>`).join('')}</ul>`
                : empty(readiness.length ? 'Everyone looks ready' : 'No jump data yet', readiness.length ? '<div>No athlete is more than 5% below their baseline.</div>' : '<div>Import a ForceDecks CSV to see readiness.</div>')}
            </div>
          </div>

          <div class="grid two">
            <div class="card">
              <div class="card-head"><div class="card-title">Renewals Due · 14 Days</div><a href="#/memberships">Memberships →</a></div>
              ${renewals.length ? `<ul class="list">${renewals.map(({ client, plan, days }) => `
                <li><div class="grow"><a class="title" href="#/clients/${client.id}">${esc(SB.store.clientName(client))}</a>
                <div class="sub">${esc(plan ? plan.name : 'No plan')} · ${fmtDate(client.renewalDate)}</div></div>
                <span class="badge ${days < 0 ? 'bad' : days <= 3 ? 'warn' : ''}">${days < 0 ? Math.abs(days) + 'd overdue' : days === 0 ? 'today' : 'in ' + days + 'd'}</span></li>`).join('')}</ul>`
                : empty('Nothing due', '<div>No renewals in the next two weeks.</div>')}
            </div>
            <div class="card">
              <div class="card-head"><div class="card-title">Program Library</div><a href="#/programs">All programs →</a></div>
              ${s.programs.length ? `<ul class="list">${s.programs.slice().sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || '')).slice(0, 5).map(p => {
                const days = (p.phases || []).reduce((n, ph) => n + (ph.days || []).length, 0);
                const assigned = s.clients.filter(c => c.programId === p.id).length;
                const pdfOnly = SB.views.programs.isPdfOnly(p);
                const info = pdfOnly ? `PDF${p.pdf.pages ? ' · ' + p.pdf.pages + ' pages' : ''}` : `${days} day${days === 1 ? '' : 's'} · ${(p.phases || []).length} phase${(p.phases || []).length === 1 ? '' : 's'}${p.pdf ? ' · + PDF' : ''}`;
                return `<li><div class="grow"><a class="title" href="${pdfOnly ? '#/programs' : '#/builder/' + p.id}">${esc(p.name)}</a><div class="sub">${[p.goal, info].filter(Boolean).map(esc).join(' · ')}</div></div>
                <span class="badge">${assigned} assigned</span></li>`;
              }).join('')}</ul>` : empty('No programs yet')}
            </div>
          </div>
        </div>`;

      const demo = el.querySelector('#demo-btn');
      if (demo) demo.addEventListener('click', () => { SB.views.settings.loadDemo(); });
      const dis = el.querySelector('#dismiss-btn');
      if (dis) dis.addEventListener('click', () => { SB.store.setSettings({ firstRun: false }); SB.refresh(); });
    }
  };
})(window.SB);
