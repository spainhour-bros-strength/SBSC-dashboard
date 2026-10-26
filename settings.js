/* Settings & Backup */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead, toast, field, input, download, pickFile, readText, todayISO, fmtDate } = SB.ui;

  function loadDemo() {
    const s = SB.store.state;
    const d = SB.seed.demoData();
    s.plans = s.plans.filter(p => !p.id.includes('_demo')).concat(d.plans);
    s.clients = s.clients.filter(c => !c.id.includes('_demo')).concat(d.clients);
    s.tests = s.tests.filter(t => t.source !== 'demo').concat(d.tests);
    s.sessions = s.sessions.filter(x => !String(x.seriesId || '').startsWith('demo_')).concat(d.sessions);
    // Give a few demo clients the starter program
    const starter = s.programs[0];
    if (starter) s.clients.filter(c => c.id.includes('_demo')).slice(0, 4).forEach(c => { c.programId = starter.id; c.programAssignedAt = SB.ui.addDays(todayISO(), -10); });
    s.settings.firstRun = false;
    SB.store.save();
    toast('Demo data loaded — fake clients, tests and sessions');
    SB.refresh();
  }
  function clearDemo() {
    const s = SB.store.state;
    s.plans = s.plans.filter(p => !p.id.includes('_demo'));
    s.clients = s.clients.filter(c => !c.id.includes('_demo'));
    s.tests = s.tests.filter(t => t.source !== 'demo');
    s.sessions = s.sessions.filter(x => !String(x.seriesId || '').startsWith('demo_'));
    s.sessions.forEach(x => { x.roster = (x.roster || []).filter(r => !r.clientId.includes('_demo')); });
    SB.store.save(); toast('Demo data removed'); SB.refresh();
  }

  SB.views.settings = {
    loadDemo, clearDemo,
    render(el) {
      const st = SB.store.settings();
      const s = SB.store.state;
      const bytes = new Blob([localStorage.getItem(SB.store.KEY) || '']).size;
      const hasDemo = s.clients.some(c => c.id.includes('_demo'));
      el.innerHTML = `
        ${pageHead({ kicker: 'System', title: 'Settings & Backup', sub: 'Your data lives in this browser only. Back it up regularly and restore it on any other computer.' })}
        <div class="content stack">
          <div class="grid two">
            <div class="card">
              <div class="card-head"><div class="card-title">Backup & Restore</div></div>
              <p style="margin-top:0">Last backup: <b>${st.lastBackup ? fmtDate(st.lastBackup.slice(0, 10)) : 'never'}</b>${!st.lastBackup || SB.ui.daysBetween(st.lastBackup.slice(0, 10), todayISO()) > 7 ? ' <span class="badge warn">back up soon</span>' : ''}</p>
              <div class="row">
                <button class="btn primary" id="b-exp">${icon('download')}Download backup</button>
                <button class="btn" id="b-imp">${icon('upload')}Restore from backup</button>
              </div>
              <p class="hint">The backup is one .json file with every client, program (including uploaded PDFs), jump test and session. Keep it somewhere private (not in the GitHub repo). Restoring replaces everything in this browser.</p>
              <ul class="list">
                <li><span class="grow">Clients</span><b>${s.clients.length}</b></li>
                <li><span class="grow">Programs</span><b>${s.programs.length}</b></li>
                <li><span class="grow">Jump tests</span><b>${s.tests.length}</b></li>
                <li><span class="grow">Sessions</span><b>${s.sessions.length}</b></li>
                <li><span class="grow">Program PDFs</span><b>${s.programs.filter(p => p.pdf).length}</b></li>
                <li><span class="grow">Data storage used</span><b>${(bytes / 1024).toFixed(0)} KB of ~5,000 KB</b></li>
                <li><span class="grow">PDF storage used</span><b id="pdf-usage">…</b></li>
              </ul>
            </div>
            <div class="card">
              <div class="card-head"><div class="card-title">Gym Settings</div></div>
              <div class="stack" id="g-form">
                ${field('Business name', input('gymName', st.gymName))}
                ${field('Coaches (comma separated)', input('coaches', (st.coaches || []).join(', ')))}
                <div><button class="btn primary" id="g-save">Save settings</button></div>
              </div>
            </div>
          </div>
          <div class="grid two">
            <div class="card">
              <div class="card-head"><div class="card-title">Demo Data</div></div>
              <p style="margin-top:0">Fake clients, 6 weeks of jump tests and two weeks of sessions — useful for trying every tab. Your real data is not touched.</p>
              <div class="row">
                <button class="btn" id="d-load">Load demo data</button>
                ${hasDemo ? `<button class="btn danger" id="d-clear">${icon('trash')}Remove demo data</button>` : ''}
              </div>
            </div>
            <div class="card">
              <div class="card-head"><div class="card-title">Danger Zone</div></div>
              <p style="margin-top:0">Erase everything stored in this browser. Download a backup first.</p>
              <button class="btn danger" id="r-all">${icon('trash')}Erase all data</button>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><div class="card-title">AI Workout Generator</div><span class="card-sub">Powers Program Builder → Quick Session</span></div>
            <p style="margin-top:0">Paste an Anthropic API key to have Claude write Quick Sessions. Without a key, Quick Session uses the built-in generator from your Exercise Library.</p>
            <div class="form-grid" id="ai-form">
              ${field('API key', `<input class="input" name="key" type="password" autocomplete="off" placeholder="sk-ant-…" value="${esc(SB.views.quick.ai.key())}">`)}
              ${field('Model', SB.ui.select('model', SB.views.quick.ai.MODELS, SB.views.quick.ai.model()))}
            </div>
            <div class="row mt">
              <button class="btn primary" id="ai-save">Save AI settings</button>
              ${SB.views.quick.ai.key() ? `<button class="btn danger" id="ai-clear">${icon('trash')}Remove key</button>` : ''}
              <span class="hint">Get a key at console.anthropic.com. The key is saved only in this browser. It is never committed to GitHub or included in backups, so add it on each device you use.</span>
            </div>
          </div>
          <div class="card">
            <div class="card-head"><div class="card-title">About Your Data</div></div>
            <ul style="margin:0;padding-left:18px;line-height:1.7">
              <li>The GitHub repo only holds the dashboard's code — no client names, test results or contact info are ever committed.</li>
              <li>Everything you enter is saved in this browser's local storage on this device. Another computer or browser starts empty until you restore a backup.</li>
              <li>Clearing your browser's site data erases the dashboard's data, so keep regular backups.</li>
              <li>When you want logins, shared data between coaches, or client self sign-up, the next step is a hosted database (see the README "Roadmap").</li>
            </ul>
          </div>
        </div>`;

      const $ = q => el.querySelector(q);
      $('#b-exp').addEventListener('click', async e => {
        const btn = e.currentTarget; btn.disabled = true; btn.textContent = 'Preparing backup…';
        try {
          const data = JSON.parse(SB.store.exportJSON());
          data.files = await SB.files.exportAll().catch(() => ({}));
          download(`sbsc-backup-${todayISO()}.json`, JSON.stringify(data));
          toast('Backup downloaded (includes program PDFs)');
        } catch (err) { toast('Backup failed: ' + err.message, 'bad'); }
        SB.refresh();
      });
      $('#b-imp').addEventListener('click', async () => {
        const [f] = await pickFile('.json,application/json'); if (!f) return;
        if (!(await SB.ui.confirm('Restoring replaces ALL data in this browser with the backup. Continue?', { okText: 'Restore' }))) return;
        try {
          const data = JSON.parse(await readText(f));
          const files = data.files; delete data.files;
          SB.store.importJSON(JSON.stringify(data));
          if (files) await SB.files.importAll(files);
          toast('Backup restored'); SB.go('#/home');
        } catch (e) { toast(e.message, 'bad'); }
      });
      SB.files.usage().then(b => { const x = el.querySelector('#pdf-usage'); if (x) x.textContent = SB.files.fmtSize(b || 0) || '0 KB'; }).catch(() => { });
      $('#g-save').addEventListener('click', () => {
        const d = SB.ui.formData($('#g-form'));
        SB.store.setSettings({ gymName: d.gymName, coaches: d.coaches.split(',').map(x => x.trim()).filter(Boolean) });
        toast('Settings saved');
      });
      $('#ai-save').addEventListener('click', () => {
        const d = SB.ui.formData($('#ai-form'));
        SB.views.quick.ai.set(d.key, d.model);
        toast(d.key ? 'AI settings saved' : 'AI key removed, using the built-in generator'); SB.refresh();
      });
      const aic = $('#ai-clear'); if (aic) aic.addEventListener('click', () => { SB.views.quick.ai.set('', ''); toast('AI key removed'); SB.refresh(); });
      $('#d-load').addEventListener('click', loadDemo);
      const dc = $('#d-clear'); if (dc) dc.addEventListener('click', clearDemo);
      $('#r-all').addEventListener('click', async () => {
        if (!(await SB.ui.confirm('Erase every client, program, test and session from this browser? This cannot be undone.', { okText: 'Erase everything' }))) return;
        SB.store.reset();
        await SB.files.clear().catch(() => { });
        const s2 = SB.store.state; s2.exercises = SB.seed.exerciseLibrary(); s2.programs = [SB.seed.starterProgram()]; s2.settings.firstRun = true; SB.store.save();
        toast('All data erased'); SB.go('#/home');
      });
    }
  };
})(window.SB);
