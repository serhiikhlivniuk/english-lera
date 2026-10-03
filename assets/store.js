/* ===== English Workspace — data + progress store =====
   Works with no backend at all: everything goes to localStorage.
   If supabase.url and supabase.anonKey are filled in data/config.json,
   the same data is mirrored to Supabase so the teacher can see progress. */

const EW = (() => {
  const BASE = document.documentElement.dataset.base || '';
  const LS = 'lera:v1:';
  let cfg = null, sb = null;

  /* ---------- data ---------- */
  const cache = {};
  async function data(name) {
    if (!cache[name]) {
      cache[name] = fetch(`${BASE}data/${name}.json`, { cache: 'no-cache' })
        .then(r => { if (!r.ok) throw new Error(`${name}: ${r.status}`); return r.json(); });
    }
    return cache[name];
  }
  async function config() {
    if (!cfg) {
      cfg = await data('config');
      const s = cfg.supabase || {};
      if (s.url && s.anonKey) sb = {
        url: s.url.trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, ''),
        key: s.anonKey.trim(),
        student: s.studentId || 'student-1'
      };
    }
    return cfg;
  }

  /* ---------- local storage ---------- */
  function get(key, fallback) {
    try { const v = localStorage.getItem(LS + key); return v === null ? fallback : JSON.parse(v); }
    catch { return fallback; }
  }
  function setLocal(key, value) {
    try { localStorage.setItem(LS + key, JSON.stringify(value)); } catch { /* private mode */ }
    return value;
  }
  function set(key, value) {
    setLocal(key, value);
    setLocal(key + ':ts', Date.now());
    // never push before we know what the database already has: a page that
    // skipped hydrate() used to overwrite newer progress from another device
    if (sb || !cfg) hydrate().then(() => push('progress', { key, value: get(key, value) }));
    return value;
  }

  /* ---------- supabase (REST, no SDK) ---------- */
  async function sbFetch(path, opts = {}) {
    if (!sb) return null;
    try {
      const r = await fetch(`${sb.url}/rest/v1/${path}`, {
        keepalive: true,   // let the last save finish even if the tab is closing
        ...opts,
        headers: {
          apikey: sb.key,
          Authorization: `Bearer ${sb.key}`,
          'Content-Type': 'application/json',
          ...(opts.headers || {})
        }
      });
      if (!r.ok) return null;
      const t = await r.text();
      return t ? JSON.parse(t) : true;
    } catch { return null; }
  }
  function push(kind, payload) {
    if (!sb) return;
    if (kind === 'progress') {
      sbFetch('progress?on_conflict=student_id,key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates' },
        body: JSON.stringify({ student_id: sb.student, key: payload.key, value: payload.value, updated_at: new Date().toISOString() })
      });
    } else {
      sbFetch('events', {
        method: 'POST',
        body: JSON.stringify({ student_id: sb.student, kind, payload, created_at: new Date().toISOString() })
      });
    }
  }
  const connected = () => !!sb;
  const read = (table, query = '') => sbFetch(`${table}?${query}`);

  /* ---------- merge two versions of one key (older, newer) ----------
     arrays → union without duplicates · lesson answers → field by field ·
     plain objects (hw:done, scores) → key by key · anything else → newer  */
  const isObj = v => v && typeof v === 'object' && !Array.isArray(v);
  function merge(older, newer) {
    if (Array.isArray(older) && Array.isArray(newer)) return dedupe([...older, ...newer]);
    if (isObj(older) && isObj(newer)) {
      if (isObj(older.answers) || isObj(newer.answers)) {
        const answers = { ...(older.answers || {}), ...(newer.answers || {}) };
        // old format stored radios as `true`; a real value from either side beats it
        for (const k of Object.keys(answers)) {
          if (answers[k] === true && typeof (older.answers || {})[k] === 'string') answers[k] = older.answers[k];
        }
        return { ...older, ...newer, answers, filled: Object.keys(answers).length };
      }
      return { ...older, ...newer };
    }
    return newer;
  }
  function dedupe(list) {
    const seen = new Set();
    return list.filter(x => {
      const k = typeof x === 'object' ? JSON.stringify(x && x.word !== undefined ? [String(x.word).toLowerCase(), x.at] : x) : String(x);
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });
  }

  /* ---------- hydrate: pull the student's progress back down ----------
     Without this, progress only travels one way: a student who opens the
     site on another device (or clears their browser) sees an empty page
     while the database knows better. Both sides are merged (see merge()),
     so one device can never wipe what another device saved.            */
  let hydrated = null;
  function hydrate() {
    if (hydrated) return hydrated;
    // never let a slow or dead network hold up the page: give up after 5s
    hydrated = Promise.race([pull(), new Promise(r => setTimeout(() => r(false), 5000))]);
    return hydrated;
  }
  function pull() {
    return (async () => {
      await config();
      if (!sb) return false;
      const rows = await sbFetch(`progress?student_id=eq.${encodeURIComponent(sb.student)}&select=key,value,updated_at`);
      if (!rows) return false;
      for (const r of rows) {
        if (!r.key || r.key.endsWith(':ts')) continue;
        const localVal = get(r.key, null);
        const localTs = get(r.key + ':ts', 0);
        const remoteTs = Date.parse(r.updated_at) || 0;
        if (localVal === null) {
          const v = Array.isArray(r.value) ? dedupe(r.value) : r.value;
          setLocal(r.key, v);
          setLocal(r.key + ':ts', remoteTs);
          if (v !== r.value && v.length !== r.value.length) push('progress', { key: r.key, value: v });
          continue;
        }
        // merge instead of "newest wins": two devices must never wipe each other's answers
        const merged = localTs > remoteTs ? merge(r.value, localVal) : merge(localVal, r.value);
        setLocal(r.key, merged);
        setLocal(r.key + ':ts', Math.max(localTs, remoteTs));
        if (JSON.stringify(merged) !== JSON.stringify(r.value)) push('progress', { key: r.key, value: merged });
      }
      return true;
    })();
  }

  /* ---------- schedule ---------- */
  function nextLesson(meet) {
    const now = new Date();
    let best = null;
    for (const s of meet.schedule) {
      const [h, m] = s.time.split(':').map(Number);
      for (let add = 0; add <= 7; add++) {
        const d = new Date(now);
        d.setDate(now.getDate() + add);
        d.setHours(h, m, 0, 0);
        if (d.getDay() !== s.dayIndex % 7 || d <= now) continue;
        if (!best || d < best.date) best = { date: d, slot: s };
        break;
      }
    }
    return best;
  }
  function humanUntil(date) {
    const ms = date - new Date();
    if (ms <= 0) return 'right now';
    const days = Math.floor(ms / 864e5), hours = Math.floor(ms / 36e5) % 24, mins = Math.floor(ms / 6e4) % 60;
    const pl = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
    if (days) return `in ${pl(days, 'day')} ${pl(hours, 'hour')}`;
    if (hours) return `in ${pl(hours, 'hour')} ${pl(mins, 'minute')}`;
    return `in ${pl(mins, 'minute')}`;
  }

  return { BASE, data, config, get, set, push, connected, read, hydrate, merge, dedupe, nextLesson, humanUntil };
})();
