/* Primal System — certification course (PS-1 demo embedded) */
(function (SB) {
  SB.views = SB.views || {};
  const { esc, icon, pageHead } = SB.ui;

  const DEMO = 'primal-ps1.html';
  const MODULE_COUNT = 7;

  // The PS-1 demo saves its own progress under 'ps1demo' in this browser.
  function demoProgress() {
    try {
      const s = JSON.parse(localStorage.getItem('ps1demo') || 'null') || {};
      return {
        passed: Object.keys(s.passed || {}).filter(k => s.passed[k]).length,
        exam: s.examScore,
        demo: s.demo !== false
      };
    } catch (e) { return { passed: 0, exam: null, demo: true }; }
  }

  SB.views.primal = {
    render(el) {
      const p = demoProgress();
      el.innerHTML = `
        ${pageHead({
          kicker: 'Education',
          title: 'Primal System',
          sub: 'Deadlift, overhead press, loaded carries. The SBSC certification course: PS-1, PS-2 and PS-3.',
          actions: `
            <a class="btn primary" href="${DEMO}" target="_blank" rel="noopener">${icon('cert')}Open PS-1 full screen</a>
            <button class="btn" id="ps-reload">${icon('right')}Back to course home</button>`
        })}
        <div class="content stack">
          <div class="grid kpis">
            <div class="card kpi"><div class="label">PS-1 · Foundations</div><div class="value">Demo</div><div class="delta flat">7 modules + final exam (80% to pass)</div></div>
            <div class="card kpi"><div class="label">PS-2</div><div class="value">Outline</div><div class="delta flat">In the course draft</div></div>
            <div class="card kpi"><div class="label">PS-3 · Sports Performance</div><div class="value">Outline</div><div class="delta flat">In the course draft</div></div>
            <div class="card kpi"><div class="label">Your PS-1 Progress</div><div class="value">${p.passed}/${MODULE_COUNT}</div><div class="delta flat">${p.exam != null ? `Exam: ${esc(p.exam)}%` : 'Exam not taken'} · ${p.demo ? 'demo mode on' : 'gating on'}</div></div>
          </div>
          <div class="card ps-frame-card">
            <iframe id="ps-frame" class="ps-frame" src="${DEMO}" title="Primal System PS-1 course"></iframe>
          </div>
          <p class="hint">Course progress is saved in this browser only, like the rest of the dashboard. It isn't part of the dashboard backup.</p>
        </div>`;

      el.querySelector('#ps-reload').addEventListener('click', () => {
        el.querySelector('#ps-frame').src = DEMO + '#home';
      });
    }
  };
})(window.SB);
