/* TRANSFLOW — payables & 28-day cash-flow forecast */
(function(){
  const listEl = document.getElementById('payList');
  if(!listEl) return;
  const $ = id => document.getElementById(id);

  const OPEN = 132000;                 // opening bank balance
  const OPS_IN = 9500, RUN_OUT = 3200; // cash-on-delivery trips in / daily running out (weekdays)
  const N = 28;

  const T0 = new Date(); T0.setHours(12,0,0,0);
  const dayMs = 864e5;
  const dateFor = i => new Date(T0.getTime() + i*dayMs);
  const iso = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const isWeekday = d => { const g=d.getDay(); return g>=1 && g<=5; };
  const hash = s => { let h=2166136261>>>0; for(const c of String(s)){ h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; };
  const load = (k,fb) => { try{ const v=JSON.parse(sessionStorage.getItem(k)); return v==null?fb:v; }catch(e){ return fb; } };
  const fDs = d => d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}).toUpperCase();

  let scen = 'normal', filter = 'ALL';
  let state = load('tf_pay', { paid:[], defer:{} });
  const save = () => sessionStorage.setItem('tf_pay', JSON.stringify(state));

  /* ---------- build the payables book ---------- */
  const BASE = { 'Ahmed Khan':4800,'Bilal Hussain':4500,'Rajesh Nair':4200,'Suresh Menon':4600,
                 'Imran Baloch':5200,'Yousef Ali':4000,'Manoj Kumar':4300,'Khalid Rehman':4800 };
  const VENDORS = [
    { id:'P-BRAKE', payee:'Al Noor Workshop',      desc:'Brake repair — D-12876',          cat:'MAINT',     amt:3400,  off:2  },
    { id:'P-FUEL',  payee:'ENOC Fuel Account',     desc:'Diesel — July',                   cat:'FUEL',      amt:18400, off:3  },
    { id:'P-RTA',   payee:'RTA Dubai',             desc:'Registration renewal — B-24501',  cat:'GOVT',      amt:2100,  off:5  },
    { id:'P-SALIK', payee:'Salik',                 desc:'Toll tag top-up',                 cat:'GOVT',      amt:1800,  off:7  },
    { id:'P-TYRE',  payee:'Al Ittihad Tyres',      desc:'4× tyres — B-90112',              cat:'MAINT',     amt:6800,  off:9  },
    { id:'P-INS',   payee:'Gulf Insurance',        desc:'Fleet insurance renewal',         cat:'INSURANCE', amt:12500, off:12 },
    { id:'P-RENT',  payee:'Al Quoz Yard',          desc:'Office & yard rent — August',     cat:'RENT',      amt:8000,  off:14 },
    { id:'P-VAT',   payee:'Federal Tax Authority', desc:'VAT payable — Q2',                cat:'GOVT',      amt:21850, off:26 },
  ];

  function buildPayables(){
    const rows = [];
    // drivers: salary + live commission from their jobs
    (TF.vehicles||[]).forEach((v,i) => {
      const rev = (TF.jobs||[]).filter(j => j.veh===v.plate).reduce((a,j)=>a + j.qty*j.rate, 0);
      const comm = Math.round(rev*0.05);
      rows.push({ id:'P-DRV-'+v.plate, payee:v.driver, desc:`${v.plate} · salary + commission (${TF.fmt.aed(comm)})`,
                  cat:'DRIVERS', amt:(BASE[v.driver]||4200)+comm, off:4+(i%5) });
    });
    VENDORS.forEach(v => rows.push({ ...v }));
    // apply defer + paid
    return rows.map(r => {
      const off = r.off + (state.defer[r.id]||0);
      const due = dateFor(off);
      const paid = state.paid.includes(r.id);
      const dtd = off; // days to due from today
      const status = paid ? 'PAID' : (dtd<0 ? 'OVERDUE' : (dtd<=7 ? 'WEEK' : 'SCHEDULED'));
      return { ...r, off, due, paid, dtd, status };
    }).sort((a,b) => (a.paid?1:0)-(b.paid?1:0) || a.off-b.off);
  }

  /* ---------- receivables inflows (for the forecast) ---------- */
  function arList(){
    if(window.TF && TF.ar) return TF.ar.unified().filter(v => v.outstanding>0);
    return (TF.invoices||[]).map(v => {
      const due = new Date(v.due+'T12:00:00');
      const dpd = Math.round((T0-due)/dayMs);
      const paid = v.st==='paid'?v.amt:(v.st==='partial'?40000:0);
      return { no:v.no, client:v.client, outstanding:Math.max(0,v.amt-paid), daysPastDue:dpd };
    }).filter(v => v.outstanding>0);
  }

  function forecast(){
    const inflows = new Array(N).fill(0), outflows = new Array(N).fill(0);
    for(let i=0;i<N;i++){ if(isWeekday(dateFor(i))){ inflows[i]+=OPS_IN; outflows[i]+=RUN_OUT; } }

    const paidSet = new Set(load('tf_paid',[]));
    const late = scen==='late';
    let biggestOverdue = null;
    arList().forEach(v => {
      if(paidSet.has(v.no)) return;
      if(v.daysPastDue>0){
        if(!biggestOverdue || v.outstanding>biggestOverdue.outstanding) biggestOverdue = v;
        if(late) return;                                  // stress: overdue accounts stall, collect nothing in window
        const day = Math.min(N-1, 4 + (hash(v.no)%9));
        inflows[day] += v.outstanding*0.75;
      } else {
        const du = -v.daysPastDue;
        const day = Math.min(N-1, late ? du+10 : du);
        inflows[Math.max(0,day)] += v.outstanding*0.9;
      }
    });

    buildPayables().forEach(p => {
      const day = p.paid ? 0 : Math.max(0, Math.min(N-1, p.off));
      outflows[day] += p.amt;
    });

    const bal = [], dates = [];
    let run = OPEN;
    for(let i=0;i<N;i++){ run = run + inflows[i] - outflows[i]; bal.push(Math.round(run)); dates.push(fDs(dateFor(i))); }
    const danger = bal.filter(b => b<0).length;
    const minBal = Math.min(...bal), minI = bal.indexOf(minBal);

    const weeks = [0,1,2,3].map(w => {
      const s=w*7, e=Math.min(s+7,N);
      const infl = inflows.slice(s,e).reduce((a,b)=>a+b,0);
      const out  = outflows.slice(s,e).reduce((a,b)=>a+b,0);
      return { label:['THIS WEEK','WEEK 2','WEEK 3','WEEK 4'][w], infl, out, net:infl-out, closing:bal[e-1] };
    });

    return { inflows, outflows, bal, dates, danger, minBal, minI, weeks, biggestOverdue, OPEN };
  }

  /* ---------- forecast chart (diverging bars + balance line) ---------- */
  function drawForecast(el, F){
    const W=920,H=250,P={l:58,r:16,t:18,b:30};
    const iw=W-P.l-P.r, ih=H-P.t-P.b, n=F.bal.length;
    const hi=Math.max(...F.bal,F.OPEN)*1.06;
    const lo=Math.min(...F.bal,0);
    const loPad = lo<0 ? lo*1.3 : -hi*0.08;
    const X=i=>P.l+(i/(n-1))*iw;
    const Y=v=>P.t+ih-((v-loPad)/(hi-loPad))*ih;
    const y0=Y(0);

    let grid='';
    for(let s=0;s<=4;s++){
      const val=loPad+(hi-loPad)*(s/4), yy=Y(val);
      grid += `<line x1="${P.l}" x2="${W-P.r}" y1="${yy}" y2="${yy}" stroke="var(--line)" stroke-dasharray="3 4"/>
               <text x="${P.l-8}" y="${yy+3}" text-anchor="end">${TF.fmt.k(Math.round(val))}</text>`;
    }
    grid += `<line x1="${P.l}" x2="${W-P.r}" y1="${y0}" y2="${y0}" stroke="var(--ink)" stroke-width="1.4"/>`;

    const bw=Math.max(3, iw/n*0.6);
    const bars = F.bal.map((b,i)=>{
      const top = b>=0 ? Y(b) : y0, h=Math.max(Math.abs(Y(b)-y0),0.6);
      return `<rect class="fc-bar ${b>=0?'pos':'neg'}" x="${X(i)-bw/2}" y="${top}" width="${bw}" height="${h}" style="--o:${i*20}ms">
        <title>${F.dates[i]} · BAL ${TF.fmt.aed(b)} · IN ${TF.fmt.aed(F.inflows[i])} · OUT ${TF.fmt.aed(F.outflows[i])}</title></rect>`;
    }).join('');

    const line = F.bal.map((b,i)=>`${X(i)},${Y(b)}`).join(' ');
    const minI=F.minI, neg=F.minBal<0;
    const lowMk = `<circle cx="${X(minI)}" cy="${Y(F.minBal)}" r="4.5" fill="${neg?'var(--red)':'var(--ink)'}"/>
      <text x="${X(minI)}" y="${Y(F.minBal)+(neg?17:-11)}" text-anchor="middle"
        style="font-size:9px;font-weight:600;fill:${neg?'var(--red)':'var(--ink)'}">${TF.fmt.aed(F.minBal)}</text>`;
    const today = `<line x1="${X(0)}" x2="${X(0)}" y1="${P.t}" y2="${P.t+ih}" stroke="var(--acc)" stroke-width="1.4" stroke-dasharray="4 3"/>
      <text x="${X(0)+4}" y="${P.t+9}" style="font-size:8px;letter-spacing:.12em;fill:var(--acc-2)">TODAY</text>`;
    const wk = ['THIS WK','WK 2','WK 3','WK 4'].map((l,i)=>`<text x="${X(i*7)}" y="${H-8}" text-anchor="middle">${l}</text>`).join('');

    el.innerHTML = `<svg class="fchart" viewBox="0 0 ${W} ${H}" width="100%">${grid}${bars}
      <polyline class="fc-line" points="${line}"/>${today}${lowMk}${wk}</svg>`;
    requestAnimationFrame(()=>requestAnimationFrame(()=>el.classList.add('in')));
  }

  /* ---------- render ---------- */
  function countUp(el,to,fmt){
    if(!el) return;
    const t0=performance.now(), dur=950;
    const step=t=>{ const p=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-p,3), v=to*e;
      el.textContent = fmt==='aed'?TF.fmt.aed(v):TF.fmt.num(v);
      if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function render(){
    const pays = buildPayables();
    const F = forecast();
    const unpaid = pays.filter(p=>!p.paid);

    // manifest
    countUp($('mPay30'), unpaid.filter(p=>p.off<=30).reduce((a,p)=>a+p.amt,0), 'aed');
    countUp($('mWeek'),  unpaid.filter(p=>p.off<=7).reduce((a,p)=>a+p.amt,0), 'aed');
    countUp($('mDrv'),   unpaid.filter(p=>p.cat==='DRIVERS').reduce((a,p)=>a+p.amt,0), 'aed');
    countUp($('mVen'),   unpaid.filter(p=>p.cat!=='DRIVERS').reduce((a,p)=>a+p.amt,0), 'aed');
    countUp($('mProj'),  F.bal[N-1], 'aed');
    countUp($('mDanger'), F.danger, 'num');
    $('mProj').closest('.m-cell').classList.toggle('good', F.bal[N-1]>=0);
    $('mProj').closest('.m-cell').classList.toggle('bad',  F.bal[N-1]<0);
    $('mDangerCell').classList.toggle('bad', F.danger>0);
    $('mProjSub').textContent = scen==='late' ? 'STRESS-TEST CLOSE' : 'FORECAST CLOSE';

    // lowest-point headline
    const neg = F.minBal<0;
    $('fcLow').innerHTML = `<span class="fc-low-l mono">${neg?'⚠ LOWEST PROJECTED BALANCE':'TIGHTEST PROJECTED BALANCE'}</span>
      <span class="fc-low-v display ${neg?'neg':''}">${TF.fmt.aed(F.minBal)}</span>
      <span class="fc-low-d mono">AROUND ${F.dates[F.minI]}${scen==='late'?' · STRESS SCENARIO':''}</span>`;

    drawForecast($('fcChart'), F);

    // advisory
    const bo = F.biggestOverdue;
    if(neg){
      const lever = bo ? `Chase <a href="/app/finance/receivables">${bo.client} (${TF.fmt.aed(bo.outstanding)})</a>` : 'Bring forward a collection';
      $('fcAdvisory').innerHTML = `⚠ Cash turns negative around ${F.dates[F.minI]}. ${lever} or defer a payment below to stay afloat.`;
    } else {
      $('fcAdvisory').innerHTML = scen==='late'
        ? `Even if overdue clients stall, you stay afloat — tightest at ${TF.fmt.aed(F.minBal)} on ${F.dates[F.minI]}. Buffer: ${TF.fmt.aed(F.minBal)}.`
        : `Cash stays positive — tightest on ${F.dates[F.minI]} at ${TF.fmt.aed(F.minBal)}. You cover the wage bill and VAT with ${TF.fmt.aed(F.minBal)} to spare.`;
    }

    // weekly table
    $('wkBody').innerHTML = F.weeks.map(w => `
      <tr class="${w.closing<0?'neg-row':''}">
        <td class="mono">${w.label}</td>
        <td class="r mono in-c">${TF.fmt.aed(w.infl)}</td>
        <td class="r mono out-c">${TF.fmt.aed(w.out)}</td>
        <td class="r mono ${w.net<0?'neg-c':''}">${w.net<0?'−':'+'}${TF.fmt.aed(Math.abs(w.net))}</td>
        <td class="r mono close-c ${w.closing<0?'neg-c':''}"><b>${TF.fmt.aed(w.closing)}</b></td>
      </tr>`).join('');

    // payables queue
    const shown = pays.filter(p =>
      filter==='ALL' ? true :
      filter==='DRIVERS' ? p.cat==='DRIVERS' :
      filter==='OPS' ? p.cat!=='DRIVERS' :
      filter==='WEEK' ? (!p.paid && p.off<=7) :
      filter==='OVERDUE' ? (!p.paid && p.dtd<0) : true);

    listEl.innerHTML = shown.length ? shown.map((p,i) => {
      const dueChip = p.paid ? '' : (p.dtd<0 ? `<span class="due bad">${-p.dtd}D OVERDUE</span>`
                    : p.dtd<=7 ? `<span class="due warn">IN ${p.dtd}D</span>`
                    : `<span class="due">IN ${p.dtd}D</span>`);
      return `<div class="pay ${p.paid?'is-paid':''} ${(!p.paid&&p.dtd<0)?'ovd':''}" data-id="${p.id}" style="--i:${Math.min(i,12)}">
        <div class="pay-cat"><span class="cat-chip ${p.cat}">${p.cat}</span></div>
        <div class="pay-body">
          <div class="pay-top"><b>${p.payee}</b><span class="amt mono">${TF.fmt.aed(p.amt)}</span></div>
          <div class="pay-desc mono">${p.desc}</div>
          <div class="pay-due mono">DUE ${fDs(p.due)} ${dueChip}</div>
        </div>
        <div class="pay-acts">${p.paid
          ? '<span class="paid-tag">✓ PAID TODAY</span>'
          : '<button data-act="pay">✓ PAY</button><button data-act="defer">⏸ DEFER 7D</button>'}</div>
      </div>`;
    }).join('') : `<div class="q-empty">NOTHING MATCHES THIS FILTER.</div>`;

    renderTicker(pays, F);
  }

  function renderTicker(pays, F){
    const ev = [];
    const wk = pays.filter(p=>!p.paid && p.off<=7);
    if(wk.length) ev.push(`<span><b>${wk.length} PAYABLE${wk.length>1?'S':''} DUE THIS WEEK</b> · ${TF.fmt.aed(wk.reduce((a,p)=>a+p.amt,0))}</span>`);
    if(F.danger>0) ev.push(`<span class="r">⚠ ${F.danger} DAY${F.danger>1?'S':''} BELOW ZERO IN FORECAST</span>`);
    else ev.push(`<span class="g">✓ FORECAST STAYS POSITIVE</span>`);
    const drv = pays.filter(p=>p.cat==='DRIVERS'&&!p.paid).reduce((a,p)=>a+p.amt,0);
    ev.push(`<span>WAGE BILL ${TF.fmt.aed(drv)}</span>`);
    pays.filter(p=>p.paid).slice(-2).forEach(p=>ev.push(`<span class="g">✓ PAID ${p.payee.toUpperCase()} · ${TF.fmt.aed(p.amt)}</span>`));
    if(!ev.length) ev.push('<span>PAYABLES SYNCED</span> · ALNOOR-01');
    TF.fx.ticker($('btick'), ev);
  }

  /* ---------- events ---------- */
  document.addEventListener('click', e => {
    const scenB = e.target.closest('.scen-b');
    if(scenB){ scen = scenB.dataset.scen;
      document.querySelectorAll('.scen-b').forEach(b=>b.classList.toggle('on', b===scenB));
      render(); return; }
    const chip = e.target.closest('.fchip');
    if(chip){ filter = chip.dataset.f;
      document.querySelectorAll('.fchip').forEach(c=>c.classList.toggle('on', c===chip));
      render(); return; }
    const act = e.target.closest('[data-act]');
    const row = e.target.closest('.pay');
    if(act && row){
      const id = row.dataset.id;
      if(act.dataset.act==='pay'){
        if(!state.paid.includes(id)) state.paid.push(id); save();
        const p = buildPayables().find(x=>x.id===id);
        TF.fx.toast('✓ PAID ' + (p?p.payee:id) + ' · ' + TF.fmt.aed(p?p.amt:0) + ' — FORECAST UPDATED');
        render();
      } else if(act.dataset.act==='defer'){
        state.defer[id] = (state.defer[id]||0) + 7; save();
        const p = buildPayables().find(x=>x.id===id);
        TF.fx.toast('⏸ ' + (p?p.payee:id) + ' DEFERRED TO ' + fDs(p?p.due:new Date()) + ' — NEAR-TERM CASH IMPROVED');
        render();
      }
    }
  });

  render();
})();