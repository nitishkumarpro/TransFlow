window.TF = window.TF || {};
TF.fx = {
  reveal(){
    const els = [...document.querySelectorAll('[data-reveal]:not(.rv)')];
    if(!els.length) return;
    const show = el => el.classList.add('rv');
    if(!('IntersectionObserver' in window)){ els.forEach(show); return; }
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const io = new IntersectionObserver((entries) => entries.forEach(e => {
      if(e.isIntersecting){ show(e.target); io.unobserve(e.target); }
    }), { threshold:.12, rootMargin:'0px 0px -6% 0px' });
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if(r.top < vh && r.bottom > 0) show(el);   /* on screen now → show, no flash */
      else io.observe(el);                        /* below fold → animate on scroll */
    });
    setTimeout(() => els.forEach(show), 1600);    /* ultimate fail-safe */
  },
  counters(){
    const els = [...document.querySelectorAll('[data-count]')];
    if(!els.length) return;
    const run = el => TF.fx._run(el);
    if(!('IntersectionObserver' in window)){ els.forEach(run); return; }
    const vh = window.innerHeight || document.documentElement.clientHeight;
    const io = new IntersectionObserver((entries) => entries.forEach(e => {
      if(e.isIntersecting){ run(e.target); io.unobserve(e.target); }
    }), { threshold:.4 });
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if(r.top < vh && r.bottom > 0) run(el); else io.observe(el);
    });
  },
  _run(el){
    const to = +el.dataset.to, fmt = el.dataset.fmt, dec = +(el.dataset.dec||0);
    const t0 = performance.now(), dur = 1200;
    const step = t => {
      const p = Math.min(1,(t-t0)/dur), e = 1-Math.pow(1-p,3), v = to*e;
      el.textContent = fmt==='aed' ? TF.fmt.aed(v) : fmt==='pct' ? v.toFixed(dec)+'%' : TF.fmt.num(v);
      if(p<1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  },
  clock(el){
    if(!el) return;
    const f = new Intl.DateTimeFormat('en-GB',{ timeZone:'Asia/Dubai', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
    const tick = () => el.textContent = f.format(new Date()) + ' GST';
    tick(); setInterval(tick, 1000);
  },
  ticker(el, items){
    if(!el) return;
    const html = items.map(i => `<span>${i}</span>`).join('');
    el.innerHTML = `<div class="ticker-track">${html}${html}</div>`;
  },
  toast(msg){
    const t = document.createElement('div');
    t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
    setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 400); }, 2800);
  },
};
