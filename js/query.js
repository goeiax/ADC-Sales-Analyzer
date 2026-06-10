/* ADC POS Intelligence Dashboard — Module: query.js
 * Local, no-AI querying of the data. Two tools:
 *   1) Patient treatment history by date range (point-and-click).
 *   2) A general keyword "quick lookups" box (deterministic, instant, private).
 * Depends on core globals: D, rp, escHtml, showPatientDetail.
 * All data stays in the browser — nothing is sent anywhere.
 */

function lqProfiles() { return D.patientProfiles || []; }

// ── INIT (called from rebuildDashboard after data loads) ──────────────────────
function buildLocalQuery() {
  const list = document.getElementById('lqPatientList');
  if (list) {
    const opts = lqProfiles().slice(0, 4000).map(p =>
      '<option value="' + escHtml((p.name || p.mrn) + ' — ' + p.mrn) + '"></option>'
    ).join('');
    list.innerHTML = opts;
  }
  const pr = document.getElementById('lqPatientResult');
  if (pr) pr.innerHTML = lqProfiles().length
    ? '<span style="color:#9ca3af;font-size:0.82rem;">Pilih pasien di atas untuk melihat riwayat perawatannya. Tambahkan tanggal Dari/Sampai untuk mempersempit.</span>'
    : '<span style="color:#9ca3af;font-size:0.82rem;">Belum ada profil pasien. Tambahkan CSV Neosoft ke folder “Raw CSVs” lalu buka ulang aplikasi.</span>';
  const qr = document.getElementById('lqQueryResult');
  if (qr) qr.innerHTML = '';
  if (document.getElementById('rcResult')) lqRunRecall();
}

// ── PATIENT TREATMENT HISTORY ─────────────────────────────────────────────────
function lqFindPatient(raw) {
  const q = (raw || '').trim();
  if (!q) return null;
  const profiles = lqProfiles();
  // "Name — MRN" picked from the datalist → use the MRN after the dash.
  const dash = q.lastIndexOf('—');
  if (dash !== -1) {
    const mrn = q.slice(dash + 1).trim().toUpperCase();
    const byMrn = profiles.find(p => (p.mrn || '').toUpperCase() === mrn);
    if (byMrn) return byMrn;
  }
  const up = q.toUpperCase();
  // Exact MRN, then name contains, then MRN contains.
  return profiles.find(p => (p.mrn || '').toUpperCase() === up)
      || profiles.find(p => (p.name || '').toUpperCase().includes(up))
      || profiles.find(p => (p.mrn || '').toUpperCase().includes(up))
      || null;
}

