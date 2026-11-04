"""End-to-end smoke test: boots MemeOS in headless Chromium, exercises the core, reports console errors.

    python tools/e2e.py            # needs a server: python -m http.server 8765 (run from the project root)
"""
import json
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
URL = "http://127.0.0.1:8765/index.html?fast&nolock"
fails = []


def check(name, cond, extra=""):
    print(("ok   " if cond else "FAIL ") + name + (("  " + str(extra)) if extra and not cond else ""))
    if not cond:
        fails.append(name)


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    ctx = b.new_context(viewport={"width": 1440, "height": 900})
    page = ctx.new_page()
    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(URL)
    page.wait_for_function("window.memeos && window.memeos.fs.ready", timeout=20000)
    check("boot without console errors", not errors, errors[:5])

    # file system seeded and persistent API works
    r = page.evaluate("""async () => { const fs = memeos.fs; const memes = fs.list('/home/pepe/Memes').length; await fs.writeFile('/home/pepe/Documents/e2e.txt', 'hello'); const t = await fs.readText('/home/pepe/Documents/e2e.txt'); await fs.trash('/home/pepe/Documents/e2e.txt'); const inTrash = fs.list('/.trash').some(n => n.name === 'e2e.txt'); await fs.restore('/.trash/e2e.txt'); const back = !!fs.resolve('/home/pepe/Documents/e2e.txt'); await fs.remove('/home/pepe/Documents/e2e.txt'); return { memes, t, inTrash, back, gone: !fs.resolve('/home/pepe/Documents/e2e.txt') }; }""")
    check("memes seeded", r["memes"] >= 40, r)
    check("write/read/trash/restore/remove", r["t"] == "hello" and r["inTrash"] and r["back"] and r["gone"], r)

    # launch every app
    apps = page.evaluate("[...memeos.APPS.keys()]")
    for a in apps:
        n0 = len(errors)
        page.evaluate(f"memeos.launch('{a}')")
        page.wait_for_timeout(250)
        check(f"launch {a}", len(errors) == n0 and page.evaluate(f"[...memeos.wins.values()].some(w => w.app.id === '{a}')"), errors[n0:n0 + 3])
    check("task manager lists processes", page.evaluate("document.querySelectorAll('.tk-row').length") >= len(apps))
    page.evaluate("[...memeos.wins.values()].forEach(w => w.close(true))")
    page.wait_for_timeout(300)
    check("all windows closed", page.evaluate("memeos.wins.size") == 0)

    # terminal: run commands
    page.evaluate("memeos.launch('terminal')")
    page.wait_for_selector(".tm-in")
    for cmd in ["ls ~", "mkdir ~/e2e", "write ~/e2e/a.txt wow such test", "cat ~/e2e/a.txt", "tree ~/e2e", "rm -r ~/e2e", "trash", "neofetch"]:
        page.fill(".tm-in", cmd)
        page.keyboard.press("Enter")
        page.wait_for_timeout(120)
    out = page.inner_text(".tm-out")
    check("terminal write/cat", "wow such test" in out, out[-300:])
    check("terminal rm to trash", "moved 1 item" in out and "e2e" in out)
    check("terminal neofetch", "pepe@memeos" in out and "MemeOS 1.0" in out)
    check("terminal no errors", not [e for e in errors if "terminal" in e.lower()], errors[-3:])

    # window manager: drag, snap, maximize, minimize via keyboard
    page.evaluate("memeos.launch('files')")
    page.wait_for_timeout(300)
    page.keyboard.press("Alt+ArrowLeft")
    page.wait_for_timeout(250)
    b1 = page.evaluate("(() => { const w = [...memeos.wins.values()].find(w => w.app.id === 'files'); return { x: w.b.x, w: w.b.w, snapped: w.snapped, aw: document.getElementById('windows').clientWidth }; })()")
    check("snap left", b1["x"] == 0 and abs(b1["w"] - b1["aw"] / 2) < 2 and b1["snapped"] == "left", b1)
    page.keyboard.press("Alt+Enter")
    page.wait_for_timeout(250)
    check("maximize", page.evaluate("[...memeos.wins.values()].find(w => w.app.id === 'files').state") == "max")
    page.keyboard.press("Alt+n")
    page.wait_for_timeout(300)
    check("minimize", page.evaluate("[...memeos.wins.values()].find(w => w.app.id === 'files').state") == "min")
    page.click(".tb-app[data-app='files']")
    page.wait_for_timeout(300)
    check("restore from taskbar", page.evaluate("[...memeos.wins.values()].find(w => w.app.id === 'files').state") != "min")
    # drag the terminal window by its title bar (close the maximized Files window first so it is reachable)
    page.evaluate("[...memeos.wins.values()].find(w => w.app.id === 'files').close(true)")
    page.wait_for_timeout(250)
    tb = page.query_selector(".win[data-app='terminal'] .win-title").bounding_box()
    page.mouse.move(tb["x"] + 120, tb["y"] + 15); page.mouse.down(); page.mouse.move(tb["x"] + 320, tb["y"] + 215, steps=12); page.mouse.up()
    page.wait_for_timeout(100)
    tb2 = page.query_selector(".win[data-app='terminal'] .win-title").bounding_box()
    check("drag window", abs(tb2["x"] - tb["x"] - 200) < 3 and abs(tb2["y"] - tb["y"] - 200) < 3, (tb, tb2))

    # files app: navigate, context menu exists, open a text file via double click
    page.evaluate("[...memeos.wins.values()].forEach(w => w.close(true))")
    page.evaluate("memeos.launch('files', { path: '/home/pepe/Documents' })")
    page.wait_for_selector(".fx-tile")
    page.dblclick(".fx-tile[data-path='/home/pepe/Documents/todo.txt']")
    page.wait_for_selector(".np-text")
    check("open file from Files", "touch grass" in page.input_value(".np-text"))
    page.click(".fx-content", button="right", position={"x": 400, "y": 300})
    check("files context menu", page.query_selector(".menu") is not None)
    page.keyboard.press("Escape")

    # start menu search + calc
    page.keyboard.press("Alt+s")
    page.wait_for_selector(".st-search")
    page.fill(".st-search", "2+2*3")
    page.wait_for_timeout(100)
    check("start menu arithmetic", "= 8" in page.inner_text(".st-body"))
    page.fill(".st-search", "todo")
    page.wait_for_timeout(100)
    check("start menu file search", "todo.txt" in page.inner_text(".st-body"))
    page.keyboard.press("Escape")

    # settings: theme switch applies
    page.evaluate("memeos.settings.set('theme', 'light')")
    check("light theme applied", page.evaluate("document.documentElement.dataset.theme") == "light")
    page.evaluate("memeos.settings.set('theme', 'dark')")

    # persistence across reload
    page.evaluate("memeos.fs.writeFile('/home/pepe/Documents/persist.txt', 'still here')")
    page.wait_for_timeout(200)
    page.reload()
    page.wait_for_function("window.memeos && window.memeos.fs.ready", timeout=20000)
    check("file persisted across reload", page.evaluate("memeos.fs.resolve('/home/pepe/Documents/persist.txt') !== null"))
    page.evaluate("memeos.fs.remove('/home/pepe/Documents/persist.txt')")

    check("no console errors overall", not errors, errors[:8])
    ctx.close(); b.close()

print("\n%d failures" % len(fails))
sys.exit(1 if fails else 0)
