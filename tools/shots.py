"""Screenshots and GIFs of the running OS for the README (docs/readme/*.png|gif).

    python tools/shots.py [name ...]        # needs python tools/serve.py running on 8765
"""
import io
import sys
from pathlib import Path

from PIL import Image
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "docs" / "readme"
OUT.mkdir(parents=True, exist_ok=True)
BASE = "http://127.0.0.1:8765/index.html?fast"
VIEW = {"width": 1440, "height": 900}
only = set(sys.argv[1:])


def want(name): return not only or name in only


def shot(page, name, clip=None, scale=1):
    png = page.screenshot(clip=clip)
    im = Image.open(io.BytesIO(png)).convert("RGB")
    if scale != 1:
        im = im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS)
    im.save(OUT / f"{name}.png", optimize=True)
    print(name, im.size, (OUT / f"{name}.png").stat().st_size // 1024, "KB")


def gif(frames, name, duration=80, scale=0.5, loop_pause=1200):
    """Two-pass ffmpeg palette GIF when ffmpeg is available (much better colours), Pillow otherwise."""
    import shutil, subprocess, tempfile
    ims = [Image.open(io.BytesIO(f)).convert("RGB") for f in frames]
    ims = [im.resize((int(im.width * scale), int(im.height * scale)), Image.LANCZOS) for im in ims]
    out = OUT / f"{name}.gif"
    if shutil.which("ffmpeg"):
        with tempfile.TemporaryDirectory() as td:
            td = Path(td); lines = []
            for i, im in enumerate(ims):
                im.save(td / f"f{i:04d}.png"); lines.append(f"file 'f{i:04d}.png'\nduration {(loop_pause if i == len(ims) - 1 else duration) / 1000:.3f}")
            lines.append(f"file 'f{len(ims) - 1:04d}.png'")
            (td / "list.txt").write_text("\n".join(lines), encoding="utf-8")
            flt = "split[a][b];[a]palettegen=max_colors=255:stats_mode=diff[p];[b][p]paletteuse=dither=sierra2_4a:diff_mode=rectangle"
            subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(td / "list.txt"), "-vf", flt, "-loop", "0", str(out)], check=True)
    else:
        q = [im.quantize(colors=255, method=Image.MEDIANCUT, dither=Image.FLOYDSTEINBERG) for im in ims]
        durs = [duration] * len(q); durs[-1] = loop_pause
        q[0].save(out, save_all=True, append_images=q[1:], duration=durs, loop=0, optimize=True)
    print(name + ".gif", len(ims), "frames", out.stat().st_size // 1024, "KB")


def ready(page):
    page.wait_for_function("window.memeos && window.memeos.fs.ready", timeout=20000)
    page.wait_for_timeout(300)


def fresh(ctx, url_extra="&nolock", setup=None):
    page = ctx.new_page()
    page.goto(BASE + url_extra)
    ready(page)
    page.evaluate("document.getElementById('toasts').innerHTML=''")
    if setup:
        page.evaluate(setup)
    return page


with sync_playwright() as p:
    b = p.chromium.launch(channel="chrome")
    ctx = b.new_context(viewport=VIEW, device_scale_factor=2)
    # settle first run (achievement toast etc.) so later pages are quiet
    page = fresh(ctx); page.wait_for_timeout(2500); page.evaluate("memeos.settings.set('firstRun', false)"); page.close()

    if want("lock"):
        page = ctx.new_page(); page.goto(BASE); page.wait_for_selector("#lock:not(.hidden)"); page.wait_for_timeout(800)
        page.evaluate("document.querySelector('#lock').style.backgroundImage = 'url(assets/wallpapers/aurora.jpg)'")
        page.evaluate("document.querySelector('.lock-clock').textContent='13:37'; document.querySelector('.lock-date').textContent='Thursday, 4 November'")
        shot(page, "lock", scale=.5); page.close()

    if want("hero"):
        page = fresh(ctx)
        page.evaluate("""(async () => {
            const f = memeos.launch('files', {path: '/home/pepe/Memes'}); f.setBounds({x: 70, y: 60, w: 880, h: 560});
            await new Promise(r => setTimeout(r, 300));
            const t = memeos.launch('terminal', {cwd: '/home/pepe'}); t.setBounds({x: 760, y: 330, w: 620, h: 400});
            await new Promise(r => setTimeout(r, 100));
            const n = memeos.launch('photos', {path: '/home/pepe/Memes/Doge.jpg'}); n.setBounds({x: 930, y: 40, w: 440, h: 330});
            await new Promise(r => setTimeout(r, 200)); t.focus();
        })()""")
        page.wait_for_timeout(600)
        page.fill(".tm-in", "neofetch"); page.keyboard.press("Enter"); page.wait_for_timeout(500)
        page.evaluate("document.querySelector('.tm-out').scrollTop = 0")
        shot(page, "hero", scale=.5)
        page.close()

    if want("start"):
        page = fresh(ctx)
        page.evaluate("memeos.bus.emit('file:open', '/home/pepe/Documents/welcome.md'); memeos.bus.emit('file:open', '/home/pepe/Memes/Stonks.jpg'); memeos.bus.emit('file:open', '/home/pepe/Documents/todo.txt'); memeos.bus.emit('file:open', '/home/pepe/Memes/This Is Fine.jpg')")
        page.keyboard.press("Alt+s"); page.wait_for_selector("#start.in"); page.wait_for_timeout(400)
        shot(page, "start", scale=.5); page.close()

    if want("files"):
        page = fresh(ctx, setup="memeos.settings.patch({wallpaper: 'deep'})")
        page.evaluate("const w = memeos.launch('files', {path: '/home/pepe/Memes'}); w.setBounds({x: 120, y: 70, w: 1000, h: 640})")
        page.wait_for_selector(".fx-tile"); page.wait_for_timeout(600)
        page.click(".fx-tile[data-path='/home/pepe/Memes/Grumpy Cat.jpg']")
        page.click(".fx-tile[data-path='/home/pepe/Memes/Stonks.jpg']", modifiers=["Control"])
        page.click(".fx-tile[data-path='/home/pepe/Memes/Stonks.jpg']", button="right")
        page.wait_for_timeout(250)
        shot(page, "files", scale=.5); page.close()

    if want("terminal"):
        page = fresh(ctx, setup="memeos.settings.patch({wallpaper: 'slate'})")
        page.evaluate("const w = memeos.launch('terminal'); w.setBounds({x: 180, y: 90, w: 1080, h: 640})")
        page.wait_for_selector(".tm-in")
        for cmd in ["tree ~/Documents", "cat ~/Documents/todo.txt", "ps", "neofetch"]:
            page.fill(".tm-in", cmd); page.keyboard.press("Enter"); page.wait_for_timeout(150)
        page.wait_for_timeout(300)
        shot(page, "terminal", scale=.5); page.close()

    if want("taskman"):
        page = fresh(ctx, setup="memeos.settings.patch({wallpaper: 'grass'})")
        page.evaluate("""(async () => { memeos.launch('files'); memeos.launch('notepad', {path: '/home/pepe/Documents/welcome.md'}); memeos.launch('sweeper'); memeos.launch('calc'); memeos.launch('photos', {path: '/home/pepe/Memes/Doge.jpg'});
            [...memeos.wins.values()].forEach(w => w.minimize()); const t = memeos.launch('taskman'); t.setBounds({x: 300, y: 120, w: 840, h: 560}); })()""")
        page.wait_for_selector(".tk-row"); page.wait_for_timeout(2600)
        page.click(".tk-row:nth-child(4)")
        page.wait_for_timeout(200)
        shot(page, "taskman", scale=.5)
        page.click(".tk-tab[data-id='performance']"); page.wait_for_timeout(1500)
        shot(page, "perf", scale=.5); page.close()

    if want("factory"):
        page = fresh(ctx, setup="memeos.settings.patch({wallpaper: 'candy', theme: 'light'})")
        page.evaluate("const w = memeos.launch('factory', {path: '/home/pepe/Memes/One Does Not Simply.jpg'}); w.setBounds({x: 200, y: 80, w: 1040, h: 660})")
        page.wait_for_timeout(900)
        shot(page, "factory", scale=.5); page.close()

    if want("settings"):
        page = fresh(ctx, setup="memeos.settings.patch({wallpaper: 'dawn', theme: 'light', accent: {h: 24, s: 92, l: 54}})")
        page.evaluate("const w = memeos.launch('settings'); w.setBounds({x: 220, y: 70, w: 1000, h: 700})")
        page.wait_for_timeout(600)
        shot(page, "settings", scale=.5); page.close()

    if want("sweeper"):
        page = fresh(ctx, setup="memeos.settings.patch({wallpaper: 'aurora', theme: 'dark'})")
        page.evaluate("memeos.launch('sweeper'); memeos.launch('calc').setBounds({x: 900, y: 150, w: 340, h: 520})")
        page.wait_for_selector(".sw-c"); page.wait_for_timeout(400)
        # play a few safe-ish moves: open a corner and flag two cells
        page.click(".sw-c[data-x='0'][data-y='0']"); page.wait_for_timeout(100)
        page.click(".sw-c[data-x='8'][data-y='8']"); page.wait_for_timeout(100)
        page.click(".sw-c[data-x='4'][data-y='4']", button="right"); page.click(".sw-c[data-x='5'][data-y='2']", button="right")
        for k in "1337": page.keyboard.press(k)
        page.wait_for_timeout(200)
        shot(page, "sweeper", scale=.5); page.close()

    if want("eggs"):
        page = fresh(ctx)
        page.evaluate("memeos.launch('achievements').setBounds({x: 120, y: 60, w: 760, h: 640}); ['boot','trash','konami','neofetch','meme','snap','calc'].forEach(a => memeos.achieve(a))")
        page.wait_for_timeout(300); page.evaluate("document.getElementById('toasts').innerHTML=''")
        page.evaluate("memeos.eggs.dogeRain(45)")
        page.wait_for_timeout(1600)
        shot(page, "eggs", scale=.5); page.close()

    if want("bsod"):
        page = fresh(ctx)
        page.evaluate("memeos.launch('terminal').setBounds({x: 300, y: 200, w: 800, h: 400})"); page.wait_for_selector(".tm-in")
        page.fill(".tm-in", "rm -rf / --no-preserve-root"); page.keyboard.press("Enter"); page.wait_for_selector(".bsod"); page.wait_for_timeout(900)
        shot(page, "bsod", scale=.5); page.close()

    # ---- GIFs
    if want("gif-boot"):
        page = ctx.new_page(); frames = []
        page.goto("http://127.0.0.1:8765/index.html")
        for i in range(26):
            frames.append(page.screenshot()); page.wait_for_timeout(90)
        page.wait_for_selector("#lock:not(.hidden)")
        page.evaluate("document.querySelector('#lock').style.backgroundImage = 'url(assets/wallpapers/aurora.jpg)'")
        for i in range(8): frames.append(page.screenshot()); page.wait_for_timeout(100)
        page.keyboard.press("Enter")
        for i in range(14): frames.append(page.screenshot()); page.wait_for_timeout(70)
        page.evaluate("memeos.launch('files', {path: '/home/pepe/Memes'}).setBounds({x: 160, y: 90, w: 900, h: 560})")
        for i in range(10): frames.append(page.screenshot()); page.wait_for_timeout(70)
        gif(frames, "boot", duration=90, scale=.45); page.close()

    if want("gif-windows"):
        page = fresh(ctx, setup="memeos.settings.patch({wallpaper: 'aurora', theme: 'dark'})"); frames = []
        page.evaluate("memeos.launch('photos', {path: '/home/pepe/Memes/Stonks.jpg'}).setBounds({x: 120, y: 90, w: 640, h: 460}); memeos.launch('notepad', {path: '/home/pepe/Documents/welcome.md'}).setBounds({x: 560, y: 200, w: 700, h: 480})")
        page.wait_for_timeout(500)
        tb = page.query_selector(".win[data-app='notepad'] .win-title").bounding_box()
        page.mouse.move(tb["x"] + 200, tb["y"] + 16); page.mouse.down()
        for i in range(14):
            page.mouse.move(tb["x"] + 200 - i * 60, tb["y"] + 16 - i * 10); frames.append(page.screenshot()); page.wait_for_timeout(30)
        page.mouse.move(2, tb["y"] + 16 - 140); frames.append(page.screenshot()); page.wait_for_timeout(150); frames.append(page.screenshot())
        page.mouse.up()
        for i in range(8): frames.append(page.screenshot()); page.wait_for_timeout(50)
        page.evaluate("[...memeos.wins.values()].find(w => w.app.id === 'photos').focus()")
        page.keyboard.press("Alt+ArrowRight")
        for i in range(8): frames.append(page.screenshot()); page.wait_for_timeout(50)
        page.keyboard.press("Alt+n")
        for i in range(8): frames.append(page.screenshot()); page.wait_for_timeout(50)
        page.click(".tb-app[data-app='photos']")
        for i in range(10): frames.append(page.screenshot()); page.wait_for_timeout(50)
        gif(frames, "windows", duration=70, scale=.45); page.close()

    if want("gif-start"):
        page = fresh(ctx, setup="memeos.settings.patch({wallpaper: 'deep', theme: 'dark'})"); frames = []
        page.evaluate("memeos.bus.emit('file:open', '/home/pepe/Documents/welcome.md'); memeos.bus.emit('file:open', '/home/pepe/Memes/Stonks.jpg')")
        for i in range(3): frames.append(page.screenshot()); page.wait_for_timeout(60)
        page.click("#tb-start")
        for i in range(8): frames.append(page.screenshot()); page.wait_for_timeout(50)
        for ch in "task":
            page.keyboard.type(ch); frames.append(page.screenshot()); page.wait_for_timeout(60)
        for i in range(4): frames.append(page.screenshot()); page.wait_for_timeout(60)
        page.keyboard.press("Enter")
        for i in range(14): frames.append(page.screenshot()); page.wait_for_timeout(80)
        gif(frames, "start", duration=80, scale=.45); page.close()

    b.close()
