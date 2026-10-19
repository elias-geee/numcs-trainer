# NumCS Trainer

Lern-Website zu **401-0663-00 Numerische Methoden D-INFK** (ETH Zürich).
Training mit den Original-Moodle-Fragen und CodeExpert-Aufgaben; jeder Punkt der
Zusammenfassung verweist auf Abschnitt und Seite im Skript, weil das Skript an
der Prüfung erlaubt ist.

> **Herkunft des Materials.** Kursmaterial © Seminar für Angewandte Mathematik,
> ETH Zürich (V. Gradinaru). Zusammenfassungen, Aufgabenstellungen und
> Beispielcode stammen aus dem Material zur Vorlesung 401-0663-00. Dies ist eine
> private Lernhilfe, keine offizielle Kursseite und nicht von der ETH
> herausgegeben. Bei Beanstandungen genügt ein Issue in diesem Repository.

## Starten

```bash
python3 -m http.server 8000
```

Dann <http://localhost:8000> öffnen.

Ein Webserver ist nötig — per Doppelklick auf `index.html` schlagen die
`fetch`-Aufrufe für `data/*.json` fehl.

**Internet wird beim ersten Lauf gebraucht:** KaTeX und Pyodide kommen vom CDN
(jsDelivr). Pyodide lädt erst beim ersten Klick auf *Ausführen und prüfen*, und
dann nur die Pakete, die die Aufgabe deklariert (`braucht`). NumPy + Matplotlib
sind rund 15 MB; der Browser cacht sie danach.

## Aufbau

```
numcs/
  index.html                 Shell
  css/style.css              Light/Dark über CSS-Tokens
  js/util.js                 esc / el / KaTeX / Zahlen-Parser
  js/progress.js             localStorage, Export/Import
  js/pyodide-runner.js       Python im Browser, Plot-Capture, timerpro-Shim
  js/quiz.js                 Moodle-Fragetypen
  js/codetask.js             CodeExpert-Stufen 1–3
  js/summary.js              Zusammenfassung
  js/app.js                  Router, Sidebar, Views
  data/index.json            Liste der Wochen
  data/woche_XX.json         eine Datei pro Woche — die einzige Inhaltsquelle
  assets/ref/<taskId>.png    Referenzgrafiken (generiert)
  tools/check_solutions.py   führt alle Lösungen aus und prüft die Teststärke
  tools/check_content.py     statische Prüfung der Inhalte
  tools/pyodide-selftest.html prüft dieselben Lösungen im echten Browser
```

**Der Code kennt keine Inhalte.** Eine neue Woche besteht nur aus einer neuen
JSON-Datei plus einem Eintrag in `data/index.json`.

## Stand

| Woche | Thema | Skript | Moodle | CodeExpert |
|---|---|---|---|---|
| 1 | Rundungsfehler und Fehlerpropagation | 1.1 | 9 eigene | 3 (10 Lücken) |
| 2 | Rechenaufwand, Rechnen mit Matrizen | 1.2–1.3 | 10 eigene | 4 (11 Lücken) |
| 3 | Polynominterpolation | 2.1–2.3 | **6 Original** + 6 eigene | 2 (8 Lücken) |
| 4 | Chebyshev-Interpolation | 2.4 | 10 eigene | 1 (4 Lücken) |
| 5 | Trigonometrische Interpolation, DFT | 3.1–3.6 | **4 Original** + 8 eigene | 4 (20 Lücken) |
| 6 | Stückweise polynomiale Interpolation | 4.1–4.3 | **7 Original** + 10 eigene | – (keine im Material) |
| 7–14 | Quadratur bis DNNs | 5–8 | Platzhalter, «Aufgaben folgen» | |

Wochen 1–6 sind vollständig: 80 Moodle-Fragen (17 davon Original) und
14 CodeExpert-Aufgaben mit 53 Lücken, alle verifiziert.

Seitenzahlen sind die **gedruckten** Nummern im Skript (PDF-Seite = Skriptseite + 1).

> **Zu den Moodle-Lösungen:** In keinem der 17 Screenshots ist die offizielle
> Antwort markiert. Alle Lösungen sind selbst erarbeitet, im Interface als
> «Eigene Lösung – nicht offiziell» gekennzeichnet und mit Skript-Verweis
> begründet. Prüfe sie im Zweifel dort nach.

## Neue Woche ergänzen

### 1. Material zuordnen

Die Moodle-Ordner heissen nicht wie die Wochen. Zugeordnet wird **nach Inhalt**:
`Quiz2` → Woche 3, `Quiz3` → Woche 5, `Quiz4` → Woche 6.

### 2. `data/woche_XX.json` anlegen

Am einfachsten `woche_01.json` kopieren und ersetzen. Gerüst:

