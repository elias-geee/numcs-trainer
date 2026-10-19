/* ============================================================
   codetask.js — CodeExpert-Training in drei Stufen
     Stufe 1  Lückencode, pro Lücke Multiple Choice
     Stufe 2  gleicher Lückencode, Lücken selbst eintippen
     Stufe 3  rekonstruiertes Template, vollständig selbst lösen
   Stufe 2 und 3 werden durch Ausführen in Pyodide geprüft, damit
   gleichwertige Schreibweisen bestehen.
   ============================================================ */

const CodeTask = (() => {

  const GAP_RE = /«(L\d+)»/;
  const GAP_RE_G = /«(L\d+)»/g;

  /* --------- deterministisches Mischen (stabil über Reloads) --------- */

  function hash(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function seededShuffle(items, seed) {
    const a = items.slice();
    let s = hash(seed) || 1;
    const next = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /* ---------------- Ausführung + Bewertung ---------------- */

  async function execute(task, code) {
    const t = task.test || {};
    const res = await Py.run({
      code,
      pruefcode: t.typ === 'plot' ? null : (t.pruefcode || null),
      packages: task.braucht && task.braucht.length ? task.braucht : ['numpy']
    });
    res.bestanden = t.typ === 'plot'
      ? (res.ok && res.images.length > 0)
      : (res.ok && res.passed === true);
    return res;
  }

  /** stdout, Fehler und Plots anzeigen. */
  function renderRun(res, task, host) {
    host.replaceChildren();

    const verdict = el('div', { class: 'fb ' + (res.bestanden ? 'fb-ok' : 'fb-err') });
    if (res.bestanden) {
      verdict.appendChild(el('h4', {}, '✓ Bestanden'));
      verdict.appendChild(el('p', {}, (task.test && task.test.typ === 'plot')
        ? 'Der Code läuft fehlerfrei und erzeugt eine Grafik. Vergleiche sie unten mit der Referenz.'
        : 'Die Werte stimmen mit der Referenzlösung überein.'));
    } else if (!res.ok) {
      verdict.appendChild(el('h4', {}, '✗ Der Code läuft nicht'));
      verdict.appendChild(el('p', {}, 'Python hat eine Ausnahme geworfen — siehe Ausgabe.'));
    } else if (task.test && task.test.typ === 'plot') {
      verdict.appendChild(el('h4', {}, '✗ Keine Grafik erzeugt'));
      verdict.appendChild(el('p', {}, 'Der Code lief durch, hat aber keine Matplotlib-Figur hinterlassen.'));
    } else {
      verdict.appendChild(el('h4', {}, '✗ Test nicht bestanden'));
      verdict.appendChild(el('p', {}, 'Der Code läuft, liefert aber nicht die erwarteten Werte.'));
    }
    host.appendChild(verdict);

    if (res.error) {
      host.appendChild(el('div', { class: 'out err' }, res.error));
    }
    if (res.stdout.trim()) {
      host.appendChild(el('details', { class: 'disclose' }, [
        el('summary', {}, 'Ausgabe (stdout)'),
        el('div', { class: 'disclose-body' }, [el('div', { class: 'out' }, res.stdout.trim())])
      ]));
    }

    const figs = [];
    res.images.forEach((src, i) => {
      figs.push(el('div', { class: 'plot' }, [
        el('figure', {}, [
          el('img', { src, alt: 'Dein Plot ' + (i + 1) }),
          el('figcaption', {}, 'Dein Ergebnis' + (res.images.length > 1 ? ' — Figur ' + (i + 1) : ''))
        ])
      ]));
    });
    const refs = [].concat(task.referenzPlot || []);
    refs.forEach((src, i) => {
      figs.push(el('div', { class: 'plot' }, [
        el('figure', {}, [
          el('img', { src, alt: 'Referenzgrafik ' + (i + 1), loading: 'lazy' }),
          el('figcaption', {}, 'Referenz aus der Musterlösung' +
            (refs.length > 1 ? ' — Figur ' + (i + 1) : ''))
        ])
      ]));
    });
    if (figs.length) host.appendChild(el('div', { class: 'plots' }, figs));
  }

  function runButtonRow(label, onRun) {
    const btn = el('button', { class: 'btn btn-primary' }, label);
    const note = el('span', { class: 'faint' },
      Py.isReady() ? '' : 'Beim ersten Lauf wird Python geladen (einige Sekunden).');
    const row = el('div', { class: 'btn-row' }, [btn, note]);
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const old = btn.textContent;
      btn.textContent = 'läuft …';
      try {
        await onRun();
      } catch (e) {
        console.error(e);
      } finally {
        btn.disabled = false;
        btn.textContent = old;
        note.textContent = '';
      }
    });
    return row;
  }

  /* ---------------- Lückencode rendern ---------------- */

  /**
   * Baut <pre> aus `luecken_template` und setzt pro «Lk» ein Widget ein.
   * `makeWidget(gap)` liefert das Eingabeelement.
   */
  function gapCodeBlock(task, makeWidget) {
    const pre = el('pre', { class: 'gapcode' });
    const byId = Object.fromEntries((task.luecken || []).map(g => [g.id, g]));
    const parts = task.luecken_template.split(GAP_RE);

    parts.forEach((part, i) => {
      if (i % 2 === 0) {
        if (part) pre.appendChild(document.createTextNode(part));
      } else {
        const gap = byId[part];
        pre.appendChild(gap
          ? makeWidget(gap)
          : document.createTextNode('«' + part + '»'));
      }
    });
    return pre;
  }

  /** Erklärungen zu allen Lücken, nach dem Prüfen eingeblendet. */
  function gapExplanations(task, states) {
    const box = el('div', { class: 'fb fb-info' });
    box.appendChild(el('h4', {}, 'Was hinter den Lücken steckt'));
    (task.luecken || []).forEach(g => {
      const st = states ? states[g.id] : null;
      const mark = st === true ? '✓ ' : st === false ? '✗ ' : '';
      box.appendChild(el('p', {}, [
        el('b', {}, mark + g.id + ': '),
        el('code', {}, g.loesung)
      ]));
      if (g.erklaerung) box.appendChild(el('div', { class: 'faint', html: g.erklaerung }));
    });
    return box;
  }

  /* ---------------- Stufe 1: Multiple Choice ---------------- */

  function stage1(task, host, done) {
    host.appendChild(el('p', { class: 'muted' },
      'Wähle für jede Lücke den passenden Ausdruck. Die Fehloptionen sind so gebaut, ' +
      'wie man es tatsächlich falsch macht — falsche Achse, falscher Index, vergessene Transponierung.'));

    const selects = {};
    const pre = gapCodeBlock(task, gap => {
      const shuffled = seededShuffle(
        gap.optionen.map((text, idx) => ({ text, idx })),
        task.id + gap.id
      );
      const sel = el('select', { class: 'gap-select' });
      sel.appendChild(el('option', { value: '' }, '— ' + gap.id + ' wählen —'));
      shuffled.forEach(o => sel.appendChild(el('option', { value: String(o.idx) }, o.text)));
      selects[gap.id] = sel;
      return sel;
    });
    host.appendChild(pre);

    const fbHost = el('div');
    const actions = el('div', { class: 'btn-row' });
    const checkBtn = el('button', { class: 'btn btn-primary' }, 'Prüfen');
    const resetBtn = el('button', { class: 'btn' }, 'Zurücksetzen');
    actions.append(checkBtn, resetBtn);
    host.append(actions, fbHost);

    checkBtn.addEventListener('click', () => {
      const gaps = task.luecken || [];
      if (gaps.some(g => selects[g.id].value === '')) {
        fbHost.replaceChildren(el('div', { class: 'fb fb-info' }, 'Bitte alle Lücken füllen.'));
        return;
      }
      const states = {};
      let allOk = true;
      gaps.forEach(g => {
        const ok = Number(selects[g.id].value) === g.richtig;
        states[g.id] = ok;
        allOk = allOk && ok;
        selects[g.id].classList.remove('is-correct', 'is-wrong');
        selects[g.id].classList.add(ok ? 'is-correct' : 'is-wrong');
      });

      const summary = el('div', { class: 'fb ' + (allOk ? 'fb-ok' : 'fb-err') }, [
        el('h4', {}, allOk ? '✓ Alle Lücken richtig' : '✗ Noch nicht alle Lücken richtig')
      ]);
      fbHost.replaceChildren(summary, gapExplanations(task, states));
      done(allOk);
    });

    resetBtn.addEventListener('click', () => {
      Object.values(selects).forEach(s => {
        s.value = '';
        s.classList.remove('is-correct', 'is-wrong');
      });
      fbHost.replaceChildren();
    });
  }

  /* ---------------- Stufe 2: selbst eintippen ---------------- */

  function stage2(task, host, done) {
    host.appendChild(el('p', { class: 'muted' },
      'Gleicher Lückencode, diesmal ohne Auswahl. Geprüft wird durch Ausführen — ' +
      'jede gleichwertige Schreibweise besteht.'));

    const inputs = {};
    const pre = gapCodeBlock(task, gap => {
      const inp = el('input', {
        class: 'gap-input',
        type: 'text',
        spellcheck: 'false',
        autocapitalize: 'off',
        autocomplete: 'off',
        size: String(Math.max(12, Math.min(60, gap.loesung.length + 4))),
        placeholder: gap.id
      });
      inputs[gap.id] = inp;
      return inp;
    });
    host.appendChild(pre);

    const outHost = el('div');
    const hintHost = el('div');

    host.appendChild(runButtonRow('Ausführen und prüfen', async () => {
      const gaps = task.luecken || [];
      if (gaps.some(g => !inputs[g.id].value.trim())) {
        outHost.replaceChildren(el('div', { class: 'fb fb-info' }, 'Bitte alle Lücken ausfüllen.'));
        return;
      }
      const code = task.luecken_template.replace(GAP_RE_G, (_, id) =>
        inputs[id] ? inputs[id].value : '');
      const res = await execute(task, code);
      renderRun(res, task, outHost);
      gaps.forEach(g => {
        inputs[g.id].classList.remove('is-correct', 'is-wrong');
        inputs[g.id].classList.add(res.bestanden ? 'is-correct' : 'is-wrong');
      });
      if (!res.bestanden) hintHost.replaceChildren(hints(task));
      else hintHost.replaceChildren(gapExplanations(task, null));
      done(res.bestanden);
    }));

    host.append(outHost, hintHost);
    host.appendChild(solutionDisclosure(task, 'luecken'));
  }

  /* ---------------- Stufe 3: alles selbst ---------------- */

  function stage3(task, host, done) {
    host.appendChild(el('p', { class: 'muted' },
      'Das rekonstruierte CodeExpert-Template. Fülle die mit ' +
      '# TODO markierten Stellen aus — so wie an der Prüfung.'));

    const ta = el('textarea', { class: 'editor', spellcheck: 'false', autocapitalize: 'off' });
    ta.value = task.template;
    host.appendChild(ta);

    // Tab soll einrücken statt den Fokus zu verlieren.
    ta.addEventListener('keydown', e => {
      if (e.key !== 'Tab') return;
      e.preventDefault();
      const s = ta.selectionStart, t = ta.selectionEnd;
      ta.value = ta.value.slice(0, s) + '    ' + ta.value.slice(t);
      ta.selectionStart = ta.selectionEnd = s + 4;
    });

    const outHost = el('div');
    const hintHost = el('div');

    const row = runButtonRow('Ausführen und prüfen', async () => {
      const res = await execute(task, ta.value);
      renderRun(res, task, outHost);
      if (!res.bestanden) hintHost.replaceChildren(hints(task));
      else hintHost.replaceChildren();
      done(res.bestanden);
    });
    const resetBtn = el('button', { class: 'btn' }, 'Template zurücksetzen');
    resetBtn.addEventListener('click', () => {
      ta.value = task.template;
      outHost.replaceChildren();
      hintHost.replaceChildren();
    });
    row.appendChild(resetBtn);
    host.appendChild(row);

    host.append(outHost, hintHost);
    host.appendChild(solutionDisclosure(task, 'voll'));
  }

  /* ---------------- Hinweise & Lösung ---------------- */

  function hints(task) {
    const box = el('details', { class: 'disclose' }, [el('summary', {}, 'Hinweise einblenden')]);
    const body = el('div', { class: 'disclose-body' });
    (task.luecken || []).forEach(g => {
      if (!g.hinweis) return;
      body.appendChild(el('p', {}, [el('b', {}, g.id + ': '), document.createTextNode(g.hinweis)]));
    });
    if (!body.children.length) body.appendChild(el('p', { class: 'faint' }, 'Für diese Aufgabe sind keine Hinweise hinterlegt.'));
    box.appendChild(body);
    return box;
  }

  function solutionDisclosure(task, which) {
    const box = el('details', { class: 'disclose' }, [el('summary', {}, 'Lösung anzeigen')]);
    const body = el('div', { class: 'disclose-body' });
    if (which === 'luecken') {
      (task.luecken || []).forEach(g => {
        body.appendChild(el('p', {}, [el('b', {}, g.id + ': '), el('code', {}, g.loesung)]));
        if (g.erklaerung) body.appendChild(el('div', { class: 'faint', html: g.erklaerung }));
      });
    } else {
      body.appendChild(el('pre', { class: 'code' }, task.loesung));
    }
    box.appendChild(body);
    return box;
  }

  /* ---------------- Rahmen ---------------- */

  function render(task, card) {
    const stageIds = [1, 2, 3].map(n => `${task.id}:s${n}`);

    const head = el('div', { class: 'q-head' }, [
      el('span', { class: 'pill pill-acc', title: 'Quelle: ' + (task.quelle || '') }, 'Original-CodeExpert'),
      ...stageIds.map((id, i) => {
        const p = statusPill(Progress.get(id).status);
        p.prepend(document.createTextNode('S' + (i + 1) + ': '));
        return p;
      })
    ]);
    card.appendChild(head);

    const titleRow = el('div', { class: 'sum-head' }, [el('h3', {}, task.titel), refChip(task.skriptRef)]);
    card.appendChild(titleRow);

    if (task.beschreibung) card.appendChild(el('div', { html: task.beschreibung }));

    if (task.hinweisUmgebung) {
      card.appendChild(el('div', { class: 'notice' }, [
        el('span', { class: 'notice-icon' }, 'ⓘ'),
        el('span', { html: task.hinweisUmgebung })
      ]));
    }

    const tabs = el('div', { class: 'stage-tabs' });
    const body = el('div');
    const labels = ['Stufe 1 · Auswahl', 'Stufe 2 · Eintippen', 'Stufe 3 · Alles selbst'];
    const renderers = [stage1, stage2, stage3];

    labels.forEach((label, i) => {
      const b = el('button', {}, label);
      b.addEventListener('click', () => {
        [...tabs.children].forEach(c => c.classList.remove('active'));
        b.classList.add('active');
        body.replaceChildren();
        renderers[i](task, body, correct => {
          Progress.record(stageIds[i], correct);
          const fresh = statusPill(correct ? 'richtig' : 'falsch');
          fresh.prepend(document.createTextNode('S' + (i + 1) + ': '));
          head.replaceChild(fresh, head.children[i + 1]);
        });
        math(body);
      });
      tabs.appendChild(b);
    });

    card.appendChild(el('div', { class: 'btn-row' }, [tabs]));
    card.appendChild(body);
    tabs.children[0].click();

    math(card);
    return card;
  }

  function renderList(tasks, host, status) {
    if (!tasks || !tasks.length) {
      const pending = status === 'nur_zusammenfassung';
      host.appendChild(el('div', { class: 'empty' }, [
        el('div', { class: 'empty-mark' }, pending ? '⏳' : '—'),
        el('p', {}, pending
          ? 'Die CodeExpert-Aufgaben dieser Woche liegen noch nicht vor.'
          : 'Für diese Woche liegen keine CodeExpert-Aufgaben vor.')
      ]));
      return;
    }
    tasks.forEach(t => {
      const card = el('div', { class: 'card' });
      host.appendChild(card);
      render(t, card);
    });
  }

  return { render, renderList };
})();
