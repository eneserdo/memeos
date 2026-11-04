// Photos: image viewer with zoom, pan, rotate, folder navigation, set as wallpaper.
import { registerApp, launch } from "../core/apps.js";
import { fs, isImage, dirname, basename, fmtSize } from "../core/fs.js";
import { el, errorBox, filePicker, downloadBlob, clamp } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { setWallpaperFrom, trashPaths } from "../shell/desktop.js";
import { bus } from "../core/bus.js";

registerApp({
  id: "photos", name: "Photos", desc: "Look at pictures", icon: "image", color: "linear-gradient(135deg,#ff7ab6,#8b5cf6)", w: 860, h: 600, minW: 400, minH: 300, keywords: ["image", "viewer", "picture", "gallery"],
  mount(win, proc, args) {
    const st = { path: args.path || null, scale: 1, fit: true, rot: 0, x: 0, y: 0 };
    const img = el("img", { class: "ph-img", alt: "", draggable: false });
    const stage = el("div", { class: "ph-stage" }, img);
    const info = el("div", { class: "ph-info" });
    const bar = el("div", { class: "ph-bar" });
    const b = (ic, title, fn) => el("button", { class: "btn ghost icon", title, html: icon(ic), onclick: fn });
    const zoomLabel = el("span", { class: "ph-zoom", text: "fit" });
    bar.append(b("folderOpen", "Open", async () => { const p = await filePicker({ mode: "open", start: st.path ? dirname(st.path) : "~/Memes", filter: isImage }); if (p) load(p); }),
      b("chevronL", "Previous (Left)", () => step(-1)), b("chevronR", "Next (Right)", () => step(1)), el("span", { class: "grow" }),
      b("zoomOut", "Zoom out (-)", () => zoom(-1)), zoomLabel, b("zoomIn", "Zoom in (+)", () => zoom(1)), b("maximize2", "Fit (0)", () => { st.fit = true; st.x = st.y = 0; apply(); }),
      b("rotate", "Rotate (R)", () => { st.rot = (st.rot + 90) % 360; apply(); }), el("span", { class: "grow" }),
      b("image", "Set as wallpaper", () => st.path && setWallpaperFrom(fs.resolve(st.path))), b("wand", "Open in Meme Factory", () => st.path && launch("factory", { path: st.path })),
      b("download", "Download", async () => { if (st.path) downloadBlob(await fs.blob(fs.resolve(st.path)), basename(st.path)); }), b("trash", "Delete", async () => { if (st.path) { const p = st.path; const n = siblings(); const i = n.indexOf(p); await trashPaths([p]); const rest = siblings(); rest.length ? load(rest[Math.min(i, rest.length - 1)]) : empty(); } }));
    win.body.append(el("div", { class: "ph" }, bar, stage, info));
    const siblings = () => st.path ? fs.list(dirname(st.path), { hidden: false }).filter(isImage).map(n => fs.pathOf(n)) : [];
    function step(d) { const s = siblings(); if (!s.length) return; const i = s.indexOf(st.path); load(s[(i + d + s.length) % s.length]); }
    function fitScale() { const r = stage.getBoundingClientRect(), rot = st.rot % 180 !== 0, w = rot ? img.naturalHeight : img.naturalWidth, h = rot ? img.naturalWidth : img.naturalHeight; return Math.min(1, (r.width - 24) / w, (r.height - 24) / h) || 1; }
    function apply() { const s = st.fit ? fitScale() : st.scale; img.style.transform = `translate(${st.x}px, ${st.y}px) rotate(${st.rot}deg) scale(${s})`; zoomLabel.textContent = st.fit ? `fit ${Math.round(s * 100)}%` : `${Math.round(s * 100)}%`; stage.classList.toggle("pan", !st.fit && s > fitScale()); }
    function zoom(d, cx, cy) { const cur = st.fit ? fitScale() : st.scale; st.fit = false; st.scale = clamp(cur * (d > 0 ? 1.25 : 0.8), 0.05, 12); if (st.scale <= fitScale()) { st.x = st.y = 0; } apply(); }
    function load(path) {
      const n = fs.resolve(path); if (!n || !isImage(n)) return errorBox("Photos", new Error("That is not a picture."));
      st.path = path; st.fit = true; st.rot = 0; st.x = st.y = 0; img.src = fs.url(n); proc.bytes = n.size || 0; bus.emit("file:open", path);
      img.onload = () => { apply(); const s = siblings(); win.setTitle(`${n.name} - Photos`); info.innerHTML = `<span>${img.naturalWidth} x ${img.naturalHeight}</span><span>${fmtSize(n.size || 0)}</span><span>${s.indexOf(path) + 1} of ${s.length} in ${basename(dirname(path)) || "/"}</span><span class="grow"></span><span>${new Date(n.modified).toLocaleDateString()}</span>`; };
    }
    function empty() { st.path = null; img.removeAttribute("src"); win.setTitle("Photos"); info.innerHTML = ""; stage.innerHTML = ""; stage.append(el("div", { class: "empty" }, el("span", { html: icon("image") }), el("b", { text: "No picture open" }), el("button", { class: "btn", text: "Open a picture", onclick: () => bar.firstChild.click() }))); }
    stage.addEventListener("wheel", e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    stage.addEventListener("pointerdown", e => { if (st.fit || e.button !== 0) return; const s = { x: e.clientX - st.x, y: e.clientY - st.y }; stage.setPointerCapture(e.pointerId); const mv = ev => { st.x = ev.clientX - s.x; st.y = ev.clientY - s.y; apply(); }; const up = () => { stage.removeEventListener("pointermove", mv); stage.removeEventListener("pointerup", up); }; stage.addEventListener("pointermove", mv); stage.addEventListener("pointerup", up); });
    stage.addEventListener("dblclick", () => { if (st.fit) { st.fit = false; st.scale = 1; } else { st.fit = true; st.x = st.y = 0; } apply(); });
    win.body.tabIndex = 0;
    win.body.addEventListener("keydown", e => { const k = e.key; if (k === "ArrowLeft") step(-1); else if (k === "ArrowRight") step(1); else if (k === "+" || k === "=") zoom(1); else if (k === "-") zoom(-1); else if (k === "0") { st.fit = true; st.x = st.y = 0; apply(); } else if (k.toLowerCase() === "r") { st.rot = (st.rot + 90) % 360; apply(); } else if (k === "Delete") bar.lastChild.click(); else return; e.preventDefault(); });
    win.on("resize", apply);
    const off = bus.on("fs", ev => { if (st.path && !fs.resolve(st.path)) { const s = siblings(); s.length ? load(s[0]) : empty(); } });
    win.on("close", () => off());
    if (st.path) load(st.path); else empty();
    setTimeout(() => win.body.focus(), 50);
  },
});
