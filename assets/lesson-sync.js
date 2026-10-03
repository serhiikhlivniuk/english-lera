/* Mirrors the student's worksheet answers into the shared store (and Supabase, if connected)
   and brings them back: open the lesson on another device and the answers are there.

   What is saved, by field type:
     text / select / textarea  → by id            (b1: "am")
     radio group               → by name, value   (q1: "b")
     True / False buttons      → by data-tf       (r1: "false")
   Answers are merged field by field, so two devices never wipe each other. */
(() => {
  const id = document.currentScript?.dataset.lesson || 'lesson';
  const key = `lesson:${id}:answers`;
  let restoring = false;

  const collect = () => {
    const out = {};
    document.querySelectorAll('input, textarea, select').forEach((el, i) => {
      if (el.type === 'button' || el.type === 'submit') return;
      if (el.type === 'radio') { if (el.checked && el.name) out[el.name] = el.value; return; }
      const k = el.id || el.name || `f${i}`;
      if (el.type === 'checkbox') { if (el.checked) out[k] = true; return; }
      if (el.value.trim() !== '') out[k] = el.value;
    });
    document.querySelectorAll('.tf[data-tf]').forEach(g => {
      const b = g.querySelector('button[aria-pressed="true"]');
      if (b) out[g.dataset.tf] = b.value;
    });
    return out;
  };

  const save = () => {
    const prev = EW.get(key, null) || {};
    const answers = { ...(prev.answers || {}), ...collect() };
    const n = Object.keys(answers).length;
    if (!n) return;
    if (prev.answers && JSON.stringify(prev.answers) === JSON.stringify(answers)) return;
    EW.set(key, { updated: new Date().toISOString(), filled: n, answers });
  };

  /* put saved answers back into empty fields; the page's own script stores them */
  const restore = () => {
    const a = (EW.get(key, null) || {}).answers || {};
    restoring = true;
    for (const [k, v] of Object.entries(a)) {
      if (typeof v !== 'string' && v !== true) continue;
      const tf = document.querySelector(`.tf[data-tf="${CSS.escape(k)}"]`);
      if (tf) {
        if (!tf.querySelector('button[aria-pressed="true"]')) {
          const b = tf.querySelector(`button[value="${CSS.escape(v)}"]`);
          if (b) b.click();
        }
        continue;
      }
      const radios = document.querySelectorAll(`input[type=radio][name="${CSS.escape(k)}"]`);
      if (radios.length) {
        if (typeof v === 'string' && ![...radios].some(r => r.checked)) {
          const r = [...radios].find(r => r.value === v);
          if (r) { r.checked = true; r.dispatchEvent(new Event('change', { bubbles: true })); }
        }
        continue;
      }
      const el = document.getElementById(k);
      if (!el) continue;
      if (el.type === 'checkbox') {
        if (!el.checked && v === true) { el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }
      } else if (typeof v === 'string' && el.value.trim() === '') {
        el.value = v;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
    restoring = false;
  };

  let t;
  const later = () => { if (restoring) return; clearTimeout(t); t = setTimeout(save, 1200); };
  document.addEventListener('input', later);
  document.addEventListener('change', later);
  document.addEventListener('click', e => { if (e.target.closest('.tf button, [data-reveal]')) later(); });
  // pagehide / hidden fire reliably on phones, beforeunload often does not
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') save(); });
  window.addEventListener('pagehide', save);

  EW.hydrate()
    .catch(() => {})
    .then(() => {
      restore();
      save(); // answers that lived only in this browser go up now, not on the next keystroke
    });
})();
