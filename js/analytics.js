/* ADC POS Intelligence Dashboard — Module: analytics.js
 * Analytics computations and visualizations:
 *   - STATS (spend segments, visit dist, lifecycle stats, top treatments)
 *   - RFM + Pareto (computeRFMAndPareto + buildRFMPareto)
 *   - Cohorts (computeCohorts + buildCohortRetention)
 *   - Forecasting (buildForecast + updateForecast)
 *   - Doctor Efficiency + Insight Cards
 * Extracted May 2026. Depends on core globals (D, D_META, rp, chartInstances, etc.).
 */

let STATS = {};
let RFM = null;   // { segments: [...], pareto: [...], summary: {...} }
let COHORTS = null; // { cohorts: [...], summary: {...} }

// ── HELPERS ──────────────────────────────────────────────────────────────────
function getRefDate(){
  const m = D_META || {};
  if(m.latestInvoiceDate){
    const d = new Date(m.latestInvoiceDate);
    if(!isNaN(d.getTime())) return d;
  }
  return new Date();
}

// ── ANALYTICS PRE-COMPUTE ────────────────────────────────────────────────────
function buildAnalytics(){
  const profiles = D.patientProfiles || [];
  if(!profiles.length){ STATS={}; return; }

  const sumSpend  = arr => arr.reduce((s,p)=>s+(p.totalSpend||0),0);
  const sumVisits = arr => arr.reduce((s,p)=>s+(p.visits||0),0);
  const avgSp  = arr => arr.length ? sumSpend(arr)/arr.length : 0;
  const avgVis = arr => arr.length ? sumVisits(arr)/arr.length : 0;

  const high = profiles.filter(p=>p.totalSpend>=10e6);
  const mid  = profiles.filter(p=>p.totalSpend>=3e6&&p.totalSpend<10e6);
  const low  = profiles.filter(p=>p.totalSpend<3e6);

  const txMap = {};
  profiles.forEach(p=>{
    (p.treatments||[]).forEach(t=>{
      if(!t.item)return;
      if(!txMap[t.item]) txMap[t.item]={patients:0,totalSpend:0,totalQty:0};
      txMap[t.item].patients++;
      txMap[t.item].totalSpend+=t.spend||0;
      txMap[t.item].totalQty  +=t.qty||0;
    });
  });
  const topTx = Object.entries(txMap)
    .sort((a,b)=>b[1].patients-a[1].patients)
    .slice(0,25)
    .map(([name,s])=>({name, patients:s.patients, totalQty:s.totalQty,
                        avgSpend:s.patients?s.totalSpend/s.patients:0}));

  const vd = {'1':0,'2-5':0,'6-10':0,'11+':0};
  profiles.forEach(p=>{
    const v=p.visits||0;
    if(v===1)       vd['1']++;
    else if(v<=5)   vd['2-5']++;
    else if(v<=10)  vd['6-10']++;
    else            vd['11+']++;
  });

  const lcStats = {};
  ['active','lapsing','dormant'].forEach(lc=>{
    const g=profiles.filter(p=>p.lifecycle===lc);
    lcStats[lc]={count:g.length, avgSpend:avgSp(g), avgVisits:avgVis(g),
                 withPhone:g.filter(p=>p.phone).length, totalSpend:sumSpend(g)};
  });

  const bothOutlets   = profiles.filter(p=>p.outlet==='Both').length;
  const withPhone     = profiles.filter(p=>p.phone).length;
  const withDiscount  = profiles.filter(p=>p.discountUsed).length;
  const highDormant   = profiles.filter(p=>p.lifecycle==='dormant'&&p.totalSpend>=5e6);

  STATS = { high,mid,low, topTx, vd, lcStats,
            bothOutlets, withPhone, withDiscount, highDormant,
            total:profiles.length };
}

