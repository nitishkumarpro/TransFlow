/* TRANSFLOW — receivables / collections cockpit */
(function(){
  const queueEl = document.getElementById('queue');
  if(!queueEl) return;
  const $ = id => document.getElementById(id);

  const BANK = 'Emirates NBD\nIBAN AE07 0331 2345 6789 0000 4521';
  const CONTACTS = {
    'Gulf Cement Co.':['Khalid Al Mansoori','+971 50 734 2210'],
    'Emirates Steel':['Ravi Menon','+971 50 662 8841'],
    'Al Ghurair Foods':['Sara Haddad','+971 50 519 3374'],
    'RAK Ceramics':['Ahmed Raza','+971 50 907 5518'],
    'Falcon Pack':['Lina Farouk','+971 50 288 6402'],
    'Emaar Construction':['Vikram Singh','+971 50 445 7789'],
    'Masafi Trading':['Juma Al Kaabi','+971 50 133 9026'],
  };
  const contactFor = n => { const c = CONTACTS[n] || ['Accounts Dept','+971 50 000 0000'];
    return { name:c[0], phone:c[1], email:'accounts@' + n.toLowerCase().replace(/[^a-z]/g,'') + '.ae' }; };

  const today = () => { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate(), 12,0,0); };
  const todayISO = () => { const n = new Date(); return n.getFullYear()+'-'+String(n.getMonth()+1).padStart(2,'0')+'-'+String(n.getDate()).padStart(2,'0'); };
  const parseD = s => { const p = String(s).slice(0,10).split('-').map(Number); return new Date(p[0], p[1]-1, p[2], 12,0,0); };
  const load = (k,fb) => { try { const v = JSON.parse(sessionStorage.getItem(k)); return v==null?fb:v; } catch(e){ return fb; } };

  let state = load('tf_chase', {});
  let recovered = load('tf_recovered', []);
  const saveState = () => sessionStorage.setItem('tf_chase', JSON.stringify(state));
  const saveRec = () => sessionStorage.setItem('tf_recovered', JSON.stringify(recovered));

  /* view-models from the live AR engine, or a static fallback */
  function vmList(){
    if(window.TF && TF.ar) return TF.ar.unified();
    const T = today();
    return (TF.invoices||[]).map(v => {
      const due = parseD(v.due), dpd = Math.round((T-due)/864e5);
      const paid = v.st==='paid' ? v.amt : (v.st==='partial' ? 40000 : 0);
      return { no:v.no, client:v.client, dateISO:v.date, dueISO:v.due, amt:v.amt, paid,
               outstanding:Math.max(0, v.amt-paid), effSt:v.st, daysPastDue:dpd, fresh:false };
    });
  }

  const tier = d => d>60 ? { label:'CRITICAL', act:'FINAL NOTICE · HOLD FUTURE LOADS', cls:'t4' }
                  : d>30 ? { label:'VERY HOT',  act:'FIRM REMINDER · CALL TODAY',      cls:'t3' }
                  : d>15 ? { label:'HOT',        act:'PHONE CALL + EMAIL',              cls:'t2' }
                  :        { label:'WARM',        act:'FRIENDLY REMINDER EMAIL',         cls:'t1' };

  const promiseChip = v => {
    const s = state[v.no]; if(!s || !s.promise) return '';
    return (parseD(s.promise) < today() && v.outstanding>0)
      ? `<span class="flag broken">⚠ PROMISE BROKEN · WAS ${TF.fmt.dt(s.promise)}</span>`
      : `<span class="flag promise">🤝 PROMISED BY ${TF.fmt.dt(s.promise)}</span>`;
  };
  const lastChip = v => {
    const s = state[v.no];
    return (!s || !s.last) ? `<span class="flag never">NO CONTACT LOGGED</span>`
                           : `<span class="flag last">↻ ${s.last.action.toUpperCase()} · ${TF.fmt.dt(s.last.date)}</span>`;
  };

  function cardHTML(v, i){
    const t = tier(v.daysPastDue), c = contactFor(v.client);
    return `<div class="chase ${t.cls}" data-no="${v.no}" style="--i:${Math.min(i,10)}">
      <div class="chase-heat"><span class="days" data-to="${v.daysPastDue}">0</span><small>DAYS</small></div>
      <div class="chase-body">
        <div class="chase-top">
          <b class="client">${v.client.toUpperCase()}</b>
          <span class="inv mono">${v.no}</span>
          <span class="amt mono">${TF.fmt.aed(v.outstanding)}</span>
        </div>
        <div class="chase-meta mono">DUE ${TF.fmt.dt(v.dueISO)} · ${c.name} · ${c.phone}</div>
        <div class="chase-flags">
          <span class="flag tier">${t.label} · ${t.act}</span>${promiseChip(v)}${lastChip(v)}
        </div>
      </div>
      <div class="chase-acts">
        <button data-act="call">📞 LOG</button>
        <button data-act="rem">✉ REMIND</button>
        <button data-act="wa">💬 WA</button>
        <button data-act="paid" class="pay">✓ PAID</button>
      </div>
    </div>`;
  }

  let overdue = [], dueSoon = [];
  function compute(){
    const list = vmList();
    overdue = list.filter(v => v.outstanding>0 && v.daysPastDue>0)
                  .sort((a,b) => b.daysPastDue-a.daysPastDue || b.outstanding-a.outstanding);
    dueSoon = list.filter(v => v.outstanding>0 && v.daysPastDue<=0 && v.daysPastDue>=-7)
                  .sort((a,b) => a.dueISO < b.dueISO ? -1 : 1);
  }

  function countUp(el, to, fmt){
    if(!el) return;
    const t0 = performance.now(), dur = 950;
    const step = t => { const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3), val = to*e;
      el.textContent = fmt==='aed' ? TF.fmt.aed(val) : TF.fmt.num(val);
      if(p<1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function render(){
    compute();
    queueEl.innerHTML = overdue.length ? overdue.map(cardHTML).join('')
      : `<div class="q-empty">🎉 NOTHING OVERDUE — EVERY ACCOUNT IS CURRENT. GO HAVE A KARAK.</div>`;

    $('dueSoon').innerHTML = dueSoon.length ? dueSoon.map((v,i) => `
      <div class="soon-row" data-no="${v.no}" style="--i:${i}">
        <span class="soon-due mono">${v.daysPastDue===0 ? 'DUE TODAY' : 'DUE IN '+(-v.daysPastDue)+'D'}</span>
        <b>${v.client}</b><span class="mono" style="color:var(--mut)">${v.no}</span>
        <span class="amt mono" style="margin-left:auto">${TF.fmt.aed(v.outstanding)}</span>
        <button class="soon-rem" data-act="rem">✉ NUDGE</button>
      </div>`).join('')
      : `<div class="q-empty">NOTHING DUE IN THE NEXT 7 DAYS.</div>`;

    const toCollect = overdue.reduce((a,v)=>a+v.outstanding, 0);
    const promised  = overdue.filter(v=>state[v.no]&&state[v.no].promise).reduce((a,v)=>a+v.outstanding, 0);
    countUp($('mCollect'), toCollect, 'aed');
    countUp($('mAccounts'), overdue.length, 'num');
    countUp($('mOldest'), overdue.length ? overdue[0].daysPastDue : 0, 'num');
    countUp($('mPromised'), promised, 'aed');
    countUp($('mRec'), recovered.reduce((a,r)=>a+r.amt, 0), 'aed');

    renderCallList(); renderPromises(); renderTicker();
    queueEl.querySelectorAll('.days').forEach(el => countUp(el, +el.dataset.to, 'num'));
  }

  function renderCallList(){
    $('callList').innerHTML = overdue.slice(0,4).map((v,i) => `
      <div class="call-row" data-no="${v.no}">
        <span class="rank">${i+1}</span>
        <div class="call-who"><b>${v.client}</b><small class="mono">${v.daysPastDue}D · ${TF.fmt.aed(v.outstanding)}</small></div>
        <button class="call-go" data-act="call">📞</button>
      </div>`).join('') || `<div class="q-empty">NO URGENT CALLS. NICE.</div>`;
  }

  function renderPromises(){
    const rows = overdue.filter(v => state[v.no] && state[v.no].promise);
    $('promises').innerHTML = rows.length ? rows.map(v => {
      const broken = parseD(state[v.no].promise) < today() && v.outstanding>0;
      return `<div class="pr-row ${broken?'broken':''}">
        <div><b>${v.client}</b><small class="mono">${TF.fmt.aed(v.outstanding)}</small></div>
        <span class="mono pr-date">${broken?'⚠ WAS ':'BY '}${TF.fmt.dt(state[v.no].promise)}</span>
      </div>`;
    }).join('') : `<div class="q-empty">NO PROMISES LOGGED YET.<br>LOCK ONE IN DURING A CALL.</div>`;
  }

  function renderTicker(){
    const ev = [];
    recovered.slice(-2).forEach(r => ev.push(`<span class="g">💰 RECOVERED ${TF.fmt.aed(r.amt)} · ${r.client.toUpperCase()}</span>`));
    overdue.filter(v => state[v.no]&&state[v.no].promise&&parseD(state[v.no].promise)<today())
           .forEach(v => ev.push(`<span><b>⚠ BROKEN PROMISE</b> · ${v.client.toUpperCase()}</span>`));
    overdue.slice(0,3).forEach(v => ev.push(`<span><b>${v.client.toUpperCase()}</b> ${v.daysPastDue}D OVERDUE · ${TF.fmt.aed(v.outstanding)}</span>`));
    const calls = Object.values(state).filter(s => s.last && s.last.date===todayISO()).length;
    if(calls) ev.push(`<span class="g">📞 ${calls} CHASE${calls>1?'S':''} LOGGED TODAY</span>`);
    if(!ev.length) ev.push('<span>COLLECTIONS SYNCED</span> · ALNOOR-01 · LIVE');
    TF.fx.ticker($('btick'), ev);
  }

  /* ---- modals ---- */
  let cur = null, channel = 'wa';
  const findVM = no => vmList().find(v => v.no===no);

  function openLog(no){
    cur = no; const v = findVM(no);
    $('logTitle').textContent = no + (v ? ' · ' + v.client : '');
    $('logNote').value = ''; $('logPromise').value = ''; $('logAct').selectedIndex = 0;
    $('logOvl').classList.add('show');
  }
  function openRem(no, ch){
    cur = no; channel = ch || 'wa'; const v = findVM(no); if(!v) return;
    $('remTitle').textContent = no + ' · ' + v.client;
    setChannel(v); $('remOvl').classList.add('show');
  }
  function reminderText(v, ch){
    const c = contactFor(v.client), due = TF.fmt.dt(v.dueISO), days = v.daysPastDue;
    const lead = `This is Harish from ${TF.company.name}. I hope you are well.\n\nOur records show invoice ${v.no} for ${TF.fmt.aed(v.outstanding)} was due on ${due} and is now ${days} day${days===1?'':'s'} overdue.`;
    const pay  = `We would be grateful if you could arrange payment at your earliest convenience to:\n\n${BANK}`;
    const close = `If payment has already been made, please disregard this message.\n\nThank you,\nHarish S.\n${TF.company.name}\nTRN ${TF.company.trn}`;
    return `Dear ${c.name},\n\n${lead}\n\n${pay}\n\n${close}`;
  }
  function setChannel(v){
    const c = contactFor(v.client);
    document.querySelectorAll('.chan-b').forEach(b => b.classList.toggle('on', b.dataset.ch===channel));
    const wrap = $('msgWrap'); wrap.classList.toggle('wa', channel==='wa'); wrap.classList.toggle('mail', channel==='mail');
    $('remRecip').textContent = channel==='wa' ? ('TO · ' + c.name + ' · ' + c.phone) : ('TO · ' + c.name + '  <' + c.email + '>');
    $('remSubject').style.display = channel==='mail' ? 'block' : 'none';
    $('remSubject').textContent = 'SUBJECT · Overdue payment reminder — ' + v.no + ' — ' + TF.fmt.aed(v.outstanding);
    $('remMsg').value = reminderText(v, channel);
    updCount();
  }
  const updCount = () => { $('remCount').textContent = $('remMsg').value.length + ' CHARACTERS'; };

  function logChase(no, action, note, promise){
    state[no] = state[no] || { log:[] };
    state[no].last = { action, date:todayISO(), note };
    if(promise) state[no].promise = promise;
    state[no].log.unshift({ action, date:todayISO(), note, promise:promise||null });
    saveState();
  }

  function markPaid(no){
    const v = findVM(no); if(!v) return;
    const paid = load('tf_paid', []); if(!paid.includes(no)){ paid.push(no); sessionStorage.setItem('tf_paid', JSON.stringify(paid)); }
    recovered.push({ no, amt:v.outstanding, client:v.client }); saveRec();
    const card = queueEl.querySelector(`.chase[data-no="${no}"]`);
    if(card){ card.classList.add('clearing'); setTimeout(render, 500); } else render();
    TF.fx.toast('💰 ' + TF.fmt.aed(v.outstanding) + ' RECOVERED FROM ' + v.client.toUpperCase() + ' — WELL DONE');
  }

  /* ---- events ---- */
  document.addEventListener('click', e => {
    const act = e.target.closest('[data-act]');
    const holder = e.target.closest('[data-no]');
    if(act && holder){
      const no = holder.dataset.no, a = act.dataset.act;
      if(a==='call') openLog(no);
      else if(a==='rem') openRem(no, 'mail');
      else if(a==='wa') openRem(no, 'wa');
      else if(a==='paid') markPaid(no);
      return;
    }
    if(e.target.closest('#logClose') || e.target.closest('#logCancel') || e.target.id==='logOvl') $('logOvl').classList.remove('show');
    if(e.target.closest('#remClose') || e.target.id==='remOvl') $('remOvl').classList.remove('show');
    if(e.target.closest('#logSave')){
      const p = $('logPromise').value;
      logChase(cur, $('logAct').value, $('logNote').value.trim(), p || null);
      $('logOvl').classList.remove('show');
      TF.fx.toast('↻ CHASE LOGGED FOR ' + cur + (p ? ' · PROMISE ' + TF.fmt.dt(p) : ''));
      render();
    }
    if(e.target.closest('.chan-b')){ channel = e.target.closest('.chan-b').dataset.ch; const v = findVM(cur); if(v) setChannel(v); }
    if(e.target.closest('#remSend')){
      logChase(cur, channel==='wa' ? 'WhatsApp reminder' : 'Email reminder', 'Reminder sent via ' + (channel==='wa'?'WhatsApp':'email'), null);
      $('remOvl').classList.remove('show');
      TF.fx.toast((channel==='wa'?'💬':'📧') + ' REMINDER SENT FOR ' + cur + ' · LOGGED');
      render();
    }
  });
  document.addEventListener('input', e => { if(e.target.id==='remMsg') updCount(); });
  document.addEventListener('keydown', e => { if(e.key==='Escape'){ $('logOvl').classList.remove('show'); $('remOvl').classList.remove('show'); } });

  render();
})();