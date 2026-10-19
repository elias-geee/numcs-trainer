#!/usr/bin/env python3
"""
check_solutions.py — verifiziert alle Inhalte unter data/ offline.

Keine Aufgabe soll auf die Seite gehen, bevor dieses Skript grün ist.

Geprüft wird pro CodeExpert-Aufgabe:
  1. Musterlösung (`loesung`) läuft und besteht `test.pruefcode`
  2. Lückencode (`luecken_template`) mit eingesetzten `luecken[].loesung`
     läuft ebenfalls und besteht denselben Test
     → garantiert, dass Stufe 2 mit der ausgewiesenen Lösung bestanden wird
  3. Template (`template`) läuft NICHT durch (sonst wäre nichts zu tun)
  4. Für jede Lücke: optionen[richtig] == loesung, Optionen eindeutig
  5. Jede falsche MC-Option darf den Test NICHT bestehen
     → fängt Tests ab, die alles akzeptieren

Und pro Moodle-Frage:
  - mc-single: loesung ist ein gültiger Index
  - numeric-multi: jedes Feld hat Wert und Toleranz
  - jede ID ist projektweit eindeutig

Aufruf:
    python3 tools/check_solutions.py              # alles prüfen
    python3 tools/check_solutions.py --plots      # zusätzlich assets/ref/*.png
    python3 tools/check_solutions.py --week 3     # nur eine Woche
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import sys
import textwrap
import traceback
from contextlib import redirect_stdout, redirect_stderr
from pathlib import Path

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
REFPLOTS = ROOT / "assets" / "ref"
GAP_RE = re.compile(r"«(L\d+)»")

# Muss mit TIMERPRO_SRC in js/pyodide-runner.js übereinstimmen.
TIMERPRO_SRC = '''
import time

def time_it_pro(repetitions=1):
    def decorator(func):
        def wrapper(*args, **kwargs):
            ts = []
            result = None
            for r in range(repetitions):
                a = [v.copy() if hasattr(v, 'copy') and hasattr(v, 'shape') else v
                     for v in args]
                start = time.perf_counter()
                out = func(*a, **kwargs)
                ts.append(time.perf_counter() - start)
                if r == 0:
                    result = out
            wrapper.min_time = min(ts)
            wrapper.ats.append(min(ts))
            print(f'Min. Time taken: {min(ts):.6f} seconds in ', func.__name__)
            return result
        wrapper.ats = []
        wrapper.min_time = 0.0
        wrapper.__name__ = func.__name__
        wrapper.__doc__ = func.__doc__
        return wrapper
    return decorator
'''

GREEN, RED, YELLOW, DIM, RESET = "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"

failures: list[str] = []
checks = 0


def ok(msg: str) -> None:
    global checks
    checks += 1
    print(f"  {GREEN}OK {RESET} {msg}")


def bad(msg: str, detail: str = "") -> None:
    global checks
    checks += 1
    failures.append(msg)
    print(f"  {RED}FAIL {msg}{RESET}")
    if detail:
        print(textwrap.indent(detail.rstrip(), "      "))


def warn(msg: str) -> None:
    print(f"  {YELLOW}!  {RESET} {msg}")


# --------------------------------------------------------------------------- #
#  Ausführung
# --------------------------------------------------------------------------- #

def setup_timerpro(tmpdir: Path) -> None:
    tmpdir.mkdir(parents=True, exist_ok=True)
    (tmpdir / "timerpro.py").write_text(TIMERPRO_SRC, encoding="utf-8")
    if str(tmpdir) not in sys.path:
        sys.path.insert(0, str(tmpdir))


def run_code(code: str, pruefcode: str | None):
    """Führt Code und optional Prüfcode in frischem Namensraum aus.

    Rückgabe: (good, passed, ns, text, traceback_text)
      good    – Code lief ohne Exception
      passed  – Prüfcode lief ohne Exception (None, wenn keiner)
    """
    ns: dict = {"__name__": "__main__"}
    buf = io.StringIO()
    plt.close("all")

    try:
        with redirect_stdout(buf), redirect_stderr(buf):
            exec(compile(code, "<loesung>", "exec"), ns)
    except Exception:
        return False, None, ns, buf.getvalue(), traceback.format_exc(limit=6)

    if pruefcode is None:
        return True, None, ns, buf.getvalue(), ""

    try:
        with redirect_stdout(buf), redirect_stderr(buf):
            exec(compile(pruefcode, "<pruefcode>", "exec"), ns)
    except Exception:
        return True, False, ns, buf.getvalue(), traceback.format_exc(limit=6)

    return True, True, ns, buf.getvalue(), ""


def fill_gaps(template: str, mapping: dict[str, str]) -> str:
    return GAP_RE.sub(lambda m: mapping.get(m.group(1), f"«{m.group(1)}»"), template)


def save_plots(task_id: str) -> int:
    REFPLOTS.mkdir(parents=True, exist_ok=True)
    nums = plt.get_fignums()
    for i, n in enumerate(nums):
        name = f"{task_id}.png" if len(nums) == 1 else f"{task_id}-{i + 1}.png"
        plt.figure(n).savefig(REFPLOTS / name, dpi=80, bbox_inches="tight")
    plt.close("all")
    return len(nums)


# --------------------------------------------------------------------------- #
#  Prüfungen
# --------------------------------------------------------------------------- #

def check_codetask(task: dict, make_plots: bool) -> None:
    tid = task["id"]
    print(f"\n{DIM}-- CodeExpert: {tid} — {task['titel']}{RESET}")

    pruef = (task.get("test") or {}).get("pruefcode")
    is_plot = (task.get("test") or {}).get("typ") == "plot"

    # 1 — Musterlösung
    good, passed, ns, out, tb = run_code(task["loesung"], pruef)
    if not good:
        bad(f"{tid}: die Musterlösung wirft eine Ausnahme", tb)
    elif is_plot:
        n = len(plt.get_fignums())
        (ok if n else bad)(f"{tid}: Musterlösung erzeugt {n} Figur(en)")
    elif passed:
        ok(f"{tid}: Musterlösung besteht den Test")
    else:
        bad(f"{tid}: Musterlösung besteht den eigenen Test NICHT", tb)

    if make_plots and good:
        n = save_plots(tid)
        if n:
            print(f"      -> {n} Referenzgrafik(en) nach assets/ref/")
    plt.close("all")

    gaps = task.get("luecken") or []

    # 2 — Lückencode mit den ausgewiesenen Lösungen
    if task.get("luecken_template") and gaps:
        filled = fill_gaps(task["luecken_template"], {g["id"]: g["loesung"] for g in gaps})
        rest = GAP_RE.findall(filled)
        if rest:
            bad(f"{tid}: Lücken ohne Eintrag in 'luecken': {rest}")
        good2, passed2, _, _, tb2 = run_code(filled, pruef)
        if not good2:
            bad(f"{tid}: Lückencode mit Musterlösungen wirft eine Ausnahme", tb2)
        elif is_plot:
            ok(f"{tid}: Lückencode läuft (Plot-Aufgabe)")
        elif passed2:
            ok(f"{tid}: Lückencode mit den ausgewiesenen Lösungen besteht den Test")
        else:
            bad(f"{tid}: Lückencode besteht den Test NICHT — Stufe 2 wäre unlösbar", tb2)
        plt.close("all")

    # 3 — Template darf nicht schon fertig sein
    if task.get("template"):
        good3, passed3, _, _, _ = run_code(task["template"], pruef)
        if good3 and (passed3 is True):
            bad(f"{tid}: das Template besteht den Test bereits — es ist nichts zu tun")
        else:
            ok(f"{tid}: Template ist unvollständig (wie es sein soll)")
        plt.close("all")

    # 4 — Konsistenz der Multiple-Choice-Optionen
    for g in gaps:
        gid, sol, opts, idx = g["id"], g["loesung"], g.get("optionen", []), g.get("richtig")
        if not isinstance(idx, int) or not (0 <= idx < len(opts)):
            bad(f"{tid}/{gid}: 'richtig' ist kein gültiger Index")
            continue
        if opts[idx] != sol:
            bad(f"{tid}/{gid}: optionen[{idx}] != loesung",
                f"optionen[{idx}] = {opts[idx]!r}\nloesung       = {sol!r}")
        elif len(set(opts)) != len(opts):
            bad(f"{tid}/{gid}: doppelte Optionen")
        elif len(opts) < 3:
            warn(f"{tid}/{gid}: nur {len(opts)} Optionen")
        else:
            ok(f"{tid}/{gid}: Optionen konsistent ({len(opts)} Stück)")
        if not g.get("erklaerung"):
            warn(f"{tid}/{gid}: keine Erklärung hinterlegt")

    # 5 — Gegenprobe: JEDE falsche Option muss durchfallen
    if task.get("luecken_template") and gaps and pruef and not is_plot:
        base = {x["id"]: x["loesung"] for x in gaps}
        weak = []
        for g in gaps:
            for i, optext in enumerate(g.get("optionen", [])):
                if i == g.get("richtig"):
                    continue
                mapping = dict(base)
                mapping[g["id"]] = optext
                good5, passed5, _, _, _ = run_code(fill_gaps(task["luecken_template"], mapping), pruef)
                plt.close("all")
                if good5 and passed5 is True:
                    weak.append(f"{g['id']} = {optext!r}")
        if weak:
            bad(f"{tid}: falsche Optionen bestehen den Test trotzdem — Test zu schwach",
                "\n".join(weak))
        else:
            ok(f"{tid}: alle falschen Optionen fallen durch")


def check_moodle(q: dict) -> None:
    qid = q["id"]
    if q["typ"] == "mc-single":
        opts = q.get("optionen", [])
        if not isinstance(q.get("loesung"), int) or not (0 <= q["loesung"] < len(opts)):
            bad(f"{qid}: 'loesung' ist kein gültiger Index in 'optionen'")
        elif len(set(opts)) != len(opts):
            bad(f"{qid}: doppelte Antwortoptionen")
        else:
            ok(f"{qid}: Single Choice, Lösung = Option {q['loesung'] + 1} von {len(opts)}")
    elif q["typ"] == "numeric-multi":
        felder = q.get("felder", [])
        if not felder:
            bad(f"{qid}: keine Felder definiert")
        elif any("wert" not in f for f in felder):
            bad(f"{qid}: ein Feld hat keinen Wert")
        else:
            ok(f"{qid}: Zahleneingabe, {len(felder)} Feld(er)")
    else:
        bad(f"{qid}: unbekannter Fragetyp {q['typ']!r}")

    if not q.get("erklaerung"):
        warn(f"{qid}: keine Erklärung hinterlegt")
    if q.get("quelle", {}).get("typ") == "original" and q.get("loesungsStatus") != "eigene":
        warn(f"{qid}: Originalfrage ohne Kennzeichnung 'eigene Lösung' — im Material "
             f"ist keine offizielle Lösung markiert")


# --------------------------------------------------------------------------- #

def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--plots", action="store_true",
                    help="Referenzgrafiken nach assets/ref/ schreiben")
    ap.add_argument("--week", type=int, default=None, help="nur diese Woche prüfen")
    args = ap.parse_args()

    setup_timerpro(ROOT / ".cache")
    os.chdir(ROOT)
    os.makedirs("./cx_out", exist_ok=True)

    index = json.loads((DATA / "index.json").read_text(encoding="utf-8"))
    seen_ids: dict[str, str] = {}

    for entry in index["wochen"]:
        n = entry["woche"]
        if args.week is not None and n != args.week:
            continue

        path = DATA / f"woche_{n:02d}.json"
        if not path.exists():
            bad(f"Woche {n}: {path.name} fehlt, steht aber im Index")
            continue

        week = json.loads(path.read_text(encoding="utf-8"))
        status = week.get("status")
        print(f"\n{'=' * 72}\nWoche {n} — {week['titel']}  [{status}]\n{'=' * 72}")

        if status != entry.get("status"):
            bad(f"Woche {n}: Status in index.json ({entry.get('status')}) "
                f"und {path.name} ({status}) stimmen nicht überein")

        if status in ("platzhalter", "in_arbeit"):
            print(f"  {DIM}übersprungen ({status}){RESET}")
            continue

        if not week.get("zusammenfassung"):
            bad(f"Woche {n}: Status '{status}', aber keine Zusammenfassung")
        if status == "nur_zusammenfassung" and week.get("codeexpert"):
            bad(f"Woche {n}: Status 'nur_zusammenfassung', aber es gibt schon "
                f"CodeExpert-Aufgaben — Status auf 'vollstaendig' setzen")

        for z in week.get("zusammenfassung", []):
            if not z.get("ref"):
                warn(f"Woche {n}/{z.get('id')}: Zusammenfassungspunkt ohne Skript-Verweis")

        for q in week.get("moodle", []):
            if q["id"] in seen_ids:
                bad(f"doppelte ID {q['id']} (auch in {seen_ids[q['id']]})")
            seen_ids[q["id"]] = path.name
            check_moodle(q)

        for t in week.get("codeexpert", []):
            if t["id"] in seen_ids:
                bad(f"doppelte ID {t['id']} (auch in {seen_ids[t['id']]})")
            seen_ids[t["id"]] = path.name
            check_codetask(t, args.plots)

    print(f"\n{'=' * 72}")
    if failures:
        print(f"{RED}{len(failures)} von {checks} Prüfungen fehlgeschlagen:{RESET}")
        for f in failures:
            print(f"  - {f}")
        return 1
    print(f"{GREEN}Alle {checks} Prüfungen bestanden.{RESET}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
