/* TRANSFLOW — billing ledger */
(function(){
  const body = document.getElementById('ledgerBody');
  if(!body) return;
  const $ = id => document.getElementById(id);
  const filter = { st:'ALL', client:'ALL', q:'' };
  const sort = { key:'date', dir:-1 };

  const ST = { paid:['ok','PAID'], open:['wait','OPEN'], partial:['run','PARTIAL'], overdue:['bad','PAST DUE'] };

  function rows(){
    const ar = TF.ar.all();
    let r = ar.u.filter(v =>
      (filter.st==='ALL' || v.effSt===filter.st) &&
      (filter.client==='ALL' || v.client===filter.client) &&
      (!filter.q || (v.no+v.client).toLowerCase().includes(filter.q)));
    r.sort((a,b) => {
      let va,vb;
      switch(sort.key){
        case 'no': va=a.no; vb=b.no; break;
        case 'client': va=a.client; vb=b.client; break;
        case 'date': va=a.dt; vb=b.dt; break;
        case 'due': va=a.due; vb=b.due; break;
        case 'amt': va=a.amt; vb=b.amt; break;
        case 'st': va=a.effSt; vb=b.effSt; break;
      }
      return (va>vb?1:va<vb?-1:0)*sort.dir;
    });
    return { r, ar };
  }

  function render(){
    const { r, ar } = rows();
    body.innerHTML = r.length ? r.map((v,i) => {
      const [sc,sl] = ST[v.effSt];
      const ovd = v.effSt==='overdue';
      const dueTxt = v.effSt==='paid' ? TF.fmt.dt(v.dueISO)
        : (v.daysPastDue>0 ? `<span class="due-warn">${TF.fmt.dt(v.dueISO)} · ${v.daysPastDue}D</span>` : TF.fmt.dt(v.dueISO));
      return `<tr class="${ovd?'ovd ':''}${v.fresh?'fresh':''}" style="--i:${Math.min(i,14)}" data-no="${v.no}">
        <td><span class="no-cell"><b>${v.no}</b>${v.fresh?'<span class="ribbon">JUST RAISED</span>':''}</span></td>
        <td>${v.client}</td>
        <td class="mono">${TF.fmt.dt(v.dateISO)}</td>
        <td class="mono">${dueTxt}</td>
        <td class="r amt">${TF.fmt.aed(v.amt)}</td>
        <td class="r amt">${v.outstanding>0?TF.fmt.aed(v.outstanding):'<span style="color:var(--teal-2)">CLEARED</span>'}</td>
        <td class="r"><span class="st ${sc}"><i></i>${sl}</span></td>
        <td class="r"><span class="row-act"><button data-act="view">OPEN</button><button data-act="mail">RESEND</button></span></td>
      </tr>`;
    }).join('') : `<tr class="empty-row"><td colspan="8">NO INVOICES MATCH THIS FILTER</td></tr>`;

    /* manifest */
    const set = (id,val) => { const el=$(id); if(el) el.dataset.to = val; };
    set('m-raised',''); // placeholders use positional query below
    const counts = document.querySelectorAll('.manifest [data-count]');
    counts[0].dataset.to = ar.raised;
    counts[1].dataset.to = ar.collected;
    counts[2].dataset.to = ar.outstanding;
    counts[3].dataset.to = ar.overdueCount;
    $('mCount').textContent = ar.u.length + ' INVOICES';
    $('mCollPct').textContent = (ar.raised? (ar.collected/ar.raised*100).toFixed(0):0) + '% RECOVERED';
    $('mOld').textContent = 'OLDEST ' + (ar.oldestDays||0) + ' DAYS';
    TF.fx.counters();

    /* ticker */
    const ev = [];
    ar.u.filter(v=>v.fresh).forEach(v => ev.push(`<span class="g">✓ ${v.no} RAISED</span> · ${v.client} · ${TF.fmt.aed(v.amt)}`));
    ar.u.filter(v=>v.effSt==='overdue').slice(0,3).forEach(v => ev.push(`<span><b>${v.no}</b> NOW ${v.daysPastDue}D PAST DUE</span> · ${v.client}`));
    ar.u.filter(v=>v.effSt==='paid').slice(0,2).forEach(v => ev.push(`<span class="g">💰 ${v.no} SETTLED</span> · ${v.client}`));
    if(!ev.length) ev.push('<span>LEDGER SYNCED</span> · ALNOOR-01 · ALL FIGURES LIVE');
    TF.fx.ticker($('btick'), ev);

    /* sort indicators */
    document.querySelectorAll('.ledger th[data-sort]').forEach(th => {
      th.classList.remove('s-asc','s-desc');
      if(th.dataset.sort===sort.key) th.classList.add(sort.dir===1?'s-asc':'s-desc');
    });
  }

  body.addEventListener('click', e => {
    const tr = e.target.closest('tr[data-no]'); if(!tr) return;
    const act = e.target.closest('[data-act]');
    if(act && act.dataset.act==='mail'){ e.stopPropagation(); TF.fx.toast('📧 ' + tr.dataset.no + ' RE-SENT TO CLIENT ACCOUNTS'); return; }
    if(act && act.dataset.act==='view'){ e.stopPropagation(); }
    location.href = '/app/operations/invoice-view?no=' + encodeURIComponent(tr.dataset.no);
  });
  document.querySelectorAll('.ledger th[data-sort]').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.sort; sort.dir = sort.key===k ? -sort.dir : (k==='date'||k==='due'||k==='amt'?-1:1); sort.key = k; render();
  }));
  $('srch').addEventListener('input', e => { filter.q = e.target.value.toLowerCase(); render(); });
  $('fClient').addEventListener('change', e => { filter.client = e.target.value; render(); });
  document.querySelectorAll('.fchip').forEach(ch => ch.addEventListener('click', () => {
    document.querySelectorAll('.fchip').forEach(c=>c.classList.remove('on')); ch.classList.add('on');
    filter.st = ch.dataset.st; render();
  }));
  $('exportBtn').addEventListener('click', () => TF.fx.toast('⤓ LEDGER EXPORTED — ledger_alnoor_' + TF.ar._iso(TF.ar._today()) + '.csv'));

  render();
})();