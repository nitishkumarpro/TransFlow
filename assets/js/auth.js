window.TF = window.TF || {};
TF.auth = {
  get(){ try { return JSON.parse(sessionStorage.getItem('tf_auth')); } catch(e){ return null; } },
  login(company, user){
    sessionStorage.setItem('tf_auth', JSON.stringify({ company, user: user || 'HARISH S.', t: Date.now() }));
  },
  logout(){ sessionStorage.removeItem('tf_auth'); location.href = '/'; },
};

/* login-page wiring (no-op on app pages) */
document.addEventListener('DOMContentLoaded', () => {
  const f = document.getElementById('gateForm');
  if(!f) return;
  const sel = document.getElementById('coSel');
  sel.innerHTML = TF.companies.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
  f.addEventListener('submit', e => {
    e.preventDefault();
    const btn = f.querySelector('button');
    TF.auth.login(sel.value, document.getElementById('uid').value.trim().toUpperCase() || 'HARISH S.');
    btn.textContent = 'GATE CLEAR ✓';
    btn.style.background = 'var(--teal)'; btn.style.color = '#fff';
    setTimeout(() => location.href = '/app/dashboard', 550);
  });
});
