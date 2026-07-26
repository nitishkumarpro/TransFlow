/* TRANSFLOW — invoice permalink (self-contained doc renderer + payment) */
(function(){
  const no = new URLSearchParams(location.search).get('no');
  const docsEl = document.getElementById('invDocs'), rail = document.getElementById('rail');
  if(!no){ notFound(); return; }

  const paidSet = () => new Set(JSON.parse(sessionStorage.getItem('tf_paid')||'[]'));
  const setPaid = s => { const a=[...paidSet()]; if(!a.includes(no)){ a.push(no); sessionStorage.setItem('tf_paid',JSON.stringify(a)); } };

  /* ---- find the invoice: raised this session (full doc) or seeded (synthesize) ---- */
  const gen = (JSON.parse(sessionStorage.getItem('tf_gen')||'[]')).find(g => g.no===no);
  const seed = (TF.invoices||[]).find(v => v.no===no);
  if(!gen && !seed){ notFound(); return; }

  const c = (gen && gen.c) || (TF.clients||[]).find(x=>x.name=== (gen?gen.client:seed.client)) || {trn:'—',terms:30};
  const client = gen ? gen.client : seed.client;
  const dateISO = gen ? TF.ar._iso(TF.ar._parse(gen.date)) : seed.date;
  const dueISO  = gen ? TF.ar._iso(TF.ar._parse(gen.due))  : seed.due;
  const total   = gen ? gen.total : seed.amt;
  const sub     = gen ? gen.sub   : Math.round(total - (total - Math.round(total/1.05)));
  const vat     = gen ? gen.vat   : (total - sub);
  const terms   = gen ? gen.terms : c.terms;
  const js = gen && gen.js ? gen.js : synthLines(sub, no);

  const paid = paidSet().has(no) || seed && seed.st==='paid';

  /* ---------- doc template (verbatim twin of the modal's, shares invoice.css) ---------- */
  const W1=['','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE','TEN','ELEVEN','TWELVE','THIRTEEN','FOURTEEN','FIFTEEN','SIXTEEN','SEVENTEEN','EIGHTEEN','NINETEEN'];
  const W10=['','','TWENTY','THIRTY','FORTY','FIFTY','SIXTY','SEVENTY','EIGHTY','NINETY'];
  const two=n=>n<20?W1[n]:W10[(n/10)|0]+(n%10?'-'+W1[n%10]:'');
  const three=n=>{const h=(n/100)|0,r=n%100;return (h?W1[h]+' HUNDRED'+(r?' ':''):'')+(r?two(r):'');};
  function words(n){n=Math.round(n);if(!n)return'ZERO';const m=(n/1e6)|0,t=((n%1e6)/1000)|0,r=n%1000;return((m?three(m)+' MILLION ':'')+(t?three(t)+' THOUSAND ':'')+(r?three(r):'')).trim();}
  function qrSVG(seed){let h=2166136261>>>0;for(const ch of seed){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
    const rnd=()=>{h^=h<<13;h>>>=0;h^=h>>>17;h^=h<<5;h>>>=0;return h/4294967296;};
    const N=25,s=4,cells=[];const inF=(r,c)=>(r<7&&c<7)||(r<7&&c>=N-7)||(r>=N-7&&c<7);
    for(let r=0;r<N;r++)for(let c=0;c<N;c++)if(!inF(r,c)&&rnd()>.5)cells.push(`<rect x="${c*s}" y="${r*s}" width="${s}" height="${s}"/>`);
    const F=(r0,c0)=>`<rect x="${c0*s}" y="${r0*s}" width="${7*s}" height="${7*s}"/><rect x="${(c0+1)*s}" y="${(r0+1)*s}" width="${5*s}" height="${5*s}" fill="#fff"/><rect x="${(c0+2)*s}" y="${(r0+2)*s}" width="${3*s}" height="${3*s}"/>`;
    return `<svg viewBox="0 0 ${N*s} ${N*s}" class="qr" fill="#0C161B"><rect width="${N*s}" height="${N*s}" fill="#fff"/>${F(0,0)}${F(0,N-7)}${F(N-7,0)}${cells.join('')}</svg>`;}
  const fD = d => d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'numeric'}).toUpperCase();
  const logo = `<svg viewBox="0 0 24 24" fill="none"><path d="M3 7h12l6 5-6 5H3z" fill="#FF5A1F" stroke="#0C161B" stroke-width="1.2"/><path d="M7 10.5h6M7 13.5h4" stroke="#0C161B" stroke-width="1.4"/></svg>`;

  const rows = js.map((j,k)=>`<tr>
    <td class="r">${k+1}</td>
    <td>${j.cargo||j.desc||'Transport charges'}<span class="sub">${(j.from||'').toUpperCase()}${j.to?' → '+j.to.toUpperCase():''}${j.id?' · '+j.id:''}</span></td>
    <td class="r">${j.veh||'—'}</td><td class="r">${j.qty}</td>
    <td class="r">${TF.fmt.aed(j.rate)}</td><td class="r"><b>${TF.fmt.aed(j.qty*j.rate)}</b></td></tr>`).join('');

  docsEl.innerHTML = `<article class="inv-doc on">
    <div class="hazard inv-hz"></div>
    ${paid?'<div class="paid-stamp">PAID</div>':''}
    <header class="inv-head">
      <div class="inv-brand">${logo}<div><b>TRANSFLOW</b><small>${TF.company.name.toUpperCase()} · DUBAI, UAE</small></div></div>
      <div class="inv-ttl"><span class="display">TAX INVOICE</span><span class="mono">NO. ${no}</span></div>
    </header>
    <section class="inv-meta">
      <div><label>BILL TO</label><b>${client.toUpperCase()}</b><span>TRN ${c.trn||'—'}</span><span>UNITED ARAB EMIRATES</span></div>
      <div><label>ISSUED</label><b>${fD(TF.ar._parse(dateISO))}</b><span>BY HARISH S.</span></div>
      <div><label>DUE</label><b>${fD(TF.ar._parse(dueISO))}</b><span>${terms} DAYS</span></div>
      <div><label>CURRENCY</label><b>AED</b><span>VAT @ 5%</span></div>
    </section>
    <table class="inv-tbl"><thead><tr><th>#</th><th>DESCRIPTION</th><th class="r">VEHICLE</th><th class="r">QTY</th><th class="r">RATE</th><th class="r">AMOUNT</th></tr></thead>
      <tbody>${rows}</tbody></table>
    <section class="inv-tot">
      <div class="inv-words">AMOUNT IN WORDS — UAE DIRHAMS ${words(total)} ONLY<br><br>RATES EXCLUSIVE OF VAT · GOODS RECEIVED IN GOOD ORDER UNLESS NOTED WITHIN 48 HRS</div>
      <table class="inv-sums">
        <tr><td>SUBTOTAL</td><td class="r">${TF.fmt.aed(sub)}</td></tr>
        <tr><td>VAT (5%)</td><td class="r">${TF.fmt.aed(vat)}</td></tr>
        <tr class="grand"><td>TOTAL DUE</td><td class="r">${TF.fmt.aed(total)}</td></tr>
      </table>
    </section>
    <div class="inv-qrbox">${qrSVG(no)}<small>FTA-COMPLIANT E-INVOICE<br>SCAN TO VERIFY · FEDERAL TAX AUTHORITY</small></div>
    <footer class="inv-bot">
      <div><label>BANK</label><span>EMIRATES NBD · AE07 0331 2345 6789 0000 4521</span></div>
      <div><label>SELLER TRN</label><span>${TF.company.trn}</span></div>
      <span class="sig">RECEIVED BY ____________________</span>
    </footer>
    <div class="inv-wm">TRANSFLOW</div>
  </article>`;

  /* ---------- right rail ---------- */
  const vm = TF.ar.unified().find(v=>v.no===no) || { effSt: paid?'paid':'open', outstanding: paid?0:total, daysPastDue:0 };
  const due = TF.ar._parse(dueISO), T = TF.ar._today();
  const raised = TF.ar._parse(dateISO);
  document.getElementById('crumbNo').textContent = no;
  document.title = no + ' · ' + client + ' — TRANSFLOW';
  rail.innerHTML = `
    <div class="card"><div class="card-b">
      <div class="rail-amt ${paid?'paid':''}"><span>${paid?'SETTLED':'BALANCE DUE'}</span><b>${TF.fmt.aed(vm.outstanding)}</b></div>
      <div class="rail-row"><span>Client</span><b>${client}</b></div>
      <div class="rail-row"><span>Issued</span><b>${fD(raised)}</b></div>
      <div class="rail-row"><span>Due</span><b>${fD(due)}</b></div>
      <div class="rail-row"><span>Subtotal</span><b>${TF.fmt.aed(sub)}</b></div>
      <div class="rail-row"><span>VAT 5%</span><b>${TF.fmt.aed(vat)}</b></div>
    </div></div>
    <div class="card"><div class="card-h"><h3 style="font-size:15px">LIFECYCLE</h3></div><div class="card-b">
      <div class="timeline">
        <div class="tl done"><small>${fD(raised)}</small>Invoice raised</div>
        <div class="tl ${paid?'done':(due<T?'bad':'now')}"><small>${fD(due)}</small>${paid?'Payment received':(due<T?'Now '+vm.daysPastDue+' days past due':'Due date')}</div>
        ${paid?'<div class="tl done"><small>'+fD(T)+'</small>Marked settled in TransFlow</div>':''}
      </div>
    </div></div>`;

  /* ---------- actions ---------- */
  const payBtn = document.getElementById('vPay');
  if(paid){ payBtn.textContent = '✓ SETTLED'; payBtn.disabled = true; payBtn.style.opacity=.5; }
  payBtn.addEventListener('click', () => { setPaid(); TF.fx.toast('✓ ' + no + ' MARKED PAID — LEDGER & SOA UPDATED'); location.reload(); });
  document.getElementById('vPrint').addEventListener('click', () => window.print());
  document.getElementById('vMail').addEventListener('click', () => TF.fx.toast('📧 ' + no + ' PDF SENT TO ACCOUNTS@' + client.toUpperCase().replace(/[^A-Z]/g,'') + '.AE'));
  document.getElementById('vWa').addEventListener('click', () => TF.fx.toast('💬 ' + no + ' PDF SENT VIA WHATSAPP · +971 50 XXX XXXX'));
  document.getElementById('vCopy').addEventListener('click', () => {
    const url = location.href;
    if(navigator.clipboard) navigator.clipboard.writeText(url).then(()=>TF.fx.toast('⧉ LINK COPIED — PASTE IT IN WHATSAPP TO A PROSPECT')).catch(()=>TF.fx.toast('⧉ ' + url));
    else TF.fx.toast('⧉ ' + url);
  });
  window.addEventListener('scroll', () => document.getElementById('vbar').classList.toggle('solid', window.scrollY>8));

  /* ---------- helpers ---------- */
  function synthLines(sub, seed){
    const pool=[{cargo:'2×40ft Containers',from:'Jebel Ali Port',to:'Khalifa Port',veh:'B-45823'},
      {cargo:'Steel Coils 28T',from:'Hamriyah FZ',to:'Abu Dhabi',veh:'B-78214'},
      {cargo:'Packaged Goods',from:'Al Quoz',to:'Al Ain',veh:'C-33907'},
      {cargo:'Site Materials',from:'Dubai Inv. Park',to:'Downtown Dubai',veh:'C-67230'}];
    let h=2166136261>>>0; for(const c of seed){h^=c.charCodeAt(0);h=Math.imul(h,16777619)>>>0;}
    const n=1+(h%3), w=[]; let s=0; for(let i=0;i<n;i++){const x=1+((h>>(i*2))&3); w.push(x); s+=x;}
    const lines=[]; let used=0;
    for(let i=0;i<n;i++){ const amt = i<n-1 ? Math.round(sub*w[i]/s/50)*50 : (sub-used); used+=amt;
      const p=pool[(h+i)%pool.length]; lines.push({cargo:p.cargo,from:p.from,to:p.to,veh:p.veh,qty:1,rate:amt}); }
    return lines;
  }
  function notFound(){
    docsEl.innerHTML = `<div style="text-align:center;padding:80px 20px">
      <p class="kicker" style="justify-content:center">WAYBILL NOT FOUND</p>
      <p class="display" style="font-size:64px;font-weight:800;line-height:.95;margin:8px 0">NO SUCH <span style="color:var(--acc)">INVOICE</span></p>
      <p style="color:var(--mut);margin-bottom:20px">${no||'(none)'} is not on the ledger.</p>
      <a class="btn btn-acc" href="/app/operations/invoices">← BACK TO LEDGER</a></div>`;
    rail.innerHTML='';
  }
})();