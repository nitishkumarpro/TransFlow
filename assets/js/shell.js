(function(){
  const auth = TF.auth.get();
  if(!auth){ location.href = '/'; return; }

  const P = d => `<svg viewBox="0 0 24 24">${d}</svg>`;
  const I = {
    gauge:P('<circle cx="12" cy="13" r="8"/><path d="M12 13l3.5-3.5"/>'),
    grid:P('<path d="M3 5h18v14H3zM3 10h18M9 5v14M15 5v14"/>'),
    file:P('<path d="M6 3h9l4 4v14H6zM14 3v5h5"/>'),
    doc:P('<path d="M6 3h12v18H6zM9 8h6M9 12h6M9 16h4"/>'),
    rin:P('<path d="M12 3v10M8 9l4 4 4-4M4 17h16v4H4z"/>'),
    rout:P('<path d="M12 13V3M8 7l4-4 4 4M4 17h16v4H4z"/>'),
    fuel:P('<path d="M12 3s6 7 6 11a6 6 0 0 1-12 0c0-4 6-11 6-11z"/>'),
    pay:P('<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3 3-5 6-5s6 2 6 5M17 8h4M19 6v4"/>'),
    pct:P('<path d="M5 19L19 5"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>'),
    book:P('<path d="M4 5a2 2 0 0 1 2-2h13v18H6a2 2 0 0 1-2-2zM8 3v18"/>'),
    shield:P('<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/>'),
    eye:P('<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/>'),
    users:P('<circle cx="12" cy="8" r="3.5"/><path d="M4 21c0-4 4-6 8-6s8 2 8 6"/>'),
    truck:P('<path d="M2 6h11v10H2zM13 10h5l3 3v3h-8z"/><circle cx="6.5" cy="18.5" r="1.8"/><circle cx="16.5" cy="18.5" r="1.8"/>'),
    id:P('<rect x="3" y="5" width="18" height="14" rx="1"/><circle cx="9" cy="11" r="2"/><path d="M6 16c.5-1.6 1.7-2.4 3-2.4s2.5.8 3 2.4M14.5 10H18M14.5 13H18"/>'),
    tag:P('<path d="M3 12l9-9h9v9l-9 9z"/><circle cx="16" cy="8" r="1.6"/>'),
    rates:P('<path d="M3 5h18v14H3zM3 10h18M9 10v9"/>'),
    route:P('<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18h7a3 3 0 0 0 0-6h-7a3 3 0 0 1 0-6h7"/>'),
    chart:P('<path d="M4 4v16h16M8 16v-4M12 16V9M16 16v-6"/>'),
    tax:P('<path d="M4 21h16M6 18V10M10 18V10M14 18V10M18 18V10M3 10l9-7 9 7"/>'),
    key:P('<circle cx="8" cy="12" r="4"/><path d="M12 12h9M18 12v3M15 12v2"/>'),
    lock:P('<path d="M12 3l7 3v6c0 4-3 7-7 9-4-2-7-5-7-9V6z"/><path d="M9 12l2 2 4-4"/>'),
  };

  /* soon:1 = teaser link (toast instead of navigate). Flip to 0 as pages ship. */
  const NAV = [
    { g:'OVERVIEW', items:[
      { id:'dashboard', t:'Control Tower', h:'/app/dashboard', i:'gauge' }]},
    { g:'OPERATIONS', items:[
      { id:'spreadsheet', t:'Spreadsheet',          h:'/app/operations/spreadsheet', i:'grid' },
      { id:'invoices',    t:'Invoices',             h:'/app/operations/invoices',    i:'file', soon:1 },
      { id:'soa',         t:'Statement of Account', h:'/app/operations/soa',         i:'doc',  soon:1 }]},
    { g:'FINANCE', items:[
      { id:'receivables', t:'Receivables', h:'/app/finance/receivables', i:'rin',  soon:1 },
      { id:'payables',    t:'Payables',    h:'/app/finance/payables',    i:'rout', soon:1 },
      { id:'costs',       t:'Cost Entry',  h:'/app/finance/costs',       i:'fuel', soon:1 },
      { id:'salaries',    t:'Salaries',    h:'/app/finance/salaries',    i:'pay',  soon:1 },
      { id:'commissions', t:'Commissions', h:'/app/finance/commissions', i:'pct',  soon:1 },
      { id:'ledger',      t:'Ledger',      h:'/app/finance/ledger',      i:'book', soon:1 },
      { id:'vat',         t:'VAT',         h:'/app/finance/vat',         i:'shield', soon:1 }]},
    { g:'MANAGEMENT', items:[
      { id:'mgmt', t:'Owner Cockpit', h:'/app/management/overview', i:'eye', soon:1 }]},
    { g:'MASTERS', items:[
      { id:'clients',   t:'Clients',          h:'/app/masters/clients',   i:'users', soon:1 },
      { id:'vehicles',  t:'Vehicles',         h:'/app/masters/vehicles',  i:'truck', soon:1 },
      { id:'employees', t:'Employees',        h:'/app/masters/employees', i:'id',    soon:1 },
      { id:'vendors',   t:'Vendors',          h:'/app/masters/vendors',   i:'tag',   soon:1 },
      { id:'rates',     t:'Rates',            h:'/app/masters/rates',     i:'rates', soon:1 },
      { id:'routes',    t:'Routes (From/To)', h:'/app/masters/routes',    i:'route', soon:1 }]},
    { g:'REPORTS', items:[
      { id:'vpl',  t:'Vehicle P&L',           h:'/app/reports/vehicle-pl',           i:'chart',  soon:1 },
      { id:'rvc',  t:'Revenue vs Cost',       h:'/app/reports/revenue-vs-cost',      i:'chart',  soon:1 },
      { id:'crev', t:'Client Revenue',        h:'/app/reports/client-revenue',       i:'chart',  soon:1 },
      { id:'salc', t:'Salaries & Commissions',h:'/app/reports/salaries-commissions', i:'pay',    soon:1 },
      { id:'vatr', t:'VAT Report',            h:'/app/reports/vat-report',           i:'shield', soon:1 },
      { id:'ctax', t:'Corporate Tax',         h:'/app/reports/corporate-tax',        i:'tax',    soon:1 }]},
    { g:'ADMIN', items:[
      { id:'users', t:'Users',       h:'/app/admin/users',       i:'key',  soon:1 },
      { id:'perms', t:'Permissions', h:'/app/admin/permissions', i:'lock', soon:1 }]},
  ];

  const active = document.body.dataset.active || 'dashboard';
  const navHTML = NAV.map(sec =>
    `<div class="nvg">${sec.g}</div>` + sec.items.map(it =>
      `<a class="nv${it.id===active?' on':''}${it.soon?' soon':''}" href="${it.h}"${it.soon?' data-soon':''}>
        ${I[it.i]}<span>${it.t}</span>${it.soon?'<em class="nv-s">PILOT</em>':''}</a>`).join('')).join('');

  const side = `<aside class="side" id="side">
    <a class="brand" href="/app/dashboard">
      <svg viewBox="0 0 24 24" fill="none"><path d="M3 7h12l6 5-6 5H3z" fill="#FF5A1F" stroke="#0C161B" stroke-width="1.2"/><path d="M7 10.5h6M7 13.5h4" stroke="#0C161B" stroke-width="1.4"/></svg>
      <span><b>TRANSFLOW</b><small>ERP · UAE FREIGHT</small></span>
    </a>
    <div class="hazard"></div>
    <nav>${navHTML}</nav>
    <div class="side-f">SURVEY BUILD ${TF.meta.v}<br>${TF.meta.built}</div>
  </aside>`;

  const top = `<header class="top">
    <button class="menu-btn" id="menuBtn" aria-label="Menu">
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M3 12h18M3 18h12"/></svg>
    </button>
    <div class="co-switch"><label>COMPANY</label>
      <select id="coSel">${TF.companies.map((c,i)=>`<option${i?' disabled':''}>${c.name}</option>`).join('')}</select>
    </div>
    <div class="top-r">
      <span class="live"><i></i>LIVE</span>
      <span class="clock mono" id="gstClock">--:--:--</span>
      <span class="uchip"><b>${auth.user}</b><small>SUPER ADMIN</small></span>
      <button class="out" id="logoutBtn">EXIT</button>
    </div>
  </header>`;

  const page = document.getElementById('page');
  const layout = document.createElement('div'); layout.className = 'layout';
  const main = document.createElement('div'); main.className = 'main';
  page.parentNode.insertBefore(layout, page);
  layout.insertAdjacentHTML('afterbegin', side);
  layout.appendChild(main);
  main.insertAdjacentHTML('afterbegin', top);
  main.appendChild(page);
  main.insertAdjacentHTML('beforeend',
    `<footer class="stamp mono">${TF.meta.product} — SURVEY BUILD ${TF.meta.v} · ${TF.meta.built} · DATA SET: ALNOOR-01 · FIGURES ILLUSTRATIVE — NOT A TAX DOCUMENT</footer>`);
  document.body.insertAdjacentHTML('beforeend',
    `<div class="scrim" id="scrim"></div>
     <div class="demo-badge"><span>SURVEY BUILD ${TF.meta.v}</span><button id="resetBtn">↺ RESET</button></div>`);

  /* wiring */
  TF.fx.clock(document.getElementById('gstClock'));
  document.querySelectorAll('[data-soon]').forEach(a => a.addEventListener('click', e => {
    e.preventDefault();
    TF.fx.toast('🔒 ' + a.querySelector('span').textContent + ' — included in the pilot build · SEP 2026');
  }));
  document.getElementById('logoutBtn').addEventListener('click', () => TF.auth.logout());
  document.getElementById('resetBtn').addEventListener('click', () => { sessionStorage.clear(); location.href = '/'; });
  document.getElementById('menuBtn').addEventListener('click', () => document.body.classList.toggle('side-open'));
  document.getElementById('scrim').addEventListener('click', () => document.body.classList.remove('side-open'));
  document.getElementById('coSel').addEventListener('change', e =>
    TF.fx.toast('MULTI-TENANT DEMO — ' + e.target.value.toUpperCase() + ' loads its own data in the pilot build'));

  /* safety net — content must NEVER stay invisible, even if a page's own script errors */
  TF.fx.reveal();
  TF.fx.counters();
})();
