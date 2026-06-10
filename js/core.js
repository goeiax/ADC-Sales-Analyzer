/* ADC POS Intelligence Dashboard — Module: core.js
 * Core state (D, D_DEFAULT, D_META), data loading, main orchestrator (rebuildDashboard),
 * shared utilities, KPI/filter basics, grids, doc bars, and supporting builders.
 * Extracted May 2026 for maintainability. The monolithic script is being progressively replaced.
 * Globals are intentional (window.*) so onclick= handlers and cross-module calls continue to work.
 */

// ── CHART.JS GLOBAL DEFAULTS ─────────────────────────────────────────────────
// aspectRatio 3 → height ≈ width/3 (~215px at 650px wide, vs 325px at default 2)
if (typeof Chart !== 'undefined') {
  Chart.defaults.aspectRatio = 3;
  Chart.defaults.plugins.legend.labels.boxWidth = 10;
  Chart.defaults.plugins.legend.labels.padding = 10;
  Chart.defaults.plugins.legend.labels.font = { size: 11 };
}

// ── DATA (embedded fallback; refreshed from dashboard-data.json on start) ─────
const D_DEFAULT = {
  monthly: [
    {month:'January',  key:'jan', revenue:2398698381, txns:1037, aov:2313113, mom:0,    spdve:1969833906, spgk:428864475},
    {month:'February', key:'feb', revenue:2308721550, txns:1022, aov:2259023, mom:-3.7, spdve:1859951037, spgk:448770513},
    {month:'March',    key:'mar', revenue:3037834862, txns:1117, aov:2719637, mom:31.6, spdve:2576983341, spgk:460851521},
    {month:'April',    key:'apr', revenue:2903436719, txns:1262, aov:2300663, mom:-4.4, spdve:2127729461, spgk:775707258},
    {month:'May*',     key:'may', revenue:972453291,  txns:472,  aov:2060282, mom:null, spdve:702034024,  spgk:270419267},
  ],
  yearly: [
    {year:'2022',  revenue:9083260,       invoices:5,     aov:1816652, visitors:5,    newReg:59,   creditExcl:0,          yoy:null},
    {year:'2023',  revenue:14589408441,   invoices:5867,  aov:2486690, visitors:1487, newReg:1480, creditExcl:239500000,  yoy:null},
    {year:'2024',  revenue:24237100779,   invoices:10912, aov:2221142, visitors:2779, newReg:1977, creditExcl:117500000,  yoy:66.1},
    {year:'2025',  revenue:30128187783,   invoices:13122, aov:2296006, visitors:3269, newReg:1854, creditExcl:1036700000, yoy:24.3},
    {year:'2026*', revenue:11621144803,   invoices:4910,  aov:2366832, visitors:1967, newReg:659,  creditExcl:1007578967, yoy:null},
  ],
  items: [
    {item:'Picosure Pro Glow',                   code:'T-22120050',   outlet:'SpDVE', revenue:937000000,  qty:224,  txns:223},
    {item:'Ulthera Prime Full Face (600 Shoots)', code:'T-25100004',   outlet:'SpDVE', revenue:893937500,  qty:39,   txns:39},
    {item:'Picosure Pro Exclusive Membership',   code:'PKG-23070002', outlet:'SpDVE', revenue:672840000,  qty:32,   txns:31},
    {item:'Deep Pore Combo',                     code:'T-23070002',   outlet:'SpDVE', revenue:466043179,  qty:605,  txns:604},
    {item:"Adc Fat Blocker 5's",                 code:'P-24100004',   outlet:'SpGK',  revenue:325337050,  qty:4310, txns:521},
    {item:'Excel V Rejuvenation Plus',           code:'T-24070002',   outlet:'SpDVE', revenue:289750000,  qty:100,  txns:100},
    {item:'Dermapen',                            code:'T-22120045',   outlet:'SpDVE', revenue:271015000,  qty:212,  txns:212},
    {item:'Consultation By Clinical Nutrition',  code:'T-24100015',   outlet:'SpGK',  revenue:240150000,  qty:644,  txns:644},
    {item:'ADC Biosimulation Booster',           code:'T-22120015',   outlet:'SpDVE', revenue:212065000,  qty:51,   txns:48},
    {item:'Laser Genesis',                       code:'T-22120033',   outlet:'SpDVE', revenue:185200000,  qty:143,  txns:143},
    {item:'Skin Booster (Restylane)',             code:'T-23010012',   outlet:'SpDVE', revenue:178500000,  qty:38,   txns:38},
    {item:'ADC Slimming Pro Package',            code:'PKG-24030001', outlet:'SpGK',  revenue:164800000,  qty:74,   txns:74},
    {item:'Fotona 4D Facelift',                  code:'T-24110001',   outlet:'SpDVE', revenue:158750000,  qty:27,   txns:27},
    {item:'Clinical Nutrition Consultation',     code:'T-22120061',   outlet:'SpGK',  revenue:142600000,  qty:382,  txns:382},
    {item:'Profhilo H+L Bioremodeling',          code:'T-23090005',   outlet:'SpDVE', revenue:138900000,  qty:41,   txns:41},
  ],
  doctors: [
    {name:'dr. Renata Yuliasari, SpDVE',    outlet:'SpDVE', revenue:4420000000, txns:1345},
    {name:'dr. Devina Santoso, SpDVE',      outlet:'SpDVE', revenue:2180000000, txns:687},
    {name:'dr. Melissa Hartono, SpDVE',     outlet:'SpDVE', revenue:1640000000, txns:498},
    {name:'dr. Nita Nurul Rachman, Sp.GK', outlet:'SpGK',  revenue:1230000000, txns:495},
    {name:'dr. Aulia Rahman, SpDVE',        outlet:'SpDVE', revenue:998000000,  txns:312},
    {name:'dr. Sinta Wijaya, Sp.GK',       outlet:'SpGK',  revenue:715000000,  txns:287},
    {name:'dr. Kezia Putri, SpDVE',         outlet:'SpDVE', revenue:542000000,  txns:183},
  ],
  patients: [
    {rank:1, mrn:'EM-220300012', visits:24, revenue:48200000},
    {rank:2, mrn:'EM-231100034', visits:19, revenue:38750000},
    {rank:3, mrn:'EM-240500071', visits:17, revenue:34100000},
    {rank:4, mrn:'EM-221200008', visits:15, revenue:31600000},
    {rank:5, mrn:'EM-230700055', visits:14, revenue:28400000},
  ],
  payment:[
    {method:'EDC BCA',pct:48.7},{method:'Cash',pct:21.3},
    {method:'EDC Mandiri',pct:13.8},{method:'GoPay/QRIS',pct:8.9},{method:'Other Cards',pct:7.3},
  ],
  categories:[],newReturning:[],visitDist:[],patientsLifecycle:null,discounts:null,salesVsCollection:[],commission:null,alerts:[],
  dow:[
    {day:'Mon',revenue:1420000000},{day:'Tue',revenue:1680000000},{day:'Wed',revenue:1890000000},
    {day:'Thu',revenue:1740000000},{day:'Fri',revenue:1980000000},{day:'Sat',revenue:2210000000},{day:'Sun',revenue:710000000},
  ],
};

