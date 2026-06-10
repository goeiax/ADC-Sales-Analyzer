/* ADC POS Intelligence Dashboard — Module: ui.js
 * Intent-first navigation. A landing screen asks the user what they want;
 * each goal reveals only the relevant tabs/cards on top of the existing tab system.
 * Depends on core globals: chartInstances.
 */

// goal → { title, tabs (existing tab-content ids), cards (standalone card ids),
//          chrome (show KPI/insight overview), filters (show month/outlet bar) }
const GOALS = {
  revenue:   { title: 'Pendapatan',            tabs: ['revenue', 'trends'],     cards: [],                              chrome: true,  filters: true },
  retention: { title: 'Tarik pasien kembali',  tabs: ['remarketing'],           cards: ['recallCard'],                  chrome: false, filters: true },
  lookup:    { title: 'Cari pasien',           tabs: [],                        cards: ['localQueryCard'],              chrome: false, filters: false },
  services:  { title: 'Perawatan & dokter',    tabs: ['products', 'operations'],cards: [],                              chrome: false, filters: true },
  patients:  { title: 'Tren pasien',           tabs: ['patients'],              cards: [],                              chrome: false, filters: false },
  ask:       { title: 'Tanya data',            tabs: [],                        cards: ['qaSection', 'localQueryCard'], chrome: false, filters: false },
  everything:{ title: 'Semua data',            tabs: ['revenue','products','patients','remarketing','operations','trends'],
                                               cards: ['localQueryCard', 'recallCard', 'qaSection'], chrome: true, filters: true },
};

const ALL_CARDS = ['localQueryCard', 'recallCard', 'qaSection'];

function goView(goal) {
  const g = GOALS[goal];
  if (!g) return;
  document.body.classList.remove('view-home');
  document.body.classList.add('view-goal');
  document.body.classList.toggle('show-chrome', !!g.chrome);
  document.body.classList.toggle('show-filters', !!g.filters);

  // Tabs (multiple may be active at once)
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  g.tabs.forEach(t => document.getElementById('tab-' + t)?.classList.add('active'));

  // Standalone cards
  ALL_CARDS.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = g.cards.includes(id) ? '' : 'none';
  });

  const title = document.getElementById('goalTitle');
  if (title) title.textContent = g.title;

  // Charts created inside a display:none container are stuck at 0x0 — Chart.js
  // resize() cannot recover them. Recreate any dead-but-now-visible chart in place
  // from its own config; healthy ones just repaint. setTimeout (not rAF) so this
  // still runs when the window is occluded/backgrounded, where rAF never fires.
  if (typeof chartInstances !== 'undefined') {
    setTimeout(() => {
      chartInstances.forEach((c, i) => {
        try {
          const canvas = c.canvas;
          if (!canvas || canvas.offsetParent === null) return; // still hidden
          if (c.width === 0 || c.height === 0) {
            const cfg = { type: c.config.type, data: c.config.data, options: c.config.options };
            c.destroy();
            chartInstances[i] = new Chart(canvas, cfg);
          } else {
            c.resize(); c.update('none');
          }
        } catch (_) {}
      });
    }, 60);
  }
  window.scrollTo(0, 0);
}

function goHome() {
  document.body.classList.remove('view-goal');
  document.body.classList.add('view-home');
  window.scrollTo(0, 0);
}

// Start on the landing screen.
document.addEventListener('DOMContentLoaded', () => {
  document.body.classList.add('view-home');
});
