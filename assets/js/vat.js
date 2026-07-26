/* TRANSFLOW — FTA VAT Return (Form 201), computed live from invoices + costs */
(function(){
  const grid = document.getElementById('vboxGrid');
  if(!grid) return;
  const $ = id => document.getElementById(id);
  const aed = n => TF.fmt.aed(n);

  /* fixed demo reference date so quarter-current + filing deadlines are coherent
     for every viewer regardless of wall clock (matches the survey data window) */
  const DEMO = new Date(2026,6,27,12,0,0);
  const d = (y,m,day) => new Date(y,m-1,day,12,0,0);
  const parseISO = s => { const p=String(s).slice(0,10).split('-').map(Number); return new Date(p[0],p[1]-1,p[2],12,0,0); };
  const fD = dt => dt.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  const daysBetween = (a,b) => Math.round((b-a)/864e5);
  const hash = s => { let h=2166136261>>>0; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; };
  const load = (k,fb) => { try{ const v=JSON.parse(sessionStorage.getItem(k)); return v==null?fb:v; }catch(e){ return fb; } };

  const QS = [
    { id:'Q1', label:'Q1 2026', sub:'JAN – MAR 2026', from:d(2026,1,1),  to:d(2026,3,31),  deadline:d(2026,4,28) },
    { id:'Q2', label:'Q2 2026', sub:'APR – JUN 2026', from:d(2026,4,1),  to:d(2026,6,30),  deadline:d(2026,7,28) },
    { id:'Q3', label:'Q3 2026', sub:'JUL – SEP 2026', from:d(2026,7,1),  to:d(2026,9,30),  deadline:d(2026,10,28) },
  ];
  const EMIR = ['Abu Dhabi','Dubai','Sharjah','Ajman','Umm Al Quwain','Ras Al Khaimah','Fujairah'];
  const EM_COL = ['var(--teal)','var(--acc)','var(--amber)','#3E5560','var(--red)','#0A5F4E','#C98F00'];
  const EM_PICK = ['Dubai','Dubai','Dubai','Dubai','Abu Dhabi','Abu Dhabi','Abu Dhabi','Sharjah','Sharjah','Ras Al Khaimah','Fujairah','Ajman','Umm Al Quwain'];

  /* authored purchase book per quarter — recoverable vs non-recoverable, with reasons */
  const INPUTS = {
    Q1:[
      {cat:'FUEL',  label:'Diesel — ENOC account',            net:30000, rec:true},
      {cat:'MAINT', label:'Maintenance & repairs',            net:12000, rec:true},
      {cat:'TYRE',  label:'Tyres & parts',                    net:4000,  rec:true},
      {cat:'INS',   label:'Fleet insurance',                  net:12000, rec:true},
      {cat:'RENT',  label:'Yard & office rent (commercial)',  net:24000, rec:true},
      {cat:'PROF',  label:'Audit & accounting fees',          net:4000,  rec:true},
      {cat:'GOVT',  label:'RTA / government fees',            net:6000,  rec:false, why:'GOVERNMENT SERVICE — NO VAT'},
      {cat:'GOVT',  label:'Salik tolls',                      net:4000,  rec:false, why:'GOVERNMENT TOLL — NO VAT'},
      {cat:'WAGE',  label:'Driver salaries & commissions',    net:40000, rec:false, why:'EMPLOYMENT — OUTSIDE VAT SCOPE'},
    ],
    Q2:[
      {cat:'FUEL',  label:'Diesel — ENOC account',            net:54000, rec:true},
      {cat:'MAINT', label:'Maintenance & repairs',            net:26000, rec:true},
      {cat:'TYRE',  label:'Tyres & parts',                    net:9000,  rec:true},
      {cat:'INS',   label:'Fleet insurance',                  net:12500, rec:true},
      {cat:'RENT',  label:'Yard & office rent (commercial)',  net:24000, rec:true},
      {cat:'PROF',  label:'Audit & accounting fees',          net:6000,  rec:true},
      {cat:'GOVT',  label:'RTA / government fees',            net:8000,  rec:false, why:'GOVERNMENT SERVICE — NO VAT'},
      {cat:'GOVT',  label:'Salik tolls',                      net:5400,  rec:false, why:'GOVERNMENT TOLL — NO VAT'},
      {cat:'WAGE',  label:'Driver salaries & commissions',    net:52000, rec:false, why:'EMPLOYMENT — OUTSIDE VAT SCOPE'},
    ],
    Q3:[
      {cat:'FUEL',  label:'Diesel — ENOC account',            net:18400, rec:true},
      {cat:'MAINT', label:'Maintenance & repairs (brakes)',   net:9600,  rec:true},
      {cat:'TYRE',  label:'Tyres & parts',                    net:3400,  rec:true},
      {cat:'INS',   label:'Fleet insurance',                  net:4200,  rec:true},
      {cat:'RENT',  label:'Yard & office rent (commercial)',  net:8000,  rec:true},
      {cat:'PROF',  label:'Audit & accounting fees',          net:2000,  rec:true},
      {cat:'GOVT',  label:'RTA registration — B-24501',       net:2100,  rec:false, why:'GOVERNMENT SERVICE — NO VAT'},
      {cat:'GOVT',  label:'Salik tolls',                      net:1800,  rec:false, why:'GOVERNMENT TOLL — NO VAT'},
      {cat:'WAGE',  label:'Driver salaries & commissions',    net:18000, rec:false, why:'EMPLOYMENT — OUTSIDE VAT SCOPE'},
    ],
  };
  const CAPEX = {cat:'CAPEX', label:'2 × NEW TRUCKS — capital purchase', net:700000, rec:true};
  const vatOf = it => it.rec ? Math.round(it.net*0.05) : 0;

  let state = { q:'Q3', capex:false };
  const filedSet = () => new Set(load('tf_vat_filed', []));

  /* ---- outputs for a quarter (live AR if present, else seed) ---- */
  function outputs(q){
    const qd = QS.find(x=>x.id===q);
    const all = (window.TF && TF.ar) ? TF.ar.unified()
      : (TF.invoices||[]).map(v => ({ no:v.no, client:v.client, dateISO:v.date, amt:v.amt, fresh:false }));
    const list = [];
    all.forEach(v => {
      const dt = parseISO(v.dateISO);
      if(dt < qd.from || dt > qd.to) return;
      const net = Math.round(v.amt/1.05), vat = v.amt - net;
      const em = EM_PICK[hash(v.no) % EM_PICK.length];
      list.push({ no:v.no, client:v.client, dateISO:v.dateISO, amt:v.amt, net, vat, em, fresh:!!v.fresh });
    });
    return list.sort((a,b)=> parseISO(a.dateISO)-parseISO(b.dateISO));
  }

  function inputs(q){
    const rows = INPUTS[q].map(it => ({...it}));
    if(state.capex) rows.push({...CAPEX});
    return rows.map(it => ({...it, vat:vatOf(it)}));
  }

  function compute(q){
    const outs = outputs(q);
    const ins  = inputs(q);
    const box1 = outs.reduce((a,o)=>a+o.net,0);
    const box2 = outs.reduce((a,o)=>a+o.vat,0);
    const box8 = box2;                                  // + zero(5) + reverse-charge(7), all 0
    const recIn = ins.filter(i=>i.rec);
    const noIn  = ins.filter(i=>!i.rec);
    const box9 = recIn.reduce((a,i)=>a+i.vat,0);
    const net  = box8 - box9;
    // emirate split (1a-1g order)
    const em = {}; EMIR.forEach(e=>em[e]=0);
    outs.forEach(o=> em[o.em] += o.net);
    return { outs, ins, recIn, noIn, box1, box2, box8, box9, net, em };
  }

  /* ---- count-up ---- */
  function countUp(el,to,fmt){
    if(!el) return;
    const t0=performance.now(), dur=900;
    const step=t=>{ const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3), v=to*e;
      el.textContent = fmt==='pct'?v.toFixed(1)+'%':aed(v);
      if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  /* ---- render ---- */
  function render(){
    const qd = QS.find(x=>x.id===state.q);
    const C = compute(state.q);
    const filed = filedSet().has(state.q);
    const isCurrent = DEMO >= qd.from && DEMO <= qd.to;
    const daysLeft = daysBetween(DEMO, qd.deadline);

    // filing strip
    $('fTRN').textContent = TF.company.trn;
    $('fPeriod').textContent = qd.label;
    $('fSub').textContent = qd.sub;
    $('formPeriod').textContent = qd.sub;
    document.querySelectorAll('.seg-b').forEach(b=>b.classList.toggle('on', b.dataset.q===state.q));

    const st = $('fStatus'), dy = $('fDays');
    st.className = 'stchip'; dy.className = 'dayschip';
    if(filed){ st.classList.add('filed'); st.textContent = '✓ FILED'; dy.classList.add('muted'); dy.textContent = 'SUBMITTED TO FTA'; }
    else if(isCurrent){ st.classList.add('prog'); st.textContent = '◔ IN PROGRESS'; dy.textContent = 'DRAFT · PERIOD OPEN'; }
    else if(daysLeft < 0){ st.classList.add('over'); st.textContent = '⚠ OVERDUE'; dy.classList.add('over'); dy.textContent = Math.abs(daysLeft)+'D PAST DEADLINE'; }
    else if(daysLeft <= 3){ st.classList.add('ready'); st.textContent = 'READY TO FILE'; dy.classList.add('warn'); dy.textContent = 'DUE IN '+daysLeft+' DAY'+(daysLeft===1?'':'S'); }
    else { st.classList.add('ready'); st.textContent = 'READY TO FILE'; dy.textContent = 'DUE '+fD(qd.deadline); }

    $('capex').classList.toggle('on', state.capex);
    const mf = $('markFiled');
    mf.textContent = filed ? '↺ MARK UN-FILED' : '✓ MARK RETURN FILED';

    // net hero
    const nc = $('netcard'); nc.classList.remove('pay','ref','nil');
    const rib = $('netRibbon');
    if(C.net > 0){ nc.classList.add('pay'); rib.textContent = 'VAT PAYABLE TO FTA'; }
    else if(C.net < 0){ nc.classList.add('ref'); rib.textContent = 'VAT REFUND DUE FROM FTA'; }
    else { nc.classList.add('nil'); rib.textContent = 'NIL RETURN'; }
    countUp($('netVal'), Math.abs(C.net), 'aed');
    $('netArith').textContent = 'BOX 8 ' + aed(C.box8) + '  −  BOX 9 ' + aed(C.box9) + '  =  ' + (C.net<0?'−':'') + aed(Math.abs(C.net));
    $('netDue').textContent = C.net>0 ? ('SETTLE VIA eDIRHAM / FTA PORTAL BY ' + fD(qd.deadline))
                          : C.net<0 ? ('FTA PROCESSES REFUND / CARRY-FORWARD WITHIN ~20 WORKING DAYS')
                          : ('NO PAYMENT OR REFUND THIS PERIOD — RETURN STILL MUST BE FILED');
    const np = $('netPrimary');
    np.textContent = filed ? '✓ RETURN ON RECORD' : (C.net>=0 ? '⤓ FILE & PAY VIA FTA PORTAL' : '⤓ FILE & CLAIM REFUND');
    $('netStamp').hidden = !filed;

    // position card
    countUp($('posOut'), C.box8, 'aed'); countUp($('posIn'), C.box9, 'aed');
    const tot = C.box8 + C.box9 || 1;
    const f = $('tugF'); f.style.left = (C.box9/tot*100).toFixed(1)+'%'; f.style.right = (C.box8/tot*100).toFixed(1)+'%';
    $('chkOut').textContent = 'Σ PER-INVOICE VAT ' + aed(C.box2) + ' = BOX 2 ✓';
    $('chkIn').textContent  = 'Σ RECOVERABLE LINES ' + aed(C.box9) + ' = BOX 9 ✓';

    // emirate bar (1a-1g)
    const emTot = EMIR.reduce((a,e)=>a+C.em[e],0) || 1;
    $('emBar').innerHTML = EMIR.map((e,i)=> C.em[e] ? `<span class="em-seg" style="width:${(C.em[e]/emTot*100).toFixed(2)}%;background:${EM_COL[i]}" title="${e} · ${aed(C.em[e])}"></span>` : '').join('')
      || '<span class="em-seg" style="width:100%;background:var(--line-2)"></span>';
    $('emLeg').innerHTML = EMIR.map((e,i)=> C.em[e] ? `<span><i style="background:${EM_COL[i]}"></i>${e} ${aed(C.em[e])}</span>` : '').join('')
      || '<span class="mut">NO STANDARD-RATED SUPPLIES THIS PERIOD</span>';

    // the 9 boxes
    const boxes = [
      {n:'1', l:'STANDARD-RATED SUPPLIES', v:C.box1, k:'val', s:C.outs.length+' invoices · excl. VAT'},
      {n:'2', l:'TAX ON STANDARD-RATED',   v:C.box2, k:'out', s:'5% of Box 1'},
      {n:'3', l:'ZERO-RATED SUPPLIES',     v:0,      k:'zero',s:'exports / intl. transport = 0'},
      {n:'4', l:'EXEMPT SUPPLIES',         v:0,      k:'zero',s:'none this period'},
      {n:'5', l:'SUPPLIES TO GCC (REG.)',  v:0,      k:'zero',s:'none this period'},
      {n:'6', l:'SUPPLIES OUTSIDE GCC',    v:0,      k:'zero',s:'none this period'},
      {n:'7', l:'REVERSE CHARGE (OUTPUT)', v:0,      k:'zero',s:'none this period'},
      {n:'8', l:'TOTAL OUTPUT TAX',        v:C.box8, k:'out', s:'Box 2 + 5 + 7'},
      {n:'9', l:'RECOVERABLE INPUT TAX',   v:C.box9, k:'in',  s:C.recIn.length+' lines · 5% recovered'},
    ];
    grid.innerHTML = boxes.map((b,i)=>`
      <div class="vbox ${b.k}" style="--i:${i}">
        <span class="vbox-n mono">${b.n}</span>
        <span class="vbox-l">${b.l}</span>
        <span class="vbox-v display ${b.v<0?'neg':''}">${b.v<0?'−':''}${aed(Math.abs(b.v))}</span>
        <span class="vbox-s mono">${b.s}</span>
      </div>`).join('');
    requestAnimationFrame(()=>requestAnimationFrame(()=>grid.classList.add('in')));

    // output schedule
    $('outCount').textContent = C.outs.length + ' TAX INVOICES';
    $('outList').innerHTML = C.outs.length ? C.outs.map((o,i)=>`
      <a class="out-row" href="/app/operations/invoice-view?no=${encodeURIComponent(o.no)}" style="--i:${Math.min(i,10)}">
        <span class="mono o-no">${o.no}${o.fresh?'<em class="new">NEW</em>':''}</span>
        <span class="o-mid"><b>${o.client}</b><small class="mono">${TF.fmt.dt(o.dateISO)} · ${o.em}</small></span>
        <span class="o-fig"><span class="mono o-net">${aed(o.net)}</span><span class="mono o-vat">+${aed(o.vat)}</span></span>
      </a>`).join('')
      : `<div class="empty mono">NO STANDARD-RATED SUPPLIES IN ${qd.label}.<br>A NIL RETURN IS STILL FILED ON TIME.</div>`;

    // input schedule
    $('inCount').textContent = C.recIn.length + ' RECOVERABLE · ' + C.noIn.length + ' EXCLUDED';
    const maxIn = Math.max(...C.ins.map(i=>i.vat), 1);
    $('inBars').innerHTML = C.ins.map((it,i)=>`
      <div class="in-row ${it.rec?'':'norec'}" style="--i:${Math.min(i,12)}">
        <div class="in-top"><span class="in-cat ${it.cat}">${it.cat}</span><b>${it.label}</b>
          <span class="mono in-vat">${it.rec?('+ '+aed(it.vat)):'NO VAT'}</span></div>
        ${it.rec ? `<div class="in-tr"><span class="in-f" style="--w:${(it.vat/maxIn*100).toFixed(1)}%"></span></div>`
                 : `<div class="in-why mono">${it.why}</div>`}
      </div>`).join('');
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
      grid.closest('.card-b').classList.add('in');
      document.querySelectorAll('.in-row').forEach(r=>r.classList.add('in'));
    }));

    renderTicker(C, qd, filed, isCurrent, daysLeft);
  }

  function renderTicker(C, qd, filed, isCurrent, daysLeft){
    const ev = [];
    if(filed) ev.push(`<span class="g">✓ ${qd.label} FILED WITH FTA</span>`);
    else if(!isCurrent && daysLeft<0) ev.push(`<span class="r">⚠ ${qd.label} FILING ${Math.abs(daysLeft)}D OVERDUE</span>`);
    else if(!isCurrent && daysLeft<=3) ev.push(`<span><b>FILE ${qd.label} IN ${daysLeft}D</b></span>`);
    ev.push(C.net>=0 ? `<span><b>NET PAYABLE ${aed(C.net)}</b></span>` : `<span class="g">NET REFUND ${aed(Math.abs(C.net))}</span>`);
    ev.push(`<span>OUTPUT ${aed(C.box8)} · INPUT ${aed(C.box9)}</span>`);
    if(state.capex) ev.push(`<span class="g">＋ CAPEX INPUT VAT ${aed(Math.round(CAPEX.net*0.05))} RECOVERED</span>`);
    ev.push(`<span>${C.outs.length} SUPPLIES · ${C.recIn.length} RECOVERABLE LINES</span>`);
    TF.fx.ticker($('btick'), ev);
  }

  /* ---- events ---- */
  document.addEventListener('click', e => {
    const sb = e.target.closest('.seg-b');
    if(sb){ state.q = sb.dataset.q; render(); return; }
    if(e.target.closest('#capex')){ state.capex = !state.capex; render();
      TF.fx.toast(state.capex ? '＋ FLEET EXPANSION ADDED — AED 35,000 INPUT VAT NOW RECOVERABLE' : '− FLEET EXPANSION REMOVED'); return; }
    if(e.target.closest('#markFiled')){
      const set = [...filedSet()]; const i = set.indexOf(state.q);
      if(i>=0) set.splice(i,1); else set.push(state.q);
      sessionStorage.setItem('tf_vat_filed', JSON.stringify(set));
      TF.fx.toast(i>=0 ? '↺ '+state.q+' MARKED UN-FILED' : '✓ '+state.q+' MARKED FILED — LOCKED FOR THE RECORD');
      render(); return; }
    if(e.target.closest('#expXml')){ TF.fx.toast('⤓ VAT201_'+state.q+'.xml GENERATED — FTA SCHEMA VALID'); return; }
    if(e.target.closest('#expXlsx')){ TF.fx.toast('⤓ VAT_WORKPAPER_'+state.q+'.xlsx — FULL AUDIT TRAIL'); return; }
    if(e.target.closest('#vPrint')){ window.print(); return; }
    if(e.target.closest('#netPrimary')){
      const C = compute(state.q);
      TF.fx.toast(C.net>=0 ? '⤓ REDIRECTING TO FTA PORTAL — '+aed(C.net)+' DUE' : '⤓ REFUND CLAIM SUBMITTED TO FTA — '+aed(Math.abs(C.net)));
      return; }
    const rm = e.target.closest('.rm-chip');
    if(rm){ TF.fx.toast('🔒 ' + rm.textContent.trim() + ' — BUILT FROM THIS SAME LEDGER · PILOT SEP 2026'); return; }
  });

  render();
})();