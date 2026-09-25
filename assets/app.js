/* ===== English Workspace — shared UI ===== */
(() => {
  const B = document.documentElement.dataset.base || '';
  const PAGES = [
    ['index.html', 'Home', '🏠'],
    ['lessons.html', 'Lessons', '📘'],
    ['vocabulary.html', 'Vocabulary', '🔤'],
    ['grammar.html', 'Grammar', '🧩'],
    ['speaking.html', 'Speaking', '🗣'],
    ['links.html', 'Links', '🔗'],
    ['homework.html', 'Homework', '✅']
  ];
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch {} }
  };

  /* ---- theme ---- */
  const savedTheme = ls.get('lera:theme');
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;
  window.ewToggleTheme = () => {
    const cur = document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    ls.set('lera:theme', next);
    paintTheme();
  };
  function paintTheme() {
    const btn = document.querySelector('.theme-btn');
    if (!btn) return;
    const dark = (document.documentElement.dataset.theme
      || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')) === 'dark';
    btn.textContent = dark ? '☀' : '☾';
    btn.setAttribute('aria-label', dark ? 'Switch to light theme' : 'Switch to dark theme');
  }

  /* ---- Ukrainian hints ---- */
  if (ls.get('lera:tr') === 'on') document.documentElement.dataset.tr = 'on';
  window.ewToggleTr = () => {
    const on = document.documentElement.dataset.tr === 'on';
    if (on) delete document.documentElement.dataset.tr;
    else document.documentElement.dataset.tr = 'on';
    ls.set('lera:tr', on ? 'off' : 'on');
    paintTr();
  };
  function paintTr() {
    const btn = document.querySelector('.tr-btn');
    if (!btn) return;
    const on = document.documentElement.dataset.tr === 'on';
    btn.setAttribute('aria-pressed', String(on));
    btn.title = on ? 'Hide Ukrainian translations' : 'Show Ukrainian translations';
  }

  /* ---- chrome ---- */
  const here = location.pathname.split('/').pop() || 'index.html';
  const bar = document.createElement('header');
  bar.className = 'topbar';
  bar.innerHTML = `<div class="topbar-in">
    <a class="brand" href="${B}index.html"><span class="dot">EN</span> Lera's English</a>
    <nav class="nav">${PAGES.map(([h, t, e]) =>
      `<a href="${B}${h}"${h === here ? ' aria-current="page"' : ''}><span aria-hidden="true">${e}</span> ${t}</a>`).join('')}</nav>
    <div class="topbar-actions">
      <button class="tr-btn" onclick="ewToggleTr()" type="button" aria-pressed="false">UA</button>
      <button class="theme-btn" onclick="ewToggleTheme()" type="button">☾</button>
    </div>
  </div>`;
  document.body.prepend(bar);
  paintTheme(); paintTr();

  document.addEventListener('DOMContentLoaded', async () => {
    const wrap = document.querySelector('.wrap');
    if (!wrap || document.querySelector('.footer')) return;
    const f = document.createElement('footer');
    f.className = 'footer';
    f.innerHTML = `<span>Lera's English · materials for our lessons</span>
      <span class="sync" id="ew-sync">saved on this device</span>`;
    wrap.appendChild(f);
    try {
      await EW.config();
      if (EW.connected()) { const s = document.getElementById('ew-sync'); s.textContent = 'syncing'; s.classList.add('on'); }
    } catch {}
  });

  /* ---- helpers ---- */
  window.esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  window.fmtDate = iso => {
    if (!iso) return '';
    const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  };
  window.uk = s => s ? `<span class="uk-tr">${window.esc(s)}</span>` : '';
})();
