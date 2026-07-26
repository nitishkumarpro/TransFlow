window.TF = window.TF || {};
TF.charts = {
  bars(el, { labels, series, h = 230 }){
    const W = 640, P = { l:44, r:6, t:12, b:24 }, iw = W-P.l-P.r, ih = h-P.t-P.b;
    const max  = Math.max(...series.flatMap(s => s.values)) * 1.12;
    const step = Math.ceil(max/4/25000) * 25000, top = step*4;
    const y = v => P.t + ih - (v/top)*ih;
    let g = '';
    for(let i=0;i<=4;i++){
      const v = step*i, yy = y(v);
      g += `<line x1="${P.l}" x2="${W-P.r}" y1="${yy}" y2="${yy}" stroke="var(--line)" ${i?'stroke-dasharray="3 4"':''}/>
            <text x="${P.l-8}" y="${yy+3}" text-anchor="end">${v?TF.fmt.k(v):'0'}</text>`;
    }
    const gw = iw/labels.length, bw = Math.min(24,(gw-18)/series.length);
    let bars = '', lx = '';
    labels.forEach((lb,gi) => {
      const cx = P.l + gi*gw + gw/2;
      series.forEach((s,si) => {
        const x  = cx - (series.length*bw + 4*(series.length-1))/2 + si*(bw+4);
        const yy = y(s.values[gi]), hh = P.t + ih - yy;
        bars += `<rect class="cbar" x="${x}" y="${yy}" width="${bw}" height="${hh}"
                  style="fill:${s.color};--d:${gi*70+si*40}ms">
                  <title>${s.name} · ${lb} — ${TF.fmt.aed(s.values[gi])}</title></rect>`;
      });
      lx += `<text x="${cx}" y="${h-6}" text-anchor="middle">${lb}</text>`;
    });
    el.innerHTML = `<svg class="cht" viewBox="0 0 ${W} ${h}" width="100%">${g}${bars}${lx}</svg>`;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  },
  spark(el, vals, color='var(--acc)', w=130, h=36){
    const mx = Math.max(...vals), mn = Math.min(...vals)*0.92;
    const pts = vals.map((v,i) => [ i/(vals.length-1)*(w-8)+4, h-4-((v-mn)/(mx-mn))*(h-10) ]);
    const line = pts.map(p => p.join(',')).join(' ');
    const last = pts[pts.length-1];
    el.innerHTML = `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">
      <polygon points="${line} ${w-4},${h-2} 4,${h-2}" style="fill:${color};opacity:.12"/>
      <polyline points="${line}" style="stroke:${color}" stroke-width="2" fill="none"/>
      <circle cx="${last[0]}" cy="${last[1]}" r="3" style="fill:${color}"/></svg>`;
  },
  hbars(el, items, { money=true } = {}){
    const mx = Math.max(...items.map(i => i.value), 1);
    el.innerHTML = items.map((it,i) => `
      <div class="hb">
        <div class="hb-t"><span>${it.label}</span><b class="mono">${money?TF.fmt.aed(it.value):it.value}</b></div>
        <div class="hb-tr"><span class="hb-f"
          style="background:${it.color||'var(--teal)'};--w:${(it.value/mx*100).toFixed(1)}%;transition-delay:${i*90}ms"></span></div>
        ${it.sub?`<div class="hb-s mono">${it.sub}</div>`:''}
      </div>`).join('');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('in')));
  },
};
