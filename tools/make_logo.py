"""Render the MemeOS logo: four real meme faces in a 2x2 tile grid (assets/logo.png + docs/logo-*.png).

    python tools/make_logo.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
MEMES = ROOT / "assets" / "memes"
# (file, crop box in source pixels): square crops on the faces
TILES = [
    ("doge", (30, 10, 590, 570)),
    ("trollface", (197, 0, 703, 506)),
    ("grumpycat", (30, 70, 470, 510)),
    ("successkid", (165, 80, 445, 360)),
]
S = 1024           # render size
GAP = int(S * 0.055)
R = int(S * 0.11)  # tile corner radius


def tile(name, box, size):
    im = Image.open(MEMES / f"{name}.jpg").convert("RGB").crop(box).resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 2, size * 2), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size * 2 - 1, size * 2 - 1), radius=R * 2, fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(im, (0, 0), mask)
    # soft inner edge so the tiles read as glass, not stickers
    edge = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(edge).rounded_rectangle((1, 1, size - 2, size - 2), radius=R, outline=(255, 255, 255, 70), width=max(2, size // 90))
    out.alpha_composite(edge)
    return out


def logo(size):
    canvas = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    t = (S - GAP) // 2
    # shadow under the grid
    sh = Image.new("RGBA", (S, S), (0, 0, 0, 0))
    ImageDraw.Draw(sh).rounded_rectangle((GAP * 1.5, GAP * 2, S - GAP * 1.5, S - GAP * 0.9), radius=R, fill=(0, 0, 0, 90))
    sh = sh.filter(ImageFilter.GaussianBlur(S * 0.03))
    canvas.alpha_composite(sh)
    pos = [(0, 0), (t + GAP, 0), (0, t + GAP), (t + GAP, t + GAP)]
    for (name, box), (x, y) in zip(TILES, pos):
        canvas.alpha_composite(tile(name, box, t), (x, y))
    return canvas.resize((size, size), Image.LANCZOS)


big = logo(S)
big.save(ROOT / "assets" / "logo.png", optimize=True)
for n in (256, 128, 64, 32):
    logo(S).resize((n, n), Image.LANCZOS).save(ROOT / "docs" / f"logo-{n}.png", optimize=True) if n >= 128 else None
big.resize((64, 64), Image.LANCZOS).save(ROOT / "assets" / "favicon.png", optimize=True)
print("assets/logo.png", big.size, "docs/logo-256.png docs/logo-128.png assets/favicon.png")
