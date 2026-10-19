#!/usr/bin/env python3
"""
check_content.py — statische Prüfung der Inhaltsdateien unter data/.

Ergänzt tools/check_solutions.py (das den Python-Code ausführt) um die Dinge,
die man sonst nur im Browser sieht:

  1. rohes "<" in HTML-Feldern (NICHT in Lücken-Optionen: das ist
     Python-Code und wird als Textknoten gerendert)
     $x < 0$ wird vom HTML-Parser als Tag-Anfang gelesen und verschluckt den
     Rest des Satzes. Muss &lt; heissen. (Dieser Fehler ist live aufgetreten.)
  2. ungerade Anzahl "$" in einem Feld — eine nicht geschlossene Formel
  3. referenzPlot zeigt auf eine Datei, die es nicht gibt
  4. Skriptseite liegt ausserhalb des Seitenbereichs der Woche
  5. IDs: eindeutig, und das Wochenpräfix passt zur Datei
  6. mc-single hat mindestens 3 Optionen; numeric-multi hat tol und tolTyp
  7. Originalfragen: loesungsStatus "eigene" und ein Screenshot-Pfad,
     der existiert
  8. unbekannte Schlüssel (Tippfehler wie "loesungStatus")

Aufruf:
    python3 tools/check_content.py
    python3 tools/check_content.py --week 5
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
PROJECT = ROOT.parent

GREEN, RED, YELLOW, DIM, RESET = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"

# Tags, die in den Inhalten vorkommen dürfen.
TAGS = (r'(?:/?(?:p|b|i|u|em|strong|code|pre|ul|ol|li|br|hr|span|div|h\d|table|'
        r'tr|td|th|thead|tbody|sub|sup|figure|figcaption|img|a|blockquote|'
        r'dl|dt|dd|small|mark|kbd|samp|var|cite|abbr)\b|/)')

# Felder, deren Inhalt als HTML ins Dokument geschrieben wird.
HTML_FIELDS = {
    "frageHtml", "erklaerung", "text", "merke", "beschreibung", "einleitung",
    "material", "moodleHinweis", "hinweisUmgebung", "hinweisOriginal",
    "hinweis", "titel", "label", "anzeige",
}
HTML_LISTS = {"optionen", "formeln"}

ALLOWED = {
    "week": {"woche", "titel", "status", "skript", "vorlage", "einleitung",
             "material", "moodleHinweis", "aufgabenUebersicht",
             "zusammenfassung", "moodle", "codeexpert"},
    "zus": {"id", "titel", "ref", "text", "formeln", "merke"},
    "moodle": {"id", "quelle", "typ", "thema", "frageHtml", "hinweisOriginal",
               "optionen", "loesung", "felder", "loesungsStatus",
               "damaligeAuswahl", "erklaerung", "skriptRef"},
    "code": {"id", "titel", "quelle", "skriptRef", "braucht", "beschreibung",
             "hinweisUmgebung", "luecken_template", "luecken", "template",
             "loesung", "test", "referenzPlot"},
    "luecke": {"id", "loesung", "optionen", "richtig", "erklaerung", "hinweis"},
}

problems: list[str] = []
checked = 0


def fail(where: str, msg: str, ctx: str = "") -> None:
    problems.append(f"{where}: {msg}")
    print(f"  {RED}FAIL{RESET} {where}: {msg}")
    if ctx:
        print(f"       {DIM}…{ctx}…{RESET}")


def warn(where: str, msg: str) -> None:
    print(f"  {YELLOW}!   {RESET} {where}: {msg}")


def check_html(where: str, value: str) -> None:
    """Rohes '<' und unpaarige '$' finden."""
    global checked
    checked += 1
    for m in re.finditer(r"<", value):
        if not re.match(TAGS, value[m.start() + 1:m.start() + 14]):
            ctx = value[max(0, m.start() - 40):m.start() + 40].replace("\n", " ")
            fail(where, 'rohes "<" — muss "&lt;" heissen, sonst verschluckt '
                        'der HTML-Parser den Rest', ctx)
    # $ zählen, \$ ignorieren
    dollars = len(re.findall(r"(?<!\\)\$", re.sub(r"\$\$", "", value)))
    if dollars % 2:
        fail(where, f"ungerade Anzahl '$' ({dollars}) — nicht geschlossene Formel?",
             value[:90].replace("\n", " "))


def walk_html(obj, path: str) -> None:
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and k in HTML_FIELDS and not (
                    k == "loesung" or (".luecken" in path and k in ("titel", "label"))):
                check_html(f"{path}.{k}", v)
            elif isinstance(v, list) and k in HTML_LISTS and ".luecken" not in path:
                # Die Optionen einer CodeExpert-Luecke sind Python-Code und
                # werden als Textknoten gerendert (<option>, <code>) — dort ist
                # ein rohes "<" voellig legitim und darf nicht gemeldet werden.
                for i, s in enumerate(v):
                    if isinstance(s, str):
                        check_html(f"{path}.{k}[{i}]", s)
            else:
                walk_html(v, f"{path}.{k}")
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            walk_html(v, f"{path}[{i}]")


def keys(where: str, obj: dict, allowed: set) -> None:
    extra = set(obj) - allowed
    if extra:
        fail(where, f"unbekannte Schlüssel: {sorted(extra)}")


def page_range(week: dict):
    s = (week.get("skript") or {}).get("seiten", "")
    m = re.match(r"\s*(\d+)\s*[–-]\s*(\d+)", s)
    return (int(m.group(1)), int(m.group(2))) if m else None


def check_ref(where: str, ref, rng) -> None:
    if not isinstance(ref, dict):
        return
    p = ref.get("seite")
    if p is None:
        warn(where, "Verweis ohne Seitenzahl")
        return
    if rng and not (rng[0] - 8 <= p <= rng[1] + 8):
        warn(where, f"Seite {p} liegt ausserhalb des Wochenbereichs {rng[0]}–{rng[1]}")


def check_week(path: Path, seen: dict) -> None:
    global checked
    week = json.loads(path.read_text(encoding="utf-8"))
    n = week["woche"]
    print(f"\n{DIM}-- {path.name} — Woche {n}: {week['titel']} [{week.get('status')}]{RESET}")

    keys(path.name, week, ALLOWED["week"])
    walk_html(week, path.name)
    rng = page_range(week)

    for z in week.get("zusammenfassung", []):
        w = f"{path.name}/{z.get('id')}"
        keys(w, z, ALLOWED["zus"])
        check_ref(w, z.get("ref"), rng)

    for q in week.get("moodle", []):
        w = f"{path.name}/{q.get('id')}"
        checked += 1
        keys(w, q, ALLOWED["moodle"])

        if q["id"] in seen:
            fail(w, f"ID doppelt (auch in {seen[q['id']]})")
        seen[q["id"]] = path.name
        if not re.match(rf"^m-w{n}-\d\d$", q["id"]):
            warn(w, f"ID folgt nicht dem Muster m-w{n}-NN")

        if q.get("loesungsStatus") != "eigene":
            fail(w, "loesungsStatus muss 'eigene' sein — im Material ist nirgends "
                    "eine offizielle Lösung markiert")

        quelle = q.get("quelle") or {}
        if quelle.get("typ") == "original":
            d = quelle.get("datei")
            if not d:
                fail(w, "Originalfrage ohne Screenshot-Pfad")
            elif not (PROJECT / d).exists():
                fail(w, f"Screenshot nicht gefunden: {d}")
        elif quelle.get("typ") != "zusatz":
            fail(w, f"quelle.typ muss 'original' oder 'zusatz' sein, nicht {quelle.get('typ')!r}")

        if q["typ"] == "mc-single":
            opts = q.get("optionen") or []
            if len(opts) < 3:
                fail(w, f"nur {len(opts)} Optionen")
            if not isinstance(q.get("loesung"), int) or not (0 <= q["loesung"] < len(opts)):
                fail(w, "loesung ist kein gültiger Index")
            if "damaligeAuswahl" in q and not (0 <= q["damaligeAuswahl"] < len(opts)):
                fail(w, "damaligeAuswahl ist kein gültiger Index")
        elif q["typ"] == "numeric-multi":
            for i, f_ in enumerate(q.get("felder") or []):
                if "wert" not in f_:
                    fail(w, f"Feld {i} ohne 'wert'")
                if "tol" not in f_ or f_.get("tolTyp") not in ("rel", "abs"):
                    fail(w, f"Feld {i} ohne gültige tol/tolTyp")
        else:
            fail(w, f"unbekannter Fragetyp {q['typ']!r}")

        check_ref(w, q.get("skriptRef"), rng)
        if not q.get("erklaerung"):
            fail(w, "keine Erklärung")

    for t in week.get("codeexpert", []):
        w = f"{path.name}/{t.get('id')}"
        checked += 1
        keys(w, t, ALLOWED["code"])
        if t["id"] in seen:
            fail(w, f"ID doppelt (auch in {seen[t['id']]})")
        seen[t["id"]] = path.name
        if not re.match(rf"^ce-w{n}-[a-z0-9]+$", t["id"]):
            warn(w, f"ID folgt nicht dem Muster ce-w{n}-<kurzname>")

        src = t.get("quelle")
        if src and not (PROJECT / src).exists():
            fail(w, f"Quelldatei nicht gefunden: {src}")

        for r in ([] if not t.get("referenzPlot")
                  else ([t["referenzPlot"]] if isinstance(t["referenzPlot"], str)
                        else t["referenzPlot"])):
            if not (ROOT / r).exists():
                fail(w, f"Referenzgrafik fehlt: {r}")

        for g in t.get("luecken", []):
            keys(f"{w}/{g.get('id')}", g, ALLOWED["luecke"])

        check_ref(w, t.get("skriptRef"), rng)

        tmpl = t.get("luecken_template", "")
        marks = set(re.findall(r"«(L\d+)»", tmpl))
        ids = {g["id"] for g in t.get("luecken", [])}
        if marks != ids:
            fail(w, f"Marker im Template {sorted(marks)} passen nicht zu "
                    f"luecken {sorted(ids)}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--week", type=int, default=None)
    args = ap.parse_args()

    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    by_num = {e["woche"]: e for e in index["wochen"]}
    seen: dict[str, str] = {}

    for path in sorted(DATA.glob("woche_*.json")):
        n = int(path.stem.split("_")[1])
        if args.week is not None and n != args.week:
            continue
        week = json.loads(path.read_text(encoding="utf-8"))
        if by_num.get(n, {}).get("status") != week.get("status"):
            fail(path.name, f"Status weicht von index.json ab "
                            f"({week.get('status')} vs {by_num.get(n, {}).get('status')})")
        check_week(path, seen)

    print("\n" + "=" * 72)
    if problems:
        print(f"{RED}{len(problems)} Probleme in {checked} geprüften Elementen:{RESET}")
        for p in problems:
            print(f"  - {p}")
        return 1
    print(f"{GREEN}Inhalte sauber ({checked} Elemente geprüft).{RESET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
