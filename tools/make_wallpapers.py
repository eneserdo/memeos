"""Generate the built-in wallpapers (soft gradient blobs, 1920x1200) and the logo PNG renders.

    python tools/make_wallpapers.py
"""
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "wallpapers"
OUT.mkdir(parents=True, exist_ok=True)
W, H = 1920, 1200

PALETTES = {
    # name: (background, [blob colours])
    "aurora":  ((12, 16, 34),   [(44, 86, 210), (120, 70, 230), (20, 190, 170), (255, 110, 90)]),
    "dawn":    ((238, 232, 226), [(255, 170, 120), (255, 214, 150), (190, 170, 255), (140, 200, 255)]),
    "deep":    ((20, 10, 36),   [(130, 40, 200), (230, 60, 140), (60, 40, 150), (30, 120, 220)]),
    "grass":   ((20, 44, 26),   [(70, 160, 70), (170, 220, 60), (30, 110, 90), (240, 220, 110)]),
    "slate":   ((28, 30, 36),   [(70, 76, 90), (110, 120, 140), (60, 90, 120), (160, 150, 140)]),
    "candy":   ((250, 240, 245), [(255, 120, 180), (120, 200, 255), (255, 220, 120), (170, 255, 200)]),
}


def blobs(name, bg, colours, seed):
    rnd = random.Random(seed)
    img = Image.new("RGB", (W // 4, H // 4), bg)
    d = ImageDraw.Draw(img, "RGBA")
    for i, c in enumerate(colours * 2):
        r = rnd.randint(110, 230)
        cx = rnd.randint(-40, img.width + 40)
        cy = rnd.randint(-40, img.height + 40)
        d.ellipse((cx - r, cy - r, cx + r, cy + r), fill=c + (150,))
    img = img.filter(ImageFilter.GaussianBlur(70)).resize((W, H), Image.LANCZOS)
    # subtle diagonal light sweep so it does not look flat
    sweep = Image.new("L", (W, H), 0)
    sd = ImageDraw.Draw(sweep)
    for x in range(0, W, 6):
        v = int(28 * (0.5 + 0.5 * math.sin(x / W * math.pi * 1.6)))
        sd.line((x, 0, x - 500, H), fill=v, width=7)
    sweep = sweep.filter(ImageFilter.GaussianBlur(60))
    img = Image.composite(Image.new("RGB", (W, H), (255, 255, 255)), img, sweep.point(lambda v: int(v * 0.35)))
    # film grain
    noise = Image.effect_noise((W, H), 9).convert("L")
    img = Image.composite(img, Image.blend(img, Image.new("RGB", (W, H), (0, 0, 0)), 0.08), noise.point(lambda v: 255 if v > 125 else 235))
    img.save(OUT / f"{name}.jpg", "JPEG", quality=84, optimize=True, progressive=True)
    thumb = img.resize((320, 200), Image.LANCZOS)
    thumb.save(OUT / f"{name}_thumb.jpg", "JPEG", quality=80)
    print(name, (OUT / f"{name}.jpg").stat().st_size)


for i, (name, (bg, cols)) in enumerate(PALETTES.items()):
    blobs(name, bg, cols, seed=1000 + i * 7)