```jsonc
{
  "woche": 4,
  "titel": "Chebyshev-Interpolation",
  "status": "vollstaendig",            // | "in_arbeit" | "platzhalter"
  "skript":  { "kapitel": "2.4", "seiten": "54–64" },
  "vorlage": "wochenplan/Vorlage04_ChebyInterpolation.pdf",
  "einleitung": "<p>…roter Faden der Woche…</p>",
  "moodleHinweis": "<p>…woher die Fragen stammen…</p>",
  "zusammenfassung": [ … ],
  "moodle":          [ … ],
  "codeexpert":      [ … ]
}
```

Danach den Eintrag in `data/index.json` auf denselben `status` setzen — der
Checker meckert, wenn beide auseinanderlaufen.

### Zusammenfassungspunkt

```jsonc
{
  "id": "w4-z1",
  "titel": "Chebyshev-Polynome erster Art",
  "ref": { "abschnitt": "2.4", "seite": 54, "nummer": "Def. 2.4.1, (2.4.19)" },
  "text": "<p>HTML. Mathe als $…$ oder $$…$$.</p>",
  "formeln": ["T_n(x)=\\cos(n\\arccos x)"],   // wird als $$…$$ gerendert
  "merke": "Ein Satz, der an der Prüfung trägt."
}
```

> **Achtung `<` in Formeln.** In allen HTML-Feldern muss ein mathematisches
> Kleiner-Zeichen als `&lt;` geschrieben werden (`$x &lt; 0$`), sonst
> verschluckt der HTML-Parser den Rest des Satzes. `>` ist unkritisch.

### Moodle-Frage

Zwei Typen, beide aus dem Originalmaterial abgeleitet:

```jsonc
{
  "id": "m-w4-01",
  "quelle": { "typ": "original",       // | "zusatz"
              "datei": "moodle quizes/Quiz2/Bildschirmfoto … .png" },
  "typ": "mc-single",
  "thema": "Chebyshev-Knoten",
  "frageHtml": "<p>Wörtlich aus dem Screenshot, Tippfehler inklusive.</p>",
  "hinweisOriginal": "Hinweistext, der im Original unter der Frage steht.",
  "optionen": ["…", "…", "…", "…"],
  "loesung": 2,                        // Index in "optionen"
  "loesungsStatus": "eigene",          // für dieses Material immer "eigene"
  "erklaerung": "<p>Warum — mit Bezug aufs Skript.</p>",
  "skriptRef": { "abschnitt": "2.4", "seite": 57, "nummer": "Thm. 2.4.3" }
}
```

Für Zahleneingaben `"typ": "numeric-multi"` und statt `optionen`/`loesung`:

```jsonc
"felder": [
  { "label": "T_3(0.5)", "wert": -1.0, "tol": 0.002, "tolTyp": "rel",
    "anzeige": "-1" }          // optional: so wird die Lösung angezeigt
]
```

`tolTyp` ist `"rel"` oder `"abs"`. Eingaben dürfen Brüche (`4/9`), Komma und
`2.1e-8` sein.

**Die Reihenfolge der Optionen bei Originalfragen nicht verändern** — sie soll
dem Screenshot entsprechen. (Bei den CodeExpert-Lücken mischt die Seite
automatisch, dort ist die Position also egal.)

### CodeExpert-Aufgabe

```jsonc
{
  "id": "ce-w4-clenshaw",
  "titel": "Clenshaw",
  "quelle": "codeexpert/Clenshaw - Student attempt .rtf",
  "skriptRef": { "abschnitt": "2.4", "seite": 61 },
  "braucht": ["numpy", "matplotlib", "scipy"],   // "timerpro" für das Shim
  "beschreibung": "<p>Aus den Docstrings und dem Plot-Code abgeleitet.</p>",
  "hinweisUmgebung": "<p>Nur falls vom Original abgewichen wird.</p>",

  "luecken_template": "…Code mit «L1», «L2» …",  // Quelle für Stufe 1 UND 2
  "luecken": [
    { "id": "L1",
      "loesung": "a[k] + 2.0 * x * dk1 - dk2",
      "optionen": ["…", "…", "…", "…"],
      "richtig": 1,                     // Index von loesung in optionen
      "erklaerung": "<p>Was die Operation numerisch bedeutet.</p>",
      "hinweis": "Eine Frage, die auf die Spur bringt." }
  ],

  "template": "…rekonstruiertes Original mit # TODO…",   // Stufe 3
  "loesung":  "…vollständiger Referenzcode…",
  "test": { "typ": "werte",             // | "plot"
            "pruefcode": "assert …" },
  "referenzPlot": "assets/ref/ce-w4-clenshaw.png"        // oder [ …, … ]
}
```

Die drei Stufen entstehen automatisch:

| Stufe | Quelle | Prüfung |
|---|---|---|
| 1 Auswahl | `luecken_template` + `optionen` | Index-Vergleich, sofort |
| 2 Eintippen | `luecken_template` + Textfelder | Code ausführen + `pruefcode` |
| 3 Alles selbst | `template` im Editor | Code ausführen + `pruefcode` |

