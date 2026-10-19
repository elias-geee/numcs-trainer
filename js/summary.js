/* ============================================================
   summary.js — Zusammenfassung der Skript-Kapitel einer Woche
   Jeder Punkt trägt seinen Verweis (Abschnitt, Seite, Nummer),
   damit das Nachschlagen an der Prüfung schnell geht.
   ============================================================ */

const Summary = (() => {

  function item(z) {
    const box = el('div', { class: 'sum-item' });

    const head = el('div', { class: 'sum-head' }, [
      el('h3', {}, z.titel),
      refChip(z.ref)
    ]);
    box.appendChild(head);

    if (z.text) box.appendChild(el('div', { html: z.text }));

    (z.formeln || []).forEach(f => {
      box.appendChild(el('div', { class: 'sum-formula', html: '$$' + f + '$$' }));
    });

    if (z.merke) {
      box.appendChild(el('div', { class: 'merke', html: '<b>Merke:</b> ' + z.merke }));
    }
    return box;
  }

  function overviewTable(week) {
    const rows = [];
    (week.moodle || []).forEach((q, i) => rows.push([
      'Moodle ' + (i + 1),
      q.quelle && q.quelle.typ === 'original' ? 'Original' : 'Eigene',
      q.thema || (q.typ === 'numeric-multi' ? 'Zahleneingabe' : 'Single Choice'),
      Progress.get(q.id).status
    ]));
    (week.codeexpert || []).forEach(t => {
      const st = [1, 2, 3].map(n => Progress.get(`${t.id}:s${n}`).status);
      rows.push([
        'CodeExpert',
        'Original',
        t.titel,
        st.every(s => s === 'richtig') ? 'richtig'
          : st.some(s => s === 'falsch') ? 'falsch' : 'offen'
      ]);
    });

    if (!rows.length) return null;

    const tbody = el('tbody');
    rows.forEach(r => {
      tbody.appendChild(el('tr', {}, [
        el('td', {}, r[0]),
        el('td', {}, r[1]),
        el('td', {}, r[2]),
        el('td', {}, [statusPill(r[3])])
      ]));
    });

    return el('div', { class: 'tbl-wrap' }, [
      el('table', { class: 'tbl' }, [
        el('thead', {}, [el('tr', {}, [
          el('th', {}, 'Art'), el('th', {}, 'Herkunft'), el('th', {}, 'Thema'), el('th', {}, 'Status')
        ])]),
        tbody
      ])
    ]);
  }

  function render(week, host) {
    if (week.status === 'in_arbeit') {
      host.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'notice' }, [
          el('span', { class: 'notice-icon' }, '🔨'),
          el('span', {}, [
            el('b', {}, 'Wird gerade aufgebaut. '),
            document.createTextNode(
              'Für diese Woche liegt Material vor (Wochenplan, Mitschrieb und Aufgaben), ' +
              'die Zusammenfassung und das Training entstehen im nächsten Schritt.'
            )
          ])
        ]),
        el('p', {}, [
          document.createTextNode('Thema: '), el('b', {}, week.titel),
          document.createTextNode(' — Skript Kapitel ' + (week.skript?.kapitel || '—') +
            ', Seiten ' + (week.skript?.seiten || '—') + '.')
        ]),
        week.material ? el('div', { html: week.material }) : null
      ]));
      return;
    }

    if (week.status === 'platzhalter') {
      host.appendChild(el('div', { class: 'card' }, [
        el('div', { class: 'notice' }, [
          el('span', { class: 'notice-icon' }, '⏳'),
          el('span', {}, [
            el('b', {}, 'Aufgaben folgen. '),
            document.createTextNode(
              'Diese Woche wurde in der Vorlesung noch nicht behandelt — es liegt weder ' +
              'ausgefüllter Wochenplan noch Moodle- oder CodeExpert-Material vor.'
            )
          ])
        ]),
        el('p', {}, [
          document.createTextNode('Vorgesehenes Thema laut '),
          el('code', {}, week.vorlage || 'wochenplan/'),
          document.createTextNode(': '),
          el('b', {}, week.titel)
        ]),
        el('p', { class: 'faint' }, 'Skript: Kapitel ' + (week.skript?.kapitel || '—') +
          ', Seiten ' + (week.skript?.seiten || '—') + '.')
      ]));
      return;
    }

    if (week.einleitung) {
      host.appendChild(el('div', { class: 'card' }, [el('div', { html: week.einleitung })]));
    }

    const card = el('div', { class: 'card' });
    card.appendChild(el('div', { class: 'kicker' }, 'Kernpunkte aus dem Skript'));
    (week.zusammenfassung || []).forEach(z => card.appendChild(item(z)));
    host.appendChild(card);

    const tbl = overviewTable(week);
    if (tbl) {
      const c2 = el('div', { class: 'card' });
      c2.appendChild(el('div', { class: 'kicker' }, 'Aufgaben dieser Woche'));
      c2.appendChild(tbl);
      host.appendChild(c2);
    }

    math(host);
  }

  return { render };
})();
