/* TRANSFLOW — vehicle profit & loss report (self-contained cost model) */
(function(){
  const body = document.getElementById('vBody');
  if(!body) return;
  const $ = id => document.getElementById(id);

  const PERIOD_LABEL = { month:'MONTH TO DATE', last:'LAST MONTH', qtd:'QUARTER TO DATE' };
  const HEADS = ['fuel','driver_pay','maint','ins','tyre','toll','reg'];
  const HEAD_LABEL = { fuel:'FUEL & DIESEL', driver_pay:'DRIVER PAY + COMM.', maint:'MAINTENANCE',
                       ins:'INSURANCE', tyre:'TYRES', toll:'TOLLS / SALIK', reg:'REGISTRATION / RTA' };

  /* authored monthly model — one deliberate loser (the truck in the shop), one thin margin */
  const BASE = [
    { plate:'B-45823', type:'40FT FLATBED', driver:'Ahmed Khan',    rev:72400, fuel:16200, driver_pay:7400, maint:3100, ins:2400, tyre:1800, toll:2200, reg:600 },
    { plate:'B-78214', type:'40FT FLATBED', driver:'Bilal Hussain', rev:68900, fuel:15800, driver_pay:7100, maint:2600, ins:2400, tyre:1500, toll:2000, reg:600 },
    { plate:'C-33907', type:'20FT BOX',     driver:'Rajesh Nair',   rev:54200, fuel:11400, driver_pay:6200, maint:2200, ins:1800, tyre:1200, toll:1600, reg:500 },
    { plate:'D-51442', type:'CHILLED VAN',  driver:'Suresh Menon',  rev:61500, fuel:13900, driver_pay:6800, maint:4400, ins:2900, tyre:1600, toll:1900, reg:600 },
    { plate:'B-90112', type:'LOWBED',       driver:'Imran Baloch',  rev:58700, fuel:14600, driver_pay:7600, maint:3800, ins:3200, tyre:2400, toll:1400, reg:700 },
    { plate:'C-67230', type:'10T TRUCK',    driver:'Yousef Ali',    rev:41300, fuel:8900,  driver_pay:5400, maint:1900, ins:1500, tyre:900,  toll:2300, reg:400 },
    { plate:'D-12876', type:'CURTAINSIDER', driver:'Manoj Kumar',   rev:12400, fuel:3100,  driver_pay:5800, maint:9600, ins:2200, tyre:3400, toll:400,  reg:600 },
    { plate:'B-24501', type:'40FT FLATBED', driver:'Khalid Rehman', rev:39500, fuel:9700,  driver_pay:6900, maint:2400, ins:2400, tyre:1300, toll:1100, reg:4200 },
  ];

  const hash = s => { let h=2166136261>>>0; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; };
  const vehMeta = p => (TF.vehicles||[]).find(v => v.plate===p) || {};
  const stLabel = s => s==='wrk' ? 'WORKSHOP' : (s==='run' ? 'ON ROAD' : 'ON ROAD');

  let state = { period:'month', sort:'margin', filter:'ALL' };

  function build(){
    const P = state.period;
    return BASE.map(b => {
      const rf = P==='last' ? (0.84 + (hash(b.plate+'r')%18)/100)
               : P==='qtd'  ? (2.80 + (hash(b.plate+'r')%8)/10) : 1;
      const cf = P==='month' ? 1 : rf * (0.93 + (hash(b.plate+'c'+P)%16)/100);
      const rev = Math.round(b.rev*rf);
      const heads = {}; let cost = 0;
      HEADS.forEach(k => { heads[k] = Math.round(b[k]*cf); cost += heads[k]; });
      const gp = rev - cost, margin = rev ? gp/rev*100 : 0;
      const trips = Math.max(1, Math.round(rev / (1300 + hash(b.plate+'t')%900)));
      const km = trips * (80 + hash(b.plate+'k')%180);
      const opCost = heads.fuel + heads.tyre + heads.maint;
      const cls = gp<0 ? 'bleed' : (margin<32 ? 'watch' : 'ok');
      const topCost = HEADS.slice().sort((x,y)=>heads[y]-heads[x])[0];
      return Object.assign({}, b, { rev, heads, cost, gp, margin, trips, km,
        perKm: km?opCost/km:0, perTrip: trips?rev/trips:0, fuelShare: cost?heads.fuel/cost*100:0,
        cls, topCost, status: vehMeta(b.plate).st || 'run' });
    });
  }

  function fleet(rows){
    const rev = rows.reduce((a,r)=>a+r.rev,0), cost = rows.reduce((a,r)=>a+r.cost,0), gp = rev-cost;
    const bleed = rows.filter(r=>r.gp<0), watch = rows.filter(r=>r.gp>=0 && r.margin<32);
    const win = rows.filter(r=>r.gp>=0).length;
    const worst = rows.slice().sort((a,b)=>a.gp-b.gp)[0];
    const best  = rows.slice().sort((a,b)=>b.margin-a.margin)[0];
    return { rev, cost, gp, margin: rev?gp/rev*100:0, bleed, watch, win, worst, best, n:rows.length };
  }

  function sortRows(rows){
    const r = rows.slice();
    if(state.sort==='margin') r.sort((a,b)=>a.margin-b.margin);
    else if(state.sort==='gp') r.sort((a,b)=>a.gp-b.gp);
    else r.sort((a,b)=>b.rev-a.rev);
    return r;
  }
  const filterRows = rows => rows.filter(r =>
    state.filter==='ALL' ? true : state.filter==='BLEED' ? r.cls==='bleed'
    : state.filter==='WATCH' ? r.cls==='watch' : r.cls==='ok');

  /* ---------- count-up ---------- */
  function countUp(el,to,fmt){
    if(!el) return;
    const t0=performance.now(), dur=950;
    const step=t=>{ const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3), v=to*e;
      el.textContent = fmt==='aed'?TF.fmt.aed(v):fmt==='pct'?v.toFixed(1)+'%':TF.fmt.num(v);
      if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const mColor = m => m<0 ? 'var(--red)' : m<32 ? 'var(--amber)' : 'var(--teal)';
  const mWidth = m => Math.max(3, Math.min(100, ((m+20)/80)*100));

  /* ---------- render ---------- */
  function render(){
    const all = build(), F = fleet(all), rows = filterRows(sortRows(all));

    countUp($('mRev'), F.rev, 'aed'); countUp($('mCost'), F.cost, 'aed');
    countUp($('mGp'), F.gp, 'aed');  countUp($('mMargin'), F.margin, 'pct');
    countUp($('mWin'), F.win, 'num'); countUp($('mBleed'), F.bleed.length, 'num');
    $('mPer').textContent = PERIOD_LABEL[state.period];
    $('mGp').closest('.m-cell').classList.toggle('good', F.gp>=0);
    $('mGp').closest('.m-cell').classList.toggle('bad', F.gp<0);

    renderHealth(F); renderMix(all, F); renderVerdict(F); renderTable(rows); renderTicker(F);
  }

  function renderHealth(F){
    const m = F.margin, pct = Math.max(2, Math.min(100, m/60*100));
    const zone = m<25 ? 'var(--red)' : m<40 ? 'var(--amber)' : 'var(--teal)';
    $('health').innerHTML = `
      <div class="hg-top"><span class="hg-v display" style="color:${zone}">${m.toFixed(1)}%</span>
        <span class="hg-l mono">FLEET VEHICLE-LEVEL MARGIN</span></div>
      <div class="hg-track"><span class="hg-z z1"></span><span class="hg-z z2"></span><span class="hg-z z3"></span>
        <span class="hg-mk" style="left:${pct}%"></span></div>
      <div class="hg-scale mono"><span>0%</span><span>25%</span><span>40%</span><span>60%+</span></div>
      <div class="hg-note mono">${F.win} of ${F.n} trucks profitable · ${F.bleed.length} below zero${F.watch.length?' · '+F.watch.length+' on thin margin':''}</div>`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ const mk=$('health').querySelector('.hg-mk'); if(mk) mk.style.left=pct+'%'; }));
  }

  function renderMix(all, F){
    const segs = all.map(r => {
      const w = F.rev ? r.rev/F.rev*100 : 0;
      const c = r.cls==='bleed' ? 'var(--red)' : r.cls==='watch' ? 'var(--amber)' : 'var(--teal)';
      return `<span class="mix-seg" style="width:${w.toFixed(2)}%;background:${c}" title="${r.plate} · ${TF.fmt.aed(r.rev)} · ${r.margin.toFixed(0)}% margin"></span>`;
    }).join('');
    const legend = all.slice().sort((a,b)=>b.rev-a.rev).slice(0,4).map(r =>
      `<span><i style="background:${r.cls==='bleed'?'var(--red)':r.cls==='watch'?'var(--amber)':'var(--teal)'}"></i>${r.plate} ${(F.rev?r.rev/F.rev*100:0).toFixed(0)}%</span>`).join('');
    $('mix').innerHTML = `<div class="mix-bar">${segs}</div>
      <div class="mix-leg mono">${legend}<span class="mut">+${Math.max(0,all.length-4)} MORE</span></div>`;
  }

  function renderVerdict(F){
    const w = F.worst; if(!w){ $('verdictCard').style.display='none'; return; }
    $('verdictCard').style.display='';
    const neg = w.gp<0;
    const watch = F.watch.slice().sort((a,b)=>a.margin-b.margin)[0];
    $('verdict').innerHTML = `
      <div class="vd-badge ${neg?'bad':'warn'}">${neg?'🚨 BLEEDING':'⚠ THIN MARGIN'}</div>
      <div class="vd-main">
        <div class="vd-plate"><b class="display">${w.plate}</b><span class="mono">${w.type} · ${w.driver}</span></div>
        <div class="vd-fig"><span class="vd-num display ${neg?'neg':''}">${TF.fmt.aed(w.gp)}</span>
          <span class="vd-ml mono">${w.margin.toFixed(1)}% MARGIN · ${PERIOD_LABEL[state.period]}</span></div>
        <p class="vd-why">${neg
          ? `This truck cost <b>${TF.fmt.aed(w.cost)}</b> to run but earned only <b>${TF.fmt.aed(w.rev)}</b>. The biggest drain is <b>${HEAD_LABEL[w.topCost]}</b> at ${TF.fmt.aed(w.heads[w.topCost])} — ${w.status==='wrk'?'it is off the road in the workshop, earning nothing while the fixed costs keep running.':'utilisation is too low for the costs it carries.'}`
          : `Margin is only <b>${w.margin.toFixed(1)}%</b> — one bad month flips it red. Watch <b>${HEAD_LABEL[w.topCost]}</b> (${TF.fmt.aed(w.heads[w.topCost])}).`}</p>
      </div>
      <div class="vd-acts">
        <button data-vact="review" data-plate="${w.plate}">⚑ FLAG FOR REVIEW</button>
        <button data-vact="audit"  data-plate="${w.plate}">🔍 COST AUDIT</button>
        <button data-vact="pull"   data-plate="${w.plate}">${neg?'⊘ PULL FROM FLEET':'↻ REASSIGN ROUTES'}</button>
        <button data-vact="open"   data-plate="${w.plate}" class="primary">OPEN FILE →</button>
      </div>
      ${watch && watch.plate!==w.plate ? `<div class="vd-also mono">ALSO WATCH · ${watch.plate} — ${watch.margin.toFixed(1)}% MARGIN</div>` : ''}`;
  }

  function renderTable(rows){
    body.innerHTML = rows.length ? rows.map((r,i) => `
      <tr class="vrow ${r.cls}" data-plate="${r.plate}" style="--i:${Math.min(i,10)}">
        <td class="vrank">${i+1}</td>
        <td class="vplate"><b>${r.plate}</b><small>${r.type}</small></td>
        <td class="vdrv">${r.driver}<small class="mono">${stLabel(r.status)}</small></td>
        <td class="r mono">${TF.fmt.aed(r.rev)}</td>
        <td class="r mono">${TF.fmt.aed(r.cost)}</td>
        <td class="r mono vgp ${r.gp<0?'neg':''}">${r.gp<0?'−':''}${TF.fmt.aed(Math.abs(r.gp))}</td>
        <td class="vmargin"><div class="mb"><span class="mb-f" style="--w:${mWidth(r.margin).toFixed(1)}%;background:${mColor(r.margin)}"></span></div><b style="color:${mColor(r.margin)}">${r.margin.toFixed(1)}%</b></td>
        <td><span class="vpill ${r.cls}">${r.cls==='bleed'?'BLEEDING':r.cls==='watch'?'THIN':'PROFITABLE'}</span></td>
        <td class="vgo"><button data-act="open">DETAIL →</button></td>
      </tr>`).join('')
      : `<tr><td colspan="9" class="empty-row">NO VEHICLES MATCH THIS FILTER.</td></tr>`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>body.classList.add('in')));
  }

  function renderTicker(F){
    const ev = [];
    if(F.worst) ev.push(`<span><b>${F.worst.plate}</b> ${F.worst.gp<0?'LOSING '+TF.fmt.aed(Math.abs(F.worst.gp)):'THIN AT '+F.worst.margin.toFixed(0)+'%'}</span>`);
    ev.push(`<span class="g">FLEET MARGIN ${F.margin.toFixed(1)}%</span>`);
    if(F.bleed.length) ev.push(`<span class="r">${F.bleed.length} TRUCK${F.bleed.length>1?'S':''} BELOW ZERO</span>`);
    if(F.best) ev.push(`<span class="g">★ BEST MARGIN ${F.best.plate} · ${F.best.margin.toFixed(0)}%</span>`);
    ev.push(`<span>${F.win}/${F.n} PROFITABLE</span>`);
    TF.fx.ticker($('btick'), ev);
  }

  /* ---------- detail drawer: waterfall + live trips ---------- */
  function openDrawer(plate){
    const r = build().find(x=>x.plate===plate); if(!r) return;
    const meta = vehMeta(plate);
    $('dKicker').textContent = 'VEHICLE FILE · ' + PERIOD_LABEL[state.period];
    $('dTitle').textContent = plate + ' · ' + r.type;

    const segs = [{label:'REVENUE', val:r.rev, kind:'rev'}]
      .concat(HEADS.map(k => ({ label:HEAD_LABEL[k], val:r.heads[k], kind:'cost' })))
      .concat([{ label:'GROSS PROFIT', val:r.gp, kind:'gp' }]);

    const hi = r.rev, lo = Math.min(0, r.gp);
    const W=520, H=320, P={l:14,r:14,t:24,b:64}, iw=W-P.l-P.r, ih=H-P.t-P.b;
    const Y = v => P.t + ih - ((v-lo)/(hi-lo))*ih;
    const y0 = Y(0), n = segs.length, colW = iw/n, bw = colW*0.6;
    let run = r.rev, parts = '', labels = '';

    segs.forEach((s,i) => {
      const x = P.l + i*colW + (colW-bw)/2;
      let top, h, fill, origin;
      if(s.kind==='rev'){ top=Y(s.val); h=y0-top; fill='var(--teal)'; origin='bottom'; }
      else if(s.kind==='cost'){ top=Y(run); h=Y(run-s.val)-Y(run); fill='var(--red)'; origin='top'; run-=s.val; }
      else { const a=Math.max(0,s.val), b=Math.min(0,s.val); top=Y(a); h=Math.max(Y(b)-Y(a),1); fill=s.val>=0?'var(--teal)':'var(--red)'; origin=s.val>=0?'bottom':'top'; }
      const cls = s.kind==='cost' ? 'wf-cost' : (s.val>=0?'wf-pos':'wf-neg');
      parts += `<g class="wf-seg ${cls}" style="--o:${i*55}ms;transform-origin:50% ${origin}">
        <rect x="${x}" y="${top}" width="${bw}" height="${Math.max(h,1)}" fill="${fill}" rx="2"/>
        <text x="${x+bw/2}" y="${top-5}" text-anchor="middle" class="wf-val">${s.kind==='cost'?'−':''}${TF.fmt.k(s.val)}</text></g>`;
      if(s.kind==='cost' && i<n-1){ const cy=Y(run); parts += `<line x1="${x+bw}" x2="${x+colW+(colW-bw)/2}" y1="${cy}" y2="${cy}" stroke="var(--line-2)" stroke-dasharray="2 3"/>`; }
      const short = s.label.split(' ')[0];
      labels += `<text x="${x+bw/2}" y="${H-40}" text-anchor="middle" class="wf-lab" transform="rotate(-32 ${x+bw/2} ${H-40})">${short}</text>`;
    });
    const zero = `<line x1="${P.l}" x2="${W-P.r}" y1="${y0}" y2="${y0}" stroke="var(--ink)" stroke-width="1.2"/>`;

    const liveTrips = (TF.jobs||[]).filter(j=>j.veh===plate);
    const weekRev = liveTrips.reduce((a,j)=>a+j.qty*j.rate,0);
    const tripsHTML = liveTrips.length ? liveTrips.map(j => `
      <div class="dtrip">
        <span class="mono dt-id">${j.id}</span>
        <div class="dt-mid"><b>${j.from} → ${j.to}</b><small>${j.cargo}</small></div>
        <span class="mono dt-amt">${TF.fmt.aed(j.qty*j.rate)}</span>
        <span class="st ${j.st}"><i></i>${j.st==='ok'?'DEL':j.st==='run'?'RUN':'WAIT'}</span>
      </div>`).join('') : `<div class="d-empty mono">NO TRIPS LOGGED THIS WEEK</div>`;

    $('drawerBody').innerHTML = `
      <div class="d-headline ${r.cls}">
        <span class="dh-gp display ${r.gp<0?'neg':''}">${r.gp<0?'−':''}${TF.fmt.aed(Math.abs(r.gp))}</span>
        <span class="dh-ml mono">${r.margin.toFixed(1)}% MARGIN · <span class="vpill ${r.cls}">${r.cls==='bleed'?'BLEEDING':r.cls==='watch'?'THIN':'PROFITABLE'}</span></span>
      </div>
      <div class="d-stats">
        <div class="dstat"><span>TRIPS</span><b>${r.trips}</b></div>
        <div class="dstat"><span>EST. KM</span><b>${TF.fmt.num(r.km)}</b></div>
        <div class="dstat"><span>OPS AED/KM</span><b>${r.perKm.toFixed(2)}</b></div>
        <div class="dstat"><span>AED/TRIP</span><b>${TF.fmt.num(r.perTrip)}</b></div>
        <div class="dstat"><span>FUEL SHARE</span><b>${r.fuelShare.toFixed(0)}%</b></div>
        <div class="dstat"><span>DRIVER</span><b style="font-size:12px">${r.driver}</b></div>
      </div>
      <div class="d-block">
        <p class="kicker">COST WATERFALL</p>
        <svg class="wf" viewBox="0 0 ${W} ${H}" width="100%">${zero}${parts}${labels}</svg>
      </div>
      <div class="d-block">
        <p class="kicker">THIS WEEK · LIVE FROM TRIP SHEET · ${TF.fmt.aed(weekRev)}</p>
        <div class="dtrips">${tripsHTML}</div>
      </div>`;

    $('drawer').classList.add('open'); $('drawer').setAttribute('aria-hidden','false');
    $('scrim2').classList.add('show');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{ const wf=$('drawerBody').querySelector('.wf'); if(wf) wf.classList.add('in'); }));
  }
  function closeDrawer(){ $('drawer').classList.remove('open'); $('drawer').setAttribute('aria-hidden','true'); $('scrim2').classList.remove('show'); }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const seg = e.target.closest('.seg-b');
    if(seg){ state.period = seg.dataset.per; document.querySelectorAll('.seg-b').forEach(b=>b.classList.toggle('on',b===seg)); body.classList.remove('in'); render(); return; }
    const sc = e.target.closest('#sortChips .fchip');
    if(sc){ state.sort = sc.dataset.sort; document.querySelectorAll('#sortChips .fchip').forEach(c=>c.classList.toggle('on',c===sc)); body.classList.remove('in'); render(); return; }
    const fc = e.target.closest('#filterChips .fchip');
    if(fc){ state.filter = fc.dataset.f; document.querySelectorAll('#filterChips .fchip').forEach(c=>c.classList.toggle('on',c===fc)); body.classList.remove('in'); render(); return; }
    const va = e.target.closest('[data-vact]');
    if(va){ const pl=va.dataset.plate, a=va.dataset.vact;
      if(a==='open'){ openDrawer(pl); return; }
      const msg = a==='review'?'⚑ '+pl+' FLAGGED FOR FLEET REVIEW' : a==='audit'?'🔍 COST AUDIT OPENED FOR '+pl+' — MAINTENANCE & TYRES SCRUTINISED' : '⊘ '+pl+' ACTION LOGGED — FLEET PLANNER NOTIFIED';
      TF.fx.toast(msg); return; }
    const row = e.target.closest('.vrow');
    if(row && (e.target.closest('[data-act="open"]') || e.target.tagName==='TD')){ openDrawer(row.dataset.plate); return; }
    if(e.target.closest('#drawerClose') || e.target.id==='scrim2') closeDrawer();
  });
  document.addEventListener('keydown', e => { if(e.key==='Escape') closeDrawer(); });

  render();
})();