### Gute Lücken und gute Tests

**Lücken** sollen die Kernoperation treffen, nie Variablennamen. Fehloptionen so
bauen, wie man es tatsächlich falsch macht: falsche Achse (`axis=0` statt `1`),
falscher Index (`i-1` statt `i-j`), fehlende Transponierung, `2**k` statt
`4**k`, `np.real` statt `np.imag`, vergessener Faktor `2` im Nenner.

**Prüfcode** lieber auf *Eigenschaften* testen als auf hart kodierte Zahlen:

```python
# gut: unabhängig nachgerechnet
assert np.allclose(evalNewton(x, dd, x), y)          # Interpolationsbedingung
assert 3.2 < e[2]/e[3] < 5.0                         # Konvergenzordnung 2
assert abs(yf[25]) > 1.0                             # Instabilität sichtbar

# schlecht: ich habe die Zahl von Hand ausgerechnet
assert abs(result - 0.6321205588) < 1e-9
```

So bestehen gleichwertige Schreibweisen, und der Test prüft wirklich das
Konzept. Der Checker erzwingt das zusätzlich: **jede** falsche Option muss
durchfallen, sonst ist der Test zu schwach.

### 3. Verifizieren — vor dem Veröffentlichen

Einmalig eine Umgebung für die Checker anlegen (die Website selbst braucht
sie nicht — die läuft im Browser über Pyodide):

```bash
python3 -m venv .venv
.venv/bin/pip install -r tools/requirements.txt
```

```bash
# a) Code: Lösungen, Lückencode, Template, Optionen, Teststärke
.venv/bin/python tools/check_solutions.py

# b) Inhalt: rohes "<", offene $-Formeln, fehlende Pfade, Schlüssel-Tippfehler
.venv/bin/python tools/check_content.py

# c) Referenzgrafiken erzeugen (schreibt assets/ref/<taskId>.png)
.venv/bin/python tools/check_solutions.py --plots

# d) nur eine Woche — bei beiden Skripten
.venv/bin/python tools/check_solutions.py --week 4
.venv/bin/python tools/check_content.py   --week 4
```

Die beiden prüfen Verschiedenes und ergänzen sich:

| | prüft |
|---|---|
| `check_solutions.py` | führt Python aus: Musterlösung besteht den Test, Lückencode besteht ihn auch, Template besteht ihn **nicht**, und **jede** falsche MC-Option fällt durch |
| `check_content.py` | statisch: rohes `<` in HTML-Feldern, ungerade `$`-Zahl, fehlende Referenzgrafik oder Screenshot, `«Lk»` ohne Eintrag in `luecken`, `loesungsStatus`, unbekannte Schlüssel |

Wichtig: `check_content.py` prüft die `optionen` einer **Lücke** bewusst *nicht*
auf rohes `<` — das ist Python-Code und wird als Textknoten gerendert, dort ist
`py <= threshold` völlig korrekt. Nur echte HTML-Felder werden geprüft.

Danach dieselben Aufgaben **im Browser**, weil Pyodide sich anders verhält als
CPython (fehlende Pakete, Backend, Dateisystem):

```bash
python3 -m http.server 8000
open "http://localhost:8000/tools/pyodide-selftest.html?weeks=4"
```

Beides muss grün sein. Der Browser-Test hat zum Beispiel gefunden, dass der
Prelude `matplotlib` importierte, obwohl eine Aufgabe nur NumPy lädt — offline
war davon nichts zu sehen.

## Fortschritt

Liegt in `localStorage` unter `numcs.progress.v1`, ein Eintrag pro Aufgabe
(`status`, `versuche`, `zuletzt`). CodeExpert-Stufen zählen einzeln
(`<taskId>:s1`, `:s2`, `:s3`).

*Fehler wiederholen* sammelt alle Aufgaben, die beim letzten Versuch falsch
waren — über alle Wochen hinweg. Unter *Fortschritt sichern* lässt sich der
Stand als JSON exportieren und in einem anderen Browser importieren.

## Bekannte Abweichungen vom Original

- **`timerpro`** existiert nur in CodeExpert. Das Shim in `js/pyodide-runner.js`
  bietet denselben Dekorator, kopiert aber Array-Argumente pro Durchlauf und
  gibt das Ergebnis des *ersten* Laufs zurück. Ohne das würden in-place
  arbeitende Funktionen wie `divdiff` ab dem zweiten Durchlauf auf bereits
  transformierten Daten rechnen.
- **`sympy`** (3-term Rekursion) ist weggelassen; stattdessen prüft der Test
  direkt die Rekursion und die Monotonie der Folge.
- **Datensätze verkleinert**, wo das Original für den Browser zu gross wäre
  (Newton: 999 → 400 Punkte). Steht jeweils im Feld `hinweisUmgebung`.
- **`__name__`** wird im Prelude auf `"__main__"` gesetzt, damit Templates mit
  `if __name__ == "__main__":` unverändert laufen.