// ── RFM + PARETO ─────────────────────────────────────────────────────────────
function computeRFMAndPareto(){
  const profiles = D.patientProfiles || [];
  if(!profiles.length){ RFM = null; return; }

  const ref = getRefDate();
  const scored = profiles.map(p=>{
    const last = p.lastVisitDate ? new Date(p.lastVisitDate) : null;
    const daysSince = last && !isNaN(last.getTime()) ? Math.max(0, Math.floor((ref - last)/(1000*3600*24))) : 999;

    let r = 1;
    if(daysSince <= 30) r=5;
    else if(daysSince <= 60) r=4;
    else if(daysSince <= 120) r=3;
    else if(daysSince <= 180) r=2;

    const v = p.visits || 0;
    let f = 1;
    if(v >= 8) f=5;
    else if(v >= 5) f=4;
    else if(v >= 3) f=3;
    else if(v >= 2) f=2;

    const s = p.totalSpend || 0;
    let m = 1;
    if(s >= 15e6) m=5;
    else if(s >= 8e6) m=4;
    else if(s >= 4e6) m=3;
    else if(s >= 2e6) m=2;

    let segment = 'Tidur';
    const sum = r+f+m;
    if(r>=4 && f>=4 && m>=4) segment = 'Juara';
    else if(r>=4 && (f+m)>=6) segment = 'Setia';
    else if(r>=3 && (f+m)>=5) segment = 'Potensial';
    else if(r<=2 && (f+m)>=5) segment = 'Berisiko';

    return { ...p, r, f, m, daysSince, segment };
  });

  const segOrder = ['Juara','Setia','Potensial','Berisiko','Tidur'];
  const segments = segOrder.map(name=>{
    const g = scored.filter(x=>x.segment===name);
    const totalSpend = g.reduce((a,b)=>a+(b.totalSpend||0),0);
    return {
      name,
      count: g.length,
      totalSpend,
      avgSpend: g.length ? totalSpend/g.length : 0,
      withPhone: g.filter(x=>x.phone).length
    };
  });

  const sorted = [...scored].sort((a,b)=>(b.totalSpend||0)-(a.totalSpend||0));
  let cum = 0;
  const totalRev = sorted.reduce((a,b)=>a+(b.totalSpend||0),0) || 1;
  const pareto = sorted.map((p,i)=>{
    cum += (p.totalSpend||0);
    return {
      rank: i+1,
      mrn: p.mrn,
      name: p.name||'—',
      spend: p.totalSpend||0,
      cumSpend: cum,
      cumPct: +(cum/totalRev*100).toFixed(1)
    };
  });

  const top10 = sorted.slice(0, Math.ceil(sorted.length*0.1));
  const top10Rev = top10.reduce((a,b)=>a+(b.totalSpend||0),0);
  const top10Pct = +(top10Rev/totalRev*100).toFixed(1);

  const top50 = sorted.slice(0,50);
  const top50Rev = top50.reduce((a,b)=>a+(b.totalSpend||0),0);
  const top50Pct = +(top50Rev/totalRev*100).toFixed(1);

  RFM = {
    segments,
    pareto,
    summary: {
      totalPatients: sorted.length,
      totalRevenue: totalRev,
      top10Pct,
      top50Pct,
      top10Count: top10.length,
      top50Count: top50.length
    }
  };
}