let D = JSON.parse(JSON.stringify(D_DEFAULT));
let D_META = null;
let chartInstances = [];
let dataLoadSource = 'embedded';

// ── LOAD RECENT DATA ───────────────────────────────────────────────────────────
async function loadRecentData(){
  const statusEl=document.getElementById('dataRefreshStatus');
  try{
    const res=await fetch('dashboard-data.json?'+Date.now(),{cache:'no-store'});
    if(!res.ok)throw new Error('dashboard-data.json not found ('+res.status+')');
    const payload=await res.json();
    if(payload.error)throw new Error(payload.error);
    applyDashboardData(payload);
    dataLoadSource='live';
    if(statusEl){
      statusEl.className='data-refresh ok';
      const n=D_META.rawFilesCount||26;
      statusEl.textContent='✓ Data langsung · '+n+' berkas CSV · '+D_META.monthRange+(D_META.latestInvoiceDate?' · invoice terbaru '+D_META.latestInvoiceDate:'')+' · '+formatGeneratedAt(D_META.generatedAt);
    }
    return true;
  }catch(e){
    dataLoadSource='embedded';
    if(statusEl){
      statusEl.className='data-refresh warn';
      statusEl.textContent='Memakai data contoh — tambahkan CSV Neosoft ke folder “Raw CSVs”, lalu klik ↻ Segarkan ('+e.message+')';
    }
    updateDynamicLabels();
    return false;
  }
}

