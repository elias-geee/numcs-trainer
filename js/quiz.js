/* ============================================================
   quiz.js — Moodle-Training
   Fragetypen aus dem Originalmaterial:
     mc-single      Single-Choice (Moodle "Scoring method SC1/0")
     numeric-multi  mehrere Zahlenfelder in einer Frage
   ============================================================ */

const Quiz = (() => {

  /** Herkunfts-Badge: Originalfrage aus Moodle oder selbst ergänzt. */
  function sourceBadge(q) {
    if (q.quelle && q.quelle.typ === 'original') {
      return el('span', {
        class: 'pill pill-acc',
        title: q.quelle.datei ? 'Screenshot: ' + q.quelle.datei : ''
      }, 'Original-Moodle');
    }
    return el('span', { class: 'pill' }, 'Eigene Zusatzfrage');
  }

  /** Warnbanner: Die offizielle Lösung ist im Material nirgends markiert. */
  function solutionNotice(q) {
    if (q.loesungsStatus !== 'eigene') return null;
    return el('div', { class: 'notice' }, [
      el('span', { class: 'notice-icon' }, '⚠'),
      el('span', {}, [
        el('b', {}, 'Eigene Lösung – nicht offiziell. '),
        document.createTextNode(
          'In den Screenshots ist keine korrekte Antwort markiert. Die Begründung unten ' +
          'stützt sich auf das Skript; prüfe sie im Zweifel dort nach.'
        )
      ])
    ]);
  }

  /** Feedbackblock nach dem Prüfen. */
  function feedback(q, correct) {
    const box = el('div', { class: 'fb ' + (correct ? 'fb-ok' : 'fb-err') });
    box.appendChild(el('h4', {}, correct ? '✓ Richtig' : '✗ Falsch'));

    if (q.erklaerung) {
      box.appendChild(el('div', { html: q.erklaerung }));
    }
    const chip = refChip(q.skriptRef);
    if (chip) {
      box.appendChild(el('p', { class: 'faint' }, [
        document.createTextNode('Nachschlagen im Skript: '), chip
      ]));
    }
    if (q.loesungsStatus === 'eigene') {
      box.appendChild(el('p', { class: 'faint' }, 'Eigene Lösung – nicht offiziell.'));
    }
    return box;
  }

  /* ---------------- mc-single ---------------- */

  function renderMcSingle(q, host, onResult) {
    const name = 'q_' + q.id;
    const opts = [];

    q.optionen.forEach((text, i) => {
      const input = el('input', { type: 'radio', name });
      const label = el('label', { class: 'opt' }, [
        input,
        el('span', { class: 'opt-text', html: text })
      ]);
      opts.push({ label, input, i });
      host.appendChild(label);
    });

    const actions = el('div', { class: 'btn-row' });
    const checkBtn = el('button', { class: 'btn btn-primary' }, 'Prüfen');
    const againBtn = el('button', { class: 'btn hidden' }, 'Nochmal versuchen');
    actions.append(checkBtn, againBtn);
    host.appendChild(actions);

    const fbHost = el('div');
    host.appendChild(fbHost);

    checkBtn.addEventListener('click', () => {
      const picked = opts.find(o => o.input.checked);
      if (!picked) {
        fbHost.replaceChildren(el('div', { class: 'fb fb-info' }, 'Bitte zuerst eine Antwort wählen.'));
        return;
      }
      const correct = picked.i === q.loesung;

      opts.forEach(o => {
        o.label.classList.add('locked');
        o.input.disabled = true;
        if (o.i === q.loesung) {
          o.label.classList.add('is-correct');
          o.label.appendChild(el('span', { class: 'opt-mark ok' }, '✓'));
        } else if (o.i === picked.i) {
          o.label.classList.add('is-wrong');
          o.label.appendChild(el('span', { class: 'opt-mark err' }, '✗'));
        }
      });

      checkBtn.classList.add('hidden');
      againBtn.classList.remove('hidden');
      fbHost.replaceChildren(feedback(q, correct));
      math(fbHost);
      onResult(correct);
    });

    againBtn.addEventListener('click', () => render(q, host.parentElement, onResult, true));
  }

  /* ---------------- numeric-multi ---------------- */

  function renderNumericMulti(q, host, onResult) {
    const rows = q.felder.map(f => {
      const input = el('input', { type: 'text', inputmode: 'decimal', placeholder: 'z. B. -0.2222 oder -2/9' });
      const verdict = el('span', { class: 'verdict' });
      const row = el('div', { class: 'numrow' }, [
        el('span', { class: 'numlabel', html: '$' + f.label + ' = $' }),
        input,
        verdict
      ]);
      host.appendChild(row);
      return { f, input, verdict };
    });

    host.appendChild(el('p', { class: 'faint' },
      'Brüche (z. B. 4/9), Komma und Exponentialschreibweise (2.1e-8) werden akzeptiert.'));

    const actions = el('div', { class: 'btn-row' });
    const checkBtn = el('button', { class: 'btn btn-primary' }, 'Prüfen');
    const againBtn = el('button', { class: 'btn hidden' }, 'Nochmal versuchen');
    actions.append(checkBtn, againBtn);
    host.appendChild(actions);

    const fbHost = el('div');
    host.appendChild(fbHost);

    checkBtn.addEventListener('click', () => {
      if (rows.every(r => !r.input.value.trim())) {
        fbHost.replaceChildren(el('div', { class: 'fb fb-info' }, 'Bitte zuerst Werte eintragen.'));
        return;
      }

      let allOk = true;
      rows.forEach(r => {
        const got = parseNum(r.input.value);
        const ok = numMatches(got, r.f.wert, r.f.tol ?? 1e-3, r.f.tolTyp ?? 'rel');
        allOk = allOk && ok;
        r.input.disabled = true;
        r.input.classList.add(ok ? 'is-correct' : 'is-wrong');
        r.verdict.className = 'verdict ' + (ok ? 'muted' : '');
        r.verdict.style.color = ok ? 'var(--ok)' : 'var(--err)';
        r.verdict.textContent = ok ? '✓' : '✗  richtig: ' + (r.f.anzeige || fmtNum(r.f.wert));
      });

      checkBtn.classList.add('hidden');
      againBtn.classList.remove('hidden');
      fbHost.replaceChildren(feedback(q, allOk));
      math(fbHost);
      onResult(allOk);
    });

    againBtn.addEventListener('click', () => render(q, host.parentElement, onResult, true));
  }

  /* ---------------- Rahmen ---------------- */

  /**
   * Rendert eine Frage in `card` (eine .card). Bei `replace` wird der
   * bestehende Inhalt ersetzt (für "Nochmal versuchen").
   */
  function render(q, card, onResult, replace = false) {
    if (replace) card.replaceChildren();

    const head = el('div', { class: 'q-head' }, [
      el('span', { class: 'q-no' }, q.nr ? 'Frage ' + q.nr : ''),
      sourceBadge(q),
      statusPill(Progress.get(q.id).status),
      q.typ === 'mc-single'
        ? el('span', { class: 'pill' }, 'Single Choice')
        : el('span', { class: 'pill' }, 'Zahleneingabe')
    ]);
    card.appendChild(head);

    const notice = solutionNotice(q);
    if (notice) card.appendChild(notice);

    card.appendChild(el('div', { class: 'q-body', html: q.frageHtml }));

    if (q.hinweisOriginal) {
      card.appendChild(el('p', { class: 'faint' }, '↳ ' + q.hinweisOriginal));
    }

    const body = el('div');
    card.appendChild(body);

    const handle = correct => {
      Progress.record(q.id, correct);
      head.replaceChild(statusPill(correct ? 'richtig' : 'falsch'), head.children[2]);
      if (onResult) onResult(correct);
    };

    if (q.typ === 'numeric-multi') renderNumericMulti(q, body, handle);
    else renderMcSingle(q, body, handle);

    math(card);
    return card;
  }

  /** Liste aller Fragen einer Woche. */
  function renderList(questions, host, onResult) {
    if (!questions || !questions.length) {
      host.appendChild(el('div', { class: 'empty' }, [
        el('div', { class: 'empty-mark' }, '—'),
        el('p', {}, 'Für diese Woche liegen keine Moodle-Fragen vor.')
      ]));
      return;
    }
    questions.forEach((q, i) => {
      const card = el('div', { class: 'card q' });
      host.appendChild(card);
      render({ ...q, nr: i + 1 }, card, onResult);
    });
  }

  return { render, renderList };
})();
