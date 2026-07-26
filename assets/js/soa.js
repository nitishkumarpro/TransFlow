/* TRANSFLOW — statement of account */
(function(){
  const sel = document.getElementById('clientSel');
  if(!sel) return;

  /* default to the client with the oldest overdue, else first with activity, else first */
  const ar = TF.ar.all();
  const def = ar.oldestClient || (TF.clients.find(c => TF.ar.unified().some(v=>v.client===c.name)) || TF.clients[0]).name;
  sel.innerHTML = TF.clients.map(c => `<option${c.name===def?' selected':''}>${c.name}</option>`).join('');

  function render(){
    const name = sel.value, d = TF.ar.client(name);
    const usedPct = Math.min(100, d.limit ? d.outstanding/d.limit*100 : 0);
    const over = usedPct > 90;

    document.getElementById('clientCard').innerHTML = `
      <div class="cc-top">
        <div class="cc-ava">${name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase()}</div>
        <div><h3>${name}</h3><small>TRN ${d.trn} · TERMS ${d.terms} DAYS</small></div>
      </div>
      <div class="bal-hero ${d.outstanding>0?'neg':''}">${TF.fmt.aed(d.outstanding)}</div>
      <div style="font-family:var(--mono);font-size:9px;letter-spacing:.18em;color:var(--mut);margin-top:2px">CURRENT BALANCE DUE</div>
      <div class="gauge ${over?'over':''}">
        <div class="g-top"><span>CREDIT USED</span><span>${TF.fmt.aed(d.outstanding)} / ${TF.fmt.aed(d.limit)}</span></div>
        <div class="g-tr"><span class="g-f" style="--w:${usedPct.toFixed(1)}%;background:${over?'var(--red)':'var(--teal)'}"></span><span class="g-mk" style="left:100%"></span></div>
      </div>
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-ghost" id="ccLedger" style="flex:1;justify-content:center">OPEN IN LEDGER</button>
      </div>`;
    document.getElementById('ccLedger').addEventListener('click', () => {
      document.querySelectorAll('.fchip').forEach(c=>c.classList.remove('on'));
      location.href = '/app/operations/invoices';
    });

    document.getElementById('agingTiles').innerHTML = d.B.map(b =>
      `<div class="at ${b.value?'':'zero'}" style="--c:${b.color}"><div class="l">${b.label}</div><div class="v">${TF.fmt.aed(b.value)}</div></div>`).join('');

    const body = document.getElementById('stmtBody');
    if(!d.rows.length){ body.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--mut);padding:30px;font-family:var(--mono);font-size:11px;letter-spacing:.14em">NO ACTIVITY FOR THIS CLIENT</td></tr>`; }
    else {
      body.innerHTML = d.rows.map((r,i) => `
        <tr class="${r.syn?'syn':''}" style="--i:${Math.min(i,16)}">
          <td class="mono">${TF.fmt.dt(r.dateISO)}</td>
          <td class="ref ${r.no&&!r.syn?'link':''}" ${r.no&&!r.syn?`data-no="${r.no}"`:''}>${r.ref}${r.syn?' <span class="tag-syn">PRIOR</span>':''}</td>
          <td>${r.desc}</td>
          <td class="r ${r.debit?'debit':''}">${r.debit?TF.fmt.aed(r.debit):''}</td>
          <td class="r ${r.credit?'credit':''}">${r.credit?TF.fmt.aed(r.credit):''}</td>
          <td class="r bal ${r.bal>0?'neg':''}">${TF.fmt.aed(r.bal)}</td>
        </tr>`).join('') +
        `<tr class="carry"><td colspan="5">BALANCE CARRY-FORWARD</td><td class="r bal">${TF.fmt.aed(d.outstanding)}</td></tr>`;
      body.querySelectorAll('.ref.link').forEach(el => el.addEventListener('click', () =>
        location.href = '/app/operations/invoice-view?no=' + encodeURIComponent(el.dataset.no)));
    }

    /* animate gauge + reveal injected tiles */
    requestAnimationFrame(() => requestAnimationFrame(() => {
      document.querySelectorAll('.gauge').forEach(g => g.parentElement.classList.add('in'));
    }));
    document.querySelector('.gauge').closest('.card-b').classList.add('in');
    TF.fx.reveal();
  }

  sel.addEventListener('change', render);
  document.getElementById('soaPrint').addEventListener('click', () => window.print());
  document.getElementById('soaMail').addEventListener('click', () =>
    TF.fx.toast('📧 STATEMENT SENT TO ACCOUNTS@' + sel.value.toUpperCase().replace(/[^A-Z]/g,'') + '.AE'));

  render();
})();