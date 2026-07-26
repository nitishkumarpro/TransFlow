window.TF = window.TF || {};
TF.fmt = {
  aed: n => 'AED ' + Math.round(n).toLocaleString('en-US'),
  num: n => Math.round(n).toLocaleString('en-US'),
  k:   n => n >= 1000 ? Math.round(n/1000) + 'k' : String(n),
  pct: (n,d=1) => n.toFixed(d) + '%',
  dt:  iso => new Date(iso + 'T12:00:00').toLocaleDateString('en-GB', { day:'2-digit', month:'short' }),
};
