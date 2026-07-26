/* TRANSFLOW — Vehicles master. The plate the whole fleet hangs from.
   Status → trip-sheet dropdown + cockpit tiles. Doc dates → tower + cockpit.
   Driver → trip-sheet auto-fill. Edits persist via the data.js bootstrap. */
(function(){
  const reg = document.getElementById('regList');
  if(!reg) return;
  const $ = id => document.getElementById(id);
  const aed = n => TF.fmt.aed(n);
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const hash = s => { let h=2166136261>>>0; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; };

  /* stable reference date so the compliance board + tower + cockpit all agree */
  const DEMO = new Date(2026,6,27,12,0,0);
  const parseISO = s => { const p=String(s).slice(0,10).split('-').map(Number); return new Date(p[0],p[1]-1,p[2],12,0,0); };
  const daysTo = iso => Math.round((parseISO(iso)-DEMO)/864e5);
  const fD = iso => parseISO(iso).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}).toUpperCase();
  const addDays = (n) => { const x=new Date(DEMO.getTime()+n*864e5); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };

  const DOCS = [
    { k:'insExp', label:'INSURANCE',    short:'INS' },
    { k:'regExp', label:'REGISTRATION', short:'REG' },
    { k:'fitExp', label:'FITNESS TEST', short:'FIT' },
  ];
  const HEADS = [
    { k:'fuel',   l:'FUEL',     f:.42 },
    { k:'driver', l:'DRIVER',   f:.22 },
    { k:'maint',  l:'MAINT',    f:.10 },
    { k:'ins',    l:'INSUR.',   f:.08 },
    { k:'tyre',   l:'TYRES',    f:.06 },
    { k:'toll',   l:'SALIK',    f:.07 },
    { k:'reg',    l:'RTA/REG',  f:.05 },
  ];
  const SVC_TYPES = ['Oil & filters','Tyres replaced','Brake service','Annual service','AC regas','Alignment'];

  const urgency = d => d<0 ? 'over' : d<=14 ? 'crit' : d<=30 ? 'warn' : 'ok';
  const urgText = d => d<0 ? (d+'D') : (d+'D');
  /* horizon window mapping: -15d .. +90d → 0..100% */
  const pct = d => clamp((d+15)/105*100, 0, 100);
  const TODAY_PCT = pct(0);

  const TRUCK = c => `<svg viewBox="0 0 48 26" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"><path d="M2 7h26v11H2z"/><path d="M28 10h8l8 6v2H28z"/><circle cx="11" cy="20" r="3"/><circle cx="37" cy="20" r="3"/></svg>`;

  /* deterministic fallbacks for any plate missing a field (defensive) */
  const synthDate = (plate,k) => addDays(40 + (hash(plate+k)%150));
  const synthUtil = plate => 60 + (hash(plate+'u')%36);
  const synthMo   = plate => 18000 + (hash(plate+'m')%18000);
  function synthServices(plate){
    const h=hash(plate+'s');
    return [
      { date:addDays(-(15+(h%40))), type:SVC_TYPES[h%SVC_TYPES.length], cost:800+(h%2400), note:'Routine' },
      { date:addDays(-(70+(h%60))), type:SVC_TYPES[(h>>3)%SVC_TYPES.length], cost:1200+(h%3000), note:'Logged' },
    ];
  }
  function breakdown(mo){
    const out={}; let used=0;
    HEADS.forEach((hd,i)=>{ if(i===0) return; const v=Math.round(mo*hd.f/50)*50; out[hd.k]=v; used+=v; });
    out.fuel = mo-used;
    return out;
  }

  /* ---- override persistence (enforcement mechanism) ---- */
  let OV = (()=>{ try{ return JSON.parse(sessionStorage.getItem('tf_vehicles')||'null') || {edits:{},adds:[]}; }catch(e){ return {edits:{},adds:[]}; } })();
  const addedPlates = new Set((OV.adds||[]).map(a=>a.plate));
  const persist = () => sessionStorage.setItem('tf_vehicles', JSON.stringify(OV));
  function commitEdit(plate, patch){ OV.edits[plate]=Object.assign(OV.edits[plate]||{}, patch); persist();
    const v=TF.vehicles.find(x=>x.plate===plate); if(v) Object.assign(v, patch); }
  function commitAdd(rec){ OV.adds.push(rec); persist(); TF.vehicles.push(rec); addedPlates.add(rec.plate); }

  const weekRevByPlate = {};
  (TF.jobs||[]).forEach(j => weekRevByPlate[j.veh]=(weekRevByPlate[j.veh]||0)+j.qty*j.rate);

  function rows(){
    return (TF.vehicles||[]).map(v => {
      const docs = DOCS.map(dm => { const iso=v[dm.k]||synthDate(v.plate,dm.k); const days=daysTo(iso); return {...dm, iso, days, urg:urgency(days)}; });
      const soonest = docs.slice().sort((a,b)=>a.days-b.days)[0];
      const overdueDocs = docs.filter(d=>d.days<0);
      const exp14 = docs.filter(d=>d.days<=14);
      const util = v.util!=null ? v.util : synthUtil(v.plate);
      const moCost = v.moCost!=null ? v.moCost : synthMo(v.plate);
      const services = (v.services&&v.services.length) ? v.services : synthServices(v.plate);
      return { v, docs, soonest, overdueDocs, exp14, util, moCost, value:v.value||0,
               services, lastSvc:services[0], added:addedPlates.has(v.plate),
               weekRev:weekRevByPlate[v.plate]||0,
               stCls: v.st==='wrk'?'wrk':v.st==='idle'?'idle':'run',
               stLabel: v.st==='wrk'?'WORKSHOP':v.st==='idle'?'IDLE':'ON ROAD' };
    });
  }

  let state = { f:'ALL', s:'risk', q:'' };
  const filt = R => R.filter(r => {
    if(state.f==='ROAD' && r.v.st!=='run') return false;
    if(state.f==='WRK'  && r.v.st!=='wrk') return false;
    if(state.f==='RISK' && !(r.exp14.length)) return false;
    if(state.q){ const hay=(r.v.plate+r.v.type+r.v.driver+(r.v.note||'')).toLowerCase(); if(!hay.includes(state.q)) return false; }
    return true; });
  const sortR = R => { const a=R.slice();
    if(state.s==='risk') a.sort((x,y)=>x.soonest.days-y.soonest.days);
    else if(state.s==='rev') a.sort((x,y)=>y.weekRev-x.weekRev);
    else if(state.s==='cost') a.sort((x,y)=>y.moCost-x.moCost);
    else a.sort((x,y)=>x.v.plate.localeCompare(y.v.plate));
    return a; };

  function countUp(el,to,fmt,dur=900){
    if(!el) return; const t0=performance.now();
    const step=t=>{ const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3), v=to*e;
      el.textContent = fmt==='aed'?aed(v):fmt==='pct'?v.toFixed(0)+'%':TF.fmt.num(v);
      if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---------- render ---------- */
  function render(){
    const R = rows();
    const onRoad = R.filter(r=>r.v.st==='run').length;
    const expVeh = R.filter(r=>r.exp14.length).length;
    const ovdVeh = R.filter(r=>r.overdueDocs.length).length;
    const avgUtil = R.length ? Math.round(R.reduce((a,r)=>a+r.util,0)/R.length) : 0;
    const runRate = R.reduce((a,r)=>a+r.moCost,0);
    const bookVal = R.reduce((a,r)=>a+r.value,0);
    const globalSoon = R.map(r=>({plate:r.v.plate, d:r.soonest})).sort((a,b)=>a.d.days-b.d.days)[0];

    countUp($('mFleet'), R.length, 'num');
    const mr=$('mRoad'); mr.innerHTML = onRoad + '<span class="of">/'+R.length+'</span>';
    countUp($('mExp'), expVeh, 'num'); countUp($('mOvd'), ovdVeh, 'num'); countUp($('mVal'), bookVal, 'aed');
    $('mOvdCell').classList.toggle('bad', ovdVeh>0);

    countUp($('dUtil'), avgUtil, 'pct'); countUp($('dRun'), runRate, 'aed');
    const dn=$('dNext');
    if(globalSoon){ dn.textContent = globalSoon.plate+' · '+globalSoon.d.short+' '+urgText(globalSoon.d.days);
      dn.style.color = globalSoon.d.urg==='ok'?'#7FE0C6':globalSoon.d.urg==='warn'?'#F0C75A':'#FF9B8A'; }
    $('depotLine').textContent = ovdVeh>0
      ? `⚠ ${ovdVeh} VEHICLE${ovdVeh>1?'S HAVE':' HAS'} AN EXPIRED DOCUMENT — GROUND THEM UNTIL RENEWED.`
      : expVeh>0 ? `${expVeh} VEHICLE${expVeh>1?'S':' HAS'} A DOCUMENT EXPIRING WITHIN 14 DAYS — BOOK THE RENEWALS.`
      : '✓ ALL FLEET DOCUMENTS CLEAR FOR 30+ DAYS. THE YARD IS COMPLIANT.';

    renderYard(R); renderHorizon(R); renderWatch(R); renderReg(R); renderTick(R);
  }

  function renderYard(R){
    $('yard').innerHTML = R.map((r,i)=>{
      const col = r.v.st==='wrk'?'var(--red)':r.soonest.urg==='over'||r.soonest.urg==='crit'?'var(--red)':r.soonest.urg==='warn'?'var(--amber)':'var(--teal)';
      const badge = r.soonest.days<0 ? 'OVERDUE' : r.soonest.days<=30 ? r.soonest.short+' '+r.soonest.days+'D' : 'CLEAR';
      return `<button class="bay ${r.stCls}" data-plate="${r.v.plate}" style="--i:${i};--bc:${col}">
        <span class="bay-truck">${TRUCK(r.v.st==='wrk'?'#FF9B8A':'#7FE0C6')}</span>
        <span class="bay-plate mono">${r.v.plate}</span>
        <span class="bay-st"><i></i>${r.stLabel}</span>
        <span class="bay-doc ${r.soonest.urg}">${badge}</span>
      </button>`;
    }).join('');
  }

  function renderHorizon(R){
    $('vhScale').innerHTML = `<span class="vh-over-l">OVERDUE</span>
      <span class="vh-tk" style="left:${pct(0)}%"><i></i>TODAY</span>
      <span class="vh-tk" style="left:${pct(30)}%"><i></i>+30</span>
      <span class="vh-tk" style="left:${pct(60)}%"><i></i>+60</span>
      <span class="vh-tk" style="left:${pct(90)}%"><i></i>+90</span>`;
    $('vhLanes').innerHTML = DOCS.map(dm => {
      const mks = R.map(r => { const d=r.docs.find(x=>x.k===dm.k); return { plate:r.v.plate, d }; })
        .filter(m => m.d.days>=-15 && m.d.days<=90)
        .map(m => `<button class="vh-mk ${m.d.urg}" data-plate="${m.plate}" style="left:${pct(m.d.days).toFixed(2)}%" title="${m.plate} · ${dm.label} · ${fD(m.d.iso)} · ${m.d.days<0?(-m.d.days)+'D OVERDUE':m.d.days+'D'}">${m.plate}</button>`).join('');
      const beyond = R.filter(r => r.docs.find(x=>x.k===dm.k).days>90).length;
      return `<div class="vh-lane">
        <span class="vh-lane-l mono">${dm.label}</span>
        <div class="vh-track">
          <span class="vh-overzone" style="width:${TODAY_PCT.toFixed(2)}%"></span>
          <span class="vh-todayline" style="left:${TODAY_PCT.toFixed(2)}%"></span>
          ${mks}
          ${beyond?`<span class="vh-beyond mono">+${beyond} &gt;90D</span>`:''}
        </div>
      </div>`;
    }).join('');
  }

  function renderWatch(R){
    const flat = [];
    R.forEach(r => r.docs.forEach(d => flat.push({ plate:r.v.plate, st:r.v.st, d })));
    const urg = flat.filter(m=>m.d.days<=30).sort((a,b)=>a.d.days-b.d.days);
    $('watchN').textContent = urg.length ? urg.length+' DUE ≤30D' : 'CLEAR';
    $('watchList').innerHTML = urg.length ? urg.slice(0,7).map((m,i)=>`
      <div class="vh-wrow ${m.d.urg}" data-plate="${m.plate}" style="--i:${i}">
        <span class="vh-wd ${m.d.urg}">${m.d.days<0?(-m.d.days)+'D':m.d.days+'D'}</span>
        <div class="vh-wmid"><b class="mono">${m.plate}</b><span class="mono vh-wdoc">${m.d.label}${m.st==='wrk'?' · IN WORKSHOP':''}</span></div>
        <span class="mono vh-wdate">${fD(m.d.iso)}</span>
        <button class="vh-wgo" data-act="renew">${m.d.days<0?'FIX NOW':'RENEW'} →</button>
      </div>`).join('')
      : `<div class="empty mono">✓ NO CERTIFICATE EXPIRES WITHIN 30 DAYS.<br>THE RENEWAL DESK IS QUIET.</div>`;
  }

  function docChip(d){ return `<span class="vh-doc ${d.urg}" title="${d.label} · ${fD(d.iso)}"><i></i>${d.short} ${urgText(d.days)}</span>`; }

  function renderReg(R){
    const list = sortR(filt(R));
    reg.innerHTML = list.length ? list.map((r,i)=>`
      <div class="vh-row ${r.stCls} ${r.exp14.length?'risk':''}" data-plate="${r.v.plate}" style="--i:${Math.min(i,12)}">
        <div class="vh-c-plate">
          <span class="vh-plate ${r.added?'new':''}">${r.v.plate}</span>
          <span class="mono vh-type">${r.v.type}${r.v.cap?' · '+r.v.cap:''}</span>
        </div>
        <div class="vh-c-drv"><b>${r.v.driver}</b><span class="mono vh-note">${r.v.note||'—'}</span></div>
        <div class="vh-c-doc">${r.docs.map(docChip).join('')}</div>
        <div class="vh-c-util"><div class="vh-ubar"><span class="vh-uf" style="--w:${clamp(r.util,0,100)}%"></span></div><span class="mono vh-upct">${r.util}%</span></div>
        <div class="vh-c-rev mono">${r.weekRev?aed(r.weekRev):'<span class="dim">—</span>'}</div>
        <div class="vh-c-cost mono">${aed(r.moCost)}</div>
        <div class="vh-c-st"><span class="vh-pill ${r.stCls}">${r.stLabel}</span></div>
        <div class="vh-c-act">
          <button data-act="edit">EDIT</button>
          <a class="lk" href="/app/reports/vehicle-pl" title="Vehicle P&L">P&amp;L</a>
          <button data-act="svc" title="Log service">🔧</button>
        </div>
      </div>`).join('')
      : `<div class="empty mono">NO VEHICLES MATCH THIS FILTER.</div>`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>reg.classList.add('in')));
  }

  function renderTick(R){
    const ev=[];
    const ovd=R.filter(r=>r.overdueDocs.length);
    if(ovd.length) ev.push(`<span class="r"><b>⚠ EXPIRED: ${ovd.map(r=>r.v.plate).join(', ')}</b></span>`);
    R.filter(r=>r.v.st==='wrk').forEach(r=>ev.push(`<span><b>${r.v.plate}</b> WORKSHOP · ${r.v.note||'bay'}</span>`));
    R.filter(r=>r.soonest.days>=0&&r.soonest.days<=14).forEach(r=>ev.push(`<span>${r.v.plate} ${r.soonest.short} IN ${r.soonest.days}D</span>`));
    const loaded=R.filter(r=>r.weekRev>0).length;
    ev.push(`<span class="g">${loaded} TRUCKS BILLED THIS WEEK</span>`);
    ev.push(`<span>FLEET RUN-RATE ${aed(R.reduce((a,r)=>a+r.moCost,0))}/MO</span>`);
    TF.fx.ticker($('depotTick'), ev);
  }

  /* ============ DRAWER ============ */
  let mode='edit', curPlate=null, draft=null;

  function openEdit(plate){
    mode='edit'; curPlate=plate;
    const r = rows().find(x=>x.v.plate===plate); if(!r) return;
    const heads = r.v.heads || breakdown(r.moCost);
    draft = { st:r.v.st, note:r.v.note||'', cap:r.v.cap||'', value:r.v.value||0, driver:r.v.driver,
              insExp:r.docs.find(d=>d.k==='insExp').iso, regExp:r.docs.find(d=>d.k==='regExp').iso, fitExp:r.docs.find(d=>d.k==='fitExp').iso,
              heads, services:r.services.slice() };
    $('dKicker').textContent='VEHICLE FILE · EDIT MASTER';
    $('dTitle').textContent=r.v.type;
    $('dSub').textContent=r.v.plate+(r.v.cap?' · '+r.v.cap:'')+' · ACQ '+(r.v.acq||'—');
    setPlateBadge(r.v.plate, r.stCls);
    drawEditBody(r); openDrawer();
  }
  function openCreate(){
    mode='create'; curPlate=null;
    draft = { plate:'', type:'40FT FLATBED', driver:'', cap:'', value:0, st:'run', note:'',
              insExp:addDays(180), regExp:addDays(220), fitExp:addDays(150), heads:breakdown(28000), services:[] };
    $('dKicker').textContent='NEW ASSET · ADD TO REGISTER';
    $('dTitle').textContent='NEW VEHICLE';
    $('dSub').textContent='AVAILABLE IN TRIP SHEET & P&L ON SAVE';
    setPlateBadge('＋', 'new');
    drawCreateBody(); openDrawer();
  }
  function setPlateBadge(txt, cls){ const el=$('dPlate'); el.textContent=txt; el.className='vh-plate lg '+(cls||''); }
  function openDrawer(){ $('clDrawer').classList.add('open'); $('clDrawer').setAttribute('aria-hidden','false'); $('clScrim').classList.add('show'); }
  function closeDrawer(){ $('clDrawer').classList.remove('open'); $('clDrawer').setAttribute('aria-hidden','true'); $('clScrim').classList.remove('show'); }

  function docEditRow(dm, iso){
    const days=daysTo(iso), u=urgency(days);
    return `<div class="d-field"><label>${dm.label} EXPIRY</label>
      <div class="vh-docedit"><input type="date" data-doc="${dm.k}" value="${iso}">
        <span class="vh-docchip ${u}" data-chip="${dm.k}">${dm.short} · ${days<0?(-days)+'D OVERDUE':days+'D'}</span></div></div>`;
  }
  function statusConsequence(st){
    if(st==='wrk') return { c:'var(--red)', t:'WORKSHOP — removed from the trip-sheet billing dropdown and shown OFF ROAD in the Owner Cockpit until you clear it.' };
    if(st==='idle') return { c:'var(--amber)', t:'IDLE — on the yard and dispatchable, but flagged as not currently earning.' };
    return { c:'var(--teal)', t:'ON THE ROAD — available in the trip sheet and counted as earning across the system.' };
  }

  function drawEditBody(r){
    const proj = Object.values(draft.heads).reduce((a,b)=>a+(+b||0),0);
    $('dBody').innerHTML = `
      <div class="d-field"><label>STATUS</label>
        <div class="vh-seg" id="dSeg">
          <button class="${draft.st==='run'?'on run':''}" data-st="run">ON ROAD</button>
          <button class="${draft.st==='wrk'?'on wrk':''}" data-st="wrk">WORKSHOP</button>
          <button class="${draft.st==='idle'?'on idle':''}" data-st="idle">IDLE</button>
        </div>
        <div class="vh-conseq" id="dConseq"></div>
      </div>
      <div class="d-field"><label>DRIVER / OPERATOR</label><input type="text" id="dDriver" value="${draft.driver}"></div>
      <div class="d-field"><label>WORKSHOP / STATUS NOTE</label><input type="text" id="dNote" value="${draft.note}" placeholder="e.g. Workshop — brakes"></div>

      <div class="d-block"><p class="kicker">DOCUMENT VAULT · FEEDS TOWER + COCKPIT COUNTDOWNS</p>
        <div class="d-grid-docs">${DOCS.map(dm=>docEditRow(dm, draft[dm.k])).join('')}</div>
      </div>

      <div class="d-grid2">
        <div class="d-field"><label>CAPACITY</label><input type="text" id="dCap" value="${draft.cap}" placeholder="e.g. 2×40FT / 30T"></div>
        <div class="d-field"><label>BOOK VALUE (AED)</label><input type="number" id="dValue" value="${draft.value}" step="5000" min="0"></div>
      </div>

      <div class="d-block"><p class="kicker">COST-RATE CARD · MONTHLY RUN-RATE</p>
        <div class="vh-costgrid" id="dHeads">${HEADS.map(hd=>`<label class="vh-costcell"><span>${hd.l}</span><input type="number" data-h="${hd.k}" value="${draft.heads[hd.k]||0}" step="100" min="0"></label>`).join('')}</div>
        <div class="vh-proj"><span class="mono">PROJECTED MONTHLY COST</span><b class="display" id="vhProj">${aed(proj)}</b></div>
        <div class="d-enforce mono">THIS RUN-RATE IS THE FIGURE SHOWN ON THE REGISTER. THE VEHICLE P&amp;L USES THE FLEET COST MODEL TODAY AND WILL READ THESE HEADS DIRECTLY IN THE PILOT.</div>
      </div>

      <div class="d-block"><p class="kicker">SERVICE LOG</p>
        <div class="vh-svc-add">
          <select id="dSvcType">${SVC_TYPES.map(t=>`<option>${t}</option>`).join('')}</select>
          <input type="number" id="dSvcCost" placeholder="COST" step="50" min="0">
          <button class="btn btn-ghost" id="dSvcAdd" style="padding:8px 12px">＋ LOG</button>
        </div>
        <div class="d-acts" id="dSvcList"></div>
      </div>

      <div class="d-enforce mono">SAVING WRITES THE MASTER — STATUS, DATES &amp; DRIVER ARE READ BY THE TRIP SHEET, THE CONTROL TOWER &amp; THE OWNER COCKPIT.</div>`;

    wireEditBody(r);
    renderSvcList();
    setConseq();
    $('dFoot').textContent = mode==='create'?'NEW VEHICLE · NOT YET SAVED':`EDITING ${r.v.plate} · CHANGES APPLY ACROSS THE SYSTEM`;
  }

  function renderSvcList(){
    $('dSvcList').innerHTML = draft.services.length ? draft.services.map(s=>`
      <div class="d-act"><span class="mono d-act-d">${fD(s.date)}</span><span>${s.type}${s.cost?' · '+aed(s.cost):''}${s.note?' · '+s.note:''}</span></div>`).join('')
      : `<div class="mono" style="color:var(--mut);font-size:10px;letter-spacing:.1em">NO SERVICE LOGGED</div>`;
  }
  function setConseq(){ const c=statusConsequence(draft.st); const el=$('dConseq'); el.style.borderColor=c.c; el.querySelector? null:null;
    el.innerHTML = `<span style="color:${c.c}">${c.t}</span>`; }

  function wireEditBody(r){
    $('dBody').querySelectorAll('#dSeg button').forEach(b=>b.addEventListener('click',()=>{
      draft.st=b.dataset.st;
      $('dBody').querySelectorAll('#dSeg button').forEach(x=>x.classList.toggle('on', x===b));
      setConseq();
    }));
    $('dDriver').addEventListener('input', e=>draft.driver=e.target.value);
    $('dNote').addEventListener('input', e=>draft.note=e.target.value);
    $('dCap').addEventListener('input', e=>draft.cap=e.target.value);
    $('dValue').addEventListener('input', e=>draft.value=+e.target.value||0);
    $('dBody').querySelectorAll('input[data-doc]').forEach(inp=>inp.addEventListener('input', e=>{
      const k=e.target.dataset.doc; draft[k]=e.target.value;
      const days=daysTo(e.target.value), u=urgency(days);
      const chip=$('dBody').querySelector(`[data-chip="${k}"]`);
      chip.className='vh-docchip '+u;
      chip.textContent = DOCS.find(d=>d.k===k).short+' · '+(days<0?(-days)+'D OVERDUE':days+'D');
    }));
    const updProj = () => { const s=Object.values(draft.heads).reduce((a,b)=>a+(+b||0),0); $('vhProj').textContent=aed(s); };
    $('dBody').querySelectorAll('input[data-h]').forEach(inp=>inp.addEventListener('input', e=>{ draft.heads[e.target.dataset.h]=+e.target.value||0; updProj(); }));
    $('dSvcAdd').addEventListener('click', ()=>{
      draft.services.unshift({ date:addDays(0), type:$('dSvcType').value, cost:+$('dSvcCost').value||0, note:'Logged in TransFlow' });
      $('dSvcCost').value=''; renderSvcList();
    });
  }

  function drawCreateBody(){
    const proj = Object.values(draft.heads).reduce((a,b)=>a+(+b||0),0);
    $('dBody').innerHTML = `
      <div class="d-grid2">
        <div class="d-field"><label>PLATE NUMBER</label><input type="text" id="cPlate" placeholder="e.g. B-55120"></div>
        <div class="d-field"><label>VEHICLE TYPE</label>
          <select id="cType">${['40FT FLATBED','20FT BOX','CHILLED VAN','LOWBED','10T TRUCK','CURTAINSIDER'].map(t=>`<option ${t===draft.type?'selected':''}>${t}</option>`).join('')}</select></div>
      </div>
      <div class="d-grid2">
        <div class="d-field"><label>ASSIGNED DRIVER</label><input type="text" id="cDriver" placeholder="Name"></div>
        <div class="d-field"><label>CAPACITY</label><input type="text" id="cCap" placeholder="e.g. 30T"></div>
      </div>
      <div class="d-field"><label>STATUS</label>
        <div class="vh-seg" id="cSeg">
          <button class="on run" data-st="run">ON ROAD</button><button data-st="wrk">WORKSHOP</button><button data-st="idle">IDLE</button>
        </div></div>
      <div class="d-block"><p class="kicker">INITIAL DOCUMENT DATES</p>
        <div class="d-grid-docs">${DOCS.map(dm=>docEditRow(dm, draft[dm.k])).join('')}</div></div>
      <div class="d-grid2">
        <div class="d-field"><label>BOOK VALUE (AED)</label><input type="number" id="cValue" value="0" step="5000" min="0"></div>
        <div class="d-field"><label>EST. MONTHLY COST</label><input type="number" id="cMo" value="28000" step="1000" min="0"></div>
      </div>
      <div class="d-enforce mono">ON SAVE THIS VEHICLE JOINS THE REGISTER — IT APPEARS IN THE TRIP-SHEET DROPDOWN &amp; THE VEHICLE P&amp;L IMMEDIATELY.</div>`;
    $('dBody').querySelectorAll('#cSeg button').forEach(b=>b.addEventListener('click',()=>{
      draft.st=b.dataset.st; $('dBody').querySelectorAll('#cSeg button').forEach(x=>x.classList.toggle('on',x===b)); }));
    $('dBody').querySelectorAll('input[data-doc]').forEach(inp=>inp.addEventListener('input', e=>{
      const k=e.target.dataset.k||e.target.dataset.doc; draft[k]=e.target.value;
      const days=daysTo(e.target.value), u=urgency(days); const chip=$('dBody').querySelector(`[data-chip="${k}"]`);
      chip.className='vh-docchip '+u; chip.textContent=DOCS.find(d=>d.k===k).short+' · '+(days<0?(-days)+'D OVERDUE':days+'D'); }));
    $('dFoot').textContent='NEW VEHICLE · NOT YET SAVED';
  }

  function save(){
    if(mode==='create'){
      const plate=($('cPlate').value||'').trim().toUpperCase();
      if(!plate){ TF.fx.toast('⚠ ENTER A PLATE NUMBER'); $('cPlate').focus(); return; }
      if(TF.vehicles.some(v=>v.plate===plate)){ TF.fx.toast('⚠ PLATE '+plate+' ALREADY REGISTERED'); return; }
      const mo=+$('cMo').value||28000;
      const rec={ plate, type:$('cType').value, driver:$('cDriver').value.trim()||'UNASSIGNED', cap:$('cCap').value.trim(),
        value:+$('cValue').value||0, st:draft.st, note:'', acq:2026, util:synthUtil(plate),
        insExp:draft.insExp, regExp:draft.regExp, fitExp:draft.fitExp, moCost:mo, heads:breakdown(mo), services:[] };
      commitAdd(rec); closeDrawer();
      TF.fx.toast('✓ '+plate+' ADDED TO THE REGISTER — NOW IN THE TRIP-SHEET DROPDOWN & P&L');
      render(); return;
    }
    const moCost = Object.values(draft.heads).reduce((a,b)=>a+(+b||0),0);
    commitEdit(curPlate, { st:draft.st, note:draft.note, cap:draft.cap, value:draft.value, driver:draft.driver,
      insExp:draft.insExp, regExp:draft.regExp, fitExp:draft.fitExp, heads:draft.heads, moCost, services:draft.services });
    closeDrawer();
    const tag = draft.st==='wrk'?' · WORKSHOP (OFF ROAD)' : draft.st==='idle'?' · IDLE':'';
    TF.fx.toast('✓ MASTER SAVED · '+curPlate+' — '+draft.driver.toUpperCase()+' · RUN-RATE '+aed(moCost)+tag);
    render();
  }

  /* ---- events ---- */
  document.addEventListener('click', e=>{
    if(e.target.closest('#newBtn')){ openCreate(); return; }
    if(e.target.closest('#dClose')||e.target.closest('#dCancel')||e.target.id==='clScrim'){ closeDrawer(); return; }
    if(e.target.closest('#dSave')){ save(); return; }
    const fc=e.target.closest('#fChips .fchip'); if(fc){ state.f=fc.dataset.f; document.querySelectorAll('#fChips .fchip').forEach(c=>c.classList.toggle('on',c===fc)); render(); return; }
    const sc=e.target.closest('#sChips .fchip'); if(sc){ state.s=sc.dataset.s; document.querySelectorAll('#sChips .fchip').forEach(c=>c.classList.toggle('on',c===sc)); render(); return; }
    const act=e.target.closest('[data-act]'); const holder=e.target.closest('[data-plate]');
    if(act && holder){ const plate=holder.dataset.plate;
      if(act.dataset.act==='edit'||act.dataset.act==='renew'){ e.preventDefault(); openEdit(plate); return; }
      if(act.dataset.act==='svc'){ e.preventDefault(); openEdit(plate); TF.fx.toast('🔧 LOG A SERVICE IN THE '+plate+' FILE'); return; }
    }
    if(holder && !e.target.closest('a') && e.target.tagName!=='BUTTON' && !holder.classList.contains('bay')){ openEdit(holder.dataset.plate); return; }
    if(holder && holder.classList.contains('bay')){ openEdit(holder.dataset.plate); return; }
  });
  document.addEventListener('input', e=>{ if(e.target.id==='srch'){ state.q=e.target.value.toLowerCase(); render(); } });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeDrawer(); });

  render();
})();