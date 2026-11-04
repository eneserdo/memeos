"""Create the GitHub repository for this project (private by default), set its topics, enable GitHub Pages.

    python tools/create_repo.py            # private
    python tools/create_repo.py --public   # public
    python tools/create_repo.py --pages    # only (re)enable Pages from main:/ on an existing repo
"""
import sys
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parents[1]
tok = (ROOT / "Githubtoken.txt").read_text(encoding="utf-8").strip()
H = {"Authorization": "Bearer " + tok, "Accept": "application/vnd.github+json"}
SLUG = "eneserdo/memeos"
public = "--public" in sys.argv

r = requests.get(f"https://api.github.com/repos/{SLUG}", headers=H, timeout=20)
if r.status_code == 404 and "--pages" not in sys.argv:
    r = requests.post("https://api.github.com/user/repos", headers=H, timeout=30, json={
        "name": SLUG.split("/")[1],
        "description": "A desktop operating system that runs in one browser tab: window manager, persistent file system, terminal, task manager, apps, easter eggs. Much window. Very file. Wow.",
        "homepage": "https://eneserdo.github.io/memeos/",
        "private": not public, "has_wiki": False, "has_projects": False, "auto_init": False})
    print("create:", r.status_code, r.json().get("html_url"))
else:
    print("exists:", r.status_code, r.json().get("html_url"), "private" if r.json().get("private") else "public")
if "--pages" not in sys.argv:
    r = requests.put(f"https://api.github.com/repos/{SLUG}/topics", headers=H, timeout=20, json={"names": [
        "operating-system", "browser-os", "desktop", "window-manager", "javascript", "vanilla-js", "indexeddb", "memes", "doge", "web-desktop", "easter-eggs"]})
    print("topics:", r.status_code)
else:
    r = requests.post(f"https://api.github.com/repos/{SLUG}/pages", headers=H, timeout=30, json={"source": {"branch": "main", "path": "/"}})
    print("pages:", r.status_code, r.json().get("html_url") or r.text[:200])
