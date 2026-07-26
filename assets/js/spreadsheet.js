/* TRANSFLOW — operations trip sheet */
(function(){
  const grid = document.getElementById('sgrid');
  if(!grid) return;

  TF.locations = TF.locations || ['Jebel Ali Port','Khalifa Port','Abu Dhabi','Mussafah','Ghayathi',
    'Hamriyah FZ','Al Quoz','Al Ain','Jebel Ali FZ','Sharjah Airport','Fujairah Port','Ras Al Khaimah',
    'Downtown Dubai','Dubai Inv. Park','Masafi','Ras Al Khor'];

  const invoiced = new Set(JSON.parse(sessionStorage.getItem('tf_invoiced') || '[]'));
  const jobs = TF.jobs.map(j => ({ ...j }));
  const sel  = new Set();
  const filter = { client:'ALL', status:'ALL', q:'' };
  const sort = { key:'date', dir:-1 };
  let nextJob = 1053;

  const $ = id => document.getElementById(id);
  const genBtn = $('genBtn'), statusEl = $('gridStatus');
  const LETTERS = 'ABCDEFGHIJKLMN';
  const COLS = [
    { k:'chk' }, { k:'no', l:'JOB NO', w:'w-no' },
    { k:'date', l:'DATE', sort:1 }, { k:'client', l:'CLIENT', sort:1 },
    { k:'veh', l:'VEHICLE' }, { k:'driver', l:'DRIVER' },
    { k:'from', l:'FROM' }, { k:'to', l:'TO' }, { k:'cargo', l:'CARGO' },
    { k:'qty', l:'QTY', sort:1 }, { k:'rate', l:'RATE', sort:1 }, { k:'amt', l:'AMOUNT', sort:1 },
    { k:'st', l:'STATUS', sort:1 }, { k:'inv', l:'INVOICE' },
  ];
  const ORD = { wait:0, run:1, ok:2 };
  const STL = { run:['run','IN TRANSIT'], ok:['ok','DELIVERED'], wait:['wait','AWAITING'] };

  const selHTML = (f, val) => {
    const opts = f==='client' ? TF.clients.map(c=>c.name)
               : f==='veh'    ? TF.vehicles.map(v=>v.plate)
               :                TF.locations;
    return `<select class="cell-sel" data-f="${f}"><option value="">— select —</option>` +
      opts.map(o=>`<option${o===val?' selected':''}>${o}</option>`).join('') + `</select>`;
  };

  function visible(){
    return jobs.filter(j =>
        (filter.client==='ALL' || j.client===filter.client) &&
        (filter.status==='ALL' || j.st===filter.status) &&
        (!filter.q || (j.id+j.client+j.from+j.to+j.cargo+j.veh+j.driver).toLowerCase().includes(filter.q))
      ).sort((a,b) => {
        let va, vb;
        switch(sort.key){
          case 'date':   va=a.date; vb=b.date; break;
          case 'client': va=a.client; vb=b.client; break;
          case 'qty':    va=a.qty; vb=b.qty; break;
          case 'rate':   va=a.rate; vb=b.rate; break;
          case 'amt':    va=a.qty*a.rate; vb=b.qty*b.rate; break;
          case 'st':     va=ORD[a.st]; vb=ORD[b.st]; break;
        }
        return (va>vb?1:va<vb?-1:0) * sort.dir;
      });
  }

  function rowHTML(j, i){
    const isInv = invoiced.has(j.id), isSel = sel.has(j.id);
    const [sc, sl] = STL[j.st];
    return `<tr data-id="${j.id}" class="${isSel?'sel ':''}${isInv?'done':''}${j.fresh?' fresh':''}">
      <td class="rn">${i+1}</td>
      <td><input type="checkbox" class="rowchk" ${isSel?'checked':''} ${isInv?'disabled':''}></td>
      <td class="c-mono"><b>${j.id}</b></td>
      <td class="c-mono">${TF.fmt.dt(j.date).toUpperCase()}</td>
      <td>${j.fresh ? selHTML('client', j.client) : j.client}</td>
      <td class="c-mono">${j.fresh ? selHTML('veh', j.veh) : j.veh}</td>
      <td class="c-driver">${j.driver}</td>
      <td>${j.fresh ? selHTML('from', j.from) : j.from}</td>
      <td>${j.fresh ? selHTML('to', j.to) : j.to}</td>
      <td>${j.fresh ? `<input class="cell-in tx" data-f="cargo" value="" placeholder="Cargo…">` : j.cargo}</td>
      <td class="c-num"><input class="cell-in" data-f="qty"  type="number" min="0" value="${j.qty}"></td>
      <td class="c-num"><input class="cell-in" data-f="rate" type="number" min="0" step="50" value="${j.rate}"></td>
      <td class="c-amt">${TF.fmt.aed(j.qty * j.rate)}</td>
      <td><span class="st ${sc}"><i></i>${sl}</span></td>
      <td>${isInv ? '<span class="st ok"><i></i>RAISED ✓</span>'
                  : '<span class="c-mono" style="color:var(--line-2)">—</span>'}</td>
    </tr>`;
  }

  function render(){
    const vis = visible();
    const billable = vis.filter(j => !invoiced.has(j.id));
    const allSel = billable.length > 0 && billable.every(j => sel.has(j.id));
    const letters = [...LETTERS].map(l => `<th>${l}</th>`).join('');
    const hr = COLS.map(c => {
      if(c.k==='chk') return `<th><input type="checkbox" id="chkAll" class="rowchk" ${allSel?'checked':''}></th>`;
      const s = sort.key===c.k ? (sort.dir===1?' s-asc':' s-desc') : '';
      return `<th class="${s.trim()}" ${c.sort?`data-sort="${c.k}"`:''}>${c.l}</th>`;
    }).join('');
    grid.innerHTML = `<thead><tr class="lr"><th class="rn-h"></th>${letters}</tr>
      <tr class="hr"><th class="rn-h"></th>${hr}</tr></thead>
      <tbody>${vis.map(rowHTML).join('')}</tbody>`;
    updateBar(vis);
  }

  function updateBar(vis){
    vis = vis || visible();
    const selJobs = jobs.filter(j => sel.has(j.id) && !invoiced.has(j.id));
    const sum = selJobs.reduce((a,j)=>a + j.qty*j.rate, 0);
    const open = jobs.filter(j => !invoiced.has(j.id));
    const openVal = open.reduce((a,j)=>a + j.qty*j.rate, 0);

    statusEl.innerHTML =
      `<span>SHOWING <b>${vis.length}</b> OF ${jobs.length} JOBS</span>
       <span>SELECTED <b>${selJobs.length}</b></span>
       <span>SUM OF SELECTED <b class="acc">${TF.fmt.aed(sum)}</b></span>
       <span>UNINVOICED VALUE <b>${TF.fmt.aed(openVal)}</b></span>
       <span class="gs-live"><i></i>${selJobs.length ? 'READY TO BILL' : 'AUTO-CALC ON'}</span>`;

    genBtn.disabled = !selJobs.length;
    genBtn.textContent = selJobs.length
      ? `⚡ GENERATE INVOICE${selJobs.length>1?'S':''} (${selJobs.length})`
      : '⚡ SELECT TRIPS TO BILL';

    $('msJobs').textContent = jobs.length;
    $('msOpen').textContent = open.length;
    $('msVal').textContent  = TF.fmt.aed(openVal);
  }

  /* ---- events (delegated — grid re-renders freely) ---- */
  grid.addEventListener('change', e => {
    const t = e.target, tr = t.closest('tr');
    if(t.id === 'chkAll'){
      visible().filter(j=>!invoiced.has(j.id)).forEach(j => t.checked ? sel.add(j.id) : sel.delete(j.id));
      render(); return;
    }
    if(t.classList.contains('rowchk')){
      const id = tr.dataset.id;
      t.checked ? sel.add(id) : sel.delete(id);
      tr.classList.toggle('sel', t.checked);
      updateBar(); return;
    }
    if(t.classList.contains('cell-in') && tr){
      const j = jobs.find(x => x.id === tr.dataset.id);
      j[t.dataset.f] = +t.value || 0;
      tr.querySelector('.c-amt').textContent = TF.fmt.aed(j.qty * j.rate);
      updateBar(); return;
    }
    if(t.classList.contains('cell-sel') && tr){
      const j = jobs.find(x => x.id === tr.dataset.id);
      j[t.dataset.f] = t.value;
      if(t.dataset.f === 'veh'){
        const v = TF.vehicles.find(v => v.plate === t.value);
        j.driver = v ? v.driver : '';
        tr.querySelector('.c-driver').textContent = j.driver;
      }
      updateBar();
    }
  });
  grid.addEventListener('input', e => {
    const tr = e.target.closest('tr');
    if(e.target.dataset.f === 'cargo' && tr)
      jobs.find(x => x.id === tr.dataset.id).cargo = e.target.value;
  });
  grid.addEventListener('click', e => {
    const th = e.target.closest('th[data-sort]');
    if(!th) return;
    const k = th.dataset.sort;
    sort.dir = sort.key === k ? -sort.dir : (k==='date' ? -1 : 1);
    sort.key = k;
    render();
  });

  /* toolbar */
  $('srch').addEventListener('input', e => { filter.q = e.target.value.toLowerCase(); render(); });
  $('fClient').addEventListener('change', e => { filter.client = e.target.value; render(); });
  document.querySelectorAll('.fchip').forEach(ch => ch.addEventListener('click', () => {
    document.querySelectorAll('.fchip').forEach(c => c.classList.remove('on'));
    ch.classList.add('on');
    filter.status = ch.dataset.st;
    render();
  }));
  $('addJob').addEventListener('click', () => {
    jobs.unshift({ id:'JOB-'+(nextJob++), date:'2026-07-26', client:'', veh:'', driver:'',
      from:'', to:'', cargo:'', qty:1, rate:0, st:'wait', fresh:true });
    render();
    TF.fx.toast('＋ NEW TRIP ROW ADDED — FILL THE DETAILS, IT CALCULATES AS YOU TYPE');
  });
  genBtn.addEventListener('click', () => {
    const chosen = jobs.filter(j => sel.has(j.id) && !invoiced.has(j.id));
    if(chosen.some(j => !j.client || !j.veh)){
      TF.fx.toast('⚠ COMPLETE CLIENT & VEHICLE ON EVERY SELECTED ROW FIRST'); return;
    }
    TF.invoice.open(chosen, docs => {
      docs.forEach(d => d.js.forEach(j => invoiced.add(j.id)));
      sessionStorage.setItem('tf_invoiced', JSON.stringify([...invoiced]));
      sel.clear();
      render();
    });
  });

  render();
})();