// Re-run the ETL in the installed app (app.py /refresh), then reload without a restart.
async function refreshData(){
  const status=document.getElementById('dataRefreshStatus');
  const btn=document.getElementById('refreshDataBtn');
  if(btn){btn.disabled=true;btn.textContent='Refreshing…';}
  if(status){status.className='data-refresh loading';status.textContent='Membangun ulang dari CSV…';}
  try{
    const res=await fetch('refresh',{cache:'no-store'});
    const j=await res.json().catch(()=>({}));
    if(!res.ok||j.ok===false) throw new Error(j.error||('HTTP '+res.status));
    await loadRecentData();
    rebuildDashboard();
  }catch(e){
    if(status){status.className='data-refresh warn';status.textContent='Segarkan memerlukan aplikasi terpasang (gagal: '+e.message+')';}
  }finally{
    if(btn){btn.disabled=false;btn.textContent='↻ Refresh data';}
  }
}

function applyDashboardData(payload){
  D_META=payload.meta||{};
  if(payload.monthly?.length) D.monthly=payload.monthly;
  if(payload.items?.length) D.items=payload.items;
  if(payload.doctors?.length) D.doctors=payload.doctors;
  if(payload.patients?.length) D.patients=payload.patients;
  if(payload.customers) D.customers=payload.customers;
  if(payload.ambiguousNames) D.ambiguousNames=payload.ambiguousNames;
  if(payload.payment?.length) D.payment=payload.payment;
  if(payload.dow?.length) D.dow=payload.dow;
  if(payload.categories) D.categories=payload.categories;
  if(payload.newReturning) D.newReturning=payload.newReturning;
  if(payload.visitDist) D.visitDist=payload.visitDist;
  if(payload.patientsLifecycle) D.patientsLifecycle=payload.patientsLifecycle;
  if(payload.discounts) D.discounts=payload.discounts;
  if(payload.salesVsCollection) D.salesVsCollection=payload.salesVsCollection;
  if(payload.commission) D.commission=payload.commission;
  if(payload.alerts) D.alerts=payload.alerts;
  if(payload.patientProfiles) D.patientProfiles=payload.patientProfiles;
  // Recalculate lifecycle using rolling window from the latest invoice date
  if(D.patientProfiles?.length){
    const ref=typeof getRefDate==='function'?getRefDate():new Date();
    D.patientProfiles.forEach(p=>{
      const ds=p.lastVisitDate;
      if(!ds) return;
      const d=new Date(ds);
      if(isNaN(d.getTime())) return;
      const days=Math.floor((ref-d)/(1000*3600*24));
      if(days>120) p.lifecycle='dormant';
      else if(days>30) p.lifecycle='lapsing';
      else p.lifecycle='active';
    });
    const lc2={active:0,lapsing:0,dormant:0};
    D.patientProfiles.forEach(p=>{if(lc2[p.lifecycle]!==undefined)lc2[p.lifecycle]++;});
    const tot2=D.patientProfiles.length||1;
    const existing=D.patientsLifecycle||{};
    D.patientsLifecycle=Object.assign({},existing,{
      active:lc2.active, lapsing:lc2.lapsing, dormant:lc2.dormant,
      total:D.patientProfiles.length,
      activePct: +(lc2.active/tot2*100).toFixed(1),
      lapsingPct:+(lc2.lapsing/tot2*100).toFixed(1),
      dormantPct:+(lc2.dormant/tot2*100).toFixed(1),
    });
  }
  if(typeof computeRFMAndPareto === 'function') computeRFMAndPareto();
  refreshYearly2026();
  updateDynamicLabels();
  rebuildMonthChips();
  if(typeof buildInsightCards === 'function') buildInsightCards();
  if(typeof computeCohorts === 'function') computeCohorts();
  if(typeof buildCohortRetention === 'function') buildCohortRetention();
  if(typeof buildForecast === 'function') buildForecast();
  if(typeof buildDataQuality === 'function') buildDataQuality();
}

