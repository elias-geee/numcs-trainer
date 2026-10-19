/* ============================================================
   progress.js — Fortschritt in localStorage
   Ein Eintrag pro Aufgabe:
     { status: "offen" | "richtig" | "falsch", versuche: n, zuletzt: ISO }
   Schlüssel: Moodle -> Frage-ID, CodeExpert -> "<taskId>:s1" | ":s2" | ":s3"
   ============================================================ */

const Progress = (() => {
  const KEY = 'numcs.progress.v1';
  let cache = null;

  function load() {
    if (cache) return cache;
    try {
      cache = JSON.parse(localStorage.getItem(KEY)) || {};
    } catch {
      cache = {};
    }
    return cache;
  }

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(load()));
    } catch (e) {
      console.warn('Fortschritt konnte nicht gespeichert werden:', e);
    }
  }

  function get(id) {
    return load()[id] || { status: 'offen', versuche: 0, zuletzt: null };
  }

  /** Ergebnis eines Versuchs festhalten. Einmal "richtig" bleibt "richtig". */
  function record(id, correct) {
    const db = load();
    const prev = db[id] || { status: 'offen', versuche: 0 };
    db[id] = {
      status: correct ? 'richtig' : 'falsch',
      versuche: prev.versuche + 1,
      zuletzt: new Date().toISOString()
    };
    save();
    document.dispatchEvent(new CustomEvent('progress:changed', { detail: { id } }));
  }

  function reset(id) {
    const db = load();
    delete db[id];
    save();
    document.dispatchEvent(new CustomEvent('progress:changed', { detail: { id } }));
  }

  function resetAll() {
    cache = {};
    save();
    document.dispatchEvent(new CustomEvent('progress:changed', { detail: { id: null } }));
  }

  /** Alle IDs, die beim letzten Versuch falsch waren. */
  function wrongIds() {
    const db = load();
    return Object.keys(db).filter(id => db[id].status === 'falsch');
  }

  /** Zählt {richtig, falsch, offen, total} über eine Liste von IDs. */
  function tally(ids) {
    const out = { richtig: 0, falsch: 0, offen: 0, total: ids.length };
    for (const id of ids) out[get(id).status]++;
    return out;
  }

  function exportJson() {
    return JSON.stringify(load(), null, 2);
  }

  function importJson(text) {
    const data = JSON.parse(text);
    if (typeof data !== 'object' || data === null || Array.isArray(data)) {
      throw new Error('Erwartet wird ein JSON-Objekt.');
    }
    cache = data;
    save();
    document.dispatchEvent(new CustomEvent('progress:changed', { detail: { id: null } }));
  }

  return { get, record, reset, resetAll, wrongIds, tally, exportJson, importJson };
})();
