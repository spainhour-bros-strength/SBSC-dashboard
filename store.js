/* SBSC Dashboard — data store
   All data lives in this browser (localStorage). Nothing is written to the repo,
   so the GitHub repo can stay public without exposing client information.
   Use Settings → Export backup to move data between computers. */

window.SB = window.SB || {};

(function (SB) {
  const KEY = 'sbsc_dashboard_v1';
  const VERSION = 1;

  const empty = () => ({
    version: VERSION,
    settings: { gymName: 'Spainhour Bros Strength Co.', coaches: ['Noah Spainhour'], lastBackup: null },
    clients: [],
    plans: [],
    programs: [],
    exercises: [],
    tests: [],
    sessions: []
  });

  let state = empty();
  const listeners = new Set();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        state = Object.assign(empty(), parsed);
        state.settings = Object.assign(empty().settings, parsed.settings || {});
        return true;
      }
    } catch (e) {
      console.warn('Could not read saved data', e);
    }
    return false;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.error(e);
      SB.ui && SB.ui.toast('Could not save — browser storage may be full. Export a backup.', 'bad');
    }
    listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });
  }

  const uid = (p = 'id') => p + '_' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  // Generic collection helpers
  function all(col) { return state[col] || []; }
  function get(col, id) { return all(col).find(x => x.id === id) || null; }
  function upsert(col, item) {
    if (!item.id) item.id = uid(col.slice(0, 3));
    item.updatedAt = new Date().toISOString();
    const arr = state[col];
    const i = arr.findIndex(x => x.id === item.id);
    if (i >= 0) arr[i] = item; else { item.createdAt = item.createdAt || item.updatedAt; arr.push(item); }
    save();
    return item;
  }
  function remove(col, id) {
    state[col] = all(col).filter(x => x.id !== id);
    save();
  }

  SB.store = {
    KEY,
    load, save, uid, all, get, upsert, remove,
    get state() { return state; },
    settings() { return state.settings; },
    setSettings(patch) { Object.assign(state.settings, patch); save(); },
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); },

    // Clients
    clientName(c) { return c ? `${c.first || ''} ${c.last || ''}`.trim() || 'Unnamed' : '—'; },
    clientById(id) { return get('clients', id); },
    findClientByName(name) {
      const n = SB.store.normName(name);
      return all('clients').find(c => SB.store.normName(SB.store.clientName(c)) === n ||
        (c.forceDecksName && SB.store.normName(c.forceDecksName) === n)) || null;
    },
    normName(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\s+/g, ' ').trim(); },

    // Tests
    testsFor(clientId) {
      return all('tests').filter(t => t.clientId === clientId)
        .sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    },
    addTests(tests) {
      const keyOf = t => [t.clientId, t.date, t.time || '', t.testType || '', JSON.stringify(t.metrics).length].join('|');
      const existing = new Set(all('tests').map(keyOf));
      let added = 0, dupes = 0;
      tests.forEach(t => {
        const k = keyOf(t);
        if (existing.has(k)) { dupes++; return; }
        existing.add(k);
        t.id = t.id || uid('tst');
        state.tests.push(t);
        added++;
      });
      save();
      return { added, dupes };
    },

    // Backup
    exportJSON() {
      state.settings.lastBackup = new Date().toISOString();
      save();
      return JSON.stringify(state, null, 2);
    },
    importJSON(text) {
      const data = JSON.parse(text);
      if (!data || typeof data !== 'object' || !Array.isArray(data.clients)) throw new Error('This file is not an SBSC dashboard backup.');
      state = Object.assign(empty(), data);
      save();
    },
    reset() { state = empty(); save(); },
    replace(data) { state = Object.assign(empty(), data); save(); }
  };
})(window.SB);