function refreshYearly2026(){
  const y=D.yearly.find(r=>String(r.year).startsWith('2026'));
  if(!y)return;
  const rev=D.monthly.reduce((s,m)=>s+m.revenue,0);
  const inv=D.monthly.reduce((s,m)=>s+m.txns,0);
  y.revenue=rev;
  y.invoices=inv;
  y.aov=inv?Math.round(rev/inv):0;
  if(D_META?.creditExcluded!=null) y.creditExcl=D_META.creditExcluded;
}

function formatGeneratedAt(iso){
  if(!iso)return '';
  try{return new Date(iso).toLocaleString('id-ID',{dateStyle:'medium',timeStyle:'short'});}catch{return '';}
}

function updateDynamicLabels(){
  const m=D_META||{};
  const range=idMonth(m.monthRange||(D.monthly[0]?.month.replace('*','')+' – '+D.monthly[D.monthly.length-1]?.month));
  const meta=document.getElementById('headerMeta');
  const yr=m.dataYear||'';
  if(meta) meta.textContent=range+' '+yr+' · adc SpDVE + adc SpGK · Neosoft Export · Credit excluded';
  const badge=document.getElementById('monthBadge');
  if(badge) badge.textContent=(m.monthsLoaded||D.monthly.length)+' mo · '+(m.rawFilesCount||26)+' files';
  const credit=document.getElementById('creditBarText');
  if(credit){
    const ex=m.creditExcluded??1007578967;
    const inv=m.creditInvoices??125;
    credit.innerHTML='<strong>Kredit dikecualikan dari semua angka pendapatan:</strong> IDR '+Math.round(ex).toLocaleString()+' · '+inv+' invoice ('+range+')';
  }
  const credR=document.getElementById('creditBarRedemptions');
  if(credR) credR.innerHTML=m.creditRedemptions?'Penukaran (CREDIT VOUCHER): <strong>'+m.creditRedemptions+'</strong>':'';
  const credP=document.getElementById('creditBarPurchases');
  if(credP) credP.innerHTML=m.creditPurchases?'Pembelian paket CV-: <strong>'+m.creditPurchases+'</strong>':'';
  const footer=document.querySelector('.footer');
  if(footer) footer.innerHTML='ADC Clinic &nbsp;·&nbsp; Neosoft POS Export &nbsp;·&nbsp; '+range+' '+yr+' &nbsp;·&nbsp; adc SpDVE + adc SpGK &nbsp;·&nbsp; Data: '+dataLoadSource+(m.latestInvoiceDate?' &nbsp;·&nbsp; hingga '+m.latestInvoiceDate:'')+' &nbsp;·&nbsp; Dibuat oleh Claude Cowork &nbsp;·&nbsp; <span class="footer-link" onclick="openDataSources()">📁 Sumber Data</span>';
}

// Display-only English→Indonesian month name mapping (data keys stay English).
const ID_MONTHS={January:'Januari',February:'Februari',March:'Maret',April:'April',May:'Mei',June:'Juni',July:'Juli',August:'Agustus',September:'September',October:'Oktober',November:'November',December:'Desember'};
function idMonth(s){ if(s==null) return s; return String(s).replace(/January|February|March|April|May|June|July|August|September|October|November|December/g, w=>ID_MONTHS[w]||w); }
const ID_DAYS={Mon:'Sen',Tue:'Sel',Wed:'Rab',Thu:'Kam',Fri:'Jum',Sat:'Sab',Sun:'Min'};
function idDay(d){ return ID_DAYS[d]||d; }

function rebuildMonthChips(){
  const wrap=document.getElementById('monthChips');
  if(!wrap)return;
  let html='<button class="fchip active" onclick="setMonth(\'all\',this)">Semua</button>';
  D.monthly.forEach(m=>{
    const label=idMonth(m.month.replace('*',''));
    html+='<button class="fchip" onclick="setMonth(\''+m.key+'\',this)">'+label+'</button>';
  });
  wrap.innerHTML=html;
}

function destroyCharts(){
  chartInstances.forEach(c=>{try{c.destroy();}catch(_){}});
  chartInstances=[];
}

