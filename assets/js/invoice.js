/* TRANSFLOW — one-click tax invoice engine (groups selection per client) */
window.TF = window.TF || {};
TF.invoice = (function(){
  let docs = [], active = 0, onDone = null;

  const W1=['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE',
    'THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN'];
  const W10=['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];
  const two = n => n<20 ? W1[n] : W10[(n/10)|0] + (n%10 ? '-'+W1[n%10] : '');
  const three = n => { const h=(n/100)|0, r=n%100;
    return (h ? W1[h]+' HUNDRED'+(r?' ':'') : '') + (r ? two(r) : ''); };
  function words(n){ n=Math.round(n); if(!n) return 'ZERO';
    const m=(n/1e6)|0, t=((n%1e6)/1000)|0, r=n%1000;
    return ((m?three(m)+' MILLION ':'') + (t?three(t)+' THOUSAND ':'') + (r?three(r):'')).trim(); }

  function qrSVG(seed){
    let h = 2166136261 >>> 0;
    for(const ch of seed){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
    const rnd = () => { h ^= h<<13; h>>>=0; h ^= h>>>17; h ^= h<<5; h>>>=0; return h/4294967296; };
    const N=25, s=4, cells=[];
    const inF = (r,c) => (r<7&&c<7)||(r<7&&c>=N-7)||(r>=N-7&&c<7);
    for(let r=0;r<N;r++) for(let c=0;c<N;c++)
      if(!inF(r,c) && rnd()>.5) cells.push(`<rect x="${c*s}" y="${r*s}" width="${s}" height="${s}"/>`);
    const F = (r0,c0) => `<rect x="${c0*s}" y="${r0*s}" width="${7*s}" height="${7*s}"/>` +
      `<rect x="${(c0+1)*s}" y="${(r0+1)*s}" width="${5*s}" height="${5*s}" fill="#fff"/>` +
      `<rect x="${(c0+2)*s}" y="${(r0+2)*s}" width="${3*s}" height="${3*s}"/>`;
    return `<svg viewBox="0 0 ${N*s} ${N*s}" class="qr" fill="#0C161B">` +
      `<rect width="${N*s}" height="${N*s}" fill="#fff"/>${F(0,0)}${F(0,N-7)}${F(N-7,0)}${cells.join('')}</svg>`;
  }

  const fD = d => d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  const logo = `<svg viewBox="0 0 24 24" fill="none"><path d="M3 7h12l6 5-6 5H3z" fill="#FF5A1F" stroke="#0C161B" stroke-width="1.2"/><path d="M7 10.5h6M7 13.5h4" stroke="#0C161B" stroke-width="1.4"/></svg>`;

  function docHTML(d, i){
    const rows = d.js.map((j,k) => `<tr>
      <td class="r">${k+1}</td>
      <td>${j.cargo}<span class="sub">${j.from.toUpperCase()} → ${j.to.toUpperCase()} · ${j.id}</span></td>
      <td class="r">${j.veh}</td><td class="r">${j.qty}</td>
      <td class="r">${TF.fmt.aed(j.rate)}</td><td class="r"><b>${TF.fmt.aed(j.qty*j.rate)}</b></td>
    </tr>`).join('');
    return `<article class="inv-doc${i===active?' on':''}" data-i="${i}">
      <div class="hazard inv-hz"></div>
      <header class="inv-head">
        <div class="inv-brand">${logo}
          <div><b>TRANSFLOW</b><small>${TF.company.name.toUpperCase()} · DUBAI, UAE</small></div>
        </div>
        <div class="inv-ttl"><span class="display">TAX INVOICE</span><span class="mono">NO. ${d.no}</span></div>
      </header>
      <section class="inv-meta">
        <div><label>BILL TO</label><b>${d.client.toUpperCase()}</b>
          <span>TRN ${d.c.trn || '—'}</span><span>UNITED ARAB EMIRATES</span></div>
        <div><label>ISSUED</label><b>${d.date}</b><span>BY HARISH S.</span></div>
        <div><label>DUE</label><b>${d.due}</b><span>${d.terms} DAYS</span></div>
        <div><label>CURRENCY</label><b>AED</b><span>VAT @ 5%</span></div>
      </section>
      <table class="inv-tbl">
        <thead><tr><th>#</th><th>DESCRIPTION</th><th class="r">VEHICLE</th>
          <th class="r">QTY</th><th class="r">RATE</th><th class="r">AMOUNT</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <section class="inv-tot">
        <div class="inv-words">AMOUNT IN WORDS — UAE DIRHAMS ${words(d.total)} ONLY<br><br>
          RATES EXCLUSIVE OF VAT · GOODS RECEIVED IN GOOD ORDER UNLESS NOTED WITHIN 48 HRS</div>
        <table class="inv-sums">
          <tr><td>SUBTOTAL</td><td class="r">${TF.fmt.aed(d.sub)}</td></tr>
          <tr><td>VAT (5%)</td><td class="r">${TF.fmt.aed(d.vat)}</td></tr>
          <tr class="grand"><td>TOTAL DUE</td><td class="r">${TF.fmt.aed(d.total)}</td></tr>
        </table>
      </section>
      <div class="inv-qrbox">${qrSVG(d.no)}
        <small>FTA-COMPLIANT E-INVOICE<br>SCAN TO VERIFY · FEDERAL TAX AUTHORITY</small></div>
      <footer class="inv-bot">
        <div><label>BANK</label><span>EMIRATES NBD · AE07 0331 2345 6789 0000 4521</span></div>
        <div><label>SELLER TRN</label><span>${TF.company.trn}</span></div>
        <span class="sig">RECEIVED BY ____________________</span>
      </footer>
      <div class="inv-wm">TRANSFLOW</div>
    </article>`;
  }

  function renderModal(){
    const ovl = document.getElementById('invOvl');
    const total = docs.reduce((a,d)=>a+d.total,0);
    const nJobs = docs.reduce((a,d)=>a+d.js.length,0);
    ovl.querySelector('.inv-tabs').innerHTML = docs.length>1
      ? docs.map((d,i)=>`<button class="inv-tab${i===active?' on':''}" data-i="${i}">${d.no} · ${d.client.split(' ')[0].toUpperCase()}</button>`).join('') : '';
    document.getElementById('invDocs').innerHTML = docs.map(docHTML).join('');
    document.getElementById('invSum').innerHTML =
      `${docs.length} INVOICE${docs.length>1?'S':''} · ${nJobs} JOB${nJobs>1?'S':''} · TOTAL <b>${TF.fmt.aed(total)}</b>`;
  }

  function show(){ document.getElementById('invOvl').classList.add('show'); }
  function hide(){ document.getElementById('invOvl').classList.remove('show'); }

  /* static modal shell lives in spreadsheet.html; wire once */
  document.addEventListener('click', e => {
    const t = e.target;
    if(t.closest('#invClose')) hide();
    else if(t.id === 'invOvl') hide();
    else if(t.classList.contains('inv-tab')){
      active = +t.dataset.i;
      document.querySelectorAll('.inv-tab').forEach(b=>b.classList.toggle('on', +b.dataset.i===active));
      document.querySelectorAll('.inv-doc').forEach(d=>d.classList.toggle('on', +d.dataset.i===active));
    }
    else if(t.closest('#invPrint')) window.print();
    else if(t.closest('#invMail')){
      const d = docs[active];
      TF.fx.toast('📧 ' + d.no + ' PDF SENT TO ACCOUNTS@' + d.client.toUpperCase().replace(/[^A-Z]/g,'') + '.AE');
    }
    else if(t.closest('#invWa')){
      const d = docs[active];
      TF.fx.toast('💬 ' + d.no + ' PDF SENT VIA WHATSAPP · +971 50 XXX XXXX');
    }
    else if(t.closest('#invConfirm')){
      const gen = JSON.parse(sessionStorage.getItem('tf_gen') || '[]');
      docs.forEach(d => gen.push({ no:d.no, client:d.client, total:d.total, date:d.date }));
      sessionStorage.setItem('tf_gen', JSON.stringify(gen));
      const total = docs.reduce((a,d)=>a+d.total,0);
      hide();
      TF.fx.toast('✓ ' + docs.length + ' INVOICE' + (docs.length>1?'S':'') + ' RAISED · ' +
        TF.fmt.aed(total) + ' · ROWS MARKED INVOICED');
      if(onDone) onDone(docs);
    }
  });
  document.addEventListener('keydown', e => { if(e.key==='Escape') hide(); });

  return {
    open(chosen, cb){
      onDone = cb; active = 0;
      const groups = {};
      chosen.forEach(j => (groups[j.client] = groups[j.client] || []).push(j));
      const gen = JSON.parse(sessionStorage.getItem('tf_gen') || '[]');
      let no = 47 + gen.length;
      const today = new Date();
      docs = Object.entries(groups).map(([client, js]) => {
        const c = TF.clients.find(x => x.name === client) || { terms:30, trn:'' };
        const sub = js.reduce((a,j)=>a + j.qty*j.rate, 0);
        return { no:'INV-2026-' + String(no++).padStart(4,'0'), client, c, js,
          sub, vat: sub*.05, total: sub*1.05,
          date: fD(today), due: fD(new Date(today.getTime() + c.terms*864e5)), terms: c.terms };
      });
      renderModal();
      requestAnimationFrame(() => requestAnimationFrame(show));
    }
  };
})();
