/* ============================================================
   pyodide-runner.js — Python im Browser
   Lädt Pyodide erst beim ersten Bedarf, Pakete nur auf Anforderung.
   Gibt pro Lauf stdout, Fehlertext und alle erzeugten Matplotlib-
   Figuren als PNG-Data-URLs zurück.
   ============================================================ */

const Py = (() => {
  const PYODIDE_VERSION = 'v0.26.4';
  const INDEX_URL = `https://cdn.jsdelivr.net/pyodide/${PYODIDE_VERSION}/full/`;

  let pyodide = null;
  let bootPromise = null;
  const loadedPkgs = new Set();

  // Ersatzmodule fuer Module, die CodeExpert mitbringt, Pyodide aber nicht
  // (timerpro, plotstuff, testfuncsCs, …). Quelle ist data/shims.json —
  // dieselbe Datei nutzt tools/check_solutions.py, damit Browser und
  // Offline-Prüfung nicht auseinanderlaufen.
  let shimNames = [];

  async function writeShims(py) {
    const res = await fetch('data/shims.json', { cache: 'no-cache' });
    if (!res.ok) throw new Error('data/shims.json nicht ladbar (' + res.status + ')');
    const mods = (await res.json()).module || {};
    shimNames = Object.keys(mods);
    for (const [name, src] of Object.entries(mods)) {
      py.FS.writeFile(name + '.py', src, { encoding: 'utf8' });
    }
  }

  // __name__ wird gesetzt, damit Templates mit
  // `if __name__ == "__main__":` unveraendert laufen.
  // matplotlib wird nur fuer Aufgaben geladen, die es brauchen — der Import
  // muss daher fehlschlagen duerfen.
  const PRELUDE = `
import os, sys, io, base64
__name__ = "__main__"
os.makedirs('./cx_out', exist_ok=True)
try:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    plt.close('all')
except ModuleNotFoundError:
    pass
`;

  const COLLECT_PLOTS = `
import io as _io, base64 as _b64
import matplotlib.pyplot as _plt
_numcs_imgs = []
for _n in _plt.get_fignums():
    _f = _plt.figure(_n)
    _buf = _io.BytesIO()
    try:
        _f.savefig(_buf, format='png', dpi=70, bbox_inches='tight')
        _numcs_imgs.append(_b64.b64encode(_buf.getvalue()).decode('ascii'))
    except Exception:
        pass
_plt.close('all')
_numcs_imgs
`;

  function setStatus(text) {
    const el = document.getElementById('pyStatus');
    if (el) el.textContent = 'Python: ' + text;
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = () => reject(new Error('Pyodide konnte nicht geladen werden: ' + src));
      document.head.appendChild(s);
    });
  }

  async function boot() {
    if (pyodide) return pyodide;
    if (bootPromise) return bootPromise;

    bootPromise = (async () => {
      setStatus('lädt …');
      if (typeof loadPyodide === 'undefined') {
        await loadScript(INDEX_URL + 'pyodide.js');
      }
      pyodide = await loadPyodide({ indexURL: INDEX_URL });
      await writeShims(pyodide);
      setStatus('bereit');
      return pyodide;
    })();

    try {
      return await bootPromise;
    } catch (e) {
      bootPromise = null;
      setStatus('Fehler');
      throw e;
    }
  }

  /** Pakete nachladen. Die Ersatzmodule sind lokale Dateien, keine Pakete. */
  async function ensurePackages(pkgs) {
    const want = (pkgs || ['numpy'])
      .filter(p => !shimNames.includes(p))
      .filter(p => !loadedPkgs.has(p));
    if (!want.length) return;
    setStatus('lädt ' + want.join(', ') + ' …');
    await pyodide.loadPackage(want);
    want.forEach(p => loadedPkgs.add(p));
    setStatus('bereit');
  }

  /**
   * Führt Nutzercode aus und danach optional einen Prüfcode im selben
   * Namensraum.
   * @returns {Promise<{ok, passed, stdout, error, images}>}
   *   ok     — Nutzercode lief ohne Exception
   *   passed — Prüfcode lief ohne Exception (null, wenn keiner angegeben)
   */
  async function run({ code, pruefcode = null, packages = ['numpy'] }) {
    await boot();
    await ensurePackages(packages);

    let out = '';
    const capture = t => { out += t + '\n'; };
    pyodide.setStdout({ batched: capture });
    pyodide.setStderr({ batched: capture });

    const result = { ok: false, passed: null, stdout: '', error: null, images: [] };
    const ns = pyodide.globals.get('dict')();

    try {
      try {
        await pyodide.runPythonAsync(PRELUDE, { globals: ns });
      } catch (e) {
        // Darf den Lauf nicht abbrechen — sonst bleibt der Fehler unsichtbar.
        result.error = 'Fehler beim Vorbereiten der Laufzeit:\n' +
          cleanTrace(String(e && e.message ? e.message : e));
        return result;
      }

      try {
        await pyodide.runPythonAsync(code, { globals: ns });
        result.ok = true;
      } catch (e) {
        result.error = cleanTrace(String(e && e.message ? e.message : e));
      }

      // Plots auch dann einsammeln, wenn der Code danach gescheitert ist.
      try {
        const imgs = await pyodide.runPythonAsync(COLLECT_PLOTS, { globals: ns });
        result.images = (imgs && imgs.toJs ? imgs.toJs() : Array.from(imgs || []))
          .map(b64 => 'data:image/png;base64,' + b64);
        if (imgs && imgs.destroy) imgs.destroy();
      } catch { /* ohne matplotlib schlicht keine Bilder */ }

      if (result.ok && pruefcode) {
        try {
          await pyodide.runPythonAsync(pruefcode, { globals: ns });
          result.passed = true;
        } catch (e) {
          result.passed = false;
          result.error = cleanTrace(String(e && e.message ? e.message : e));
        }
      }
    } finally {
      ns.destroy();
      pyodide.setStdout({});
      pyodide.setStderr({});
      result.stdout = out;
    }

    return result;
  }

  /** Pyodide-Tracebacks um die internen Rahmen kürzen. */
  function cleanTrace(msg) {
    const lines = msg.split('\n');
    const keep = lines.filter(l =>
      !l.includes('/lib/python3') &&
      !l.includes('pyodide/_pyodide') &&
      !l.includes('runPythonAsync')
    );
    return (keep.length ? keep : lines).join('\n').trim();
  }

  function isReady() { return !!pyodide; }

  return { boot, run, isReady };
})();
