/* ============================================================
   app.js — Router, Sidebar, Views
   Routen:  #/                      Übersicht
            #/woche/<n>/<tab>       tab: zusammenfassung | moodle | code
            #/wiederholen           falsch gelöste Aufgaben, wochenübergreifend
            #/fortschritt           Export / Import / Zurücksetzen
   ============================================================ */

const App = (() => {

  let index = null;                 // data/index.json
  const weekCache = new Map();      // Nummer -> Wochendaten

  /* ---------------- Daten ---------------- */

  async function getIndex() {
    if (index) return index;
    const r = await fetch('data/index.json');
    if (!r.ok) throw new Error('data/index.json konnte nicht geladen werden (HTTP ' + r.status + ')');
    index = await r.json();
    return index;
  }

  async function getWeek(n) {
    if (weekCache.has(n)) return weekCache.get(n);
    const file = 'data/woche_' + String(n).padStart(2, '0') + '.json';
    const r = await fetch(file);
    if (!r.ok) throw new Error(file + ' konnte nicht geladen werden (HTTP ' + r.status + ')');
    const data = await r.json();
    weekCache.set(n, data);
    return data;
  }

  /** Alle Aufgaben-IDs einer Woche, für Fortschrittsbalken und Zählung. */
  function weekIds(week) {
    const ids = (week.moodle || []).map(q => q.id);
    (week.codeexpert || []).forEach(t => [1, 2, 3].forEach(n => ids.push(`${t.id}:s${n}`)));
    return ids;
  }

  /* ---------------- Sidebar ---------------- */

  async function renderSidebar(activeWeek) {
    const idx = await getIndex();
    const side = document.getElementById('sidebar');
    side.replaceChildren();
    side.appendChild(el('div', { class: 'side-label' }, 'Wochen'));

    for (const w of idx.wochen) {
      const dot = el('span', { class: 'side-dot none' });
      if (weekCache.has(w.woche)) {
        const t = Progress.tally(weekIds(weekCache.get(w.woche)));
        if (t.total && t.richtig === t.total) dot.className = 'side-dot full';
        else if (t.richtig || t.falsch) dot.className = 'side-dot part';
      }
      side.appendChild(el('a', {
        class: 'side-item' + (w.woche === activeWeek ? ' active' : '') +
               (w.status === 'platzhalter' ? ' dim' : ''),
        href: '#/woche/' + w.woche,
        title: 'Skript ' + (w.kapitel || '')
      }, [
        el('span', { class: 'side-num' }, String(w.woche)),
        el('span', { class: 'side-title' }, w.titel),
        dot
      ]));
    }

    side.appendChild(el('div', { class: 'side-label', style: 'margin-top:14px' }, 'Werkzeuge'));
    side.appendChild(el('a', { class: 'side-item', href: '#/wiederholen' }, [
      el('span', { class: 'side-num' }, '↻'),
      el('span', { class: 'side-title' }, 'Fehler wiederholen')
    ]));
    side.appendChild(el('a', { class: 'side-item', href: '#/fortschritt' }, [
      el('span', { class: 'side-num' }, '⌄'),
      el('span', { class: 'side-title' }, 'Fortschritt sichern')
    ]));
  }

  /* ---------------- Views ---------------- */

  async function viewOverview(host) {
    const idx = await getIndex();

    host.appendChild(el('div', { class: 'kicker' }, 'ETH Zürich · 401-0663-00'));
    host.appendChild(el('h1', {}, 'Numerical Methods for Computer Science'));
    host.appendChild(el('p', { class: 'lede' },
      'Training zu den Original-Moodle-Fragen und CodeExpert-Aufgaben. ' +
      'Jeder Punkt der Zusammenfassung verweist auf Abschnitt und Seite im Skript — ' +
      'das Skript ist an der Prüfung erlaubt.'));

    // Wochen für die Fortschrittsbalken vorladen (klein, lokal).
    const loaded = await Promise.all(idx.wochen.map(async w => {
      try { return await getWeek(w.woche); } catch { return null; }
    }));

    const grid = el('div', { class: 'card-grid' });
    idx.wochen.forEach((w, i) => {
      const data = loaded[i];
      const ids = data ? weekIds(data) : [];
      const t = Progress.tally(ids);
      const pct = t.total ? Math.round(100 * t.richtig / t.total) : 0;

      const badges = [];
      if (w.status === 'platzhalter') badges.push(el('span', { class: 'pill pill-warn' }, 'Aufgaben folgen'));
      else if (w.status === 'in_arbeit') badges.push(el('span', { class: 'pill pill-warn' }, 'in Arbeit'));
      else if (!t.total) badges.push(el('span', { class: 'pill' }, 'nur Zusammenfassung'));
      else badges.push(el('span', { class: 'pill pill-ok' }, t.richtig + '/' + t.total));

      const card = el('a', { class: 'card week-card', href: '#/woche/' + w.woche }, [
        el('div', { class: 'week-card-top' }, [
          el('span', { class: 'ref' }, 'Woche ' + w.woche),
          ...badges
        ]),
        el('h3', {}, w.titel),
        el('div', { class: 'faint' }, 'Skript ' + (w.kapitel || '—') + ' · S. ' + (w.seiten || '—')),
        (w.status === 'platzhalter' || w.status === 'in_arbeit') ? null
          : el('div', { class: 'bar' }, [el('i', { style: 'width:' + pct + '%' })])
      ]);
      grid.appendChild(card);
    });
    host.appendChild(grid);

    const total = Progress.tally(loaded.filter(Boolean).flatMap(weekIds));
    host.appendChild(el('div', { class: 'card' }, [
      el('div', { class: 'kicker' }, 'Stand insgesamt'),
      el('p', {}, [
        el('b', {}, String(total.richtig)), document.createTextNode(' richtig · '),
        el('b', {}, String(total.falsch)), document.createTextNode(' falsch · '),
        el('b', {}, String(total.offen)), document.createTextNode(' offen (von ' + total.total + ' Aufgaben)')
      ]),
      total.falsch
        ? el('a', { class: 'btn btn-primary', href: '#/wiederholen' },
            total.falsch + ' Fehler wiederholen')
        : el('p', { class: 'faint' }, 'Keine offenen Fehler.')
    ]));
  }

  async function viewWeek(host, n, tab) {
    const week = await getWeek(n);
    const nMoodle = (week.moodle || []).length;
    const nCode = (week.codeexpert || []).length;

    host.appendChild(el('div', { class: 'kicker' }, 'Woche ' + week.woche));
    host.appendChild(el('h1', {}, week.titel));
    host.appendChild(el('p', { class: 'lede' }, [
      document.createTextNode('Skript Kapitel ' + (week.skript?.kapitel || '—') +
        ', Seiten ' + (week.skript?.seiten || '—') + ' · Wochenplan '),
      el('code', {}, week.vorlage || '—')
    ]));

    const tabs = el('div', { class: 'tabs' });
    const defs = [
      ['zusammenfassung', 'Zusammenfassung', null],
      ['moodle', 'Moodle-Training', nMoodle],
      ['code', 'CodeExpert-Training', nCode]
    ];
    defs.forEach(([key, label, count]) => {
      const a = el('a', {
        class: tab === key ? 'active' : '',
        href: '#/woche/' + n + '/' + key
      }, label);
      if (count !== null) a.appendChild(el('span', { class: 'pill' }, String(count)));
      tabs.appendChild(a);
    });
    host.appendChild(tabs);

    const body = el('div');
    host.appendChild(body);

    if (tab === 'moodle') {
      if (week.moodleHinweis) {
        body.appendChild(el('div', { class: 'notice' }, [
          el('span', { class: 'notice-icon' }, 'ⓘ'),
          el('span', { html: week.moodleHinweis })
        ]));
      }
      Quiz.renderList(week.moodle, body, () => refreshErrCount());
    } else if (tab === 'code') {
      CodeTask.renderList(week.codeexpert, body);
    } else {
      Summary.render(week, body);
    }
  }

  async function viewRepeat(host) {
    host.appendChild(el('div', { class: 'kicker' }, 'Modus'));
    host.appendChild(el('h1', {}, 'Fehler wiederholen'));
    host.appendChild(el('p', { class: 'lede' },
      'Alle Aufgaben, die beim letzten Versuch falsch waren — über alle Wochen hinweg.'));

    const idx = await getIndex();
    const weeks = await Promise.all(idx.wochen.map(async w => {
      try { return await getWeek(w.woche); } catch { return null; }
    }));

    const wrong = new Set(Progress.wrongIds());
    let found = 0;

    for (const week of weeks.filter(Boolean)) {
      const qs = (week.moodle || []).filter(q => wrong.has(q.id));
      const cs = (week.codeexpert || []).filter(t =>
        [1, 2, 3].some(n => wrong.has(`${t.id}:s${n}`)));
      if (!qs.length && !cs.length) continue;

      found += qs.length + cs.length;
      host.appendChild(el('h2', {}, [
        document.createTextNode('Woche ' + week.woche + ' — ' + week.titel + ' '),
        el('a', { class: 'ref', href: '#/woche/' + week.woche }, 'zur Woche')
      ]));

      qs.forEach(q => {
        const card = el('div', { class: 'card q' });
        host.appendChild(card);
        Quiz.render(q, card, () => refreshErrCount());
      });
      cs.forEach(t => {
        const card = el('div', { class: 'card' });
        host.appendChild(card);
        CodeTask.render(t, card);
      });
    }

    if (!found) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('div', { class: 'empty-mark' }, '✓'),
        el('p', {}, 'Keine falsch gelösten Aufgaben. Entweder noch nichts versucht — oder alles sitzt.')
      ]));
    }
  }

  function viewProgress(host) {
    host.appendChild(el('div', { class: 'kicker' }, 'Werkzeug'));
    host.appendChild(el('h1', {}, 'Fortschritt sichern'));
    host.appendChild(el('p', { class: 'lede' },
      'Der Fortschritt liegt im localStorage dieses Browsers. Zum Mitnehmen hier exportieren.'));

    const ta = el('textarea', { class: 'editor', spellcheck: 'false', style: 'min-height:240px' });
    ta.value = Progress.exportJson();

    const msg = el('div');
    const row = el('div', { class: 'btn-row' }, [
      el('button', { class: 'btn', onclick: () => { ta.value = Progress.exportJson(); } }, 'Aktuellen Stand anzeigen'),
      el('button', {
        class: 'btn btn-primary',
        onclick: () => {
          try {
            Progress.importJson(ta.value);
            msg.replaceChildren(el('div', { class: 'fb fb-ok' }, 'Fortschritt übernommen.'));
            refreshErrCount();
          } catch (e) {
            msg.replaceChildren(el('div', { class: 'fb fb-err' }, 'Import fehlgeschlagen: ' + e.message));
          }
        }
      }, 'Aus Textfeld importieren'),
      el('button', {
        class: 'btn',
        onclick: () => {
          if (!confirm('Wirklich den gesamten Fortschritt löschen?')) return;
          Progress.resetAll();
          ta.value = Progress.exportJson();
          msg.replaceChildren(el('div', { class: 'fb fb-info' }, 'Fortschritt zurückgesetzt.'));
          refreshErrCount();
        }
      }, 'Alles zurücksetzen')
    ]);

    host.appendChild(el('div', { class: 'card' }, [ta, row, msg]));
  }

  /* ---------------- Rahmen ---------------- */

  function refreshErrCount() {
    const n = Progress.wrongIds().length;
    const badge = document.getElementById('errCount');
    badge.textContent = String(n);
    badge.classList.toggle('hidden', n === 0);
  }

  function markTopnav(route) {
    document.querySelectorAll('.topnav a').forEach(a => {
      a.classList.toggle('active',
        (route === 'wiederholen' && a.dataset.nav === 'wiederholen') ||
        (route === 'uebersicht' && a.dataset.nav === 'uebersicht'));
    });
  }

  async function route() {
    const host = document.getElementById('view');
    host.replaceChildren();
    const hash = location.hash.replace(/^#\/?/, '');
    const parts = hash.split('/').filter(Boolean);

    try {
      if (parts[0] === 'woche') {
        const n = parseInt(parts[1], 10);
        const tab = parts[2] || 'zusammenfassung';
        markTopnav(null);
        await renderSidebar(n);
        await viewWeek(host, n, tab);
      } else if (parts[0] === 'wiederholen') {
        markTopnav('wiederholen');
        await renderSidebar(null);
        await viewRepeat(host);
      } else if (parts[0] === 'fortschritt') {
        markTopnav(null);
        await renderSidebar(null);
        viewProgress(host);
      } else {
        markTopnav('uebersicht');
        await renderSidebar(null);
        await viewOverview(host);
      }
    } catch (e) {
      console.error(e);
      host.replaceChildren(el('div', { class: 'card' }, [
        el('h2', {}, 'Da ging etwas schief'),
        el('div', { class: 'out err' }, String(e.message || e)),
        el('p', { class: 'faint' },
          'Die Seite muss über einen Webserver laufen, nicht per Doppelklick: ' +
          'python3 -m http.server 8000 im Ordner numcs/, dann http://localhost:8000 öffnen.')
      ]));
    }

    refreshErrCount();
    window.scrollTo(0, 0);
  }

  /* ---------------- Theme ---------------- */

  function initTheme() {
    const saved = localStorage.getItem('numcs.theme');
    if (saved) document.documentElement.setAttribute('data-theme', saved);

    document.getElementById('themeBtn').addEventListener('click', () => {
      const cur = document.documentElement.getAttribute('data-theme');
      const isDark = cur
        ? cur === 'dark'
        : matchMedia('(prefers-color-scheme: dark)').matches;
      const next = isDark ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('numcs.theme', next);
    });
  }

  function init() {
    initTheme();
    window.addEventListener('hashchange', route);
    document.addEventListener('progress:changed', refreshErrCount);
    route();
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', App.init);
