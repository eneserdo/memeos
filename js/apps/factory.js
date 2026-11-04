// Meme Factory: put Impact text on a picture, save the PNG into the file system or download it.
import { registerApp } from "../core/apps.js";
import { fs, isImage, join, basename } from "../core/fs.js";
import { el, filePicker, errorBox, toast, downloadBlob } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { achieve } from "../core/eggs.js";
import { bus } from "../core/bus.js";

registerApp({
  id: "factory", name: "Meme Factory", desc: "Caption a picture, save it as a new file", icon: "wand", color: "linear-gradient(135deg,#f97316,#ef4444)", w: 900, h: 620, minW: 560, minH: 400, keywords: ["meme", "generator", "caption", "impact"],
  mount(win, proc, args) {
    const st = { path: null, img: null, top: "ONE DOES NOT SIMPLY", bottom: "BUILD AN OS IN A BROWSER", size: 10, stroke: 1, font: "impact", color: "#ffffff", upper: true, pad: 0 };
    const canvas = el("canvas", { class: "mf-canvas" });
    const stage = el("div", { class: "mf-stage" }, canvas);
    const side = el("div", { class: "mf-side" });
    const field = (label, ctrl) => el("label", { class: "mf-field" }, el("span", { text: label }), ctrl);
    const top = el("textarea", { class: "input", rows: 2, value: st.top }), bottom = el("textarea", { class: "input", rows: 2, value: st.bottom });
    const size = el("input", { type: "range", class: "range", min: 4, max: 20, value: st.size }), stroke = el("input", { type: "range", class: "range", min: 0, max: 3, step: .25, value: st.stroke });
    const color = el("input", { type: "color", value: st.color, class: "mf-color" });
    const font = el("select", { class: "input" }, ...[["impact", "Impact"], ["anton", "Anton"], ["comic", "Comic Sans"], ["mono", "Monospace"], ["inter", "Inter"]].map(([v, l]) => el("option", { value: v, text: l })));
    const upper = el("button", { class: "switch", role: "switch", "aria-checked": "true", onclick: () => { st.upper = !st.upper; upper.setAttribute("aria-checked", String(st.upper)); draw(); } });
    const pad = el("button", { class: "switch", role: "switch", "aria-checked": "false", onclick: () => { st.pad = st.pad ? 0 : 1; pad.setAttribute("aria-checked", String(!!st.pad)); draw(); } });
    [top, bottom, size, stroke, color, font].forEach(c => c.addEventListener("input", () => { st.top = top.value; st.bottom = bottom.value; st.size = +size.value; st.stroke = +stroke.value; st.color = color.value; st.font = font.value; draw(); }));
    const pick = el("button", { class: "btn", html: icon("image") + " Choose picture", onclick: async () => { const p = await filePicker({ mode: "open", start: "~/Memes", filter: isImage }); if (p) load(p); } });
    const upload = el("input", { type: "file", accept: "image/*", class: "hidden" }); upload.addEventListener("change", async () => { const f = upload.files[0]; if (!f) return; const n = await fs.importFile("/home/pepe/Pictures", f); load(fs.pathOf(n)); });
    const saveBtn = el("button", { class: "btn primary", html: icon("save") + " Save to Memes", onclick: () => save(), disabled: true });
    const dlBtn = el("button", { class: "btn", html: icon("download") + " Download PNG", onclick: () => canvas.toBlob(b => downloadBlob(b, "meme.png")), disabled: true });
    const randomBtn = el("button", { class: "btn ghost sm", html: icon("shuffle") + " Random picture", onclick: () => { const m = fs.list("/home/pepe/Memes").filter(isImage); if (m.length) load(fs.pathOf(m[Math.floor(Math.random() * m.length)])); } });
    side.append(el("div", { class: "mf-row" }, pick, el("button", { class: "btn icon", html: icon("upload"), title: "From your computer", onclick: () => upload.click() })), randomBtn, upload,
      field("Top text", top), field("Bottom text", bottom), field("Text size", size), field("Outline", stroke),
      el("div", { class: "mf-row" }, field("Colour", color), field("Font", font)), el("div", { class: "mf-row sw" }, el("span", { text: "Uppercase" }), upper, el("span", { text: "White bar on top" }), pad),
      el("div", { class: "grow" }), el("div", { class: "mf-row wrap" }, saveBtn, dlBtn), el("small", { class: "mf-hint", text: "Ctrl+S saves. Files land in ~/Memes/Made with MemeOS." }));
    win.body.append(el("div", { class: "mf" }, stage, side));
    const FONTS = { impact: "Impact, 'Anton', 'Arial Narrow Bold', sans-serif", anton: "'Anton', Impact, sans-serif", comic: "'Comic Sans MS', 'Comic Sans', cursive", mono: "'JetBrains Mono', monospace", inter: "'Inter', sans-serif" };
    function wrap(ctx, text, maxW) { const words = text.split(/\s+/), lines = []; let cur = ""; for (const w of words) { const t = cur ? cur + " " + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; } if (cur) lines.push(cur); return lines; }
    function draw() {
      if (!st.img) { canvas.width = 640; canvas.height = 400; const c = canvas.getContext("2d"); c.fillStyle = "#222"; c.fillRect(0, 0, 640, 400); c.fillStyle = "#888"; c.font = "500 18px Inter, sans-serif"; c.textAlign = "center"; c.fillText("Choose a picture to start", 320, 200); return; }
      const W = st.img.naturalWidth, pad = st.pad ? Math.round(W * 0.18) : 0, Hh = st.img.naturalHeight + pad;
      canvas.width = W; canvas.height = Hh; const c = canvas.getContext("2d");
      c.fillStyle = "#fff"; c.fillRect(0, 0, W, Hh); c.drawImage(st.img, 0, pad);
      const fs_ = Math.round(W * st.size / 100), lh = fs_ * 1.1;
      c.font = `${st.font === "impact" || st.font === "anton" ? "400" : "700"} ${fs_}px ${FONTS[st.font]}`; c.textAlign = "center"; c.lineJoin = "round"; c.lineWidth = Math.max(1, fs_ * 0.08 * st.stroke); c.strokeStyle = "#000"; c.fillStyle = st.pad && !st.bottom ? "#000" : st.color;
      const put = (text, fromTop) => {
        const t = st.upper ? text.toUpperCase() : text; if (!t.trim()) return;
        const lines = t.split("\n").flatMap(l => wrap(c, l, W * 0.92));
        lines.forEach((l, i) => { const y = fromTop ? (st.pad ? pad / 2 - (lines.length - 1) * lh / 2 + i * lh + fs_ * .35 : fs_ * 1.15 + i * lh) : Hh - fs_ * 0.45 - (lines.length - 1 - i) * lh; if (!(st.pad && fromTop) && st.stroke) c.strokeText(l, W / 2, y); if (st.pad && fromTop) { c.fillStyle = "#000"; c.fillText(l, W / 2, y); c.fillStyle = st.color; } else c.fillText(l, W / 2, y); });
      };
      put(st.top, true); put(st.bottom, false);
      proc.work(2);
    }
    function load(path) {
      const n = fs.resolve(path); if (!n || !isImage(n)) return errorBox("Meme Factory", new Error("Pick an image file."));
      const im = new Image(); im.onload = () => { st.img = im; st.path = path; proc.bytes = n.size || 0; saveBtn.disabled = dlBtn.disabled = false; win.setTitle(`${n.name} - Meme Factory`); draw(); }; im.onerror = () => errorBox("Meme Factory", new Error("Could not decode that picture.")); im.src = fs.url(n);
    }
    async function save() {
      if (!st.img) return;
      const dir = "/home/pepe/Memes/Made with MemeOS"; if (!fs.resolve(dir)) await fs.mkdir(dir, { recursive: true });
      const blob = await new Promise(r => canvas.toBlob(r, "image/png"));
      const stem = (st.top || st.bottom || basename(st.path)).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "meme";
      const name = fs.uniqueName(fs.stat(dir).id, stem + ".png");
      const n = await fs.writeFile(join(dir, name), blob, { mime: "image/png", meta: { w: canvas.width, h: canvas.height } });
      toast({ title: "Meme saved", body: `~/Memes/Made with MemeOS/${name}`, img: fs.url(n), app: "Meme Factory", onclick: () => import("../core/apps.js").then(m => m.openFile(fs.pathOf(n))) });
      achieve("meme"); bus.emit("file:open", fs.pathOf(n));
    }
    win.body.addEventListener("keydown", e => { if (e.ctrlKey && e.key === "s") { e.preventDefault(); save(); } });
    document.fonts?.load("400 40px Anton").then(draw).catch(() => { });
    if (args.path) load(args.path); else draw();
  },
});
