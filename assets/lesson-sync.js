/* Mirrors the student's worksheet answers into the shared store (and Supabase, if connected). */
(() => {
  const id = document.currentScript?.dataset.lesson || 'lesson';
  const key = `lesson:${id}:answers`;
  const collect = () => {
    const out = {};
    document.querySelectorAll('input, textarea, select').forEach((el, i) => {
      if (el.type === 'button' || el.type === 'submit') return;
      const k = el.id || el.name || `f${i}`;
      const v = el.type === 'checkbox' || el.type === 'radio' ? el.checked : el.value;
      if (v !== '' && v !== false) out[k] = v;
    });
    return out;
  };
  let t;
  const sync = () => {
    clearTimeout(t);
    t = setTimeout(() => {
      const a = collect();
      EW.set(key, { updated: new Date().toISOString(), filled: Object.keys(a).length, answers: a });
    }, 1500);
  };
  document.addEventListener('input', sync);
  document.addEventListener('change', sync);
  window.addEventListener('beforeunload', () => {
    const a = collect();
    if (Object.keys(a).length) EW.set(key, { updated: new Date().toISOString(), filled: Object.keys(a).length, answers: a });
  });
  EW.config().catch(() => {});
})();