function buildRFMPareto(){
  const wrap = document.getElementById('rfmSegments');
  const tableBox = document.getElementById('paretoTable');
  const canvas = document.getElementById('chartPareto');
  if(!wrap || !tableBox || !canvas) return;

  wrap.innerHTML = '';
  tableBox.innerHTML = '';

  if(!RFM || !RFM.segments.length){
    wrap.innerHTML = '<div style="grid-column:1/-1;color:#9ca3af;font-size:0.82rem;padding:12px 0;">RFM memerlukan data pasien (jalankan ETL untuk analisis lengkap).</div>';
    return;
  }

  const colors = {
    'Juara':'#059669',
    'Setia':'#10b981',
    'Potensial':'#4f46e5',
    'Berisiko':'#f59e0b',
    'Tidur':'#ef4444'
  };

  RFM.segments.forEach(s=>{
    const el = document.createElement('div');
    el.className = 'rfm-card';
    el.innerHTML = `
      <div class="rfm-name" style="color:${colors[s.name]}">${s.name}</div>
      <div class="rfm-count">${s.count.toLocaleString()}</div>
      <div class="rfm-sub">${rp(s.totalSpend)} total · ${rp(s.avgSpend)} rata2</div>
      <div class="rfm-phone">${s.withPhone.toLocaleString()} punya telepon</div>
    `;
    wrap.appendChild(el);
  });

  const sum = document.createElement('div');
  sum.style.cssText = 'grid-column:1/-1;font-size:0.76rem;color:#374151;margin-top:4px;';
  sum.innerHTML = `<strong>Konsentrasi:</strong> ${RFM.summary.top10Count} pasien teratas (~10%) menghasilkan <strong>${RFM.summary.top10Pct}%</strong> pendapatan • Top 50 menghasilkan <strong>${RFM.summary.top50Pct}%</strong>`;
  wrap.appendChild(sum);

  if(window.Chart){
    const topN = Math.min(60, RFM.pareto.length);
    const labels = RFM.pareto.slice(0,topN).map(p=>p.rank);
    const cumData = RFM.pareto.slice(0,topN).map(p=>p.cumPct);
    const c = new Chart(canvas, {
      type:'line',
      data:{
        labels,
        datasets:[{
          label:'Pendapatan Kumulatif %',
          data:cumData,
          borderColor:'#4f46e5',
          backgroundColor:'rgba(79,70,229,0.08)',
          borderWidth:2.5,
          pointRadius:0,
          tension:0.15,
          fill:true
        }]
      },
      options:{
        responsive:true,
        plugins:{legend:{display:false}},
        scales:{
          y:{min:0,max:100,ticks:{callback:v=>v+'%'},grid:{color:'#f3f4f6'}},
          x:{ticks:{maxTicksLimit:8},grid:{display:false}}
        }
      }
    });
    chartInstances.push(c);
  }

  const top15 = RFM.pareto.slice(0,15);
  if(top15.length){
    new gridjs.Grid({
      columns:[
        {id:'rank',name:'Peringkat',width:'50px'},
        {id:'patient',name:'Pasien',width:'170px'},
        {id:'spend',name:'Biaya',width:'95px'},
        {id:'cumpct',name:'Kumulatif %',width:'100px'}
      ],
      data: top15.map(p=>[p.rank, p.name, rp(p.spend,2), p.cumPct+'%']),
      sort:false,
      style:{table:{'font-size':'0.74rem'}},
      pagination:false
    }).render(tableBox);
  }
}

// ── COHORT RETENTION ─────────────────────────────────────────────────────────
function computeCohorts(){
  const profiles = D.patientProfiles || [];
  if(!profiles.length){ COHORTS = null; return; }

  const ref = getRefDate();
  const activeThresholdDays = 90;

  const cohortMap = {};

  profiles.forEach(p=>{
    let cohortKey = 'Unknown / Pre-2025';

    const mrn = (p.mrn || '').toUpperCase();
    const m = mrn.match(/^(EM|SP)-(\d{2})(\d{2})/);
    if(m){
      const yy = parseInt(m[2],10);
      const mm = parseInt(m[3],10);
      if(yy>=20 && mm>=1 && mm<=12){
        cohortKey = `${2000+yy}-${String(mm).padStart(2,'0')}`;
      }
    } else if(p.firstVisitDate || p.lastVisitDate){
      const d = new Date(p.firstVisitDate || p.lastVisitDate);
      if(!isNaN(d.getTime()) && d.getFullYear() >= 2025){
        cohortKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      }
    }

    if(!cohortMap[cohortKey]) cohortMap[cohortKey] = { key: cohortKey, patients: [], returned: 0, totalRevenue: 0 };

    cohortMap[cohortKey].patients.push(p);
    cohortMap[cohortKey].totalRevenue += (p.totalSpend || 0);

    const last = p.lastVisitDate ? new Date(p.lastVisitDate) : null;
    if(last && !isNaN(last.getTime())){
      const days = Math.floor((ref - last) / (1000*3600*24));
      if(days <= activeThresholdDays) cohortMap[cohortKey].returned++;
    }
  });

  const cohorts = Object.values(cohortMap)
    .map(c => {
      const size = c.patients.length;
      const returnedPct = size ? Math.round((c.returned / size) * 100) : 0;
      const avgSpend = size ? Math.round(c.totalRevenue / size) : 0;
      return {
        key: c.key,
        size,
        returned: c.returned,
        returnedPct,
        totalRevenue: c.totalRevenue,
        avgSpend
      };
    })
    .sort((a,b) => b.key.localeCompare(a.key));

  const avgReturned = cohorts.length
    ? Math.round(cohorts.reduce((s,c)=>s+c.returnedPct,0) / cohorts.length)
    : 0;

  COHORTS = {
    cohorts,
    summary: {
      cohortCount: cohorts.length,
      avgReturnedPct: avgReturned,
      totalPatients: profiles.length
    }
  };
}