function rebuildDashboard(){
  invalidateQACache();
  destroyCharts();
  document.getElementById('scorecard').innerHTML='';
  document.getElementById('docBars').innerHTML='';
  ['grid-all','grid-spdve','grid-spgk','grid-patients','grid-customers','grid-commission','grid-data-sources','grid-remarketing'].forEach(id=>{const el=document.getElementById(id);if(el)el.innerHTML='';});
  document.getElementById('yearTableBody').innerHTML='';
  document.getElementById('alertsContainer').innerHTML='';
  document.getElementById('funnelContainer').innerHTML='';
  document.getElementById('outletBarsContainer').innerHTML='';
  const rfmSeg = document.getElementById('rfmSegments');
  if(rfmSeg) rfmSeg.innerHTML='';
  const paretoT = document.getElementById('paretoTable');
  if(paretoT) paretoT.innerHTML='';
  const docEff = document.getElementById('docEfficiency');
  if(docEff) docEff.innerHTML='';
  const ins = document.getElementById('insightCards');
  if(ins) ins.innerHTML='';
  const cohortT = document.getElementById('cohortTable');
  if(cohortT) cohortT.innerHTML='';
  const fcClear = document.getElementById('fcCurrentRunRate');
  if(fcClear) ['fcCurrentRunRate','fcMonthsNote','fcProjectedYTD','fcProjectedRecent','fcRequiredMonthly','fcGap','fcLiftNote'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
  if(typeof resetComparisonState === 'function') resetComparisonState();
  buildAlerts();
  ['fcCurrentRunRate','fcMonthsNote','fcProjectedYTD','fcProjectedRecent','fcRequiredMonthly','fcGap','fcLiftNote'].forEach(id=>{
    const el = document.getElementById(id);
    if(el) el.textContent = '—';
  });
  buildOutletBars();
  buildFunnel();
  buildScorecard();
  if(typeof buildCharts === 'function') buildCharts();
  buildGrids();
  buildDocBars();
  if(typeof buildDoctorEfficiency === 'function') buildDoctorEfficiency();
  buildCommission();
  if(typeof buildForecast === 'function') buildForecast();
  buildDiscountUI();
  buildDataSources();
  buildYearTable();
  if(typeof buildRemarketing === 'function') buildRemarketing();
  if(typeof buildAnalytics === 'function') buildAnalytics();
  if(typeof computeRFMAndPareto === 'function') computeRFMAndPareto();
  if(typeof buildRFMPareto === 'function') buildRFMPareto();
  if(typeof buildInsightCards === 'function') buildInsightCards();
  if(typeof computeCohorts === 'function') computeCohorts();
  if(typeof buildCohortRetention === 'function') buildCohortRetention();
  updateKPIs();
  if(typeof buildDataQuality === 'function') buildDataQuality();
  if(typeof buildLocalQuery === 'function') buildLocalQuery();
  if(typeof buildProductTrends === 'function') buildProductTrends();
}

// (Additional core builders and small utils from the original monolithic script will continue to be
// migrated here in follow-up extractions. The functions below are the minimal set needed for the
// first wiring + to keep the dashboard functional while the rest of the modules are extracted.)

function buildAlerts(){
  const box=document.getElementById('alertsContainer');
  if(!box)return;
  const icons={danger:'📉',success:'📈',warning:'⚠️',info:'💳',purple:'🏥'};
  (D.alerts||[]).forEach(a=>{
    box.innerHTML+='<div class="alert '+(a.type||'info')+'"><span class="alert-icon">'+(icons[a.type]||'•')+'</span><div><strong>'+escHtml(a.title)+'</strong>'+escHtml(a.body)+'</div></div>';
  });
  if(!D.alerts?.length){
    const m=D_META||{};
    box.innerHTML='<div class="alert purple"><span class="alert-icon">🏥</span><div id="outletAlertText"><strong>SpDVE '+(m.outletSpdvePct||0)+'% · SpGK '+(m.outletSpgkPct||0)+'%</strong> From invoice data · '+(m.rawFilesCount||26)+' source files loaded.</div></div>';
  }
}

function buildDataQuality(){
  const bar=document.getElementById('dqBar');
  if(!bar)return;
  const m=D_META||{};
  const files=m.rawFilesCount||26;
  const patients=m.uniqueCustomers?m.uniqueCustomers.toLocaleString():'—';
  const credit=m.creditExcluded?rp(m.creditExcluded)+'('+(m.creditInvoices||0)+' inv)':'—';
  const profiles=D.patientProfiles||[];
  let phonePct='—';
  if(profiles.length){
    phonePct=Math.round((profiles.filter(p=>p.phone).length/profiles.length)*100)+'%';
  } else if(typeof STATS!=='undefined'&&STATS.total){
    phonePct=Math.round((STATS.withPhone/STATS.total)*100)+'%';
  }
  const fresh=m.monthRange?(m.monthRange+' '+(m.dataYear||'')):(m.latestInvoiceDate||'—');
  const issues=(m.monthsLoaded&&m.monthsLoaded<5)?'sebagian':'0';
  bar.innerHTML=
    '<span class="dq-label">Kualitas Data</span>'+
    '<span class="dq-pill">'+files+' CSV</span>'+
    '<span class="dq-pill">'+patients+' pasien</span>'+
    '<span class="dq-pill">'+phonePct+' telepon</span>'+
    '<span class="dq-pill">'+credit+'</span>'+
    '<span class="dq-pill">'+fresh+'</span>'+
    '<span class="dq-pill" style="background:#fef3c7;color:#92400e;">Masalah: '+issues+'</span>'+
    ((m.treatmentsMissingDate>0)?'<span class="dq-pill" style="background:#fee2e2;color:#991b1b;" title="Perawatan ini tidak dapat ditanggali — periksa format kolom Invoice Date">'+m.treatmentsMissingDate.toLocaleString()+' tx tanpa tanggal</span>':'');
}

function buildGrids(){
  const fmt=v=>Math.round(v).toLocaleString();
  const rpM=v=>'Rp '+(v/1e6).toFixed(1)+'M';
  const allEl=document.getElementById('grid-all');
  if(allEl) new gridjs.Grid({columns:[{id:'svc',name:'Layanan / Produk',width:'260px'},{id:'code',name:'Kode',width:'120px'},{id:'outlet',name:'Klinik',width:'80px'},{id:'rev',name:'Pendapatan',width:'110px'},{id:'qty',name:'Jml',width:'70px'},{id:'txns',name:'Txn',width:'70px'},{id:'aov',name:'AOV',width:'100px'}],data:D.items.map(r=>[r.item,r.code,r.outlet,rpM(r.revenue),fmt(r.qty),fmt(r.txns),'Rp '+Math.round(r.revenue/r.txns).toLocaleString()]),search:false,sort:true,style:{table:{'font-size':'0.78rem'}},pagination:{limit:8}}).render(allEl);
  const spdveEl=document.getElementById('grid-spdve');
  if(spdveEl) new gridjs.Grid({columns:[{id:'svc',name:'Layanan',width:'260px'},{id:'rev',name:'Pendapatan',width:'110px'},{id:'qty',name:'Jml',width:'70px'},{id:'txns',name:'Txn',width:'70px'},{id:'aov',name:'AOV',width:'100px'}],data:D.items.filter(r=>r.outlet==='SpDVE').map(r=>[r.item,rpM(r.revenue),fmt(r.qty),fmt(r.txns),'Rp '+Math.round(r.revenue/r.txns).toLocaleString()]),sort:true,style:{table:{'font-size':'0.78rem'}},pagination:{limit:6}}).render(spdveEl);
  const spgkEl=document.getElementById('grid-spgk');
  if(spgkEl) new gridjs.Grid({columns:[{id:'svc',name:'Layanan',width:'260px'},{id:'rev',name:'Pendapatan',width:'110px'},{id:'qty',name:'Jml',width:'70px'},{id:'txns',name:'Txn',width:'70px'},{id:'aov',name:'AOV',width:'100px'}],data:D.items.filter(r=>r.outlet==='SpGK').map(r=>[r.item,rpM(r.revenue),fmt(r.qty),fmt(r.txns),'Rp '+Math.round(r.revenue/r.txns).toLocaleString()]),sort:true,style:{table:{'font-size':'0.78rem'}},pagination:{limit:6}}).render(spgkEl);
  const patientsEl=document.getElementById('grid-patients');
  if(patientsEl) new gridjs.Grid({columns:[{id:'rank',name:'#',width:'36px'},{id:'mrn',name:'MRN',width:'120px'},{id:'pname',name:'Nama Pasien',width:'180px'},{id:'inv',name:'Invoice',width:'72px'},{id:'lines',name:'Item Baris',width:'72px'},{id:'comm',name:'Komisi',width:'72px'},{id:'spend',name:'Biaya',width:'100px'},{id:'src',name:'Sumber',width:'200px'}],
    data:D.patients.map(r=>[r.rank,r.mrn,r.name||'—',r.visits,r.lineItems||0,r.commissionUsages||0,'Rp '+(r.revenue/1e6).toFixed(2)+'M',(r.sources||[]).join(', ')]),
    sort:true,style:{table:{'font-size':'0.78rem'}},pagination:{limit:10}}).render(patientsEl);
  const custEl=document.getElementById('grid-customers');
  if(custEl&&D.customers?.length){
    const pMap={};(D.patientProfiles||[]).forEach(p=>{pMap[p.mrn]=p;});
    new gridjs.Grid({columns:[{id:'mrn',name:'MRN',width:'112px'},{id:'name',name:'Nama',width:'170px'},{id:'phone',name:'Telepon',width:'108px'},{id:'status',name:'Status',width:'82px'},{id:'spend',name:'Biaya',width:'95px'},{id:'visits',name:'Kunjungan',width:'56px'},{id:'lines',name:'Baris',width:'50px'},{id:'last',name:'Kunjungan Terakhir',width:'92px'},{id:'src',name:'Sumber',width:'155px'}],
      data:D.customers.map(c=>{const pr=pMap[c.mrn]||{};return[c.mrn,c.name||'—',pr.phone||'—',pr.lifecycle||'—',rp(c.revenue||0,2),c.invoiceVisits||0,c.lineItems||0,c.lastVisit||'—',(c.sources||[]).join(', ')]; }),
      search:true,sort:true,style:{table:{'font-size':'0.78rem'}},pagination:{limit:15}}).render(custEl);
  }
}

function buildDocBars(){
  const cont=document.getElementById('docBars');
  if(!D.doctors?.length || !cont) return;
  cont.innerHTML='';
  const maxRev=Math.max(...D.doctors.map(d=>d.revenue));
  D.doctors.forEach(d=>{
    const pct=(d.revenue/maxRev*100).toFixed(1);
    const tag='<span class="doc-tag '+d.outlet.toLowerCase()+'">'+d.outlet+'</span>';
    cont.innerHTML+='<div class="doc-row"><div class="doc-name">'+escHtml(d.name)+tag+'</div><div class="doc-bar-bg"><div class="doc-bar-fg '+d.outlet.toLowerCase()+'" style="width:'+pct+'%;"></div></div><div class="doc-rev">'+rp(d.revenue,2)+' · '+d.txns.toLocaleString()+' txns</div></div>';
  });
}

// Shared helpers (used across modules)
const rp=(v,d=1)=>{if(v==null||isNaN(v))return'Rp —';return v>=1e9?'Rp '+(v/1e9).toFixed(d)+'B':v>=1e6?'Rp '+(v/1e6).toFixed(d)+'M':'Rp '+Math.round(v).toLocaleString();};
let activeMonth='all',activeOutlet='all';
let compareYoY = false;

function downloadBlob(blob, filename){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;a.download=filename;a.click();
  setTimeout(()=>URL.revokeObjectURL(url),400);
}

function kpiBox(val,label){
  return '<div class="pt-kpi"><div class="pt-kpi-v">'+val+'</div><div class="pt-kpi-l">'+label+'</div></div>';
}

function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// (The rest of the original core — updateKPIs with YoY, buildCharts, buildFunnel, buildScorecard,
// buildOutletBars, buildCommission, buildDiscountUI, buildDataSources, buildYearTable, buildAnalytics,
// filterByMonthIndex, setMonth/setOutlet/toggleYoYCompare, etc. — will be moved into this file or
// a charts.js companion in the next extraction pass. The current partial core + the two already-
// extracted modules (segments + remarketing) already give a working, smaller main HTML.)
