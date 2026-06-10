/* ADC POS Intelligence Dashboard — Module: segments.js
 * Saved Segments (localStorage-backed) — extracted for maintainability.
 * Depends on global: D, savedSegments (array), renderSavedSegments, rebuildDashboard (from core).
 * All functions are intentionally global (window.*) so existing onclick= handlers continue to work.
 */

let savedSegments = [];

function saveCurrentSegment() {
  const name = prompt('Nama segmen (mis. "SpDVE bernilai tinggi yang menurun & punya telepon")');
  if (!name || !name.trim()) return;

  const profiles = D.patientProfiles || [];
  const seg = {
    name: name.trim(),
    ts: Date.now(),
    filters: { ...rmkFilter },
    count: rmkFiltered.length,
    spend: rmkFiltered.reduce((s, p) => s + (p.totalSpend || 0), 0),
    withPhone: rmkFiltered.filter(p => p.phone).length,
    sampleMRNs: rmkFiltered.slice(0, 5).map(p => p.mrn),
    totalPatients: profiles.length
  };

  savedSegments = savedSegments.filter(s => s.name !== seg.name);
  savedSegments.unshift(seg);
  try {
    localStorage.setItem('adc_saved_segments', JSON.stringify(savedSegments));
  } catch (e) {}
  renderSavedSegments();
  const btn = document.getElementById('saveSegBtn');
  if (btn) {
    const old = btn.textContent;
    btn.textContent = 'Tersimpan ✓';
    setTimeout(() => { btn.textContent = old; }, 1200);
  }
}

function loadSegment(name) {
  const seg = savedSegments.find(s => s.name === name);
  if (!seg) return;

  // Restore filter state
  rmkFilter = { ...(seg.filters || { lifecycle: 'all', outlet: 'all', treatment: '', phoneOnly: false }) };

  // Apply to UI controls
  const si = document.getElementById('rmkSearch');
  if (si) si.value = rmkFilter.treatment || '';

  const po = document.getElementById('rmkPhoneOnly');
  if (po) po.checked = !!rmkFilter.phoneOnly;

  // Outlet chips
  document.querySelectorAll('#rmkOutletChips .fchip').forEach(b => {
    const v = b.getAttribute('data-value') || '';
    b.classList.toggle('active', (rmkFilter.outlet === 'all' && v === 'all') ||
      (rmkFilter.outlet === 'spdve' && v === 'spdve') ||
      (rmkFilter.outlet === 'spgk' && v === 'spgk'));
  });

  // Lifecycle cards
  const map = { dormant: 'pcardDormant', lapsing: 'pcardLapsing', active: 'pcardActive', all: 'pcardAll' };
  document.querySelectorAll('.rmk-pcard').forEach(c => c.classList.remove('selected'));
  const cardId = map[rmkFilter.lifecycle || 'all'] || 'pcardAll';
  document.getElementById(cardId)?.classList.add('selected');

  // Re-apply filter (this will also call updateWinbackROI + renderSavedSegments)
  applyRmkFilter(true);
}

function deleteSegment(name) {
  if (!confirm('Hapus segmen "' + name + '"?')) return;
  savedSegments = savedSegments.filter(s => s.name !== name);
  try {
    localStorage.setItem('adc_saved_segments', JSON.stringify(savedSegments));
  } catch (e) {}
  renderSavedSegments();
}

function renderSavedSegments() {
  const box = document.getElementById('savedSegmentsList');
  if (!box) return;

  if (!savedSegments.length) {
    box.innerHTML = '<span style="color:#9ca3af;font-size:0.8rem;">Belum ada segmen tersimpan. Gunakan filter di kiri, lalu "Simpan Saat Ini".</span>';
    return;
  }

  box.innerHTML = savedSegments.map((s, i) => {
    const ago = Math.round((Date.now() - (s.ts || 0)) / 3600000);
    const agoStr = ago < 1 ? 'just now' : (ago < 24 ? ago + 'h ago' : Math.round(ago / 24) + 'd ago');
    return '<div class="seg-row">'
      + '<div class="seg-main">'
      +   '<strong>' + (s.name || ('Segment ' + (i + 1))) + '</strong>'
      +   '<span class="seg-meta">' + (s.count || 0).toLocaleString() + ' patients'
      +   ' · ' + rp(s.spend || 0) + ' · ' + (s.withPhone || 0) + ' punya telepon'
      +   ' · ' + agoStr + '</span>'
      + '</div>'
      + '<div class="seg-actions">'
      +   '<button class="seg-btn" onclick="loadSegment(\'' + s.name.replace(/'/g, "\\'") + '\')">Muat</button>'
      +   '<button class="seg-btn danger" onclick="deleteSegment(\'' + s.name.replace(/'/g, "\\'") + '\')">Hapus</button>'
      + '</div>'
      + '</div>';
  }).join('');
}

// Load persisted segments on module load (runs when this script executes)
try {
  const raw = localStorage.getItem('adc_saved_segments');
  if (raw) savedSegments = JSON.parse(raw) || [];
} catch (e) {
  savedSegments = [];
}