function buildCohortRetention(){
  const box = document.getElementById('cohortTable');
  if(!box) return;
  box.innerHTML = '';

  if(!COHORTS || !COHORTS.cohorts.length){
    box.innerHTML = '<div style="color:#9ca3af;font-size:0.82rem;padding:8px 0;">Analisis kohort memerlukan data pasien dengan tanggal kunjungan (jalankan ETL).</div>';
    return;
  }

  const html = `
    <div style="display:flex;gap:12px;align-items:center;margin-bottom:8px;">
      <div><strong>${COHORTS.cohorts.length}</strong> kohort • Rata-rata tingkat kembali <strong>${COHORTS.summary.avgReturnedPct}%</strong></div>
    </div>
    <table style="width:100%;font-size:0.78rem;border-collapse:collapse;">
      <thead>
        <tr style="border-bottom:1px solid #e5e7eb;color:#6b7280;">
          <th style="text-align:left;padding:4px 6px;">Kohort</th>
          <th style="text-align:right;padding:4px 6px;">Pasien</th>
          <th style="text-align:right;padding:4px 6px;">Kembali</th>
          <th style="text-align:right;padding:4px 6px;">% Kembali</th>
          <th style="text-align:right;padding:4px 6px;">Biaya Rata2</th>
        </tr>
      </thead>
      <tbody>
        ${COHORTS.cohorts.map(c => `
          <tr style="border-bottom:1px solid #f3f4f6;">
            <td style="padding:4px 6px;font-weight:600;">${c.key}</td>
            <td style="padding:4px 6px;text-align:right;">${c.size.toLocaleString()}</td>
            <td style="padding:4px 6px;text-align:right;">${c.returned.toLocaleString()}</td>
            <td style="padding:4px 6px;text-align:right;font-weight:700;color:${c.returnedPct>=60?'#059669':c.returnedPct>=40?'#d97706':'#ef4444'};">${c.returnedPct}%</td>
            <td style="padding:4px 6px;text-align:right;">${rp(c.avgSpend)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  box.innerHTML = html;
}

// ── FORECASTING ──────────────────────────────────────────────────────────────
function buildForecast(){
  const runRateEl = document.getElementById('fcCurrentRunRate');
  const monthsNoteEl = document.getElementById('fcMonthsNote');
  const projYTDEl = document.getElementById('fcProjectedYTD');
  const projRecentEl = document.getElementById('fcProjectedRecent');
  const targetInput = document.getElementById('fcTargetInput');

  if(!runRateEl || !D.monthly?.length) return;

  const monthly = D.monthly;
  const fullMonths = monthly.filter(m => !m.month.includes('*'));
  const loaded = fullMonths.length || monthly.length;
  const ytdRev = monthly.reduce((s,m)=>s + m.revenue, 0);
  const avgMonthly = loaded ? Math.round(ytdRev / loaded) : 0;

  runRateEl.textContent = rp(avgMonthly, 2) + ' / bulan';
  monthsNoteEl.textContent = `Berdasarkan ${loaded} bulan (pendapatan YTD ${rp(ytdRev)})`;

  const projYTD = avgMonthly * 12;
  projYTDEl.textContent = rp(projYTD);

  let recentAvg = avgMonthly;
  if(monthly.length >= 3){
    const last3 = monthly.slice(-3);
    const sum3 = last3.reduce((s,m)=>s+m.revenue,0);
    recentAvg = Math.round(sum3 / 3);
  }
  const projRecent = recentAvg * 12;
  projRecentEl.textContent = rp(projRecent) + (recentAvg !== avgMonthly ? ' (laju terkini)' : '');

  if(targetInput && !targetInput._wired){
    targetInput._wired = true;
    targetInput.oninput = updateForecast;
  }

  updateForecast();
}

function updateForecast(){
  const targetInput = document.getElementById('fcTargetInput');
  const reqEl = document.getElementById('fcRequiredMonthly');
  const gapEl = document.getElementById('fcGap');
  const liftEl = document.getElementById('fcLiftNote');

  if(!targetInput || !reqEl || !D.monthly?.length) return;

  const target = parseFloat(targetInput.value) || 0;
  if(!target){
    reqEl.textContent = '—'; gapEl.textContent = '—'; liftEl.textContent = 'Masukkan target untuk melihat kinerja bulanan yang dibutuhkan.';
    return;
  }

  const monthly = D.monthly;
  const fullMonths = monthly.filter(m => !m.month.includes('*'));
  const loaded = fullMonths.length || monthly.length;
  const ytdRev = monthly.reduce((s,m)=>s + m.revenue, 0);
  const currentAvg = loaded ? Math.round(ytdRev / loaded) : 0;

  const remainingMonths = Math.max(1, 12 - loaded);
  const requiredMonthly = Math.round( (target - ytdRev) / remainingMonths );

  const gap = requiredMonthly - currentAvg;
  const lift = currentAvg ? ((requiredMonthly / currentAvg - 1) * 100) : 0;

  reqEl.textContent = rp(requiredMonthly, 2);
  gapEl.textContent = (gap >= 0 ? '+' : '') + rp(gap, 2);
  gapEl.style.color = gap > 0 ? '#dc2626' : '#059669';

  const liftText = lift >= 0
    ? `Anda perlu kenaikan <strong>+${lift.toFixed(1)}%</strong> dari laju saat ini untuk ${remainingMonths} bulan tersisa.`
    : `Anda <strong>${Math.abs(lift).toFixed(1)}%</strong> lebih cepat dari laju yang dibutuhkan.`;

  liftEl.innerHTML = liftText + ` (YTD sejauh ini: ${rp(ytdRev)})`;
}

// ── DOCTOR EFFICIENCY + INSIGHTS ─────────────────────────────────────────────
function buildDoctorEfficiency(){
  const box = document.getElementById('docEfficiency');
  if(!box || !D.doctors?.length) return;
  box.innerHTML = '';

  const rows = D.doctors.map(d=>({
    ...d,
    revPerTxn: d.txns ? Math.round(d.revenue / d.txns) : 0
  })).sort((a,b)=>b.revPerTxn - a.revPerTxn);

  const maxRev = Math.max(...rows.map(r=>r.revPerTxn));

  rows.forEach(r=>{
    const pct = maxRev ? (r.revPerTxn / maxRev * 100).toFixed(1) : 0;
    const tag = '<span class="doc-tag ' + r.outlet.toLowerCase() + '">' + r.outlet + '</span>';
    const html = '<div class="doc-row">'
      + '<div class="doc-name">' + escHtml(r.name) + tag + '</div>'
      + '<div class="doc-bar-bg"><div class="doc-bar-fg ' + r.outlet.toLowerCase() + '" style="width:'+pct+'%;"></div></div>'
      + '<div class="doc-rev">' + rp(r.revPerTxn,2) + ' / txn · ' + r.txns.toLocaleString() + ' txns</div>'
      + '</div>';
    box.innerHTML += html;
  });
}

function buildInsightCards(){
  const box = document.getElementById('insightCards');
  if(!box) return;
  box.innerHTML = '';

  const insights = [];

  if(D.monthly?.length){
    let best = null;
    D.monthly.forEach(m=>{
      if(m.mom!=null && (!best || m.mom > best.mom)) best = m;
    });
    if(best && best.mom > 10){
      insights.push({
        type:'positive',
        html: `<strong>${best.month}</strong> adalah bulan terkuat — pertumbuhan <strong>+${best.mom}%</strong> MoM.`
      });
    }
  }

  if(D.monthly?.length){
    const gkGrowth = [];
    for(let i=1;i<D.monthly.length;i++){
      const prev = D.monthly[i-1].spgk;
      const cur = D.monthly[i].spgk;
      if(prev>0){
        const pct = (cur-prev)/prev*100;
        gkGrowth.push({month:D.monthly[i].month, pct});
      }
    }
    if(gkGrowth.length){
      const bestGk = gkGrowth.reduce((a,b)=>b.pct>a.pct?b:a, gkGrowth[0]);
      if(bestGk.pct > 25){
        insights.push({
          type:'positive',
          html: `<strong>adc SpGK</strong> mengalami lonjakan di <strong>${bestGk.month}</strong> (+${bestGk.pct.toFixed(0)}% vs bulan sebelumnya).`
        });
      }
    }
  }

  if(D.monthly?.length){
    const sortedAov = [...D.monthly].sort((a,b)=>b.aov-a.aov);
    const high = sortedAov[0];
    const low = sortedAov[sortedAov.length-1];
    if(high && low && high.aov > low.aov*1.2){
      insights.push({
        type:'info',
        html: `AOV berkisar dari <strong>${rp(high.aov,2)}</strong> (${high.month}) hingga <strong>${rp(low.aov,2)}</strong> (${low.month}).`
      });
    }
  }

  if(D.doctors?.length){
    const eff = D.doctors.map(d=>({
      name:d.name.replace(/, Sp.*/,''),
      revPerTxn: d.txns ? Math.round(d.revenue/d.txns) : 0
    })).sort((a,b)=>b.revPerTxn-a.revPerTxn);
    const top = eff[0];
    const avg = eff.reduce((s,d)=>s+d.revPerTxn,0)/eff.length;
    if(top && top.revPerTxn > avg*1.25){
      insights.push({
        type:'positive',
        html: `<strong>${escHtml(top.name)}</strong> adalah dokter paling efisien dengan <strong>${rp(top.revPerTxn,2)}/txn</strong> (${((top.revPerTxn/avg-1)*100).toFixed(0)}% di atas rata-rata).`
      });
    }
  }

  if(RFM?.summary){
    const c = RFM.summary;
    if(c.top10Pct >= 40){
      insights.push({
        type:'warning',
        html: `Risiko konsentrasi tinggi: ~10% pasien teratas menghasilkan <strong>${c.top10Pct}%</strong> pendapatan seumur hidup. Lindungi & kembangkan grup ini.`
      });
    }
  }

  const highDorm = STATS?.highDormant?.length || (RFM?.segments?.find(s=>s.name==='Tidur')?.count || 0);
  if(highDorm > 50){
    insights.push({
      type:'purple',
      html: `Ada <strong>${highDorm.toLocaleString()}</strong> pasien dorman bernilai tinggi — target reaktivasi kuat untuk kampanye berikutnya.`
    });
  }

  if(!insights.length){
    const div = document.createElement('div');
    div.className = 'insight-card';
    div.style.gridColumn = '1/-1';
    div.innerHTML = '<span style="color:#9ca3af;">Tidak ada anomali kuat terdeteksi pada data saat ini.</span>';
    box.appendChild(div);
    return;
  }

  const header = document.createElement('div');
  header.className = 'insight-header';
  header.innerHTML = `<span>🔎 Wawasan Utama (otomatis)</span>
    <button class="insight-ai-btn" onclick="ask('Analisis dataset saat ini dan beri saya 5 wawasan paling mengejutkan atau dapat ditindaklanjuti, termasuk risiko atau peluang yang mungkin terlewat. Jawab dalam Bahasa Indonesia.')">Lebih dalam dengan AI ↗</button>`;
  box.appendChild(header);

  insights.slice(0,6).forEach(ins=>{
    const card = document.createElement('div');
    card.className = 'insight-card ' + (ins.type||'');
    card.innerHTML = ins.html + (ins.meta ? `<div class="ins-meta">${ins.meta}</div>` : '');
    box.appendChild(card);
  });
}
