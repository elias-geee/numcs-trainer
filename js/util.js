/* ============================================================
   util.js — kleine Helfer, die alle Views teilen
   ============================================================ */

/** HTML-escapen. Für alles, was aus Daten kommt und kein Markup sein soll. */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Element bauen: el('div', {class:'x'}, 'text' | node | [..]) */
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) {
    if (c === null || c === undefined || c === false) continue;
    n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
  }
  return n;
}

/** KaTeX über einen Teilbaum laufen lassen. */
function math(root) {
  if (typeof renderMathInElement !== 'function') return;
  try {
    renderMathInElement(root, {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\[', right: '\\]', display: true },
        { left: '$', right: '$', display: false },
        { left: '\\(', right: '\\)', display: false }
      ],
      throwOnError: false,
      ignoredTags: ['script', 'noscript', 'style', 'textarea', 'option']
    });
  } catch (e) {
    console.warn('KaTeX:', e);
  }
}

/** Skript-Verweis als Chip: "§2.3 · S. 49 · (2.3.14)" */
function refChip(ref) {
  if (!ref) return null;
  const parts = [];
  if (ref.abschnitt) parts.push('§' + ref.abschnitt);
  if (ref.seite) parts.push('S. ' + ref.seite);
  if (ref.nummer) parts.push(ref.nummer);
  if (!parts.length) return null;
  return el('span', { class: 'ref', title: 'Fundstelle im Vorlesungsskript' }, parts.join(' · '));
}

/** Badge für den Status einer Aufgabe. */
function statusPill(status) {
  if (status === 'richtig') return el('span', { class: 'pill pill-ok' }, 'richtig');
  if (status === 'falsch') return el('span', { class: 'pill pill-err' }, 'falsch');
  return el('span', { class: 'pill' }, 'offen');
}

/** Zahl aus Nutzereingabe lesen; akzeptiert Komma, 1e-8, Brüche wie 4/9. */
function parseNum(raw) {
  const s = String(raw).trim().replace(',', '.').replace(/\s+/g, '');
  if (!s) return NaN;
  const frac = s.match(/^(-?\d*\.?\d+(?:[eE][-+]?\d+)?)\/(-?\d*\.?\d+(?:[eE][-+]?\d+)?)$/);
  if (frac) {
    const d = Number(frac[2]);
    return d === 0 ? NaN : Number(frac[1]) / d;
  }
  return Number(s);
}

/** Vergleich mit relativer oder absoluter Toleranz. */
function numMatches(got, want, tol = 1e-3, tolTyp = 'rel') {
  if (!Number.isFinite(got)) return false;
  if (tolTyp === 'abs') return Math.abs(got - want) <= tol;
  return Math.abs(got - want) <= tol * Math.max(1e-12, Math.abs(want));
}

/** Kurze Zahlformatierung für Lösungsanzeigen. */
function fmtNum(x) {
  if (!Number.isFinite(x)) return String(x);
  if (x !== 0 && (Math.abs(x) < 1e-3 || Math.abs(x) >= 1e6)) return x.toExponential(4);
  return String(Math.round(x * 1e8) / 1e8);
}
