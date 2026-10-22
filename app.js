/* SBSC Dashboard — router and boot */
(function (SB) {
  const { icon, destroyCharts, closeModal } = SB.ui;

  const NAV = [
    { section: 'Overview' },
    { route: 'home', label: 'Home', icon: 'home' },
    { section: 'Training' },
    { route: 'programs', label: 'Program Library', icon: 'library' },
    { route: 'builder', label: 'Program Builder', icon: 'builder' },
    { route: 'forcedecks', label: 'ForceDecks', icon: 'jump' },
    { section: 'Business' },
    { route: 'clients', label: 'Clients', icon: 'users' },
    { route: 'memberships', label: 'Memberships', icon: 'card' },
    { route: 'schedule', label: 'Schedule & Sign-Up', icon: 'calendar' },
    { section: 'System' },
    { route: 'settings', label: 'Settings & Backup', icon: 'settings' }
  ];

  function renderNav(active) {
    document.getElementById('nav').innerHTML = NAV.map(n => n.section
      ? `<div class="nav-section">${n.section}</div>`
      : `<a href="#/${n.route}" class="${n.route === active ? 'active' : ''}">${icon(n.icon)}<span>${n.label}</span></a>`
    ).join('');
  }

  function parseHash() {
    const h = (location.hash || '#/home').replace(/^#\/?/, '');
    const [path, query = ''] = h.split('?');
    const parts = path.split('/').filter(Boolean);
    const q = Object.fromEntries(new URLSearchParams(query));
    return { route: parts[0] || 'home', id: parts[1] ? decodeURIComponent(parts[1]) : null, q };
  }

  function route() {
    destroyCharts();
    closeModal();
    const { route, id, q } = parseHash();
    const view = SB.views[route] || SB.views.home;
    renderNav(SB.views[route] ? route : 'home');
    document.getElementById('sidebar').classList.remove('open');
    const el = document.getElementById('view');
    el.innerHTML = '';
    window.scrollTo(0, 0);
    try {
      view.render(el, { id, q });
    } catch (e) {
      console.error(e);
      el.innerHTML = `<div class="content"><div class="notice">Something went wrong loading this page: ${SB.ui.esc(e.message)}</div></div>`;
    }
  }

  SB.go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };
  SB.refresh = route;

  function boot() {
    const had = SB.store.load();
    if (!had) {
      // First run: seed the exercise library and a starter program template
      const s = SB.store.state;
      s.exercises = SB.seed.exerciseLibrary();
      s.programs = [SB.seed.starterProgram()];
      s.settings.firstRun = true;
      SB.store.save();
    }
    document.getElementById('menu-btn').addEventListener('click', () => document.getElementById('sidebar').classList.toggle('open'));
    window.addEventListener('hashchange', route);
    window.addEventListener('afterprint', () => document.body.classList.remove('printing'));
    route();
  }

  boot();
})(window.SB);
