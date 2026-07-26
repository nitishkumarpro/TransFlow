window.TF = window.TF || {};
TF.fx = {
  reveal(){
    const io = new IntersectionObserver(es => es.forEach(e => {
      if(e.isIntersecting){ e.target.classList.add('rv'); io.unobserve(e.target); }
    }), { threshold:.12 });
    document.querySelectorAll('[data-reveal]').forEach(el => io.observe(el));
  },
  counters(){
    const io = new IntersectionObserver(es => es.forEach(e => {
      if(e.isIntersecting){ TF.fx._run(e.target); io.unobserve(e.target); }
    }), { threshold:.4 });
    document.querySelectorAll('[data-count]').forEach(el => io.observe(el));
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
    const f = new Intl.DateTimeFormat('en-GB',{ timeZone:'Asia/Dubai', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:false });
    const tick = () => el.textContent = f.format(new Date()) + ' GST';
    tick(); setInterval(tick, 1000);
  },
  ticker(el, items){
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
