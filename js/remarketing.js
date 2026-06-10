/* ADC POS Intelligence Dashboard — Module: remarketing.js
 * Remarketing filters, Win-back ROI simulator, Cross-Product Analysis.
 * Extracted from monolithic script for maintainability (May 2026).
 * Depends on globals from core (D, rp, escHtml, downloadBlob, updateWinbackROI if present, buildCrossProductSelects, etc.).
 * All top-level functions and state are global so existing HTML onclick= and calls continue to work.
 */

let rmkFilter = { lifecycle: 'all', outlet: 'all', treatment: '', phoneOnly: false };
let rmkFiltered = [];

let crossMatched = [];
let crossSelected = [];     // array of service name strings
let allServiceNames = [];   // full autocomplete list
let _crossDropdownMatches = [];

function setRmkLifecycle(lc) {
  rmkFilter.lifecycle = lc;
  const map = { dormant: 'pcardDormant', lapsing: 'pcardLapsing', active: 'pcardActive', all: 'pcardAll' };
  document.querySelectorAll('.rmk-pcard').forEach(c => c.classList.remove('selected'));
  document.getElementById(map[lc])?.classList.add('selected');
  const rb = document.getElementById('rmkResultBar');
  if (rb) {
    rb.className = 'rmk-result-bar';
    if (lc !== 'all') rb.classList.add(lc + '-mode');
  }
  applyRmkFilter(true);
}

function setRmkFilter(type, value, btn) {
  rmkFilter[type] = value;
  document.querySelectorAll('#rmkOutletChips .fchip').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  applyRmkFilter(true);
}

function clearRmkSearch() {
  const si = document.getElementById('rmkSearch');
  if (si) si.value = '';
  rmkFilter.treatment = '';
  applyRmkFilter();
}

