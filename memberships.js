/* Memberships — plans, members, renewals, revenue estimate */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead, empty, modal, closeModal, toast, field, select, input, fmtDate, todayISO, addDays, daysBetween, money, chart } = SB.ui;

  const CADENCES = [['monthly', 'Monthly'], ['weekly', 'Weekly'], ['annual', 'Annual'], ['one-time', 'One-time / pack']];
  const monthly = p => !p || p.price == null ? 0 : p.cadence === 'monthly' ? p.price : p.cadence === 'weekly' ? p.price * 52 / 12 : p.cadence === 'annual' ? p.price / 12 : 0;

  function mrr() {
    return SB.store.all('clients').filter(c => c.status === 'active')
      .reduce((n, c) => n + monthly(SB.store.get('plans', c.planId)), 0);
  }
  function renewalsDue(days) {
    const T = todayISO();
    return SB.store.all('clients').filter(c => c.status === 'active' && c.renewalDate && c.renewalDate <= addDays(T, days))
      .map(c => ({ client: c, plan: SB.store.get('plans', c.planId), days: daysBetween(T, c.renewalDate) }))
      .sort((a, b) => a.days - b.days);
  }
  function nextRenewal(from, plan) {
    const base = from && from > todayISO() ? from : todayISO();
    const cad = plan ? plan.cadence : 'monthly';
    if (cad === 'weekly') return addDays(base, 7);
    const d = SB.ui.parseISO(base);
    if (cad === 'annual') d.setFullYear(d.getFullYear() + 1); else d.setMonth(d.getMonth() + 1);
    return SB.ui.toISO(d);
  }

  function editPlan(p) {
    const isNew = !p; p = p || { cadence: 'monthly' };
    modal({
      title: isNew ? 'New Membership Plan' : 'Edit Plan',
      body: `<div class="form-grid">
        ${field('Plan name', input('name', p.name, 'placeholder="e.g. Unlimited Training"'), 'full')}
        ${field('Price ($)', input('price', p.price, 'type="number" min="0" step="1"'))}
        ${field('Billing', select('cadence', CADENCES, p.cadence))}
        ${field('Sessions per week (blank = unlimited)', input('sessionsPerWeek', p.sessionsPerWeek, 'type="number" min="0"'))}
        ${field('Includes force plate testing', select('testing', [['', '—'], ['yes', 'Yes'], ['no', 'No']], p.testing))}
        ${field('Description', `<textarea class="input" name="description">${esc(p.description || '')}</textarea>`, 'full')}
      </div>`,
      foot: `${!isNew ? `<button class="btn danger" id="p-del">${icon('trash')}Delete</button><span class="spacer"></span>` : ''}<button class="btn" data-close>Cancel</button><button class="btn primary" id="p-save">Save</button>`,
      onMount(m) {
        m.querySelector('#p-save').addEventListener('click', () => {
          const d = SB.ui.formData(m);
          if (!d.name) { toast('Name is required', 'bad'); return; }
          SB.store.upsert('plans', Object.assign(p, d)); closeModal(); SB.refresh();
        });
        const del = m.querySelector('#p-del');
        if (del) del.addEventListener('click', async () => {
          const n = SB.store.all('clients').filter(c => c.planId === p.id).length;
          if (!(await SB.ui.confirm(`Delete "${p.name}"?${n ? ` ${n} client(s) will be left without a plan.` : ''}`))) return;
          SB.store.all('clients').filter(c => c.planId === p.id).forEach(c => { c.planId = ''; });
          SB.store.remove('plans', p.id); SB.refresh();
        });
      }
    });
  }

  SB.views.memberships = {
    mrr, renewalsDue, nextRenewal, monthly,
    render(el) {
      const plans = SB.store.all('plans');
      const clients = SB.store.all('clients');
      const active = clients.filter(c => c.status === 'active');
      const due = renewalsDue(14);
      const overdue = due.filter(d => d.days < 0);
      const noPlan = active.filter(c => !c.planId);
      el.innerHTML = `
        ${pageHead({
          kicker: 'Business', title: 'Memberships',
          sub: 'Plans, who is on them, and what renews next. Revenue is an estimate from plan prices — your payment processor stays the source of truth.',
          actions: `<button class="btn primary" id="m-new">${icon('plus')}New Plan</button>`
        })}
        <div class="content stack">
          <div class="grid kpis">
            <div class="card kpi"><div class="label">Active Members</div><div class="value">${active.length}</div><div class="delta flat">${clients.filter(c => c.status === 'paused').length} paused</div></div>
            <div class="card kpi"><div class="label">Est. Monthly Revenue</div><div class="value">${money(mrr())}</div><div class="delta flat">${money(mrr() * 12)} / yr run-rate</div></div>
            <div class="card kpi"><div class="label">Renewals · 14 Days</div><div class="value">${due.length}</div><div class="delta ${overdue.length ? 'down' : 'flat'}">${overdue.length} overdue</div></div>
            <div class="card kpi"><div class="label">Active · No Plan</div><div class="value">${noPlan.length}</div><div class="delta flat">assign from the client profile</div></div>
          </div>

          <div class="grid two">
            <div class="card">
              <div class="card-head"><div class="card-title">Plans</div></div>
              ${plans.length ? `<div class="table-wrap"><table class="data"><thead><tr><th>Plan</th><th class="num">Price</th><th>Billing</th><th class="num">Members</th><th class="num">Est. / mo</th><th></th></tr></thead><tbody>
                ${plans.map(p => { const n = active.filter(c => c.planId === p.id).length; return `<tr>
                  <td><b>${esc(p.name)}</b>${p.sessionsPerWeek ? `<div class="hint">${p.sessionsPerWeek}x / week</div>` : ''}</td>
                  <td class="num">${money(p.price)}</td><td>${esc((CADENCES.find(c => c[0] === p.cadence) || ['', p.cadence])[1])}</td>
                  <td class="num">${n}</td><td class="num">${p.cadence === 'one-time' ? '—' : money(monthly(p) * n)}</td>
                  <td class="right"><button class="btn sm ghost" data-plan="${p.id}">${icon('edit')}</button></td></tr>`; }).join('')}
              </tbody></table></div>` : empty('No plans yet', '<div>Add your membership options — pricing, billing cycle and sessions per week.</div>', `<button class="btn primary" id="m-new2">${icon('plus')}Add a plan</button>`)}
            </div>
            <div class="card">
              <div class="card-head"><div class="card-title">Members by Plan</div></div>
              ${plans.length && active.length ? '<div class="chart-box"><canvas id="m-chart"></canvas></div>' : empty('Nothing to chart yet')}
            </div>
          </div>

          <div class="card">
            <div class="card-head"><div class="card-title">Renewals & Billing</div><span class="card-sub">Active members sorted by next renewal</span></div>
            <div id="m-table"></div>
          </div>
        </div>`;

      el.querySelector('#m-new').addEventListener('click', () => editPlan(null));
      const n2 = el.querySelector('#m-new2'); if (n2) n2.addEventListener('click', () => editPlan(null));
      el.querySelectorAll('[data-plan]').forEach(b => b.addEventListener('click', () => editPlan(SB.store.get('plans', b.dataset.plan))));

      const cv = el.querySelector('#m-chart');
      if (cv) chart(cv, {
        type: 'bar',
        data: { labels: plans.map(p => p.name), datasets: [{ data: plans.map(p => active.filter(c => c.planId === p.id).length), backgroundColor: '#FF5A1F', borderRadius: 4, maxBarThickness: 48 }] },
        options: { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { grid: { display: false } } } }
      });

      const T = todayISO();
      SB.ui.sortableTable(el.querySelector('#m-table'), {
        rows: clients.filter(c => c.status === 'active' || c.status === 'paused'),
        initialSort: { key: 'renewal', dir: 1 }, onRow: c => SB.go('#/clients/' + c.id),
        emptyHtml: empty('No active members'),
        cols: [
          { key: 'name', label: 'Member', sort: c => SB.store.clientName(c), render: c => `<b>${esc(SB.store.clientName(c))}</b>` },
          { key: 'status', label: 'Status', render: c => SB.views.clients.statusBadge(c.status) },
          { key: 'plan', label: 'Plan', sort: c => (SB.store.get('plans', c.planId) || {}).name, render: c => esc((SB.store.get('plans', c.planId) || {}).name || '—') },
          { key: 'renewal', label: 'Next Renewal', sort: c => c.renewalDate || '9999', render: c => {
            if (!c.renewalDate) return '<span class="muted">not set</span>';
            const d = daysBetween(T, c.renewalDate);
            return `${fmtDate(c.renewalDate)} ${c.status === 'active' ? `<span class="badge ${d < 0 ? 'bad' : d <= 3 ? 'warn' : ''}">${d < 0 ? Math.abs(d) + 'd overdue' : d === 0 ? 'today' : 'in ' + d + 'd'}</span>` : ''}`;
          } },
          { key: 'last', label: 'Last Payment', sort: c => (c.payments || []).slice(-1)[0]?.date, render: c => { const p = (c.payments || []).slice(-1)[0]; return p ? fmtDate(p.date) : '<span class="muted">—</span>'; } },
          { key: 'act', label: '', render: c => c.status === 'active' && c.renewalDate ? `<button class="btn sm" data-renew="${c.id}">${icon('check')}Renewed</button>` : '' }
        ]
      });
      el.querySelectorAll('[data-renew]').forEach(b => b.addEventListener('click', () => {
        const c = SB.store.clientById(b.dataset.renew); const p = SB.store.get('plans', c.planId);
        c.renewalDate = nextRenewal(c.renewalDate, p);
        c.payments = (c.payments || []).concat([{ date: todayISO(), planId: c.planId, amount: p ? p.price : null }]);
        SB.store.upsert('clients', c); toast(`${c.first} renewed → ${fmtDate(c.renewalDate)}`); SB.refresh();
      }));
    }
  };
})(window.SB);
