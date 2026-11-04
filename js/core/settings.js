// Persistent settings (localStorage) and how they are applied to the document.
import { bus } from "./bus.js";

const KEY = "memeos.settings.v1";

export const WALLPAPERS = [
  { id: "aurora", name: "Aurora", src: "assets/wallpapers/aurora.jpg", thumb: "assets/wallpapers/aurora_thumb.jpg", theme: "dark" },
  { id: "deep", name: "Deep", src: "assets/wallpapers/deep.jpg", thumb: "assets/wallpapers/deep_thumb.jpg", theme: "dark" },
  { id: "slate", name: "Slate", src: "assets/wallpapers/slate.jpg", thumb: "assets/wallpapers/slate_thumb.jpg", theme: "dark" },
  { id: "grass", name: "Grass", src: "assets/wallpapers/grass.jpg", thumb: "assets/wallpapers/grass_thumb.jpg", theme: "dark" },
  { id: "dawn", name: "Dawn", src: "assets/wallpapers/dawn.jpg", thumb: "assets/wallpapers/dawn_thumb.jpg", theme: "light" },
  { id: "candy", name: "Candy", src: "assets/wallpapers/candy.jpg", thumb: "assets/wallpapers/candy_thumb.jpg", theme: "light" },
];

export const ACCENTS = [
  { name: "Violet", h: 262, s: 84, l: 62 },
  { name: "Blue", h: 215, s: 90, l: 56 },
  { name: "Teal", h: 174, s: 70, l: 42 },
  { name: "Green", h: 142, s: 60, l: 42 },
  { name: "Lime", h: 84, s: 80, l: 46 },
  { name: "Orange", h: 24, s: 92, l: 54 },
  { name: "Red", h: 352, s: 80, l: 56 },
  { name: "Pink", h: 325, s: 80, l: 60 },
  { name: "Graphite", h: 220, s: 10, l: 48 },
];

const DEFAULTS = {
  theme: "dark",              // dark | light | system
  accent: { h: 262, s: 84, l: 62 },
  wallpaper: "aurora",        // id or "custom"
  wallpaperCustom: null,      // data/blob url stored in fs as /home/pepe/Pictures/wallpaper.*
  wallpaperFit: "cover",
  transparency: true,
  animations: true,
  taskbarAlign: "center",
  showSeconds: false,
  sounds: true,
  volume: 0.5,
  nightLight: false,
  showHidden: false,
  desktopIcons: {},            // name -> {x,y} grid slots
  user: "pepe",
  avatar: "assets/avatars/pepe.svg",
  firstRun: true,
  installedAt: Date.now(),
};

class Settings {
  constructor() {
    this.data = { ...DEFAULTS };
    try { Object.assign(this.data, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { /* fresh */ }
  }
  get(k) { return this.data[k]; }
  set(k, v) { this.data[k] = v; this.save(); this.apply(); bus.emit("settings", k, v); }
  patch(obj) { Object.assign(this.data, obj); this.save(); this.apply(); Object.keys(obj).forEach(k => bus.emit("settings", k, obj[k])); }
  save() { try { localStorage.setItem(KEY, JSON.stringify(this.data)); } catch (e) { console.warn("settings save failed", e); } }
  reset() { localStorage.removeItem(KEY); this.data = { ...DEFAULTS }; this.apply(); }
  resolvedTheme() {
    const t = this.data.theme;
    if (t === "system") return matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
    return t;
  }
  apply() {
    const h = document.documentElement, d = this.data;
    h.dataset.theme = this.resolvedTheme();
    h.dataset.transparency = d.transparency ? "on" : "off";
    h.dataset.anim = d.animations ? "on" : "off";
    h.dataset.taskbar = d.taskbarAlign;
    h.style.setProperty("--accent-h", d.accent.h);
    h.style.setProperty("--accent-s", d.accent.s + "%");
    h.style.setProperty("--accent-l", d.accent.l + "%");
    h.style.setProperty("--on-accent", d.accent.l > 62 ? "#111" : "#fff");
    h.classList.toggle("night", !!d.nightLight);
    const wp = document.getElementById("wallpaper");
    if (wp) {
      const src = d.wallpaper === "custom" ? d.wallpaperCustom : (WALLPAPERS.find(w => w.id === d.wallpaper) || WALLPAPERS[0]).src;
      if (src && wp.dataset.src !== src) { wp.style.backgroundImage = `url("${src}")`; wp.dataset.src = src; }
      wp.style.backgroundSize = d.wallpaperFit === "contain" ? "contain" : d.wallpaperFit === "center" ? "auto" : "cover";
    }
  }
}
export const settings = new Settings();
matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => settings.apply());