function applyRmkFilter(scrollToResults) {
  rmkFilter.treatment = (document.getElementById('rmkSearch')?.value || '').toLowerCase().trim();
  rmkFilter.phoneOnly = document.getElementById('rmkPhoneOnly')?.checked || false;

  const profiles = D.patientProfiles || [];
  rmkFiltered = profiles.filter(p => {
    if (rmkFilter.lifecycle !== 'all' && p.lifecycle !== rmkFilter.lifecycle) return false;
    if (rmkFilter.outlet !== 'all') {
      const o = p.outlet || '';
      if (rmkFilter.outlet === 'spdve' && o !== 'SpDVE' && o !== 'Both') return false;
      if (rmkFilter.outlet === 'spgk' && o !== 'SpGK' && o !== 'Both') return false;
    }
    if (rmkFilter.phoneOnly && !p.phone) return false;
    if (rmkFilter.treatment) {
      const hit = (p.treatments || []).some(t => (t.item || '').toLowerCase().includes(rmkFilter.treatment));
      if (!hit) return false;
    }
    return true;
  });

  updateRmkStats();
  updateRmkGrid();
  if (typeof updateWinbackROI === 'function') updateWinbackROI();
  renderSavedSegments();
  if (scrollToResults) {
    setTimeout(() => {
      document.getElementById('rmkResultBar')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 80);
  }
}

function updateRmkStats() {
  const el = document.getElementById('rmkResultText');
  if (!el) return;
  const total = rmkFiltered.length;
  const withPhone = rmkFiltered.filter(p => p.phone).length;
  const spend = rmkFiltered.reduce((s, p) => s + (p.totalSpend || 0), 0);
  const phoneColor = withPhone === total ? '#059669' : (withPhone > 0 ? '#d97706' : '#ef4444');
  const noMatch = total === 0;
  el.innerHTML = noMatch
    ? '<span style="color:#ef4444;font-weight:600;">Tidak ada pasien yang cocok dengan filter saat ini.</span>'
    : '<strong style="font-size:1.0rem;color:#111827;">' + total.toLocaleString() + '</strong>'
      + ' pasien cocok &nbsp;·&nbsp; '
      + '<span style="color:' + phoneColor + ';font-weight:700;">' + withPhone.toLocaleString() + '</span> punya nomor telepon'
      + '&nbsp;·&nbsp; <span style="color:#6b7280;">' + rp(spend) + '</span> total belanja gabungan';
}

function updateRmkGrid() {
  const el = document.getElementById('grid-remarketing');
  if (!el) return;
  el.innerHTML = '';
  if (!rmkFiltered.length) {
    el.innerHTML = '<p style="color:#9ca3af;font-size:0.82rem;padding:16px 0;">Tidak ada pasien yang cocok dengan filter saat ini.</p>';
    return;
  }
  const sample = rmkFiltered.slice(0, 500);
  new gridjs.Grid({
    columns: [
      { id: 'name', name: 'Nama', width: '160px' },
      { id: 'phone', name: 'Telepon', width: '120px' },
      { id: 'outlet', name: 'Klinik', width: '70px' },
      { id: 'status', name: 'Status', width: '80px' },
      { id: 'spend', name: 'Biaya', width: '92px' },
      { id: 'visits', name: 'Kunjungan', width: '54px' },
      { id: 'last', name: 'Kunjungan Terakhir', width: '98px' },
      { id: 'toptx', name: 'Perawatan Utama', width: '190px' },
      { id: 'detail', name: '', width: '68px', formatter: (_, row) => gridjs.html(
        '<button class="pt-view-btn" onclick="showPatientDetail(\'' + row.cells[8].data + '\')">Detail ▶</button>'
      )}
    ],
    data: sample.map(p => [
      p.name || '—',
      p.phone || '—',
      p.outlet || '—',
      p.lifecycle || '—',
      rp(p.totalSpend, 2),
      p.visits,
      p.lastVisitDate || p.lastVisit || '—',
      (p.treatments || [])[0]?.item || '—',
      p.mrn   // hidden column used by Detail button
    ]),
    search: true, sort: true, style: { table: { 'font-size': '0.78rem' } }, pagination: { limit: 20 }
  }).render(el);
}

function exportFilteredPatients() {
  if (!rmkFiltered.length) { alert('Tidak ada pasien yang cocok dengan filter saat ini.'); return; }
  const maxTx = rmkFiltered.reduce((m, p) => Math.max(m, (p.treatments || []).length), 0);
  const txHeaders = Array.from({ length: maxTx }, (_, i) => 'Treatment' + (i + 1) + ',Qty' + (i + 1) + ',Spend' + (i + 1));
  let csv = 'MRN,Name,Phone,Outlet,Lifecycle,TotalSpend,SpendPerVisit,Visits,LastVisitDate,Doctors,TopPayment,DiscountUsed,' + txHeaders.join(',') + '\n';
  rmkFiltered.forEach(p => {
    const drs = '"' + (p.doctors || []).join('; ').replace(/"/g, "'") + '"';
    const spv = p.visits ? Math.round(p.totalSpend / p.visits) : 0;
    const txCols = (p.treatments || []).map(t => '"' + t.item.replace(/"/g, "'") + '",' + (t.qty || 0) + ',' + (Math.round(t.spend) || 0)).join(',');
    csv += [p.mrn, '"' + (p.name || '').replace(/"/g, "'") + '"', p.phone || '', p.outlet || '', p.lifecycle || '',
            Math.round(p.totalSpend), spv, p.visits, p.lastVisitDate || p.lastVisit || '', drs,
            p.topPayment || '', p.discountUsed ? 'Yes' : 'No', txCols].join(',') + '\n';
  });
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), 'ADC_Remarketing_' + rmkFilter.lifecycle + '_' + (rmkFilter.outlet || 'all') + '.csv');
}

function buildRemarketing() {
  const profiles = D.patientProfiles || [];
  const lc = { active: 0, lapsing: 0, dormant: 0 };
  const ph = { active: 0, lapsing: 0, dormant: 0, all: 0 };
  profiles.forEach(p => {
    if (lc[p.lifecycle] !== undefined) { lc[p.lifecycle]++; if (p.phone) ph[p.lifecycle]++; }
    if (p.phone) ph.all++;
  });
  function setCard(pfx, n, pn) {
    const ne = document.getElementById(pfx + 'N'); if (ne) ne.textContent = n.toLocaleString();
    const pe = document.getElementById(pfx + 'Phone'); if (pe) pe.textContent = pn.toLocaleString() + ' punya no. telepon';
  }
  setCard('pcardDormant', lc.dormant, ph.dormant);
  setCard('pcardLapsing', lc.lapsing, ph.lapsing);
  setCard('pcardActive', lc.active, ph.active);
  setCard('pcardAll', profiles.length, ph.all);

  rmkFilter = { lifecycle: 'all', outlet: 'all', treatment: '', phoneOnly: false };
  const si = document.getElementById('rmkSearch'); if (si) si.value = '';
  const po = document.getElementById('rmkPhoneOnly'); if (po) po.checked = false;
  document.querySelectorAll('#rmkOutletChips .fchip').forEach((b, i) => b.classList.toggle('active', i === 0));
  document.querySelectorAll('.rmk-pcard').forEach(c => c.classList.remove('selected'));
  document.getElementById('pcardAll')?.classList.add('selected');
  rmkFiltered = profiles;
  updateRmkStats();
  updateRmkGrid();
  if (typeof updateWinbackROI === 'function') updateWinbackROI();
  renderSavedSegments();
  buildCrossProductSelects();
}

// ── CROSS-PRODUCT ANALYSIS ────────────────────────────────────────────────────
function buildCrossProductSelects() {
  const seen = new Set();
  (D.patientProfiles || []).forEach(p => { (p.treatments || []).forEach(t => { if (t.item) seen.add(t.item); }); });
  (D.items || []).forEach(i => { if (i.item) seen.add(i.item); });
  allServiceNames = Array.from(seen).sort((a, b) => a.localeCompare(b));
  crossSelected = [];
  updateCrossChips();
  const box = document.getElementById('crossResults');
  if (box) box.innerHTML = '<p style="color:#9ca3af;font-size:0.82rem;">Tambahkan dua layanan atau lebih di atas untuk menemukan pasien yang membeli semuanya.</p>';
  const btn = document.getElementById('crossExportBtn');
  if (btn) btn.style.display = 'none';
}

function filterCrossOptions() {
  const q = (document.getElementById('crossSearch')?.value || '').toLowerCase().trim();
  const drop = document.getElementById('crossDropdown');
  if (!drop) return;
  if (!q) { drop.style.display = 'none'; return; }
  _crossDropdownMatches = allServiceNames.filter(s => s.toLowerCase().includes(q) && !crossSelected.includes(s)).slice(0, 12);
  if (!_crossDropdownMatches.length) { drop.style.display = 'none'; return; }
  drop.innerHTML = _crossDropdownMatches.map((s, i) => '<div class="cross-option" data-idx="' + i + '">' + escHtml(s) + '</div>').join('');
  drop.style.display = 'block';
}

// Delegated listener for cross dropdown (already present in original; kept here for module completeness)
document.addEventListener('mousedown', e => {
  const opt = e.target.closest('#crossDropdown .cross-option');
  if (opt && opt.dataset.idx !== undefined) {
    addCrossService(_crossDropdownMatches[+opt.dataset.idx]);
  }
});

function crossSearchKeydown(e) {
  if (e.key === 'Enter') {
    const q = (e.target.value || '').toLowerCase().trim();
    if (!q) return;
    const match = allServiceNames.find(s => s.toLowerCase().includes(q) && !crossSelected.includes(s));
    if (match) addCrossService(match);
  }
  if (e.key === 'Escape') { const d = document.getElementById('crossDropdown'); if (d) d.style.display = 'none'; }
}

function addCrossService(name) {
  if (!crossSelected.includes(name)) { crossSelected.push(name); updateCrossChips(); runCrossProduct(); }
  const inp = document.getElementById('crossSearch'); if (inp) inp.value = '';
  const drop = document.getElementById('crossDropdown'); if (drop) drop.style.display = 'none';
}

function removeCrossService(name) {
  crossSelected = crossSelected.filter(s => s !== name);
  updateCrossChips(); runCrossProduct();
}

function updateCrossChips() {
  const box = document.getElementById('crossChips');
  if (!box) return;
  box.innerHTML = crossSelected.map((s, i) =>
    '<span class="cross-chip">' + escHtml(s) +
    '<span class="cross-chip-x" data-chip-idx="' + i + '" title="Remove">×</span></span>'
  ).join('');
}

// Delegated chip-remove listener (kept for self-containment of the module)
document.addEventListener('mousedown', e => {
  const x = e.target.closest('#crossChips .cross-chip-x');
  if (x && x.dataset.chipIdx !== undefined) removeCrossService(crossSelected[+x.dataset.chipIdx]);
});

function runCrossProduct() {
  const box = document.getElementById('crossResults');
  const exportBtn = document.getElementById('crossExportBtn');
  if (!box) return;
  if (crossSelected.length < 2) {
    box.innerHTML = '<p style="color:#9ca3af;font-size:0.82rem;">Tambahkan dua layanan atau lebih di atas untuk menemukan pasien yang membeli semuanya.</p>';
    crossMatched = []; if (exportBtn) exportBtn.style.display = 'none'; return;
  }
  const selectedLow = crossSelected.map(s => s.toLowerCase());
  crossMatched = (D.patientProfiles || []).filter(p => {
    const names = (p.treatments || []).map(t => (t.item || '').toLowerCase());
    return selectedLow.every(sel => names.some(n => n.includes(sel)));
  });
  box.innerHTML = '';
  if (exportBtn) exportBtn.style.display = crossMatched.length ? '' : 'none';
  const withPhone = crossMatched.filter(p => p.phone).length;
  const spend = crossMatched.reduce((s, p) => s + (p.totalSpend || 0), 0);
  const lc = { active: 0, lapsing: 0, dormant: 0 };
  crossMatched.forEach(p => { if (lc[p.lifecycle] !== undefined) lc[p.lifecycle]++; });
  const summary = document.createElement('div');
  summary.style.cssText = 'background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:12px 18px;margin-bottom:12px;font-size:0.84rem;color:#1e40af;line-height:1.7;';
  summary.innerHTML = '<strong>' + crossMatched.length.toLocaleString() + ' pasien</strong> membeli semua ' + crossSelected.length + ' layanan terpilih'
    + (crossMatched.length ? '' : ' — coba lebih sedikit atau layanan lain') + '<br>'
    + withPhone.toLocaleString() + ' punya telepon · Total belanja ' + rp(spend)
    + ' · <span style="color:#065f46;">Aktif ' + lc.active + '</span>'
    + ' · <span style="color:#92400e;">Menurun ' + lc.lapsing + '</span>'
    + ' · <span style="color:#991b1b;">Dorman ' + lc.dormant + '</span>';
  box.appendChild(summary);
  if (!crossMatched.length) return;
  const grid = document.createElement('div');
  box.appendChild(grid);
  new gridjs.Grid({
    columns: [
      { id: 'name', name: 'Nama', width: '160px' }, { id: 'phone', name: 'Telepon', width: '115px' },
      { id: 'outlet', name: 'Klinik', width: '75px' }, { id: 'status', name: 'Status', width: '82px' }, { id: 'spend', name: 'Biaya', width: '90px' },
      { id: 'visits', name: 'Kunjungan', width: '58px' }, { id: 'last', name: 'Kunjungan Terakhir', width: '90px' },
      { id: 'detail', name: '', width: '68px', formatter: (_, row) => gridjs.html(
        '<button class="pt-view-btn" onclick="showPatientDetail(\'' + row.cells[7].data + '\')">Detail ▶</button>'
      )}
    ],
    data: crossMatched.map(p => [p.name || '—', p.phone || '—', p.outlet || '—', p.lifecycle || '—', rp(p.totalSpend, 2), p.visits, p.lastVisit || '—', p.mrn]),
    search: true, sort: true, style: { table: { 'font-size': '0.78rem' } }, pagination: { limit: 15 }
  }).render(grid);
}

function exportCrossProduct() {
  if (!crossMatched.length) return;
  let csv = 'MRN,Name,Phone,Outlet,Lifecycle,TotalSpend,Visits,LastVisit,TopTreatment,Doctor\n';
  crossMatched.forEach(p => {
    const top = (p.treatments || [])[0]?.item || '';
    const dr = (p.doctors || [])[0] || '';
    csv += [p.mrn, '"' + (p.name || '') + '"', p.phone || '', p.outlet || '', p.lifecycle || '',
            Math.round(p.totalSpend), p.visits, p.lastVisit || '',
            '"' + top.replace(/"/g, "'") + '"', '"' + dr.replace(/"/g, "'") + '"'].join(',') + '\n';
  });
  const safe = s => s.substring(0, 15).replace(/[^a-zA-Z0-9]/g, '_');
  downloadBlob(new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }), 'ADC_CrossProduct_' + crossSelected.map(safe).join('_AND_') + '.csv');
}

// Close cross-product dropdown when clicking outside (module self-containment)
document.addEventListener('click', e => {
  if (!e.target.closest('#crossSearch') && !e.target.closest('#crossDropdown')) {
    const d = document.getElementById('crossDropdown'); if (d) d.style.display = 'none';
  }
});

function updateWinbackROI() {
  const targeted = rmkFiltered.length;
  const withPhone = rmkFiltered.filter(p => p.phone).length;

  const offer    = parseFloat(document.getElementById('wbOffer')?.value)    || 500000;
  const respPct  = parseFloat(document.getElementById('wbResponse')?.value) || 18;
  const revenueP = parseFloat(document.getElementById('wbRevenue')?.value)  || 4500000;
  const contact  = parseFloat(document.getElementById('wbContact')?.value)  || 15000;

  const responders = Math.round(withPhone * respPct / 100);
  const gross      = responders * revenueP;
  const cost       = withPhone * (contact + offer);
  const net        = gross - cost;
  const roi        = cost > 0 ? gross / cost : 0;
  const breakeven  = revenueP > offer ? (contact + offer) / (revenueP - offer) * 100 : null;

  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('wbTargeted',   targeted.toLocaleString());
  set('wbPhone',      withPhone.toLocaleString());
  set('wbResponders', responders.toLocaleString());
  set('wbGross',      rp(gross));
  set('wbCost',       rp(cost));
  set('wbNet',        rp(net));
  set('wbROI',        roi > 0 ? roi.toFixed(1) + '×' : '—');
  set('wbBreakeven',  breakeven !== null ? breakeven.toFixed(1) + '%' : '—');

  const netEl = document.getElementById('wbNet');
  if (netEl) netEl.style.color = net >= 0 ? '#059669' : '#dc2626';

  const warn = document.getElementById('wbWarning');
  if (warn) {
    if (withPhone < 10) {
      warn.textContent = 'Kurang dari 10 pasien dengan nomor telepon di segmen ini — pertimbangkan memperluas filter.';
      warn.style.display = 'block';
    } else {
      warn.style.display = 'none';
    }
  }
}