// Jump from anywhere (e.g. the patient-detail modal) straight into the dated history panel.
function lqShowPatient(mrn) {
  const p = lqProfiles().find(x => x.mrn === mrn);
  if (!p) return;
  if (typeof closePatientDetail === 'function') closePatientDetail();
  const inp = document.getElementById('lqPatient');
  if (inp) inp.value = (p.name || p.mrn) + ' — ' + p.mrn;
  const f = document.getElementById('lqFrom'); if (f) f.value = '';
  const t = document.getElementById('lqTo'); if (t) t.value = '';
  lqRunPatient();
  document.getElementById('localQueryCard')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function lqClearDates() {
  const f = document.getElementById('lqFrom'); if (f) f.value = '';
  const t = document.getElementById('lqTo'); if (t) t.value = '';
  lqRunPatient();
}

function lqRunPatient() {
  const box = document.getElementById('lqPatientResult');
  if (!box) return;
  const p = lqFindPatient(document.getElementById('lqPatient')?.value);
  if (!p) {
    box.innerHTML = '<span style="color:#9ca3af;font-size:0.82rem;">Tidak ada pasien yang cocok. Ketik nama atau MRN, atau pilih dari daftar.</span>';
    return;
  }
  const from = document.getElementById('lqFrom')?.value || '';
  const to = document.getElementById('lqTo')?.value || '';

  let txs = (p.treatments || []).slice();
  if (from || to) txs = txs.filter(t => t.date && (!from || t.date >= from) && (!to || t.date <= to));
  txs.sort((a, b) => (a.date || '').localeCompare(b.date || ''));

  const spend = txs.reduce((s, t) => s + (t.spend || 0), 0);
  const windowLabel = (from || to)
    ? ('antara ' + (from || '…') + ' dan ' + (to || '…'))
    : 'semua tanggal';

  const header =
    '<div style="display:flex;flex-wrap:wrap;gap:8px 16px;align-items:baseline;margin-bottom:8px;">'
    + '<strong style="font-size:0.98rem;color:#111827;">' + escHtml(p.name || '—') + '</strong>'
    + '<span style="color:#6b7280;font-size:0.8rem;">' + escHtml(p.mrn) + '</span>'
    + (p.phone ? '<span style="color:#6b7280;font-size:0.8rem;">📞 ' + escHtml(p.phone) + '</span>' : '')
    + '<span class="lq-pill">' + (p.outlet || '—') + '</span>'
    + (p.lifecycle ? '<span class="lq-pill ' + p.lifecycle + '">' + p.lifecycle + '</span>' : '')
    + '<button class="pt-view-btn" style="margin-left:auto;" onclick="showPatientDetail(\'' + escHtml(p.mrn) + '\')">Detail lengkap ▶</button>'
    + '</div>'
    + '<div style="font-size:0.82rem;color:#374151;margin-bottom:8px;">'
    + '<strong>' + txs.length + '</strong> perawatan ' + windowLabel
    + ' · <strong>' + rp(spend, 2) + '</strong> pada rentang ini</div>';

  if (!txs.length) {
    box.innerHTML = header + '<span style="color:#9ca3af;font-size:0.82rem;">Tidak ada perawatan pada rentang tanggal ini.</span>';
    return;
  }

  const rows = txs.map(t =>
    '<tr style="border-bottom:1px solid #f3f4f6;">'
    + '<td style="padding:5px 8px;white-space:nowrap;">' + (t.date || '—') + '</td>'
    + '<td style="padding:5px 8px;">' + escHtml(t.item || '—') + '</td>'
    + '<td style="padding:5px 8px;color:#6b7280;">' + escHtml(t.code || '') + '</td>'
    + '<td style="padding:5px 8px;text-align:center;">' + (t.qty || 0) + '</td>'
    + '<td style="padding:5px 8px;text-align:right;white-space:nowrap;">' + rp(t.spend, 2) + '</td>'
    + '<td style="padding:5px 8px;">' + (t.outlet || '') + '</td>'
    + '<td style="padding:5px 8px;color:#6b7280;">' + escHtml(t.doctor || '') + '</td>'
    + '</tr>'
  ).join('');

  box.innerHTML = header
    + '<table style="width:100%;border-collapse:collapse;font-size:0.78rem;">'
    + '<thead><tr style="border-bottom:2px solid #e5e7eb;color:#6b7280;text-align:left;">'
    + '<th style="padding:4px 8px;">Tanggal</th><th style="padding:4px 8px;">Perawatan</th>'
    + '<th style="padding:4px 8px;">Kode</th><th style="padding:4px 8px;text-align:center;">Jml</th>'
    + '<th style="padding:4px 8px;text-align:right;">Biaya</th><th style="padding:4px 8px;">Klinik</th>'
    + '<th style="padding:4px 8px;">Dokter</th></tr></thead><tbody>' + rows + '</tbody></table>'
    + '<div style="margin-top:8px;"><button class="qa-btn" onclick="lqExportPatient(\'' + escHtml(p.mrn) + '\')">⬇ Ekspor daftar ini (CSV)</button></div>';

  lq_lastPatientTxs = { mrn: p.mrn, name: p.name, txs };
}

let lq_lastPatientTxs = null;
function lqExportPatient() {
  if (!lq_lastPatientTxs) return;
  const { mrn, name, txs } = lq_lastPatientTxs;
  let csv = 'Date,Treatment,Code,Qty,Spend,Outlet,Doctor\n';
  txs.forEach(t => {
    csv += [t.date || '', '"' + (t.item || '').replace(/"/g, "'") + '"', t.code || '',
            t.qty || 0, Math.round(t.spend || 0), t.outlet || '',
            '"' + (t.doctor || '').replace(/"/g, "'") + '"'].join(',') + '\n';
  });
  const safe = String(name || mrn).substring(0, 20).replace(/[^a-zA-Z0-9]/g, '_');
  downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'ADC_' + safe + '_treatments.csv');
}

// ── PATIENTS DUE FOR RECALL ───────────────────────────────────────────────────
// Each patient has their own rhythm: average gap between their dated treatments.
// "Due" = today is past (last visit + their average gap). High-value first.
function waLink(phone, msg) {
  let d = String(phone || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('0')) d = '62' + d.slice(1);
  else if (!d.startsWith('62')) d = '62' + d;
  return 'https://wa.me/' + d + (msg ? '?text=' + encodeURIComponent(msg) : '');
}

function lqComputeRecall() {
  const ref = (typeof getRefDate === 'function') ? getRefDate() : new Date();
  const def = Math.max(14, parseInt(document.getElementById('rcDefault')?.value || '90', 10));
  const maxStale = Math.max(30, parseInt(document.getElementById('rcMaxStale')?.value || '365', 10));
  const phoneOnly = document.getElementById('rcPhoneOnly')?.checked;

  const rows = [];
  lqProfiles().forEach(p => {
    if (phoneOnly && !p.phone) return;
    const dates = (p.treatments || []).map(t => t.date).filter(Boolean).sort();
    if (!dates.length) return;
    const last = new Date(dates[dates.length - 1]);
    if (isNaN(last.getTime())) return;
    let interval = def;
    if (dates.length >= 2) {
      const first = new Date(dates[0]);
      interval = Math.round((last - first) / 86400000 / (dates.length - 1));
    }
    interval = Math.max(14, interval);
    const expected = new Date(last.getTime() + interval * 86400000);
    const overdue = Math.round((ref - expected) / 86400000);
    if (overdue < 0 || overdue > maxStale) return;   // not due yet, or likely gone
    const lastTx = (p.treatments || []).filter(t => t.date === dates[dates.length - 1]).map(t => t.item)[0]
                || (p.treatments || [])[0]?.item || '';
    rows.push({ p, lastDate: dates[dates.length - 1], interval, overdue, lastTx });
  });
  rows.sort((a, b) => (b.p.totalSpend || 0) - (a.p.totalSpend || 0));   // value first
  return rows;
}

let lq_lastRecall = [];
function lqRunRecall() {
  const box = document.getElementById('rcResult');
  if (!box) return;
  if (!lqProfiles().length) {
    box.innerHTML = '<span style="color:#9ca3af;font-size:0.82rem;">Perlu data pasien bertanggal. Tambahkan CSV Neosoft ke folder “Raw CSVs” lalu buka ulang.</span>';
    return;
  }
  const rows = lqComputeRecall();
  lq_lastRecall = rows;
  const withPhone = rows.filter(r => r.p.phone).length;
  const value = rows.reduce((s, r) => s + (r.p.totalSpend || 0), 0);

  if (!rows.length) {
    box.innerHTML = '<span style="color:#9ca3af;font-size:0.82rem;">Tidak ada pasien yang perlu dihubungi pada rentang ini. Coba perpanjang batas keterlambatan atau ubah jeda.</span>';
    return;
  }
  const msg = 'Halo, sudah waktunya untuk perawatan lanjutan Anda di ADC Clinic. Boleh kami bantu jadwalkan?';
  const body = rows.slice(0, 200).map(r => {
    const p = r.p;
    const wa = p.phone ? waLink(p.phone, msg) : '';
    return '<tr style="border-bottom:1px solid #f3f4f6;">'
      + '<td style="padding:5px 8px;">' + escHtml(p.name || '—') + '</td>'
      + '<td style="padding:5px 8px;">' + (p.phone ? escHtml(p.phone) : '—') + '</td>'
      + '<td style="padding:5px 8px;white-space:nowrap;">' + r.lastDate + '</td>'
      + '<td style="padding:5px 8px;text-align:center;">~' + r.interval + 'd</td>'
      + '<td style="padding:5px 8px;text-align:center;font-weight:700;color:' + (r.overdue > 60 ? '#dc2626' : '#d97706') + ';">' + r.overdue + 'd</td>'
      + '<td style="padding:5px 8px;">' + escHtml(r.lastTx || '—') + '</td>'
      + '<td style="padding:5px 8px;text-align:right;white-space:nowrap;">' + rp(p.totalSpend, 2) + '</td>'
      + '<td style="padding:5px 8px;white-space:nowrap;">'
        + (wa ? '<a href="' + wa + '" target="_blank" rel="noopener" class="pt-view-btn" style="text-decoration:none;background:#25d366;border-color:#25d366;color:#fff;">WhatsApp</a> ' : '')
        + '<button class="pt-view-btn" onclick="showPatientDetail(\'' + escHtml(p.mrn) + '\')">▶</button>'
      + '</td></tr>';
  }).join('');

  box.innerHTML =
    '<div style="font-size:0.82rem;color:#374151;margin-bottom:8px;"><strong>' + rows.length + '</strong> pasien perlu/terlambat dihubungi · '
    + '<strong>' + withPhone + '</strong> dapat dihubungi via telepon · <strong>' + rp(value) + '</strong> total nilai seumur hidup'
    + (rows.length > 200 ? ' (menampilkan 200 teratas berdasarkan nilai)' : '') + '</div>'
    + '<table style="width:100%;border-collapse:collapse;font-size:0.78rem;">'
    + '<thead><tr style="border-bottom:2px solid #e5e7eb;color:#6b7280;text-align:left;">'
    + '<th style="padding:4px 8px;">Nama</th><th style="padding:4px 8px;">Telepon</th><th style="padding:4px 8px;">Kunjungan Terakhir</th>'
    + '<th style="padding:4px 8px;text-align:center;">Ritme</th><th style="padding:4px 8px;text-align:center;">Terlambat</th>'
    + '<th style="padding:4px 8px;">Perawatan Terakhir</th><th style="padding:4px 8px;text-align:right;">Nilai</th>'
    + '<th style="padding:4px 8px;">Aksi</th></tr></thead><tbody>' + body + '</tbody></table>';
}

function lqExportRecall() {
  if (!lq_lastRecall.length) { alert('No recall list to export. Adjust the settings and try again.'); return; }
  let csv = 'MRN,Name,Phone,LastVisit,AvgIntervalDays,OverdueDays,LastTreatment,TotalSpend\n';
  lq_lastRecall.forEach(r => {
    const p = r.p;
    csv += [p.mrn, '"' + (p.name || '').replace(/"/g, "'") + '"', p.phone || '', r.lastDate,
            r.interval, r.overdue, '"' + (r.lastTx || '').replace(/"/g, "'") + '"', Math.round(p.totalSpend || 0)].join(',') + '\n';
  });
  downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), 'ADC_Recall_CallSheet.csv');
}

// ── GENERAL KEYWORD QUERY ─────────────────────────────────────────────────────
function lqRunQuery() {
  const box = document.getElementById('lqQueryResult');
  const q = (document.getElementById('lqQuery')?.value || '').trim();
  if (!box) return;
  if (!q) { box.innerHTML = ''; return; }
  const ql = q.toLowerCase();
  const profiles = lqProfiles();

  const listPatients = (arr, title) => {
    if (!arr.length) return '<span style="color:#9ca3af;font-size:0.82rem;">Tidak ada pasien cocok: ' + escHtml(q) + '</span>';
    const rows = arr.slice(0, 100).map(p =>
      '<tr style="border-bottom:1px solid #f3f4f6;">'
      + '<td style="padding:5px 8px;">' + escHtml(p.name || '—') + '</td>'
      + '<td style="padding:5px 8px;color:#6b7280;">' + escHtml(p.mrn) + '</td>'
      + '<td style="padding:5px 8px;">' + (p.phone ? escHtml(p.phone) : '—') + '</td>'
      + '<td style="padding:5px 8px;">' + (p.lifecycle || '—') + '</td>'
      + '<td style="padding:5px 8px;text-align:right;">' + rp(p.totalSpend, 2) + '</td>'
      + '<td style="padding:5px 8px;">' + (p.lastVisitDate || p.lastVisit || '—') + '</td>'
      + '<td style="padding:5px 8px;"><button class="pt-view-btn" onclick="showPatientDetail(\'' + escHtml(p.mrn) + '\')">▶</button></td>'
      + '</tr>'
    ).join('');
    return '<div style="font-size:0.82rem;color:#374151;margin-bottom:6px;"><strong>' + arr.length + '</strong> ' + title
      + (arr.length > 100 ? ' (menampilkan 100 pertama)' : '') + '</div>'
      + '<table style="width:100%;border-collapse:collapse;font-size:0.78rem;">'
      + '<thead><tr style="border-bottom:2px solid #e5e7eb;color:#6b7280;text-align:left;">'
      + '<th style="padding:4px 8px;">Nama</th><th style="padding:4px 8px;">MRN</th><th style="padding:4px 8px;">Telepon</th>'
      + '<th style="padding:4px 8px;">Status</th><th style="padding:4px 8px;text-align:right;">Biaya</th>'
      + '<th style="padding:4px 8px;">Kunjungan Terakhir</th><th style="padding:4px 8px;"></th></tr></thead><tbody>'
      + rows + '</tbody></table>';
  };

  // 1) top N patients by spend
  let m = ql.match(/top\s+(\d+)?\s*patient/);
  if (m) {
    const n = parseInt(m[1] || '10', 10);
    const top = [...profiles].sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0)).slice(0, n);
    box.innerHTML = listPatients(top, 'pasien teratas berdasarkan belanja seumur hidup'); return;
  }

  // 2) lifecycle segment, optional "over Nm" spend floor
  m = ql.match(/(dormant|lapsing|active)/);
  if (m) {
    const lc = m[1];
    const floor = ql.match(/over\s+([\d.]+)\s*m/);
    const min = floor ? parseFloat(floor[1]) * 1e6 : 0;
    let arr = profiles.filter(p => p.lifecycle === lc && (p.totalSpend || 0) >= min);
    if (ql.includes('phone')) arr = arr.filter(p => p.phone);
    arr.sort((a, b) => (b.totalSpend || 0) - (a.totalSpend || 0));
    box.innerHTML = listPatients(arr, 'pasien ' + lc + (min ? ' di atas ' + (min / 1e6) + 'Jt' : '') + (ql.includes('phone') ? ' punya telepon' : '')); return;
  }

  // 3) revenue in <month>
  m = ql.match(/revenue\s+(?:in\s+)?(jan\w*|feb\w*|mar\w*|apr\w*|may|jun\w*|jul\w*|aug\w*|sep\w*|oct\w*|nov\w*|dec\w*)/);
  if (m) {
    const mon = m[1].slice(0, 3);
    const row = (D.monthly || []).find(x => x.month.toLowerCase().startsWith(mon));
    box.innerHTML = row
      ? '<div style="font-size:0.9rem;color:#111827;"><strong>' + row.month.replace('*', '') + '</strong> pendapatan: <strong>' + rp(row.revenue, 2) + '</strong> · ' + row.txns + ' invoice · AOV ' + rp(row.aov, 2) + '</div>'
      : '<span style="color:#9ca3af;font-size:0.82rem;">Tidak ada data untuk bulan itu.</span>';
    return;
  }

  // 4) doctors at <outlet>
  m = ql.match(/doctor.*(spgk|spdve)|(spgk|spdve).*doctor/);
  if (m) {
    const out = ql.includes('spgk') ? 'SpGK' : 'SpDVE';
    const docs = (D.doctors || []).filter(d => (d.outlet || '').toLowerCase() === out.toLowerCase());
    box.innerHTML = docs.length
      ? '<div style="font-size:0.82rem;color:#374151;margin-bottom:6px;"><strong>' + docs.length + '</strong> dokter di ' + out + '</div>'
        + docs.map(d => '<div style="padding:4px 0;border-bottom:1px solid #f3f4f6;font-size:0.82rem;">' + escHtml(d.name) + ' · ' + rp(d.revenue, 2) + ' · ' + d.txns + ' txns</div>').join('')
      : '<span style="color:#9ca3af;font-size:0.82rem;">Tidak ada dokter untuk ' + out + '.</span>';
    return;
  }

  // 5) fallback — treatment / name / MRN contains
  const arr = profiles.filter(p =>
    (p.name || '').toLowerCase().includes(ql) ||
    (p.mrn || '').toLowerCase().includes(ql) ||
    (p.treatments || []).some(t => (t.item || '').toLowerCase().includes(ql))
  );
  box.innerHTML = listPatients(arr, 'pasien yang cocok “' + escHtml(q) + '”');
}
