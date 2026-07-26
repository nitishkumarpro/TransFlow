/* TRANSFLOW — Clients master. The one record the whole system reads.
   Edits/adds are written to TF.clients in place AND persisted to sessionStorage
   (a bootstrap in data.js re-applies them on every other page → enforced everywhere). */
(function(){
  const dir = document.getElementById('dirList');
  if(!dir) return;
  const $ = id => document.getElementById(id);
  const aed = n => TF.fmt.aed(n);
  const clamp = (v,a,b) => Math.max(a, Math.min(b, v));
  const hash = s => { let h=2166136261>>>0; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; };

  /* authored, stable detail per client (contact / behaviour / geography) */
  const DETAIL = {
    C01:{ contact:'Khalid Al Mansoori', role:'Credit Manager', phone:'+971 50 734 2210', emirate:'Abu Dhabi',     since:2019, score:'A', last:'2026-07-19' },
    C02:{ contact:'Ravi Menon',         role:'Finance Head',   phone:'+971 50 662 8841', emirate:'Abu Dhabi',     since:2018, score:'A', last:'2026-07-21' },
    C03:{ contact:'Sara Haddad',        role:'AP Lead',        phone:'+971 50 519 3374', emirate:'Dubai',         since:2021, score:'B', last:'2026-07-15' },
    C04:{ contact:'Ahmed Raza',         role:'Accounts',       phone:'+971 50 907 5518', emirate:'Ras Al Khaimah',since:2020, score:'B', last:'2026-07-04' },
    C05:{ contact:'Lina Farouk',        role:'Finance',        phone:'+971 50 288 6402', emirate:'Sharjah',       since:2022, score:'A', last:'2026-07-16' },
    C06:{ contact:'Vikram Singh',       role:'Procurement',    phone:'+971 50 445 7789', emirate:'Dubai',         since:2017, score:'A', last:'2026-07-23' },
    C07:{ contact:'Juma Al Kaabi',      role:'Owner',          phone:'+971 50 133 9026', emirate:'Fujairah',      since:2023, score:'C', last:'2026-05-28' },
  };
  const detailFor = c => DETAIL[c.id] || {
    contact:c.contact||'Accounts Dept', role:'—', phone:c.phone||'+971 50 000 0000',
    emirate:c.emirate||'Dubai', since:c.since||2026, score:c.score||'B', last:c.last||'2026-07-26' };

  /* YTD revenue map (concentration) — top clients + deterministic rest, internally consistent */
  const YTD = {}; let ytdTot = 0;
  (TF.topClients||[]).forEach(t => { const cl=(TF.clients||[]).find(c=>c.name===t.label); if(cl){ YTD[cl.id]=t.value; ytdTot+=t.value; } });
  (TF.clients||[]).forEach(c => { if(YTD[c.id]==null){ const v=40000+(hash(c.id+'y')%90000); YTD[c.id]=v; ytdTot+=v; } });

  /* AR per client — live engine if present, else seed-derived (matches fmt.js PARTIAL=40000) */
  function arFor(name){
    if(window.TF && TF.ar) return TF.ar.client(name);
    const invs = (TF.invoices||[]).filter(v=>v.client===name);
    let out=0; const B=[{value:0,color:'var(--teal)'},{value:0,color:'var(--teal)'},{value:0,color:'var(--amber)'},{value:0,color:'var(--red)'}];
    invs.forEach(v=>{ const o = v.st==='paid'?0 : v.st==='partial'? Math.max(0,v.amt-40000) : v.amt; out+=o;
      if(o>0){ const b = v.st==='overdue' ? 3 : 0; B[b].value+=o; } });
    return { outstanding:out, B, trn:(TF.clients.find(c=>c.name===name)||{}).trn||'—' };
  }

  /* ---- override persistence (the enforcement mechanism) ---- */
  let OV = (()=>{ try{ return JSON.parse(sessionStorage.getItem('tf_clients')||'null') || {edits:{},adds:[]}; }catch(e){ return {edits:{},adds:[]}; } })();
  const addedIds = new Set((OV.adds||[]).map(a=>a.id));
  function persist(){ sessionStorage.setItem('tf_clients', JSON.stringify(OV)); }
  function commitEdit(id, patch){
    OV.edits[id] = Object.assign(OV.edits[id]||{}, patch); persist();
    const c = TF.clients.find(x=>x.id===id); if(c) Object.assign(c, patch);   // in-place → this page + bootstrap elsewhere
  }
  function commitAdd(rec){
    OV.adds.push(rec); persist(); TF.clients.push(rec); addedIds.add(rec.id);  // in-place → spreadsheet dropdown picks it up
  }

  /* ---- view-model rows ---- */
  function rows(){
    return (TF.clients||[]).map(c => {
      const ar = arFor(c.name), d = detailFor(c);
      const outstanding = ar.outstanding, limit = c.limit||1, util = outstanding/limit*100;
      const hold = !!c.hold;
      const cls = hold ? 'hold' : util>100 ? 'over' : util>=80 ? 'near' : 'ok';
      const overBy = Math.max(0, outstanding-limit);
      const share = ytdTot ? (YTD[c.id]||0)/ytdTot*100 : 0;
      return { c, d, outstanding, limit, util, hold, cls, overBy, share,
               rev:YTD[c.id]||0, buckets:ar.B, trn:ar.trn||c.trn||'—', added:addedIds.has(c.id) };
    });
  }

  let state = { f:'ALL', s:'util', q:'' };
  const filt = R => R.filter(r => {
    if(state.f==='OVER' && r.cls!=='over') return false;
    if(state.f==='NEAR' && r.cls!=='near') return false;
    if(state.f==='OK'   && !(r.cls==='ok')) return false;
    if(state.f==='HOLD' && !r.hold) return false;
    if(state.q){ const hay=(r.c.name+r.trn+r.d.contact+r.d.emirate+r.d.role).toLowerCase(); if(!hay.includes(state.q)) return false; }
    return true;
  });
  const sortR = R => { const a=R.slice();
    if(state.s==='util') a.sort((x,y)=>y.util-x.util);
    else if(state.s==='exp') a.sort((x,y)=>y.outstanding-x.outstanding);
    else if(state.s==='rev') a.sort((x,y)=>y.rev-x.rev);
    else a.sort((x,y)=>x.c.name.localeCompare(y.c.name));
    return a; };

  const SC = { A:'var(--teal)', B:'var(--amber)', C:'var(--red)' };
  const utilColor = u => u>100?'var(--red)':u>=80?'var(--amber)':'var(--teal)';
  const monogram = n => n.split(' ').filter(Boolean).slice(0,2).map(w=>w[0]).join('').toUpperCase();

  function countUp(el,to,fmt,dur=900){
    if(!el) return; const t0=performance.now();
    const step=t=>{ const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3), v=to*e;
      el.textContent = fmt==='aed'?aed(v):fmt==='pct'?v.toFixed(0)+'%':TF.fmt.num(v);
      if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---- render ---- */
  function render(){
    const R = rows();
    const ext = R.reduce((a,r)=>a+r.limit,0);
    const exp = R.reduce((a,r)=>a+r.outstanding,0);
    const util = ext?exp/ext*100:0;
    const over = R.filter(r=>r.cls==='over'||r.hold);
    const top = R.slice().sort((a,b)=>b.share-a.share)[0];

    countUp($('mExt'), ext, 'aed'); countUp($('mExp'), exp, 'aed');
    countUp($('mUtil'), util, 'pct'); countUp($('mOver'), over.length, 'num');
    countUp($('mConc'), top?top.share:0, 'pct');
    $('mConcName').textContent = top ? (top.share>=25?'⚠ '+top.c.name.toUpperCase():top.c.name.toUpperCase()) : '—';
    $('mUtilCell').classList.toggle('bad', util>90); $('mUtilCell').classList.toggle('hot', util>70 && util<=90);
    $('mConcCell').classList.toggle('bad', top && top.share>=25);

    renderWatch(R); renderConc(R); renderDir(R); renderTick(R, util, top);
  }

  function gaugeHTML(r){
    const w = clamp(r.util,0,100).toFixed(1);
    return `<div class="cl-gauge ${r.cls}">
      <span class="cl-gf" style="--w:${w}%;background:${utilColor(r.util)}"></span>
      <span class="cl-lim"></span></div>`;
  }
  function ageHTML(r){
    const tot = r.buckets.reduce((a,b)=>a+b.value,0)||1;
    const segs = r.buckets.map(b => b.value?`<i style="width:${(b.value/tot*100).toFixed(1)}%;background:${b.color}"></i>`:'').join('');
    return `<div class="cl-age" title="CURRENT / 1-30 / 31-60 / 61+">${segs||'<i class="empty"></i>'}</div>`;
  }

  function renderWatch(R){
    const w = R.filter(r=>r.util>=80||r.hold).sort((a,b)=>b.util-a.util);
    $('watchN').textContent = w.length ? w.length+' ACCOUNT'+(w.length>1?'S':'') : 'CLEAR';
    $('watchList').innerHTML = w.length ? w.map((r,i)=>`
      <div class="wrow ${r.cls}" data-id="${r.c.id}" style="--i:${i}">
        <div class="cl-ava sm">${monogram(r.c.name)}</div>
        <div class="w-mid"><b>${r.c.name}</b>
          <span class="mono w-fig">${aed(r.outstanding)} / ${aed(r.limit)}</span></div>
        <div class="w-util" style="color:${utilColor(r.util)}">${r.util.toFixed(0)}%</div>
        <div class="w-g">${gaugeHTML(r)}</div>
        <button class="w-go" data-act="edit">${r.hold?'MANAGE HOLD':'REVIEW LIMIT'} →</button>
      </div>`).join('')
      : `<div class="empty mono">✓ EVERY ACCOUNT IS WITHIN ITS CREDIT LIMIT.<br>THE CREDIT DESK IS QUIET THIS MORNING.</div>`;
  }

  function renderConc(R){
    const ord = R.slice().sort((a,b)=>b.rev-a.rev);
    $('concBar').innerHTML = ord.map(r=>{
      const warn = r.share>=25;
      return `<span class="conc-seg ${warn?'warn':''}" style="width:${r.share.toFixed(2)}%;background:${warn?'var(--red)':utilColor(r.util)}" title="${r.c.name} · ${r.share.toFixed(1)}%"></span>`;
    }).join('');
    $('concLeg').innerHTML = ord.slice(0,4).map(r=>`<span><i style="background:${r.share>=25?'var(--red)':utilColor(r.util)}"></i>${r.c.name.split(' ')[0]} <b>${r.share.toFixed(0)}%</b></span>`).join('')
      + `<span class="mut">+${Math.max(0,ord.length-4)} MORE</span>`;
    const lead = ord[0];
    $('concNote').textContent = lead && lead.share>=25
      ? `⚠ ${lead.c.name.toUpperCase()} IS ${lead.share.toFixed(0)}% OF REVENUE — ONE LOST CONTRACT HURTS. SPREAD THE BOOK.`
      : `HEALTHY SPREAD — LARGEST CLIENT ${lead?lead.share.toFixed(0)+'%':'—'} OF REVENUE.`;
  }

  function renderDir(R){
    const list = sortR(filt(R));
    dir.innerHTML = list.length ? list.map((r,i)=>`
      <div class="cl-row ${r.cls}" data-id="${r.c.id}" style="--i:${Math.min(i,12)}">
        <div class="cl-id">
          <div class="cl-ava">${monogram(r.c.name)}</div>
          <span class="mono cl-code">${r.c.id}${r.added?'<em class="new">NEW</em>':''}</span>
        </div>
        <div class="cl-who">
          <b>${r.c.name}</b>
          <span class="mono cl-meta">${r.d.contact} · ${r.d.role} · ${r.d.emirate}</span>
          <span class="mono cl-trn">TRN ${r.trn} · <span class="score ${r.d.score}">${r.d.score}</span> · ${r.c.terms}D TERMS</span>
        </div>
        <div class="cl-exp">
          <div class="cl-exp-top"><span class="mono cl-used">${aed(r.outstanding)}</span><span class="mono cl-of">/ ${aed(r.limit)}</span>
            <b class="cl-pct" style="color:${utilColor(r.util)}">${r.util.toFixed(0)}%</b></div>
          ${gaugeHTML(r)}
          ${r.overBy?`<span class="mono cl-over">⚠ OVER BY ${aed(r.overBy)}</span>`:''}
        </div>
        <div class="cl-agecell">${ageHTML(r)}</div>
        <div class="cl-rev"><b class="mono">${aed(r.rev)}</b><span class="mono cl-share ${r.share>=25?'warn':''}">${r.share.toFixed(0)}%${r.share>=25?' ⚠':''}</span></div>
        <div class="cl-st"><span class="cl-pill ${r.cls}">${r.hold?'ON HOLD':r.cls==='over'?'OVER LIMIT':r.cls==='near'?'WATCH':'HEALTHY'}</span></div>
        <div class="cl-act">
          <button data-act="edit">EDIT</button>
          <a class="lk" href="/app/operations/soa" title="Statement of Account">SOA</a>
          <button data-act="stmt" title="Send statement">✉</button>
        </div>
      </div>`).join('')
      : `<div class="empty mono">NO CLIENTS MATCH THIS FILTER.</div>`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>dir.classList.add('in')));
  }

  function renderTick(R, util, top){
    const ev=[];
    const over=R.filter(r=>r.cls==='over');
    if(over.length) ev.push(`<span class="r"><b>${over.length} CLIENT${over.length>1?'S':''} OVER LIMIT</b> · ${over.map(r=>r.c.name.split(' ')[0]).join(', ')}</span>`);
    else ev.push(`<span class="g">✓ ALL ACCOUNTS WITHIN LIMITS</span>`);
    ev.push(`<span>BOOK ${util.toFixed(0)}% UTILISED</span>`);
    if(top) ev.push(`<span>TOP CLIENT ${top.c.name.split(' ')[0]} · ${top.share.toFixed(0)}%</span>`);
    const holds=R.filter(r=>r.hold);
    if(holds.length) ev.push(`<span class="r">${holds.length} ON CREDIT HOLD</span>`);
    ev.push(`<span>${R.length} ACTIVE ACCOUNTS</span>`);
    TF.fx.ticker($('btick'), ev);
  }

  /* ============ EDIT / CREATE DRAWER ============ */
  let mode='edit', curId=null, draft=null;

  function openEdit(id){
    mode='edit'; curId=id;
    const r = rows().find(x=>x.c.id===id); if(!r) return;
    draft = { limit:r.limit, terms:r.c.terms, hold:!!r.hold, notes:(OV.edits[id]&&OV.edits[id].notes)||'' };
    $('dKicker').textContent = 'CLIENT FILE · EDIT MASTER';
    $('dTitle').textContent = r.c.name;
    $('dTrn').textContent = 'TRN ' + r.trn + ' · ' + r.c.id;
    $('dAva').textContent = monogram(r.c.name);
    $('dAva').className = 'cl-ava lg ' + r.cls;
    drawBody(r);
    openDrawer();
  }
  function openCreate(){
    mode='create'; curId=null;
    draft = { name:'', contact:'', phone:'', emirate:'Dubai', terms:30, limit:100000, score:'B' };
    $('dKicker').textContent = 'NEW ACCOUNT · ADD TO MASTER';
    $('dTitle').textContent = 'NEW CLIENT';
    $('dTrn').textContent = 'WILL BE AVAILABLE IN TRIP SHEET & INVOICING ON SAVE';
    $('dAva').textContent = '＋'; $('dAva').className='cl-ava lg new';
    drawCreateBody();
    openDrawer();
  }
  function openDrawer(){ $('clDrawer').classList.add('open'); $('clDrawer').setAttribute('aria-hidden','false'); $('clScrim').classList.add('show'); }
  function closeDrawer(){ $('clDrawer').classList.remove('open'); $('clDrawer').setAttribute('aria-hidden','true'); $('clScrim').classList.remove('show'); }

  function policy(util, overBy){
    if(util>100) return { t:'ON CREDIT HOLD', c:'var(--red)',  m:`Exposure exceeds the limit by ${aed(overBy)}. New loads should be blocked until payment or a limit review.` };
    if(util>=90) return { t:'TIGHT',          c:'var(--red)',  m:`One more full load could breach the limit. Chase outstanding or raise headroom.` };
    if(util>=70) return { t:'WATCH',          c:'var(--amber)',m:`Approaching the limit — within policy but worth a call this week.` };
    return            { t:'COMFORTABLE',      c:'var(--teal)', m:`Within the 70% working policy. ${aed(Math.max(0,draft.limit - (rows().find(x=>x.c.id===curId)||{outstanding:0}).outstanding))} headroom.` };
  }

  function drawBody(r){
    const liveUtil = r.outstanding/(draft.limit||1)*100;
    const liveOver = Math.max(0, r.outstanding-draft.limit);
    const pol = policy(liveUtil, liveOver);
    const w = clamp(liveUtil,0,100).toFixed(1);
    const acts = activityFor(r.c.id);

    $('dBody').innerHTML = `
      <div class="d-cur ${r.cls}">
        <span class="d-cur-l mono">CURRENT EXPOSURE</span>
        <span class="d-cur-v display">${aed(r.outstanding)}</span>
        <span class="d-cur-u mono" style="color:${utilColor(liveUtil)}">${liveUtil.toFixed(0)}% OF ${aed(draft.limit)}</span>
      </div>

      <div class="d-field">
        <div class="d-field-top"><label>CREDIT LIMIT</label><span class="d-limval display" id="dLimVal">${aed(draft.limit)}</span></div>
        <input type="range" id="dSlider" min="25000" max="1000000" step="5000" value="${draft.limit}">
        <div class="d-steppers">
          <button data-step="-50000">−50K</button><button data-step="-10000">−10K</button>
          <input type="number" id="dLimNum" value="${draft.limit}" step="5000" min="0">
          <button data-step="10000">+10K</button><button data-step="50000">+50K</button>
        </div>
      </div>

      <div class="d-preview ${liveUtil>100?'over':''}">
        <div class="d-prev-g"><span class="cl-gf" style="width:${w}%;background:${pol.c}"></span><span class="cl-lim"></span></div>
        <div class="d-prev-t"><b style="color:${pol.c}">${pol.t} · ${liveUtil.toFixed(0)}%</b><span class="mono">${pol.m}</span></div>
      </div>

      <div class="d-grid2">
        <div class="d-field"><label>PAYMENT TERMS</label>
          <select id="dTerms">${[15,30,45,60,90].map(t=>`<option ${t===draft.terms?'selected':''}>${t}</option>`).join('')}</select></div>
        <div class="d-field"><label>PAYMENT BEHAVIOUR</label>
          <div class="score-pick" id="dScore">${['A','B','C'].map(s=>`<button class="${s===draft.score?'on '+s:s}" data-sc="${s}">${s}</button>`).join('')}</div></div>
      </div>

      <label class="d-switch"><input type="checkbox" id="dHold" ${draft.hold?'checked':''}>
        <span class="d-sw"></span><span class="d-sw-t"><b>CREDIT HOLD</b><small class="mono">BLOCK NEW LOADS FOR THIS CLIENT IN OPERATIONS</small></span></label>

      <div class="d-field"><label>INTERNAL NOTE</label>
        <textarea id="dNotes" rows="2" placeholder="e.g. Owner approved temporary increase to Q3…">${draft.notes||''}</textarea></div>

      <div class="d-block"><p class="kicker">ACCOUNT ACTIVITY</p>
        <div class="d-acts">${acts.map(a=>`<div class="d-act"><span class="mono d-act-d">${a.d}</span><span>${a.t}</span></div>`).join('')}</div></div>

      <div class="d-enforce mono">SAVING WRITES THE MASTER RECORD — THE SOA GAUGE, COLLECTIONS QUEUE &amp; TRIP-SHEET TERMS READ THIS SAME VALUE.</div>`;

    wireEditBody(r);
    $('dFoot').textContent = mode==='create' ? 'NEW ACCOUNT · NOT YET SAVED' : `EDITING ${r.c.id} · CHANGES APPLY ACROSS THE SYSTEM`;
  }

  function wireEditBody(r){
    const slider=$('dSlider'), num=$('dLimNum'), val=$('dLimVal');
    const setLim = v => { v=Math.max(0,Math.round(v/5000)*5000); draft.limit=v;
      slider.value=Math.min(1000000,v); num.value=v; val.textContent=aed(v);
      const u=r.outstanding/(v||1)*100, ov=Math.max(0,r.outstanding-v), p=policy(u,ov), w=clamp(u,0,100).toFixed(1);
      const pv=$('dBody').querySelector('.d-preview'); pv.classList.toggle('over',u>100);
      pv.querySelector('.cl-gf').style.width=w+'%'; pv.querySelector('.cl-gf').style.background=p.c;
      pv.querySelector('.d-prev-t b').style.color=p.c;
      pv.querySelector('.d-prev-t b').textContent=`${p.t} · ${u.toFixed(0)}%`;
      pv.querySelector('.d-prev-t span').textContent=p.m; };
    slider.addEventListener('input', e=>setLim(+e.target.value));
    num.addEventListener('input', e=>setLim(+e.target.value||0));
    $('dBody').querySelectorAll('[data-step]').forEach(b=>b.addEventListener('click',()=>setLim(draft.limit+(+b.dataset.step))));
    $('dTerms').addEventListener('change', e=>draft.terms=+e.target.value);
    $('dHold').addEventListener('change', e=>draft.hold=e.target.checked);
    $('dNotes').addEventListener('input', e=>draft.notes=e.target.value);
    $('dBody').querySelectorAll('#dScore button').forEach(b=>b.addEventListener('click',()=>{
      draft.score=b.dataset.sc; $('dBody').querySelectorAll('#dScore button').forEach(x=>x.classList.toggle('on',x===b)); }));
  }

  function drawCreateBody(){
    $('dBody').innerHTML = `
      <div class="d-field"><label>COMPANY NAME</label><input type="text" id="cName" placeholder="e.g. National Logistics LLC"></div>
      <div class="d-grid2">
        <div class="d-field"><label>TRN</label><input type="text" id="cTrn" placeholder="100XXXXXXXXXXX03" maxlength="15"></div>
        <div class="d-field"><label>EMIRATE</label>
          <select id="cEm">${['Dubai','Abu Dhabi','Sharjah','Ajman','Ras Al Khaimah','Fujairah','Umm Al Quwain'].map(e=>`<option>${e}</option>`).join('')}</select></div>
      </div>
      <div class="d-grid2">
        <div class="d-field"><label>CONTACT</label><input type="text" id="cContact" placeholder="Name"></div>
        <div class="d-field"><label>PHONE</label><input type="text" id="cPhone" placeholder="+971 50 …"></div>
      </div>
      <div class="d-grid2">
        <div class="d-field"><label>OPENING CREDIT LIMIT</label><input type="number" id="cLim" value="100000" step="5000" min="0"></div>
        <div class="d-field"><label>PAYMENT TERMS (DAYS)</label>
          <select id="cTerms">${[15,30,45,60,90].map(t=>`<option ${t===30?'selected':''}>${t}</option>`).join('')}</select></div>
      </div>
      <div class="d-enforce mono">ON SAVE THIS CLIENT IS ADDED TO THE MASTER — IT APPEARS IN THE TRIP-SHEET BILLING DROPDOWN &amp; INVOICING IMMEDIATELY.</div>`;
    $('dFoot').textContent = 'NEW ACCOUNT · NOT YET SAVED';
  }

  function activityFor(id){
    const h=hash(id); const r=rows().find(x=>x.c.id===id);
    const base=[
      {d:r?TF.fmt.dt((r.d.last||'2026-07-20')):'20 JUL', t:'Statement of account sent'},
      {d:'02 JUL', t:'Credit limit reviewed — '+ (r?aed(r.limit):'—')},
      {d:'14 JUN', t:'Payment received on time'},
      {d:'28 MAY', t:'Onboarded to TransFlow masters'},
    ];
    return base.slice(0, 3 + (h%2));
  }

  function save(){
    if(mode==='create'){
      const name=($('cName').value||'').trim();
      if(!name){ TF.fx.toast('⚠ ENTER A COMPANY NAME'); $('cName').focus(); return; }
      const id='CNEW'+(900+ (OV.adds.length));
      const rec={ id, name, trn:($('cTrn').value||'').trim()||'—', terms:+$('cTerms').value, limit:+($('cLim').value||0),
                  contact:$('cContact').value.trim(), phone:$('cPhone').value.trim(), emirate:$('cEm').value,
                  score:'B', since:2026, last:'2026-07-27', hold:false };
      commitAdd(rec);
      closeDrawer();
      TF.fx.toast('✓ '+name.toUpperCase()+' ADDED TO MASTERS — NOW IN THE TRIP-SHEET DROPDOWN');
      render(); return;
    }
    commitEdit(curId, { limit:draft.limit, terms:draft.terms, hold:draft.hold, notes:draft.notes, score:draft.score });
    const r = rows().find(x=>x.c.id===curId);
    closeDrawer();
    TF.fx.toast('✓ MASTER SAVED · '+ (r?r.c.name.toUpperCase():curId) +' — LIMIT '+aed(draft.limit)+' · '+draft.terms+'D'+(draft.hold?' · ON HOLD':''));
    render();
  }

  /* ---- events ---- */
  document.addEventListener('click', e=>{
    if(e.target.closest('#newBtn')){ openCreate(); return; }
    if(e.target.closest('#dClose')||e.target.closest('#dCancel')||e.target.id==='clScrim'){ closeDrawer(); return; }
    if(e.target.closest('#dSave')){ save(); return; }
    const fc=e.target.closest('#fChips .fchip'); if(fc){ state.f=fc.dataset.f; document.querySelectorAll('#fChips .fchip').forEach(c=>c.classList.toggle('on',c===fc)); render(); return; }
    const sc=e.target.closest('#sChips .fchip'); if(sc){ state.s=sc.dataset.s; document.querySelectorAll('#sChips .fchip').forEach(c=>c.classList.toggle('on',c===sc)); render(); return; }
    const act=e.target.closest('[data-act]'); const row=e.target.closest('[data-id]');
    if(act && row){ const id=row.dataset.id;
      if(act.dataset.act==='edit'){ e.preventDefault(); openEdit(id); return; }
      if(act.dataset.act==='stmt'){ e.preventDefault(); const r=rows().find(x=>x.c.id===id); TF.fx.toast('✉ STATEMENT SENT TO '+ (r?r.d.contact.toUpperCase():'CLIENT')); return; }
    }
    if(row && !e.target.closest('a') && e.target.tagName!=='BUTTON'){ openEdit(row.dataset.id); }
  });
  document.addEventListener('input', e=>{ if(e.target.id==='srch'){ state.q=e.target.value.toLowerCase(); render(); } });
  document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeDrawer(); });

  render();
})();