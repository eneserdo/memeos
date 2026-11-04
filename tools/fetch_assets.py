"""Download the meme pictures that seed the MemeOS file system and write assets/memes/manifest.json.

    python tools/fetch_assets.py

Sources are Know Your Meme entry images (og:image) and Imgflip meme templates (og:image of the template page).
Pictures are downscaled to max 900 px and re-encoded as JPEG. Rights stay with their owners, see ATTRIBUTION.md.
"""
import io
import json
import re
import sys
import time
from pathlib import Path

import requests
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "memes"
OUT.mkdir(parents=True, exist_ok=True)
UA = "memeos-assets/0.1 (python-requests; README and demo file seed)"
S = requests.Session()
S.headers["User-Agent"] = UA

# file stem -> (display name, source page)
SOURCES = {
    "doge":                 ("Doge", "https://imgflip.com/memegenerator/8072285/Doge"),
    "distracted":           ("Distracted Boyfriend", "https://imgflip.com/memegenerator/112126428/Distracted-Boyfriend"),
    "catyell":              ("Woman Yelling at a Cat", "https://imgflip.com/memegenerator/188390779/Woman-Yelling-At-Cat"),
    "drake":                ("Drake Hotline Bling", "https://imgflip.com/memegenerator/181913649/Drake-Hotline-Bling"),
    "changemymind":         ("Change My Mind", "https://imgflip.com/memegenerator/129242436/Change-My-Mind"),
    "pigeon":               ("Is This a Pigeon", "https://imgflip.com/memegenerator/100777631/Is-This-A-Pigeon"),
    "gruplan":              ("Gru's Plan", "https://imgflip.com/memegenerator/131940431/Grus-Plan"),
    "spongebob":            ("Mocking SpongeBob", "https://imgflip.com/memegenerator/102156234/Mocking-Spongebob"),
    "onedoesnot":           ("One Does Not Simply", "https://imgflip.com/memegenerator/61579/One-Does-Not-Simply"),
    "rollsafe":             ("Roll Safe", "https://imgflip.com/memegenerator/89370399/Roll-Safe-Think-About-It"),
    "badluckbrian":         ("Bad Luck Brian", "https://imgflip.com/memegenerator/61585/Bad-Luck-Brian"),
    "successkid":           ("Success Kid", "https://imgflip.com/memegenerator/61544/Success-Kid"),
    "grumpycat":            ("Grumpy Cat", "https://imgflip.com/memegenerator/405658/Grumpy-Cat"),
    "disastergirl":         ("Disaster Girl", "https://imgflip.com/memegenerator/97984/Disaster-Girl"),
    "ancientaliens":        ("Ancient Aliens", "https://imgflip.com/memegenerator/101470/Ancient-Aliens"),
    "philosoraptor":        ("Philosoraptor", "https://imgflip.com/memegenerator/61516/Philosoraptor"),
    "takemymoney":          ("Shut Up and Take My Money", "https://imgflip.com/memegenerator/176908/Shut-Up-And-Take-My-Money-Fry"),
    "bernie":               ("Bernie: I Am Once Again Asking", "https://imgflip.com/memegenerator/222403160/Bernie-I-Am-Once-Again-Asking-For-Your-Support"),
    "buffdoge":             ("Buff Doge vs. Cheems", "https://imgflip.com/memegenerator/180190441/Buff-Doge-vs-Cheems"),
    "alwayshasbeen":        ("Always Has Been", "https://imgflip.com/memegenerator/252758727/Always-Has-Been"),
    "panik":                ("Panik Kalm Panik", "https://imgflip.com/memegenerator/226297822/Panik-Kalm-Panik"),
    "sadpablo":             ("Sad Pablo Escobar", "https://imgflip.com/memegenerator/80707627/Sad-Pablo-Escobar"),
    "skeleton":             ("Waiting Skeleton", "https://imgflip.com/memegenerator/4087833/Waiting-Skeleton"),
    "unodraw25":            ("UNO Draw 25 Cards", "https://imgflip.com/memegenerator/217743513/UNO-Draw-25-Cards"),
    "anakin":               ("Anakin Padme 4 Panel", "https://imgflip.com/memegenerator/322841258/Anakin-Padme-4-Panel"),
    "batman":               ("Batman Slapping Robin", "https://imgflip.com/memegenerator/438680/Batman-Slapping-Robin"),
    "fry":                  ("Futurama Fry", "https://imgflip.com/memegenerator/61520/Futurama-Fry"),
    "morpheus":             ("Matrix Morpheus", "https://imgflip.com/memegenerator/100947/Matrix-Morpheus"),
    "leftexit":             ("Left Exit 12 Off Ramp", "https://imgflip.com/memegenerator/124822590/Left-Exit-12-Off-Ramp"),
    "handshake":            ("Epic Handshake", "https://imgflip.com/memegenerator/135256802/Epic-Handshake"),
    "sleepingshaq":         ("Sleeping Shaq", "https://imgflip.com/memegenerator/99683934/Sleeping-Shaq"),
    "pooh":                 ("Tuxedo Winnie the Pooh", "https://imgflip.com/memegenerator/178591752/Tuxedo-Winnie-The-Pooh"),
    "dicaprio":             ("Leonardo Dicaprio Cheers", "https://imgflip.com/memegenerator/50421420/Leonardo-Dicaprio-Cheers"),
    "thisisfine":           ("This Is Fine", "https://imgflip.com/memegenerator/55311130/This-Is-Fine"),
    "pikachu":              ("Surprised Pikachu", "https://imgflip.com/memegenerator/155067746/Surprised-Pikachu"),
    "harold":               ("Hide the Pain Harold", "https://imgflip.com/memegenerator/27813981/Hide-the-Pain-Harold"),
    "trollface":            ("Trollface", "https://knowyourmeme.com/memes/trollface"),
    "nyancat":              ("Nyan Cat", "https://knowyourmeme.com/memes/nyan-cat"),
    "rickroll":             ("Rickroll", "https://knowyourmeme.com/memes/rickroll"),
    "smugpepe":             ("Smug Frog", "https://knowyourmeme.com/memes/smug-frog"),
    "hackerman":            ("Hackerman", "https://knowyourmeme.com/memes/hackerman"),
    "stonks":               ("Stonks", "https://knowyourmeme.com/memes/stonks"),
    "wojak":                ("Wojak", "https://knowyourmeme.com/memes/wojak-feels-guy"),
    "cheems":               ("Cheems", "https://knowyourmeme.com/memes/cheems"),
    "dogecoin":             ("Doge (Kabosu)", "https://knowyourmeme.com/memes/doge"),
    "sunglassesdog":        ("Deal With It", "https://knowyourmeme.com/memes/deal-with-it"),
    "nervous":              ("Dwight Schrute: Nervous", "https://knowyourmeme.com/memes/the-office"),
    "pepesilvia":           ("Pepe Silvia", "https://knowyourmeme.com/memes/pepe-silvia"),
    "fine":                 ("Everything Is Fine", "https://knowyourmeme.com/memes/this-is-fine"),
    "touchgrass":           ("Touch Grass", "https://knowyourmeme.com/memes/touch-grass"),
}

