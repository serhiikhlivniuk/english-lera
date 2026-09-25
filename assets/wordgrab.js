/* ===== Select a word → save it to "My words" =====
   Works on every page, including the lesson worksheets. The student only
   captures the word and the sentence it came from; the tutor turns it into a
   proper dictionary entry later. */
(() => {
  const KEY = 'vocab:mine';
  const MAX_WORDS = 4, MAX_LEN = 42;

  const css = `
  .wg-btn{position:absolute;z-index:9999;transform:translate(-50%,-100%);
    background:#6C4CF1;color:#fff;border:0;border-radius:999px;padding:8px 14px;
    font:600 13px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    box-shadow:0 6px 20px -6px rgba(0,0,0,.45);cursor:pointer;white-space:nowrap}
  .wg-btn:hover{background:#5A3CE0}
  .wg-toast{position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:9999;
    background:#0F8F68;color:#fff;border-radius:999px;padding:10px 18px;
    font:600 14px/1 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    box-shadow:0 10px 30px -10px rgba(0,0,0,.5);animation:wg-in .18s ease}
  .wg-toast.warn{background:#C77700}
  @keyframes wg-in{from{opacity:0;transform:translate(-50%,8px)}to{opacity:1;transform:translate(-50%,0)}}
  @media print{.wg-btn,.wg-toast{display:none}}`;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  let btn = null;
  const kill = () => { if (btn) { btn.remove(); btn = null; } };


  // a half-selected word is almost always a mis-drag: grow the range to whole words
  function snapToWords(range) {
    try {
      const L = /[\p{L}'’-]/u;
      const sc = range.startContainer, ec = range.endContainer;
      if (sc.nodeType === 3) {
        let i = range.startOffset;
        while (i > 0 && L.test(sc.textContent[i - 1])) i--;
        range.setStart(sc, i);
      }
      if (ec.nodeType === 3) {
        let j = range.endOffset;
        const t = ec.textContent;
        while (j < t.length && L.test(t[j])) j++;
        range.setEnd(ec, j);
      }
    } catch { /* leave the range as it is */ }
  }

  function sentenceAround(node, word) {
    const text = (node && node.textContent) || '';
    const parts = text.split(/(?<=[.!?])\s+/);
    const hit = parts.find(p => p.toLowerCase().includes(word.toLowerCase()));
    const s = (hit || text).trim().replace(/\s+/g, ' ');
    return s.length > 180 ? s.slice(0, 177) + '…' : s;
  }

  function toast(msg, warn) {
    const t = document.createElement('div');
    t.className = 'wg-toast' + (warn ? ' warn' : '');
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 2200);
  }

  function save(word, context) {
    const mine = EW.get(KEY, []);
    if (mine.some(x => x.word.toLowerCase() === word.toLowerCase())) {
      toast('“' + word + '” is already in your list', true);
      return;
    }
    mine.push({
      word,
      context,
      source: (document.title || '').replace(/ · Lera's English$/, ''),
      at: new Date().toISOString()
    });
    EW.set(KEY, mine);
    EW.push('word', { word, source: document.title });
    toast('“' + word + '” saved to My words');
    document.dispatchEvent(new CustomEvent('ew:words-changed'));
  }

  document.addEventListener('selectionchange', () => { if (!btn) return; });

  function onSelect(e) {
    if (e.target.closest && e.target.closest('.wg-btn')) return;
    setTimeout(() => {
      const sel = window.getSelection();
      const raw = sel ? String(sel).trim() : '';
      kill();
      if (!raw) return;
      let word = raw.replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, '');
      if (!word || word.length > MAX_LEN) return;
      if (word.split(/\s+/).length > MAX_WORDS) return;
      if (!/\p{L}/u.test(word)) return;
      // skip anything the student is typing into
      if (e.target.matches && e.target.matches('input, textarea, select')) return;

      const range = sel.getRangeAt(0);
      snapToWords(range);
      const snapped = String(range).trim().replace(/^[^\p{L}]+|[^\p{L}'’-]+$/gu, '');
      if (snapped && snapped.length <= MAX_LEN && snapped.split(/\s+/).length <= MAX_WORDS) word = snapped;
      const r = range.getBoundingClientRect();
      const ctx = sentenceAround(range.commonAncestorContainer.parentElement || range.commonAncestorContainer, word);

      btn = document.createElement('button');
      btn.className = 'wg-btn';
      btn.type = 'button';
      btn.textContent = '＋ Add to my words';
      btn.style.left = (r.left + r.width / 2 + scrollX) + 'px';
      btn.style.top = (r.top + scrollY - 8) + 'px';
      btn.onclick = ev => { ev.stopPropagation(); save(word, ctx); sel.removeAllRanges(); kill(); };
      document.body.appendChild(btn);
    }, 10);
  }

  document.addEventListener('mouseup', onSelect);
  document.addEventListener('touchend', onSelect);
  document.addEventListener('scroll', kill, true);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') kill(); });

  // make sure the Supabase config is loaded, so a captured word also syncs
  if (window.EW && EW.config) EW.config().catch(() => {});
})();
