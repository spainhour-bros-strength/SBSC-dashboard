/* SBSC Dashboard — starter content and optional demo data.
   The exercise library and the starter program load on first run.
   Demo clients/tests/sessions load ONLY when you click "Load demo data" —
   they are fake people for trying the dashboard out. */
window.SB = window.SB || {};

(function (SB) {
  const EXERCISES = {
    'Lower — Squat': ['Back Squat', 'Front Squat', 'Safety Bar Squat', 'Goblet Squat', 'Box Squat', 'Belt Squat', 'Hack Squat', 'Leg Press', 'Heel-Elevated Goblet Squat'],
    'Lower — Hinge': ['Trap Bar Deadlift', 'Conventional Deadlift', 'Romanian Deadlift', 'Single-Leg RDL', 'Kettlebell Swing', 'Hip Thrust', 'Glute Bridge', '45° Back Extension', 'Nordic Hamstring Curl', 'Seated Hamstring Curl', 'Good Morning'],
    'Lower — Single Leg': ['Rear-Foot Elevated Split Squat', 'Walking Lunge', 'Reverse Lunge', 'Lateral Lunge', 'Step-Up', 'Lateral Step-Up', 'Cossack Squat', 'Single-Leg Box Squat', 'Copenhagen Plank'],
    'Upper — Push': ['Bench Press', 'Incline Bench Press', 'DB Bench Press', 'Incline DB Press', 'Push-Up', 'Landmine Press', 'Half-Kneeling Landmine Press', 'Overhead Press', 'Seated DB Shoulder Press', 'Dips', 'Cable Fly', 'Tricep Pushdown'],
    'Upper — Pull': ['Pull-Up', 'Chin-Up', 'Lat Pulldown', '1-Arm DB Row', 'Chest-Supported Row', 'Seated Cable Row', 'Inverted Row', 'Face Pull', 'Band Pull-Apart', 'Rear Delt Fly', 'DB Curl', 'Hammer Curl'],
    'Power': ['Hang Clean', 'Hang Power Clean', 'Power Snatch', 'Trap Bar Jump', 'Box Jump', 'Broad Jump', 'Depth Jump', 'Countermovement Jump', 'Med Ball Scoop Toss', 'Med Ball Rotational Throw', 'Med Ball Chest Pass', 'Push Press', 'Pogo Hops'],
    'Core': ['Pallof Press', 'Dead Bug', 'Bird Dog', 'Front Plank', 'Side Plank', 'Ab Wheel Rollout', 'Hanging Knee Raise', 'Cable Chop', 'Suitcase Carry', 'Farmer Carry', 'Copenhagen Side Plank'],
    'Mobility / Prep': ['90/90 Hip Switch', 'World\'s Greatest Stretch', 'T-Spine Rotation', 'Ankle Rocker', 'Couch Stretch', 'Band Shoulder Dislocate', 'Glute Activation Circuit', 'Mini-Band Lateral Walk'],
    'Conditioning': ['Assault Bike Intervals', 'Sled Push', 'Sled Drag', 'Rower Intervals', 'Tempo Runs', 'Shuttle Runs', 'Battle Ropes']
  };

  function exerciseLibrary() {
    const out = [];
    Object.entries(EXERCISES).forEach(([category, names]) => names.forEach(name => out.push({ id: SB.store.uid('exr'), name, category })));
    return out;
  }

  const ex = (label, name, sets, reps, tempo = '', rest = '', notes = '') => ({ label, name, sets, reps, tempo, rest, load: '', notes });

  function starterProgram() {
    return {
      id: SB.store.uid('prg'),
      name: 'Foundation',
      tagline: 'A 4-Week General Strength Block',
      goal: 'General Strength',
      level: 'Beginner',
      audience: 'Adult',
      description: 'Starter template — 3 full-body days per week. Duplicate it and make it your own.',
      tags: ['template', 'full body'],
      phases: [{
        name: 'Phase 1', weeks: 4,
        days: [
          { name: 'Day 1', category: 'Full Body — Squat Focus', exercises: [
            ex('1A', 'Box Jump', 3, '3', '', '60s'),
            ex('2A', 'Goblet Squat', 3, '8', '3-1-1', '90s'),
            ex('2B', 'Half-Kneeling Landmine Press', 3, '8/side', '2-0-1', '60s'),
            ex('3A', 'Romanian Deadlift', 3, '10', '3-0-1', '90s'),
            ex('3B', '1-Arm DB Row', 3, '10/side', '2-1-1', '60s'),
            ex('4A', 'Dead Bug', 3, '8/side', '', '45s'),
            ex('4B', 'Farmer Carry', 3, '30 yd', '', '45s')
          ]},
          { name: 'Day 2', category: 'Full Body — Hinge Focus', exercises: [
            ex('1A', 'Med Ball Scoop Toss', 3, '4', '', '60s'),
            ex('2A', 'Trap Bar Deadlift', 4, '5', '2-0-X', '2 min'),
            ex('2B', 'Push-Up', 4, '8–12', '2-0-1', '60s'),
            ex('3A', 'Reverse Lunge', 3, '8/side', '2-0-1', '75s'),
            ex('3B', 'Lat Pulldown', 3, '10', '2-1-1', '60s'),
            ex('4A', 'Side Plank', 3, '30s/side', '', '45s')
          ]},
          { name: 'Day 3', category: 'Full Body — Single Leg', exercises: [
            ex('1A', 'Broad Jump', 3, '3', '', '60s'),
            ex('2A', 'Rear-Foot Elevated Split Squat', 3, '8/side', '3-0-1', '90s'),
            ex('2B', 'Incline DB Press', 3, '10', '2-0-1', '60s'),
            ex('3A', 'Hip Thrust', 3, '10', '2-1-1', '75s'),
            ex('3B', 'Chest-Supported Row', 3, '10', '2-1-1', '60s'),
            ex('4A', 'Pallof Press', 3, '10/side', '', '45s'),
            ex('4B', 'Sled Push', 3, '20 yd', '', '60s')
          ]}
        ]
      }]
    };
  }

  /* ---------------- Demo data (fake) ---------------- */
  // Representative ForceDecks CMJ export columns with typical values (mean, sd)
  const FD_COLS = [
    ['Jump Height (Imp-Mom) [cm]', 36, 7, 1],
    ['Jump Height (Flight Time) [cm]', 38, 7, 1],
    ['RSI-modified [m/s]', 0.48, 0.1, 2],
    ['RSI-modified (Imp-Mom) [m/s]', 0.46, 0.1, 2],
    ['Peak Power [W]', 4300, 800, 0],
    ['Peak Power / BM [W/kg]', 52, 8, 1],
    ['Concentric Peak Force [N]', 2050, 300, 0],
    ['Concentric Peak Force / BM [N/kg]', 25, 3, 1],
    ['Concentric Mean Force [N]', 1700, 250, 0],
    ['Concentric Impulse [N s]', 225, 35, 1],
    ['Eccentric Peak Force [N]', 1950, 320, 0],
    ['Eccentric Mean Braking Force [N]', 1250, 180, 0],
    ['Eccentric Braking RFD [N/s]', 7200, 2400, 0],
    ['Eccentric Braking RFD / BM [N/s/kg]', 88, 28, 1],
    ['Eccentric Braking Impulse [N s]', 62, 12, 1],
    ['Countermovement Depth [cm]', -32, 6, 1],
    ['Contraction Time [ms]', 760, 110, 0],
    ['Eccentric Duration [ms]', 520, 90, 0],
    ['Concentric Duration [ms]', 255, 35, 0],
    ['Flight Time:Contraction Time', 0.75, 0.13, 2],
    ['Peak Landing Force [N]', 4600, 1100, 0],
    ['Takeoff Peak Force [N]', 2000, 300, 0],
    ['Vertical Velocity at Takeoff [m/s]', 2.65, 0.25, 2],
    ['Concentric Peak Force % (Asym) (%)', 4, 3, 1],
    ['Eccentric Braking Impulse % (Asym) (%)', 6, 4, 1]
  ];

  function rand(seed) { let s = seed; return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; }; }
  function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

  function demoData() {
    const T = SB.ui.todayISO();
    const r = rand(42);
    const plans = [
      { id: 'pln_demo1', name: 'Unlimited Training', price: 199, cadence: 'monthly', sessionsPerWeek: null, description: 'Example plan — edit or delete.' },
      { id: 'pln_demo2', name: '2x / Week Small Group', price: 129, cadence: 'monthly', sessionsPerWeek: 2, description: 'Example plan — edit or delete.' },
      { id: 'pln_demo3', name: 'Athlete Development (Youth)', price: 149, cadence: 'monthly', sessionsPerWeek: 3, description: 'Example plan — edit or delete.' },
      { id: 'pln_demo4', name: '10-Session Pack', price: 350, cadence: 'one-time', sessionsPerWeek: null, description: 'Example plan — edit or delete.' }
    ];
    const people = [
      ['Demo', 'Athlete A', 'Basketball', 'High School', 'active', 'pln_demo3'],
      ['Demo', 'Athlete B', 'Football', 'High School', 'active', 'pln_demo3'],
      ['Demo', 'Athlete C', 'Volleyball', 'College', 'active', 'pln_demo1'],
      ['Demo', 'Athlete D', 'Baseball', 'High School', 'active', 'pln_demo2'],
      ['Demo', 'Athlete E', 'Soccer', 'Middle School', 'active', 'pln_demo3'],
      ['Demo', 'Adult F', 'General Fitness', 'Adult', 'active', 'pln_demo1'],
      ['Demo', 'Adult G', 'General Fitness', 'Adult', 'paused', 'pln_demo2'],
      ['Demo', 'Athlete H', 'Track & Field', 'College', 'active', 'pln_demo4'],
      ['Demo', 'Prospect I', 'Basketball', 'High School', 'lead', '']
    ];
    const clients = people.map((p, i) => ({
      id: 'cli_demo' + i, first: p[0], last: p[1], sport: p[2], level: p[3], status: p[4], planId: p[5],
      email: '', phone: '', goals: 'Demo client — delete when you add real clients.',
      startDate: SB.ui.addDays(T, -120 + i * 7), renewalDate: p[4] === 'active' ? SB.ui.addDays(T, (i * 5) % 32 - 4) : '',
      programId: '', notes: '', forceDecksName: '', createdAt: new Date().toISOString()
    }));

    // 6 weekly CMJ tests for jumpers (first 8)
    const tests = [];
    clients.slice(0, 8).forEach((c, ci) => {
      const talent = gauss(r) * 0.9;
      const bw = 62 + r() * 35;
      for (let w = 5; w >= 0; w--) {
        const date = SB.ui.addDays(T, -w * 7 - (ci % 3));
        const trend = (5 - w) * 0.012;
        const dayNoise = gauss(r) * 0.04;
        const fatigue = (w === 0 && ci % 4 === 1) ? -0.12 : 0; // a couple of athletes look fatigued on the latest test
        const metrics = {};
        FD_COLS.forEach(([name, mean, sd, dp]) => {
          let v;
          if (/Asym/.test(name)) v = Math.abs(mean + gauss(r) * sd);
          else {
            const z = talent + gauss(r) * 0.25;
            const mult = 1 + trend + dayNoise + fatigue;
            const timeLike = /Duration|Contraction Time|Depth/.test(name);
            v = (mean + z * sd) * (timeLike ? (2 - mult) : mult);
            if (/\/ BM|BM\]/.test(name)) v = v;
            else if (/Force|Power|Impulse|RFD \[/.test(name)) v = v * (bw / 80);
          }
          metrics[name] = +v.toFixed(dp);
        });
        tests.push({
          id: SB.store.uid('tst'), clientId: c.id, rawName: SB.store.clientName(c), date, time: '15:3' + (ci % 10),
          testType: 'CMJ', reps: 3, bw: +(bw + gauss(r) * 0.6).toFixed(1), tags: '', metrics, source: 'demo'
        });
      }
    });

    // Sessions: recurring small-group slots this week and next
    const sessions = [];
    const weekStart = SB.ui.addDays(T, -((SB.ui.parseISO(T).getDay() + 6) % 7));
    const slots = [
      [0, '06:00', '07:00', 'Adult Strength', 'Small Group', 10],
      [0, '16:00', '17:15', 'Athlete Development', 'Small Group', 12],
      [1, '16:00', '17:15', 'Speed & Power', 'Small Group', 12],
      [2, '06:00', '07:00', 'Adult Strength', 'Small Group', 10],
      [2, '16:00', '17:15', 'Athlete Development', 'Small Group', 12],
      [3, '15:30', '16:15', 'Force Plate Testing', 'Testing', 8],
      [4, '06:00', '07:00', 'Adult Strength', 'Small Group', 10],
      [5, '09:00', '10:30', 'Open Gym', 'Open Gym', 20]
    ];
    for (let wk = 0; wk < 2; wk++) slots.forEach(([d, s, e, title, type, cap], si) => {
      const date = SB.ui.addDays(weekStart, d + wk * 7);
      const roster = clients.filter((c, ci) => c.status === 'active' && (ci + si + wk) % 3 !== 0).slice(0, Math.min(cap, 6))
        .map(c => ({ clientId: c.id, status: date < T ? (r() > 0.15 ? 'attended' : 'no-show') : 'booked' }));
      sessions.push({ id: SB.store.uid('ses'), title, type, date, start: s, end: e, capacity: cap, coach: 'Noah Spainhour', location: 'Main Floor', notes: '', roster, seriesId: 'demo_' + si });
    });

    return { plans, clients, tests, sessions };
  }

  SB.seed = { exerciseLibrary, starterProgram, demoData, FD_COLS };
})(window.SB);
