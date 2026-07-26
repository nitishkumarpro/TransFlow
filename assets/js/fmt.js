window.TF = window.TF || {};
TF.fmt = {
  aed: n => 'AED ' + Math.round(n).toLocaleString('en-US'),
  num: n => Math.round(n).toLocaleString('en-US'),
  k:   n => n >= 1000 ? Math.round(n/1000) + 'k' : String(n),
  pct: (n,d=1) => n.toFixed(d) + '%',
  dt:  iso => { const d = TF.ar._parse(iso); return d ? d.toLocaleDateString('en-GB',{day:'2-digit',month:'short'}).toUpperCase() : '—'; },
};

/* ---- accounts-receivable engine: the single source of billing truth ----
   Every page (dashboard, ledger, permalink, SOA) reads TF.ar so the printed
   date and every overdue figure always agree. No hardcoded day-counts. ---- */
(function(){
  const MON={JAN:0,FEB:1,MAR:2,APR:3,MAY:4,JUN:5,JUL:6,AUG:7,SEP:8,OCT:9,NOV:10,DEC:11};
  const parse = s => {
    if(!s) return null;
    if(/^\d{4}-\d{2}-\d{2}$/.test(s)){ const p=s.split('-').map(Number); return new Date(p[0],p[1]-1,p[2],12,0,0); }
    const m=String(s).trim().toUpperCase().match(/^(\d{1,2})\s+([A-Z]{3})\s+(\d{4})$/);
    if(m) return new Date(+m[3], MON[m[2]], +m[1], 12,0,0);
    const d=new Date(s); return isNaN(d)?null:new Date(d.getFullYear(),d.getMonth(),d.getDate(),12,0,0);
  };
  const iso  = d => d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const days = (a,b) => Math.round((b-a)/864e5);
  const today = () => { const n=new Date(); return new Date(n.getFullYear(),n.getMonth(),n.getDate(),12,0,0); };
  const hash = s => { let h=2166136261>>>0; for(const c of s){ h^=c.charCodeAt(0); h=Math.imul(h,16777619)>>>0; } return h; };

  const paidSet = () => new Set(JSON.parse(sessionStorage.getItem('tf_paid')||'[]'));
  const PARTIAL = { 'INV-2026-0045':40000 };

  function unified(){
    const paid = paidSet(), T = today(), list = [];
    (TF.invoices||[]).forEach(v => list.push({ no:v.no, client:v.client, seedSt:v.st, dateISO:v.date, dueISO:v.due, amt:v.amt, fresh:false }));
    (JSON.parse(sessionStorage.getItem('tf_gen')||'[]')).forEach(g => {
      const dDate = parse(g.date), dDue = g.due ? parse(g.due) : new Date((dDate||T).getTime()+30*864e5);
      list.push({ no:g.no, client:g.client, seedSt:'open', dateISO:iso(dDate||T), dueISO:iso(dDue), amt:g.total||g.amt||0, fresh:true });
    });
    return list.map(v => {
      const due=parse(v.dueISO), dt=parse(v.dateISO);
      const pd = paid.has(v.no) ? v.amt : (v.seedSt==='paid' ? v.amt : (PARTIAL[v.no]||0));
      const out = Math.max(0, v.amt - pd);
      const eff = (paid.has(v.no)||v.seedSt==='paid'||out<=0) ? 'paid' : (v.seedSt==='partial' ? 'partial' : (due<T ? 'overdue' : 'open'));
      const dpd = due<T ? days(due,T) : (due>T ? -days(T,due) : 0);
      return Object.assign({}, v, { due, dt, paid:pd, outstanding:out, effSt:eff, daysPastDue:dpd });
    }).sort((a,b) => b.dt - a.dt);
  }

  function bucketize(rows){
    const B=[{label:'CURRENT',value:0,color:'var(--teal)'},{label:'1–30 DAYS',value:0,color:'var(--teal)'},
             {label:'31–60 DAYS',value:0,color:'var(--amber)'},{label:'61–90 DAYS',value:0,color:'var(--red)'},
             {label:'90+ DAYS',value:0,color:'var(--red)'}];
    let out=0, raised=0, coll=0, ovd=0, old=-1, oC='', oA=0;
    rows.forEach(v => {
      raised+=v.amt; coll+=v.paid; out+=v.outstanding;
      if(v.outstanding>0){
        if(v.daysPastDue>0){ ovd++; if(v.daysPastDue>old){ old=v.daysPastDue; oC=v.client; oA=v.outstanding; } }
        B[v.daysPastDue<=0?0:v.daysPastDue<=30?1:v.daysPastDue<=60?2:v.daysPastDue<=90?3:4].value+=v.outstanding;
      }
    });
    return { B, outstanding:out, raised, collected:coll, overdueCount:ovd, oldestDays:old<0?0:old, oldestClient:oC, oldestAmt:oA };
  }

  /* deterministic prior-period history so a SOA reads like a real ledger */
  function priorPairs(client){
    const c=(TF.clients||[]).find(x=>x.name===client), h=hash(client), rows=[];
    const base=(c?c.limit:120000);
    for(let i=0;i<3;i++){
      const seed=(h>>(i*3))&7, amt=Math.round(base*(0.28+seed*0.05)/50)*50;
      const dDay=new Date(2026,1+Math.floor(i*1.3),6+seed*2,12,0,0);
      const pDay=new Date(dDay.getTime()+(8+seed)*864e5);
      const no='INV-2026-00'+(11+i*3+ (h%3));
      rows.push({ dateISO:iso(dDay), ref:no, desc:'Freight & haulage — prior period', debit:amt, credit:0, syn:true });
      rows.push({ dateISO:iso(pDay), ref:'REC-'+no.slice(-4), desc:'Payment received — bank transfer', debit:0, credit:amt, syn:true });
    }
    return rows;
  }

  function client(name){
    const c=(TF.clients||[]).find(x=>x.name===name)||{trn:'—',terms:30,limit:100000};
    const invs=unified().filter(v=>v.client===name);
    const T=today();
    const rows=priorPairs(name);
    invs.forEach(v=>{
      rows.push({ dateISO:v.dateISO, ref:v.no, desc:'Freight & transport charges', debit:v.amt, credit:0, eff:v.effSt, no:v.no });
      if(v.effSt==='paid') rows.push({ dateISO:iso(new Date(Math.min(v.due.getTime(),T.getTime()))), ref:'REC-'+v.no.slice(-4), desc:'Payment received — bank transfer', debit:0, credit:v.amt, no:v.no });
      else if(v.effSt==='partial') rows.push({ dateISO:iso(new Date(Math.min(v.due.getTime()+6*864e5,T.getTime()))), ref:'REC-'+v.no.slice(-4), desc:'Part payment received', debit:0, credit:v.paid, no:v.no });
    });
    rows.sort((a,b)=> parse(a.dateISO)-parse(b.dateISO) || (a.credit?1:-1));
    let bal=0; rows.forEach(r=>{ bal += r.debit - r.credit; r.bal=Math.round(bal); });
    const ar=bucketize(invs);
    return { meta:c, invs, rows, outstanding:ar.outstanding, B:ar.B, oldestDays:ar.oldestDays, limit:c.limit, terms:c.terms, trn:c.trn };
  }

  TF.ar = { _parse:parse, _iso:iso, _today:today, unified, all:()=>bucketize(unified()), client };
})();