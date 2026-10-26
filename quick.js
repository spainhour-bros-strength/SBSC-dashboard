/* Program Builder → Quick Session
   Type what you need ("10 min hip mobility", "upper body pump with DBs") and get a
   ready-to-run session. Uses Claude (AI) when an API key is set in Settings; otherwise
   a built-in generator pulls from the Exercise Library so it always works offline. */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead, field, select, toast } = SB.ui;

  const AI_KEY = 'sbsc_ai_key';      // stored separately from dashboard data, never in backups
  const AI_MODEL = 'sbsc_ai_model';
  const MODELS = [['claude-sonnet-5-5', 'Claude Sonnet 5.5 (best)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 (fastest)']];

  const ai = {
    MODELS,
    key() { try { return localStorage.getItem(AI_KEY) || ''; } catch (e) { return ''; } },
    model() { try { return localStorage.getItem(AI_MODEL) || MODELS[0][0]; } catch (e) { return MODELS[0][0]; } },
    set(key, model) {
      try {
        if (key) localStorage.setItem(AI_KEY, key.trim()); else localStorage.removeItem(AI_KEY);
        if (model) localStorage.setItem(AI_MODEL, model);
      } catch (e) { }
    }
  };

  const PRESETS = [
    ['Mobility', 'Full-body mobility flow'],
    ['Warm-up', 'Dynamic warm-up before a lift'],
    ['Lift', 'Full-body lift'],
    ['Upper', 'Upper body strength session'],
    ['Lower', 'Lower body strength session'],
    ['Core', 'Core and trunk stability circuit'],
    ['Conditioning', 'Conditioning finisher'],
    ['Recovery', 'Light recovery / treatment day']
  ];
  const TIMES = [['10', '10 min'], ['15', '15 min'], ['20', '20 min'], ['30', '30 min'], ['45', '45 min'], ['60', '60 min']];
  const EQUIP = ['Full gym', 'Dumbbells only', 'Kettlebells', 'Bands / bodyweight', 'Barbell + rack'];
  const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];

  // ---------- AI generator (Claude, called straight from the browser) ----------
  const TOOL = {
    name: 'build_session',
    description: 'Return the finished training session.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short session name, e.g. "Hip & T-Spine Mobility"' },
        focus: { type: 'string', description: 'One-line focus, e.g. "Lower Body — Mobility"' },
        notes: { type: 'string', description: 'One or two sentences of coaching notes for the whole session' },
        exercises: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              label: { type: 'string', description: '1A, 1B, 2A… letters group supersets/circuits' },
              name: { type: 'string' },
              sets: { type: 'string' },
              reps: { type: 'string', description: 'Reps, time or distance, e.g. 8, 8/side, 30s, 20 yd' },
              tempo: { type: 'string' },
              rest: { type: 'string' },
              load: { type: 'string', description: 'e.g. RPE 7, light, BW' },
              notes: { type: 'string', description: 'Short coaching cue' }
            },
            required: ['label', 'name', 'sets', 'reps']
          }
        }
      },
      required: ['title', 'focus', 'exercises']
    }
  };

  async function generateAI(req) {
    const lib = SB.store.all('exercises').map(e => e.name);
    const system = `You are the strength coach assistant for Spainhour Bros Strength Co. Build practical, safe, ready-to-run training sessions.
Rules:
- Fit the time available (count roughly 1–2 min per mobility/warm-up drill, 6–10 min per strength superset).
- Use labels 1A/1B/2A… where shared numbers are done together as a superset or circuit.
- Reps can be reps, time, or distance (8/side, 30s, 20 yd). Use tempo only for strength work (e.g. 3-1-1).
- Keep cues short and specific. No warm-up inside a warm-up request.
- When an exercise in this library fits, use its exact name: ${lib.join('; ')}.
Always answer by calling build_session.`;
    const user = `Request: ${req.prompt}
Time: ${req.time} minutes
Equipment: ${req.equip}
Level: ${req.level}`;
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ai.key(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: JSON.stringify({
        model: ai.model(), max_tokens: 2500, system,
        tools: [TOOL], tool_choice: { type: 'tool', name: TOOL.name },
        messages: [{ role: 'user', content: user }]
      })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const msg = (data.error && data.error.message) || res.statusText;
      if (res.status === 401) throw new Error('The API key was rejected. Check it in Settings → AI Workout Generator.');
      throw new Error('AI request failed: ' + msg);
    }
    const block = (data.content || []).find(c => c.type === 'tool_use');
    if (!block) throw new Error('The AI did not return a session. Try again.');
    return normalize(block.input, 'ai');
  }

  // ---------- Built-in generator (no key needed) ----------
  const RX = {
    'Mobility / Prep': () => ({ sets: '2', reps: pick(['8/side', '10', '30s', '6/side']), tempo: '', rest: '—', load: 'BW' }),
    'Core': () => ({ sets: '3', reps: pick(['8/side', '10', '30s', '20 yd']), tempo: '', rest: '45s', load: '' }),
    'Power': () => ({ sets: '3', reps: pick(['3', '4', '5']), tempo: '', rest: '60s', load: 'Max intent' }),
    'Conditioning': () => ({ sets: pick(['6', '8']), reps: pick(['20s on / 40s off', '15s on / 45s off', '30 yd']), tempo: '', rest: 'as listed', load: 'Hard' }),
    strength: lvl => ({ sets: lvl === 'Beginner' ? '3' : '4', reps: pick(['5', '6', '8', '10', '8/side']), tempo: pick(['3-1-1', '2-0-1', '3-0-1']), rest: pick(['90s', '2 min', '75s']), load: pick(['RPE 7', 'RPE 8']) })
  };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);

  function planFor(text) {
    const t = text.toLowerCase();
    const has = (...w) => w.some(x => t.includes(x));
    if (has('mobility', 'stretch', 'recovery', 'treatment', 'flow')) return { focus: 'Mobility', cats: ['Mobility / Prep', 'Mobility / Prep', 'Core'] };
    if (has('warm')) return { focus: 'Warm-up', cats: ['Mobility / Prep', 'Mobility / Prep', 'Power'] };
    if (has('condition', 'cardio', 'finisher', 'conditioning')) return { focus: 'Conditioning', cats: ['Conditioning'] };
    if (has('core', 'abs', 'trunk')) return { focus: 'Core', cats: ['Core'] };
    if (has('power', 'jump', 'plyo', 'explosive')) return { focus: 'Power', cats: ['Power', 'Power', 'Core'] };
    if (has('upper', 'push', 'pull', 'chest', 'back', 'arm')) return { focus: 'Upper Body', cats: ['Upper — Push', 'Upper — Pull'] };
    if (has('lower', 'leg', 'squat', 'hinge', 'glute')) return { focus: 'Lower Body', cats: ['Lower — Squat', 'Lower — Hinge', 'Lower — Single Leg'] };
    return { focus: 'Full Body', cats: ['Lower — Squat', 'Upper — Push', 'Lower — Hinge', 'Upper — Pull', 'Lower — Single Leg', 'Core'] };
  }

  function generateLocal(req) {
    const lib = SB.store.all('exercises');
    const plan = planFor(req.prompt);
    const light = ['Mobility', 'Warm-up', 'Core'].includes(plan.focus);
    const count = Math.max(3, Math.min(12, Math.round(req.time / (light ? 2 : plan.focus === 'Conditioning' ? 5 : 6))));
    // Rough equipment filter for the built-in generator (AI handles this itself)
    const EQ = {
      'Dumbbells only': /\bDB\b|Goblet|Lunge|Step-Up|Split Squat|Single-Leg|Push-Up|Plank|Dead Bug|Bird Dog|Carry|Bridge|DB Curl|Hammer Curl|Rear Delt Fly|Cossack|Jump|Hops|Stretch|Rocker|Switch|Rotation|Glute|Mini-Band|Copenhagen/i,
      'Kettlebells': /Kettlebell|Goblet|Swing|Lunge|Step-Up|Split Squat|Single-Leg|Push-Up|Plank|Dead Bug|Bird Dog|Carry|Bridge|Cossack|Jump|Hops|Stretch|Rocker|Switch|Rotation|Glute|Mini-Band|Copenhagen/i,
      'Bands / bodyweight': /Band|Push-Up|Plank|Dead Bug|Bird Dog|Bridge|Lunge|Split Squat|Step-Up|Cossack|Jump|Hops|Stretch|Rocker|Switch|Rotation|Glute|Inverted Row|Pull-Up|Chin-Up|Nordic|Copenhagen|Tempo Runs|Shuttle/i
    };
    const okEq = n => !EQ[req.equip] || EQ[req.equip].test(n);
    const pools = {}; plan.cats.forEach(c => { pools[c] = shuffle(lib.filter(e => e.category === c && okEq(e.name)).map(e => e.name)); });
    const used = new Set(), rows = [];
    for (let i = 0; rows.length < count && i < count * 4; i++) {
      const cat = plan.cats[i % plan.cats.length];
      const name = (pools[cat] || []).find(n => !used.has(n));
      if (!name) continue;
      used.add(name);
      const rx = RX[cat] ? RX[cat]() : RX.strength(req.level);
      rows.push(Object.assign({ name, notes: '' }, rx));
    }
    // Pair strength work into supersets; light work runs as one circuit
    rows.forEach((r, i) => {
      if (light) r.label = '1' + String.fromCharCode(65 + (i % 26));
      else { const g = Math.floor(i / 2) + 1; r.label = g + (i % 2 ? 'B' : 'A'); }
    });
    return normalize({
      title: `${req.time}-Min ${plan.focus}`,
      focus: plan.focus,
      notes: light ? 'Move through as a circuit. Smooth, controlled reps.' : 'Supersets: alternate A and B, rest after the pair.',
      exercises: rows
    }, 'library');
  }

  function normalize(s, source) {
    return {
      title: s.title || 'Quick Session', focus: s.focus || '', notes: s.notes || '', source,
      exercises: (s.exercises || []).map(x => ({
        label: String(x.label || ''), name: String(x.name || ''), sets: String(x.sets ?? ''), reps: String(x.reps || ''),
        tempo: String(x.tempo || ''), rest: String(x.rest || ''), load: String(x.load || ''), notes: String(x.notes || '')
      }))
    };
  }

  // ---------- Shared sub-tab bar for the Program Builder ----------
  function subTabs(active) {
    const prog = SB._lastBuilderId ? '#/builder/' + SB._lastBuilderId : '#/builder';
    return `<div class="tabs">
      <button data-href="${prog}" class="${active === 'program' ? 'active' : ''}">Program</button>
      <button data-href="#/builder?tab=quick" class="${active === 'quick' ? 'active' : ''}">Quick Session</button>
    </div>`;
  }
  function wireSubTabs(root) {
    root.querySelectorAll('.tabs [data-href]').forEach(b => b.addEventListener('click', () => SB.go(b.dataset.href)));
  }

  // ---------- View ----------
  SB.views.quick = {
    ai, subTabs, wireSubTabs,
    render(el) {
      const st = SB.store.state;
      if (!Array.isArray(st.quickSessions)) st.quickSessions = [];
      let current = null;
      const req = { prompt: '', time: '20', equip: EQUIP[0], level: 'Intermediate' };

      el.innerHTML = `
        ${pageHead({ kicker: 'Program Builder', title: 'Quick Session', sub: 'Describe what you need and get a session in seconds: mobility lists, warm-ups, random lifts, finishers.' })}
        <div class="content">
          ${subTabs('quick')}
          <div class="card">
            <div class="card-head"><div class="card-title">What do you need?</div>
              <span class="card-sub" id="q-mode"></span></div>
            <div class="row qs-presets" id="q-presets" style="margin-bottom:12px">
              ${PRESETS.map(([k, p]) => `<button class="chip" data-p="${esc(p)}">${esc(k)}</button>`).join('')}
            </div>
            <div class="form-grid" id="q-form">
              ${field('Request', `<textarea class="input" name="prompt" placeholder="e.g. 10 min hip and ankle mobility for a basketball player before practice"></textarea>`, 'full')}
              ${field('Time', select('time', TIMES, req.time))}
              ${field('Equipment', select('equip', EQUIP, req.equip))}
              ${field('Level', select('level', LEVELS, req.level))}
            </div>
            <div class="row mt">
              <button class="btn primary" id="q-go">${icon('check')}Generate Session</button>
              <span class="hint">Tip: be specific. "Upper pump, DBs only, no overhead pressing" beats "upper body".</span>
            </div>
          </div>
          <div id="q-out"></div>
          <div class="card mt" id="q-recent"></div>
        </div>`;

      const $ = s => el.querySelector(s);
      wireSubTabs(el);
      $('#q-mode').innerHTML = ai.key()
        ? `<span class="badge orange">AI: ${esc((MODELS.find(m => m[0] === ai.model()) || [0, ai.model()])[1])}</span>`
        : `<span class="badge">Built-in generator</span> <a href="#/settings">Add an AI key</a>`;

      const promptEl = $('[name="prompt"]');
      $('#q-presets').querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
        $('#q-presets').querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c === b));
        promptEl.value = b.dataset.p; promptEl.focus();
      }));
      promptEl.addEventListener('keydown', e => { if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') run(); });
      $('#q-go').addEventListener('click', run);

      async function run() {
        Object.assign(req, SB.ui.formData($('#q-form')));
        req.time = Number(req.time) || 20;
        if (!req.prompt.trim()) { toast('Type a request or tap a preset', 'bad'); promptEl.focus(); return; }
        const btn = $('#q-go'); btn.disabled = true; btn.textContent = 'Building session…';
        try {
          current = ai.key() ? await generateAI(req) : generateLocal(req);
          current.request = Object.assign({}, req);
          current.createdAt = new Date().toISOString();
          current.id = SB.store.uid('qs');
          st.quickSessions.unshift(current);
          st.quickSessions = st.quickSessions.slice(0, 25);
          SB.store.save();
          drawOut(); drawRecent();
          $('#q-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
        } catch (e) {
          toast(e.message, 'bad');
        }
        btn.disabled = false; btn.innerHTML = `${icon('check')}Generate Session`;
      }

      function persistCurrent() {
        const i = st.quickSessions.findIndex(x => x.id === current.id);
        if (i >= 0) st.quickSessions[i] = current;
        SB.store.save();
      }

      function asProgram(s) {
        return {
          name: s.title, tagline: s.focus ? s.focus + ' · Quick Session' : 'Quick Session', goal: 'Other', level: s.request ? s.request.level : '',
          audience: '', description: s.notes || '', tags: ['quick session'],
          phases: [{ name: 'Quick Session', weeks: 1, days: [{ name: 'Day 1', category: s.focus || s.title, exercises: JSON.parse(JSON.stringify(s.exercises)) }] }]
        };
      }

      function asText(s) {
        const lines = [s.title.toUpperCase(), s.focus, ''].filter((x, i) => x || i === 2);
        s.exercises.forEach(x => {
          const rx = [x.sets && x.reps ? `${x.sets} x ${x.reps}` : x.reps, x.tempo && `tempo ${x.tempo}`, x.rest && x.rest !== '—' && `rest ${x.rest}`, x.load].filter(Boolean).join(' · ');
          lines.push(`${x.label}  ${x.name}${rx ? ' — ' + rx : ''}${x.notes ? ` (${x.notes})` : ''}`);
        });
        if (s.notes) lines.push('', s.notes);
        return lines.join('\n');
      }

      function drawOut() {
        const out = $('#q-out');
        if (!current) { out.innerHTML = ''; return; }
        const s = current;
        out.innerHTML = `
          <div class="builder-day mt">
            <div class="day-bar">
              <span class="dn">QUICK <b>SESSION</b></span>
              <input class="input" id="q-title" value="${esc(s.title)}" placeholder="Session name">
              <span class="badge ${s.source === 'ai' ? 'orange' : ''}">${s.source === 'ai' ? 'AI' : 'Library'}</span>
            </div>
            <div style="padding:10px 12px 0"><input class="input" id="q-focus" value="${esc(s.focus)}" placeholder="Focus"></div>
            <div style="overflow-x:auto">
              <table class="ex-table">
                <thead><tr><th>#</th><th>Exercise</th><th>Sets</th><th>Reps</th><th>Tempo</th><th>Rest</th><th>Load</th><th>Notes</th><th></th></tr></thead>
                <tbody>${s.exercises.map((x, r) => `<tr data-r="${r}">
                  <td class="w-xs"><input class="input" data-f="label" value="${esc(x.label)}"></td>
                  <td><input class="input" data-f="name" list="q-ex-names" value="${esc(x.name)}"></td>
                  <td class="w-xs"><input class="input" data-f="sets" value="${esc(x.sets)}"></td>
                  <td class="w-s"><input class="input" data-f="reps" value="${esc(x.reps)}"></td>
                  <td class="w-s"><input class="input" data-f="tempo" value="${esc(x.tempo)}"></td>
                  <td class="w-s"><input class="input" data-f="rest" value="${esc(x.rest)}"></td>
                  <td class="w-s"><input class="input" data-f="load" value="${esc(x.load)}"></td>
                  <td><input class="input" data-f="notes" value="${esc(x.notes)}"></td>
                  <td class="row-actions"><button class="btn" data-a="del" title="Remove">${icon('x')}</button></td>
                </tr>`).join('')}</tbody>
              </table>
              <datalist id="q-ex-names">${SB.store.all('exercises').map(e => `<option value="${esc(e.name)}">`).join('')}</datalist>
            </div>
            ${s.notes ? `<p class="hint" style="padding:0 12px">${esc(s.notes)}</p>` : ''}
            <div class="row" style="padding:10px 12px">
              <button class="btn sm" id="q-add">${icon('plus')}Exercise</button>
              <button class="btn sm" id="q-again">Regenerate</button>
              <span class="spacer"></span>
              <button class="btn sm" id="q-copy">${icon('copy')}Copy</button>
              <button class="btn sm" id="q-print">${icon('print')}Print / PDF</button>
              <button class="btn sm primary" id="q-save">${icon('library')}Save as Program</button>
            </div>
          </div>`;

        out.querySelector('#q-title').addEventListener('input', e => { s.title = e.target.value; persistCurrent(); });
        out.querySelector('#q-focus').addEventListener('input', e => { s.focus = e.target.value; persistCurrent(); });
        out.querySelector('tbody').addEventListener('input', e => {
          const tr = e.target.closest('tr[data-r]'); if (!tr || !e.target.dataset.f) return;
          s.exercises[+tr.dataset.r][e.target.dataset.f] = e.target.value; persistCurrent();
        });
        out.querySelectorAll('[data-a="del"]').forEach(b => b.addEventListener('click', () => {
          s.exercises.splice(+b.closest('tr').dataset.r, 1); persistCurrent(); drawOut();
        }));
        out.querySelector('#q-add').addEventListener('click', () => {
          const last = s.exercises[s.exercises.length - 1];
          const n = last ? (parseInt(last.label) || s.exercises.length) + 1 : 1;
          s.exercises.push({ label: n + 'A', name: '', sets: '3', reps: '', tempo: '', rest: '', load: '', notes: '' });
          persistCurrent(); drawOut();
          const inp = out.querySelector('tbody tr:last-child [data-f="name"]'); if (inp) inp.focus();
        });
        out.querySelector('#q-again').addEventListener('click', () => {
          const f = $('#q-form');
          if (s.request) { f.querySelector('[name="prompt"]').value = s.request.prompt; ['time', 'equip', 'level'].forEach(k => { f.querySelector(`[name="${k}"]`).value = s.request[k]; }); }
          run();
        });
        out.querySelector('#q-copy').addEventListener('click', async () => {
          try { await navigator.clipboard.writeText(asText(s)); toast('Session copied, paste it into a text or note'); }
          catch (e) { toast('Could not copy on this browser', 'bad'); }
        });
        out.querySelector('#q-print').addEventListener('click', () => SB.views.programs.printProgram(asProgram(s)));
        out.querySelector('#q-save').addEventListener('click', () => {
          const p = SB.store.upsert('programs', asProgram(s));
          toast('Saved to the Program Library');
          SB.go('#/builder/' + p.id);
        });
      }

      function drawRecent() {
        const box = $('#q-recent');
        const list = st.quickSessions;
        box.innerHTML = `<div class="card-head"><div class="card-title">Recent Quick Sessions</div><span class="card-sub">Last 25 are kept on this device</span></div>
          ${!list.length ? '<p class="hint" style="margin:0">Sessions you generate show up here.</p>' : `<ul class="list">${list.map((s, i) => `
            <li data-i="${i}" style="cursor:pointer">
              <span class="grow"><b>${esc(s.title)}</b> <span class="hint">· ${esc(s.focus || '')} · ${s.exercises.length} exercises · ${SB.ui.fmtDate(String(s.createdAt).slice(0, 10), { noYear: true })}</span></span>
              <span class="badge ${s.source === 'ai' ? 'orange' : ''}">${s.source === 'ai' ? 'AI' : 'Library'}</span>
              <button class="btn sm ghost" data-del="${i}" title="Delete">${icon('trash')}</button>
            </li>`).join('')}</ul>`}`;
        box.querySelectorAll('li[data-i]').forEach(li => li.addEventListener('click', e => {
          if (e.target.closest('[data-del]')) return;
          current = list[+li.dataset.i]; drawOut(); $('#q-out').scrollIntoView({ behavior: 'smooth', block: 'start' });
        }));
        box.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => {
          const [gone] = list.splice(+b.dataset.del, 1); SB.store.save();
          if (current && gone && current.id === gone.id) { current = null; drawOut(); }
          drawRecent();
        }));
      }
      drawRecent();
    }
  };
})(window.SB);