manifest = {}
if (OUT / "manifest.json").exists():
    manifest = json.loads((OUT / "manifest.json").read_text(encoding="utf-8"))
only = set(sys.argv[1:])

for stem, (name, page) in SOURCES.items():
    if only and stem not in only:
        continue
    dest = OUT / f"{stem}.jpg"
    if dest.exists() and stem in manifest and not only:
        continue
    try:
        if "imgflip.com/memegenerator/" in page:          # static template image: imgflip.com/s/meme/<Name>.jpg
            html = f'<meta property="og:image" content="https://imgflip.com/s/meme/{page.rsplit("/", 1)[1]}.jpg">'
        else:
            html = S.get(page, timeout=30).text
        m = re.search(r"""property=["']og:image["']\s+content=["']([^"']+)""", html) or \
            re.search(r"""content=["']([^"']+)["']\s+property=["']og:image""", html) or \
            re.search(r"""(i\.imgflip\.com/[a-z0-9]+\.(?:jpg|png))""", html)   # imgflip template image
        if not m:
            print("no og:image:", stem); continue
        url = m.group(1)
        if url.startswith("//"):
            url = "https:" + url
        time.sleep(0.6)
        r = S.get(url, timeout=60)
        r.raise_for_status()
        im = Image.open(io.BytesIO(r.content)).convert("RGB")
        im.thumbnail((900, 900), Image.LANCZOS)
        im.save(dest, "JPEG", quality=86, optimize=True)
        manifest[stem] = {"name": name, "source": page, "image": url, "w": im.width, "h": im.height, "bytes": dest.stat().st_size}
        print("ok", stem, im.size, dest.stat().st_size)
    except Exception as e:
        print("fail", stem, type(e).__name__, str(e)[:100])
    time.sleep(0.8)

(OUT / "manifest.json").write_text(json.dumps(manifest, indent=1, ensure_ascii=False), encoding="utf-8")
print(len(manifest), "images in manifest")
