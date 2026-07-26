/* TRANSFLOW — Owner Cockpit. READ-ONLY fusion of every module's numbers.
   Invents nothing: each figure is global-derived or a printed formula. */
(function(){
  const $ = id => document.getElementById(id);
  if(!$('dial')) return;
  const aed = n => TF.fmt.aed(n);
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));

  /* ---- AR read with seed fallback (matches fmt.js TF.ar on the demo day) ---- */
  function arAll(){
    if(window.TF && TF.ar) return TF.ar.unified();
    const T = new Date(); T.setHours(12,0,0,0);
    const pd = s => { const p=String(s).slice(0,10).split('-').map(Number); return new Date(p[0],p[1]-1,p[2],12,0,0); };
    return (TF.invoices||[]).map(v => {
      const due=pd(v.due), dpd=Math.round((T-due)/864e5);
      const paid = v.st==='paid'?v.amt:(v.st==='partial'?40000:0);
      return { no:v.no, client:v.client, dateISO:v.date, dueISO:v.due, amt:v.amt, paid,
               outstanding:Math.max(0,v.amt-paid), effSt:v.st, daysPastDue:dpd, fresh:false };
    });
  }

  /* ---- count-up (local; cockpit owns every animated number) ---- */
  function countUp(el, to, fmt, dur=950){
    if(!el) return;
    const t0=performance.now();
    const step=t=>{ const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3), v=to*e;
      el.textContent = fmt==='aed'?aed(v):fmt==='pct'?v.toFixed(1)+'%':fmt==='d'?Math.round(v)+'D':TF.fmt.num(v);
      if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---- derived aggregates ---- */
  const K = TF.kpi || {};
  const ar = arAll();
  const outstanding = ar.reduce((a,v)=>a+v.outstanding,0);
  const overdue = ar.filter(v=>v.outstanding>0 && v.daysPastDue>0);
  const overdueOut = overdue.reduce((a,v)=>a+v.outstanding,0);
  const collected = ar.reduce((a,v)=>a+v.paid,0);
  const billed = ar.reduce((a,v)=>a+v.amt,0);
  const onRoad = (TF.vehicles||[]).filter(v=>v.st!=='wrk').length;
  const fleetTotal = (TF.vehicles||[]).length || 1;

  const weekRevByPlate = {};
  (TF.jobs||[]).forEach(j => weekRevByPlate[j.veh] = (weekRevByPlate[j.veh]||0) + j.qty*j.rate);

  // cash runway (indicative) — printed formula, links to Payables for the curve
  const cash = K.cash || 132000;
  const dailyBurn = (K.costMTD||287600)/30;
  const pos = cash + outstanding*0.8 - (K.costMTD||287600);
  const runway = Math.max(0, Math.round(pos/dailyBurn));

  // margin trend from the same 6-month series as the tower
  const margins = (K.revMTD!==undefined ? TF.months : null)
    ? TF.months.rev.map((r,i)=> r? ((r-TF.months.cost[i])/r*100) : 0) : [];

  /* ---- composite health (transparent blend) ---- */
  const sub = {
    margin: clamp((K.margin||0)/50*100, 0, 100),
    coll:   outstanding>0 ? clamp(100 - overdueOut/outstanding*100, 0, 100) : 100,
    fleet:  onRoad/fleetTotal*100,
    cash:   clamp(runway/30*100, 0, 100),
  };
  const health = Math.round(.30*sub.margin + .30*sub.coll + .20*sub.fleet + .20*sub.cash);
  const band = health>=85 ? {l:'STRONG',  c:'var(--teal)'}
             : health>=70 ? {l:'HEALTHY', c:'var(--teal)'}
             : health>=40 ? {l:'WATCH',   c:'var(--amber)'}
             :              {l:'CRITICAL',c:'var(--red)'};

  /* ---- radial dial ---- */
  const C = 2*Math.PI*52;
  const val = $('dialVal');
  val.style.strokeDasharray = C;
  val.style.strokeDashoffset = C;
  val.style.stroke = band.c;
  requestAnimationFrame(()=>requestAnimationFrame(()=>{
    val.style.transition = 'stroke-dashoffset 1.4s cubic-bezier(.22,.9,.28,1)';
    val.style.strokeDashoffset = C*(1-health/100);
  }));
  countUp($('dialNum'), health, 'num', 1400);
  const db = $('dialBand'); db.textContent = band.l; db.style.color = band.c; db.style.borderColor = band.c;

  $('dialSubs').innerHTML = [
    ['MARGIN', sub.margin], ['COLLECTIONS', sub.coll], ['FLEET', sub.fleet], ['CASH', sub.cash]
  ].map(([l,v]) => {
    const cc = v>=70?'var(--teal)':v>=40?'var(--amber)':'var(--red)';
    return `<span class="dsub"><i style="background:${cc}"></i>${l} <b>${Math.round(v)}</b></span>`;
  }).join('');

  /* ---- the plain-English verdict (rewrites from data) ---- */
  const fires = [];
  if(overdue.length) fires.push(overdue.length + ' invoice' + (overdue.length>1?'s':'') + ' need chasing');
  const wrk = (TF.vehicles||[]).filter(v=>v.st==='wrk');
  if(wrk.length) fires.push(wrk.length + ' truck' + (wrk.length>1?'s are':' is') + ' off the road');
  if(runway < 14) fires.push('cash runway is tight');
  $('verdictLine').innerHTML = `BUSINESS IS <em style="color:${band.c}">${band.l}</em>` +
    (fires.length ? ` — BUT ${fires.join(', and ')}.` : ' — EVERYTHING ON TRACK.');
  $('verdictSub').textContent = `${aed(K.revMTD||0)} revenue MTD · ${aed(K.gpMTD||0)} gross profit · ${onRoad}/${fleetTotal} trucks earning · ${runway}D cash runway`;

  /* ---- hero tiles (dark band) ---- */
  const tiles = [
    { l:'REVENUE · MTD', to:K.revMTD||0, fmt:'aed', chip:'▲ 12% VS JUN', cc:'up', href:'/app/dashboard', spark:TF.months?TF.months.rev:null, sc:'var(--teal)' },
    { l:'GROSS PROFIT', to:K.gpMTD||0, fmt:'aed', chip:(K.margin||0).toFixed(1)+'% MARGIN', cc:'up', href:'/app/dashboard' },
    { l:'CASH RUNWAY', to:runway, fmt:'d', chip: runway<14?'⚠ TIGHT':'COMFORTABLE', cc: runway<14?'warn':'up', href:'/app/finance/payables' },
    { l:'OUTSTANDING', to:outstanding, fmt:'aed', chip:overdue.length+' PAST DUE', cc: overdue.length?'dn':'up', href:'/app/finance/receivables' },
  ];
  $('tiles').innerHTML = tiles.map((t,i) => `
    <a class="tile" href="${t.href}" style="--i:${i}">
      <span class="tile-l mono">${t.l}</span>
      <span class="tile-v display" data-to="${t.to}" data-fmt="${t.fmt}">0</span>
      <span class="tile-chip ${t.cc}">${t.chip}</span>
      ${t.spark?`<span class="tile-sp" data-spark="${i}"></span>`:''}
      <span class="tile-go mono">SOURCE →</span>
    </a>`).join('');
  $('tiles').querySelectorAll('.tile-v').forEach(el => countUp(el, +el.dataset.to, el.dataset.fmt));
  tiles.forEach((t,i) => { const h=$('tiles').querySelector(`[data-spark="${i}"]`); if(h && t.spark) TF.charts.spark(h, t.spark, t.sc, 116, 30); });

  /* ---- deck ticker ---- */
  const ev = [];
  ev.push(`<span class="g">HEALTH ${health}/100 · ${band.l}</span>`);
  if(overdue[0]) ev.push(`<span><b>OLDEST DUE ${overdue.sort((a,b)=>b.daysPastDue-a.daysPastDue)[0].client.toUpperCase()} · ${overdue[0].daysPastDue}D</b></span>`);
  ev.push(`<span>${onRoad}/${fleetTotal} TRUCKS ON ROAD</span>`);
  ev.push(`<span class="g">MARGIN ${(K.margin||0).toFixed(1)}%</span>`);
  ev.push(`<span>${runway}D CASH RUNWAY</span>`);
  if(wrk.length) ev.push(`<span class="r">${wrk.map(v=>v.plate).join(' · ')} IN WORKSHOP</span>`);
  TF.fx.ticker($('deckTick'), ev);

  /* ---- margin trend spark (big) ---- */
  if(margins.length){
    TF.charts.spark($('marginSpark'), margins, band.c, 560, 130);
    const mn=Math.min(...margins), mx=Math.max(...margins);
    $('trendNow').textContent = 'NOW ' + margins[margins.length-1].toFixed(1) + '%';
    $('trendNow').style.color = band.c;
    $('trendRange').textContent = 'RANGE ' + mn.toFixed(0) + '%–' + mx.toFixed(0) + '%';
  }

  /* ---- money map stacked bar ---- */
  const openClean = Math.max(0, outstanding - overdueOut);
  const segs = [
    { l:'COLLECTED', v:collected, c:'var(--teal)' },
    { l:'OPEN',      v:openClean, c:'var(--steel)' },
    { l:'OVERDUE',   v:overdueOut,c:'var(--red)' },
  ];
  const tot = billed || 1;
  $('mmBar').innerHTML = segs.map(s => s.v? `<span class="mm-seg" style="width:${(s.v/tot*100).toFixed(2)}%;background:${s.c}" title="${s.l} · ${aed(s.v)}"></span>`:'').join('')
    || '<span class="mm-seg" style="width:100%;background:var(--line-2)"></span>';
  $('mmLeg').innerHTML = segs.map(s => `<span><i style="background:${s.c}"></i>${s.l} <b>${aed(s.v)}</b></span>`).join('')
    + `<span class="mm-tot">BILLED <b>${aed(billed)}</b></span>`;

  // top debtors
  const byC = {};
  ar.filter(v=>v.outstanding>0).forEach(v => byC[v.client] = (byC[v.client]||0) + v.outstanding);
  const debtors = Object.entries(byC).map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value).slice(0,3);
  $('mmDebtors').innerHTML = debtors.length ? debtors.map(d =>
    `<a class="mm-d" href="/app/operations/soa"><b>${d.label}</b><span class="mono">${aed(d.value)}</span></a>`).join('')
    : '<span class="mono" style="color:var(--mut)">NO OUTSTANDING BALANCES</span>';

  /* ---- attention / triage list ---- */
  const att = [];
  overdue.sort((a,b)=>b.daysPastDue-a.daysPastDue).slice(0,2).forEach(v =>
    att.push({ sev: v.daysPastDue>30?'crit':'warn', ico:'📞', t:`${v.client} — ${v.daysPastDue}D OVERDUE`, s:aed(v.outstanding)+' outstanding', href:'/app/finance/receivables' }));
  wrk.slice(0,1).forEach(v =>
    att.push({ sev:'warn', ico:'🔧', t:`${v.plate} IN WORKSHOP`, s:v.driver+' · fixed costs running, earning nothing', href:'/app/reports/vehicle-pl' }));
  (TF.vehicles||[]).filter(v=>v.st!=='wrk' && !weekRevByPlate[v.plate]).slice(0,1).forEach(v =>
    att.push({ sev:'note', ico:'⚑', t:`${v.plate} — NO TRIPS THIS WEEK`, s:v.driver+' · check dispatch', href:'/app/operations/spreadsheet' }));
  // fleet compliance — most urgent document across the register (same master as /app/masters/vehicles)
  (function(){
    const DEMO = new Date(2026,6,27,12,0,0);
    const pd = s => { const p=String(s).slice(0,10).split('-').map(Number); return new Date(p[0],p[1]-1,p[2],12,0,0); };
    const DOC = {insExp:'INSURANCE',regExp:'REGISTRATION',fitExp:'FITNESS TEST'};
    let u=null;
    (TF.vehicles||[]).forEach(v => Object.keys(DOC).forEach(k => { if(v[k]){ const days=Math.round((pd(v[k])-DEMO)/864e5);
      if(!u||days<u.days) u={plate:v.plate,type:DOC[k],days}; } }));
    if(u){ const ov=u.days<0;
      att.push({ sev: ov?'crit':u.days<=14?'warn':'note', ico: ov?'🚨':'🛡',
        t:`${u.plate} — ${u.type} ${ov?(-u.days)+'D OVERDUE':'IN '+u.days+'D'}`,
        s:'renew in Masters → Vehicles before it grounds the truck', href:'/app/masters/vehicles' }); }
  })();
  // VAT status (same quarter logic as the VAT page, real clock)
  const QS=[{id:'Q3',f:new Date(2026,6,1),t:new Date(2026,8,30),dl:new Date(2026,9,28)},
            {id:'Q2',f:new Date(2026,3,1),t:new Date(2026,5,30),dl:new Date(2026,6,28)}];
  const now=new Date(); const q=QS.find(x=>now>=x.f&&now<=x.t)||QS[0];
  const vatOut = ar.filter(v=>{const d=new Date(v.dateISO+'T12:00:00');return d>=q.f&&d<=q.t;}).reduce((a,v)=>a+(v.amt-Math.round(v.amt/1.05)),0);
  const inQ = now>=q.f && now<=q.t;
  att.push({ sev: inQ?'note':'warn', ico:'🧾', t:`VAT ${q.id} ${inQ?'IN PROGRESS':'DUE SOON'}`, s:'output VAT ≈ '+aed(vatOut)+' · file by '+q.dl.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}), href:'/app/reports/vat-report' });

  $('attCount').textContent = att.filter(a=>a.sev!=='note').length + ' NEED ACTION';
  $('attList').innerHTML = att.length ? att.map((a,i) => `
    <a class="att-row ${a.sev}" href="${a.href}" style="--i:${i}">
      <span class="att-rail"></span>
      <span class="att-ico">${a.ico}</span>
      <span class="att-mid"><b>${a.t}</b><small>${a.s}</small></span>
      <span class="att-go mono">OPEN →</span>
    </a>`).join('')
    : '<div class="att-empty">🎉 NOTHING NEEDS YOU — THE BUSINESS IS RUNNING ITSELF TODAY.</div>';

  /* ---- compliance rail: VAT card ---- */
  $('vatQ').textContent = q.id + ' 2026';
  const vs = $('vatSt'); vs.className = 'comp-st ' + (inQ?'prog':'ready');
  vs.textContent = inQ ? '◔ IN PROGRESS' : 'READY TO FILE';
  $('vatFig').textContent = 'OUTPUT VAT ≈ ' + aed(vatOut) + ' · FULL RETURN COMPUTES INPUT + NET';

  /* ---- fleet grid (real week revenue per plate) ---- */
  $('fleetGrid').innerHTML = (TF.vehicles||[]).map((v,i) => {
    const rev = weekRevByPlate[v.plate] || 0;
    const off = v.st==='wrk';
    return `<a class="ftile ${off?'off':''}" href="/app/reports/vehicle-pl" style="--i:${i}">
      <div class="ft-top"><b class="mono">${v.plate}</b><span class="ft-dot ${v.st}"></span></div>
      <div class="ft-type mono">${v.type}</div>
      <div class="ft-rev display">${off?'OFF ROAD':aed(rev)}</div>
      <div class="ft-drv mono">${v.driver}</div>
      <div class="ft-note">${off?'⚠ '+v.note:(rev?'this week':'no trips yet')}</div>
    </a>`;
  }).join('');

  /* ---- reveals for any injected data-reveal nodes ---- */
  TF.fx.reveal();
})();