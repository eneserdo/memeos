// Settings: personalization, taskbar, sounds, system, storage and reset, about.
import { registerApp } from "../core/apps.js";
import { settings, WALLPAPERS, ACCENTS } from "../core/settings.js";
import { el, confirm, toast, esc } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { fs, fmtSize } from "../core/fs.js";
import { bus } from "../core/bus.js";
import { sound } from "../core/sound.js";
import { resetAchievements } from "../core/eggs.js";
import { importFiles, setWallpaperFrom } from "../shell/desktop.js";

const PAGES = [["personalization", "Personalization", "wand"], ["taskbar", "Taskbar", "list"], ["sounds", "Sounds", "volume"], ["system", "System", "cpu"], ["storage", "Storage and reset", "hdd"], ["about", "About", "info"]];

registerApp({
  id: "settings", name: "Settings", desc: "Personalize MemeOS", icon: "settings", color: "linear-gradient(135deg,#94a3b8,#475569)", w: 860, h: 580, minW: 520, minH: 360, single: true, keywords: ["theme", "wallpaper", "accent", "preferences", "options"],
  reopen(win, args) { if (args.page) win._go?.(args.page); },
  mount(win, proc, args) {
    let page = args.page || "personalization";
    const nav = el("div", { class: "se-nav" }), body = el("div", { class: "se-body" });
    win.body.append(el("div", { class: "se" }, nav, body));
    const go = p => { page = p; render(); }; win._go = go;
    const row = (label, control, sub) => el("div", { class: "se-row" }, el("div", { class: "se-rl" }, el("b", { text: label }), sub ? el("small", { text: sub }) : null), control);
    const sw = (k, after) => { const s = el("button", { class: "switch", role: "switch", "aria-checked": String(!!settings.get(k)), onclick: () => { settings.set(k, !settings.get(k)); s.setAttribute("aria-checked", String(!!settings.get(k))); after?.(); } }); return s; };
    const seg = (k, opts, after) => el("div", { class: "seg" }, ...opts.map(([v, l]) => el("button", { class: settings.get(k) === v ? "on" : "", text: l, onclick: e => { settings.set(k, v); e.currentTarget.parentNode.querySelectorAll("button").forEach(b => b.classList.toggle("on", b === e.currentTarget)); after?.(); } })));
    function render() {
      nav.innerHTML = ""; nav.append(el("div", { class: "se-user" }, el("img", { src: settings.get("avatar"), alt: "" }), el("div", {}, el("b", { text: settings.get("user") }), el("small", { text: "local account" }))));
      PAGES.forEach(([id, l, ic]) => nav.append(el("button", { class: "se-nav-item" + (page === id ? " on" : ""), html: icon(ic) + " " + l, onclick: () => go(id) })));
      body.innerHTML = ""; const title = PAGES.find(p => p[0] === page)[1]; body.append(el("h2", { text: title }));
      ({ personalization, taskbar, sounds, system, storage, about })[page]();
    }
    function personalization() {
      body.append(el("h3", { text: "Theme" }), row("Colour mode", seg("theme", [["dark", "Dark"], ["light", "Light"], ["system", "System"]]), "Light wallpapers switch the theme automatically when picked"),
        row("Transparency effects", sw("transparency"), "Acrylic blur behind windows, menus and the taskbar"), row("Animations", sw("animations"), "Window open and close, minimize to taskbar, menus"), row("Night light", sw("nightLight"), "Warmer colours in the evening"));
      body.append(el("h3", { text: "Accent colour" }));
      const sw2 = el("div", { class: "se-swatches" }, ...ACCENTS.map(a => el("button", { class: "swatch" + (settings.get("accent").h === a.h && settings.get("accent").l === a.l ? " on" : ""), title: a.name, style: { background: `hsl(${a.h} ${a.s}% ${a.l}%)` }, onclick: e => { settings.set("accent", { h: a.h, s: a.s, l: a.l }); sw2.querySelectorAll(".swatch").forEach(b => b.classList.toggle("on", b === e.currentTarget)); } })));
      const custom = el("input", { type: "color", class: "se-color", title: "Custom colour" });
      custom.addEventListener("input", () => { const [h, s, l] = hexToHsl(custom.value); settings.set("accent", { h, s, l }); sw2.querySelectorAll(".swatch").forEach(b => b.classList.remove("on")); });
      sw2.append(custom); body.append(sw2);
      body.append(el("h3", { text: "Wallpaper" }));
      const grid = el("div", { class: "se-wall" }, ...WALLPAPERS.map(w => el("button", { class: "wall" + (settings.get("wallpaper") === w.id ? " on" : ""), title: w.name, style: { backgroundImage: `url(${w.thumb})` }, onclick: () => { settings.patch({ wallpaper: w.id, theme: w.theme }); render(); } }, el("span", { text: w.name }))));
      if (settings.get("wallpaper") === "custom") grid.append(el("button", { class: "wall on", title: "Custom", style: { backgroundImage: `url(${settings.get("wallpaperCustom")})` } }, el("span", { text: "Custom" })));
      const file = el("input", { type: "file", accept: "image/*", class: "hidden" });
      file.addEventListener("change", async () => { const f = file.files[0]; if (!f) return; await importFiles("/home/pepe/Pictures", [f]); const n = fs.list("/home/pepe/Pictures").find(x => x.name === f.name || x.name.startsWith(f.name.replace(/\.[^.]+$/, ""))); if (n) await setWallpaperFrom(n); render(); });
      body.append(grid, row("Picture from your computer", el("button", { class: "btn", html: icon("upload") + " Browse", onclick: () => file.click() }), "Saved to ~/Pictures and used as wallpaper"), file,
        row("Fit", seg("wallpaperFit", [["cover", "Fill"], ["contain", "Fit"], ["center", "Centre"]])));
    }
    function taskbar() {
      body.append(row("Alignment", seg("taskbarAlign", [["center", "Centre"], ["left", "Left"]])), row("Show seconds in the clock", sw("showSeconds")), row("Show hidden files on the desktop", sw("showHidden"), "Files starting with a dot"));
    }
    function sounds() {
      const vol = el("input", { type: "range", class: "range", min: 0, max: 100, value: Math.round(settings.get("volume") * 100), style: { width: "200px" } });
      vol.addEventListener("input", () => settings.set("volume", vol.value / 100)); vol.addEventListener("change", () => sound.notify());
      body.append(row("System sounds", sw("sounds"), "Synthesised with WebAudio, no files involved"), row("Volume", vol),
        el("h3", { text: "Preview" }), el("div", { class: "se-sounds" }, ...["startup", "notify", "error", "trash", "achievement", "win", "boom"].map(s => el("button", { class: "btn sm", text: s, onclick: () => sound[s]() }))));
    }
    async function system() {
      const gl = document.createElement("canvas").getContext("webgl"), gpu = gl?.getExtension("WEBGL_debug_renderer_info") ? gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info").UNMASKED_RENDERER_WEBGL) : "unknown";
      const rows = [["Device name", "memeos"], ["Processor", `${navigator.hardwareConcurrency || "?"} logical cores`], ["Installed RAM", navigator.deviceMemory ? `${navigator.deviceMemory} GB (as reported by the browser, capped at 8)` : "not reported"], ["Graphics", String(gpu)], ["Display", `${screen.width} x ${screen.height}, viewport ${innerWidth} x ${innerHeight}, ${devicePixelRatio}x`], ["Browser", navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/)?.[0] || navigator.userAgent], ["Platform", navigator.platform], ["Language", navigator.language], ["Online", navigator.onLine ? "yes" : "no"], ["Uptime", `${Math.floor(performance.now() / 60000)} min`], ["Installed", new Date(settings.get("installedAt")).toLocaleString()]];
      body.append(el("table", { class: "props", html: rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("") }));
      body.append(el("h3", { text: "Keyboard shortcuts" }), el("table", { class: "props keys", html: [["Alt+S", "Start menu"], ["Alt+W / Alt+Shift+W", "Switch windows"], ["Alt+T", "Terminal"], ["Alt+E", "Files"], ["Alt+R", "Run"], ["Alt+M", "Task Manager"], ["Alt+D", "Show desktop"], ["Alt+L", "Lock"], ["Alt+N", "Minimize window"], ["Alt+X", "Close window"], ["Alt+Enter", "Maximize / restore"], ["Alt+Arrows", "Snap window"], ["F2 / Delete", "Rename / delete selected file"], ["Ctrl+S", "Save (Notepad, Meme Factory)"]].map(([k, v]) => `<tr><th><span class="kbd">${k}</span></th><td>${v}</td></tr>`).join("") }));
    }
    async function storage() {
      const est = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
      const bar = el("div", { class: "se-bar" }, el("span", { style: { width: est?.quota ? Math.max(1, est.usage / est.quota * 100) + "%" : "1%" } }));
      body.append(row("File system", el("b", { text: `${fmtSize(fs.usage())} in ${fs.nodes.size} inodes` }), "Everything in Files, including the Recycle Bin"), bar,
        el("small", { class: "se-note", text: est ? `Browser storage: ${fmtSize(est.usage || 0)} used of ${fmtSize(est.quota || 0)} available to this origin. Seeded memes are referenced, not copied, so they do not count until you edit them.` : "This browser does not report storage usage." }),
        el("h3", { text: "Reset" }),
        row("Empty the Recycle Bin", el("button", { class: "btn", text: "Empty", onclick: async () => { if (await confirm("Empty the Recycle Bin?", "Everything in it will be permanently deleted.", { ok: "Empty", danger: true })) { await fs.emptyTrash(); render(); } } })),
        row("Reset settings", el("button", { class: "btn", text: "Reset", onclick: async () => { if (await confirm("Reset settings?", "Theme, wallpaper, taskbar and desktop layout go back to the defaults. Files are kept.", { ok: "Reset" })) { settings.reset(); render(); } } }), "Keeps your files"),
        row("Reset achievements", el("button", { class: "btn", text: "Reset", onclick: async () => { if (await confirm("Reset achievements?", "All unlocked achievements will be locked again.", { ok: "Reset" })) { resetAchievements(); toast({ title: "Achievements reset", icon: "trophy", app: "Settings" }); } } })),
        row("Factory reset", el("button", { class: "btn danger", text: "Erase everything", onclick: async () => { if (await confirm("Erase everything?", "All files, settings and achievements will be deleted and MemeOS will restart like new.", { ok: "Erase", danger: true })) { await fs.wipe(); localStorage.clear(); location.reload(); } } }), "Files, settings, achievements. Cannot be undone."));
    }
    function about() {
      body.append(el("div", { class: "se-about" }, el("img", { src: "assets/logo.png", alt: "", width: 72, height: 72 }), el("div", {}, el("b", { text: "MemeOS 1.0" }), el("p", { text: "A desktop operating system that runs inside one browser tab: window manager, persistent file system, terminal, task manager, apps, and an undisclosed number of easter eggs." }), el("p", { html: 'Source and credits: <a href="https://github.com/eneserdo/memeos" target="_blank" rel="noopener">github.com/eneserdo/memeos</a>. Meme pictures belong to their creators, see ATTRIBUTION.md.' }))),
        el("h3", { text: "Your account" }), row("User name", (() => { const i = el("input", { class: "input", value: settings.get("user"), style: { width: "180px" } }); i.addEventListener("change", () => { settings.set("user", i.value.trim() || "pepe"); render(); }); return i; })(), "Shown on the lock screen and in the start menu"),
        row("Avatar", el("div", { class: "se-avatars" }, ...["pepe", "doge", "wojak", "cat"].map(a => el("button", { class: "av" + (settings.get("avatar").endsWith(a + ".svg") ? " on" : ""), onclick: () => { settings.set("avatar", `assets/avatars/${a}.svg`); render(); } }, el("img", { src: `assets/avatars/${a}.svg`, alt: a }))))));
    }
    const off = bus.on("settings", k => { if (k === "wallpaper" && page === "personalization") { /* keep simple */ } });
    win.on("close", () => off());
    render();
  },
});
function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b); let h = 0, s = 0; const l = (max + min) / 2;
  if (max !== min) { const d = max - min; s = l > .5 ? d / (2 - max - min) : d / (max + min); h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; }
  return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
}
