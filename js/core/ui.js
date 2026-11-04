// Shared UI primitives: element helper, context menus, dialogs, toasts, file picker.
import { icon } from "./icons.js";
import { bus } from "./bus.js";
import { sound } from "./sound.js";
import { fs, join, isImage } from "./fs.js";

export function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") e.className = v;
    else if (k === "value") e.value = v;
    else if (k === "html") e.innerHTML = v;
    else if (k === "text") e.textContent = v;
    else if (k === "style" && typeof v === "object") for (const [sk, sv] of Object.entries(v)) sk.startsWith("--") ? e.style.setProperty(sk, sv) : (e.style[sk] = sv);
    else if (k.startsWith("on") && typeof v === "function") e.addEventListener(k.slice(2), v);
    else if (k === "dataset") Object.assign(e.dataset, v);
    else e.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(String(c)));
  return e;
}
export const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const sleep = ms => new Promise(r => setTimeout(r, ms));
export const fmtTime = (d, secs = false) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(secs ? { second: "2-digit" } : {}) });
export const fmtDate = d => d.toLocaleDateString([], { year: "numeric", month: "numeric", day: "numeric" });
export const fmtLongDate = d => d.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" });
export const fmtAgo = t => { const s = Math.max(0, (Date.now() - t) / 1000); if (s < 60) return "just now"; if (s < 3600) return `${Math.floor(s / 60)} min ago`; if (s < 86400) return `${Math.floor(s / 3600)} h ago`; return new Date(t).toLocaleDateString(); };
export const fmtDur = s => { s = Math.floor(s); const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h ? `${h}:${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${m}:${String(s % 60).padStart(2, "0")}`; };

// ---------- context menu
let openMenu = null;
export function closeMenu() { if (openMenu) { openMenu.remove(); openMenu = null; } }
export function contextMenu(x, y, items, { parent = null } = {}) {
  if (!parent) closeMenu();
  const m = el("div", { class: "menu", role: "menu" });
  let subMenu = null;
  for (const it of items) {
    if (!it) continue;
    if (it.sep) { m.append(el("div", { class: "sep" })); continue; }
    const row = el("div", { class: `mi${it.disabled ? " disabled" : ""}${it.danger ? " danger" : ""}${it.check ? " check" : ""}`, role: "menuitem" },
      el("span", { class: "mi-ic", html: it.icon ? icon(it.icon) : "" }), el("span", { text: it.label }),
      it.key ? el("span", { class: "mi-key", text: it.key }) : null,
      it.sub ? el("span", { class: "mi-sub", html: icon("chevronR") }) : null);
    if (it.sub) {
      row.addEventListener("mouseenter", () => { subMenu?.remove(); const r = row.getBoundingClientRect(); subMenu = contextMenu(r.right - 4, r.top - 5, it.sub, { parent: m }); });
    } else {
      row.addEventListener("mouseenter", () => { subMenu?.remove(); subMenu = null; });
      row.addEventListener("click", e => { e.stopPropagation(); closeMenu(); sound.click(); it.action?.(); });
    }
    m.append(row);
  }
  (parent || document.body).append(m);
  const r = m.getBoundingClientRect();
  m.style.left = clamp(x, 4, innerWidth - r.width - 4) + "px";
  m.style.top = clamp(y, 4, innerHeight - r.height - 4) + "px";
  if (parent) { m.style.position = "fixed"; return m; }
  openMenu = m;
  // keyboard navigation
  let idx = -1; const rows = () => [...m.querySelectorAll(":scope > .mi:not(.disabled)")];
  const key = e => {
    if (!openMenu) { removeEventListener("keydown", key, true); return; }
    if (e.key === "Escape") { closeMenu(); e.stopPropagation(); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") { const rs = rows(); idx = (idx + (e.key === "ArrowDown" ? 1 : -1) + rs.length) % rs.length; rs.forEach((r, i) => r.classList.toggle("focus", i === idx)); e.preventDefault(); }
    else if (e.key === "Enter") { rows()[idx]?.click(); }
  };
  addEventListener("keydown", key, true);
  setTimeout(() => {
    const off = e => { if (!m.contains(e.target)) { closeMenu(); removeEventListener("pointerdown", off, true); } };
    addEventListener("pointerdown", off, true);
  }, 0);
  return m;
}

// ---------- dialogs
export function dialog({ title, message, icon: ic, img, input, buttons = [{ label: "OK", value: true, primary: true }], width, html }) {
  return new Promise(resolve => {
    const layer = document.getElementById("overlay-layer");
    const inp = input ? el("input", { class: "input", value: input.value ?? "", placeholder: input.placeholder || "" }) : null;
    const d = el("div", { class: "dialog", style: width ? { width: width + "px" } : null },
      img ? el("img", { class: "dialog-icon", src: img }) : ic ? el("div", { class: "dialog-icon tile", style: { "--tile": "var(--accent)", fontSize: "22px" }, html: icon(ic) }) : null,
      el("h3", { text: title }), message ? el("p", { text: message }) : null, html ? el("div", { class: "dialog-html", html }) : null, inp,
      el("div", { class: "row" }, ...buttons.map(b => el("button", { class: `btn${b.primary ? " primary" : ""}${b.danger ? " danger" : ""}`, text: b.label, onclick: () => done(b.value) }))));
    const back = el("div", { class: "dialog-backdrop" }, d);
    const done = v => { back.remove(); removeEventListener("keydown", key, true); resolve(input ? (v ? inp.value : null) : v); };
    const key = e => { if (e.key === "Escape") { e.stopPropagation(); done(input ? null : buttons.find(b => b.cancel)?.value ?? false); } if (e.key === "Enter" && (input || buttons.length === 1)) { e.stopPropagation(); done(buttons.find(b => b.primary)?.value ?? true); } };
    addEventListener("keydown", key, true);
    layer.append(back);
    if (inp) { inp.focus(); if (input.select) { const i = inp.value.lastIndexOf("."); inp.setSelectionRange(0, input.select === "stem" && i > 0 ? i : inp.value.length); } }
    else d.querySelector(".btn.primary")?.focus();
  });
}
export const alert = (title, message, opts = {}) => dialog({ title, message, icon: "info", ...opts });
export const confirm = (title, message, { ok = "OK", cancel = "Cancel", danger = false, ...rest } = {}) =>
  dialog({ title, message, icon: danger ? "alert" : "info", buttons: [{ label: cancel, value: false, cancel: true }, { label: ok, value: true, primary: !danger, danger }], ...rest });
export const prompt = (title, value = "", { message, placeholder, select = "stem", ok = "OK" } = {}) =>
  dialog({ title, message, input: { value, placeholder, select }, buttons: [{ label: "Cancel", value: false, cancel: true }, { label: ok, value: true, primary: true }] });
export const errorBox = (title, e) => { sound.error(); return dialog({ title, message: e?.message || String(e), icon: "alert" }); };

// ---------- toasts + notification center
export const notifications = [];
export function toast({ title, body = "", icon: ic, img, color, timeout = 5000, silent = false, onclick, app = "System" }) {
  const n = { id: Date.now() + Math.random(), title, body, icon: ic, img, color, time: Date.now(), app };
  notifications.unshift(n); if (notifications.length > 50) notifications.pop();
  bus.emit("notify", n);
  if (!silent) sound.notify();
  const t = el("div", { class: "toast", role: "status" },
    img ? el("img", { src: img }) : el("div", { class: "toast-ic", style: { background: color || "var(--accent)" }, html: icon(ic || "bell") }),
    el("div", { class: "t" }, el("b", { text: title }), body ? el("span", { text: body }) : null, el("small", { text: app })),
    el("button", { class: "x", html: icon("x"), onclick: e => { e.stopPropagation(); kill(); } }));
  if (onclick) t.addEventListener("click", () => { onclick(); kill(); });
  const kill = () => { t.classList.add("out"); setTimeout(() => t.remove(), 200); };
  document.getElementById("toasts").append(t);
  if (timeout) setTimeout(kill, timeout);
  return n;
}

// ---------- file picker (open / save) over the virtual fs
export function filePicker({ mode = "open", start = "~", filter = null, name = "", title } = {}) {
  return new Promise(resolve => {
    let cur = fs.resolve(start) ? fs.pathOf(fs.resolve(start)) : fs.HOME;
    let selected = null;
    const crumbs = el("div", { class: "fp-crumbs" });
    const list = el("div", { class: "fp-list" });
    const nameInp = el("input", { class: "input", value: name, placeholder: "File name" });
    const okBtn = el("button", { class: "btn primary", text: mode === "save" ? "Save" : "Open" });
    const render = () => {
      crumbs.innerHTML = ""; const parts = cur === "/" ? [""] : cur.split("/");
      parts.forEach((p, i) => { const path = i === 0 ? "/" : parts.slice(0, i + 1).join("/"); crumbs.append(el("button", { class: "fp-crumb", text: p || "This PC", onclick: () => { cur = path; selected = null; render(); } })); if (i < parts.length - 1) crumbs.append(el("span", { class: "fp-sep", html: icon("chevronR") })); });
      list.innerHTML = "";
      const items = fs.list(cur, { hidden: false }).filter(n => n.type === "dir" || !filter || filter(n));
      if (!items.length) list.append(el("div", { class: "empty" }, el("b", { text: "Nothing here" })));
      for (const n of items) {
        const row = el("div", { class: "fp-row" + (selected === n ? " sel" : "") }, el("span", { class: "fp-ic", html: n.type === "dir" ? icon("folder") : isImage(n) ? `<img src="${fs.url(n)}" alt="">` : icon("fileText") }), el("span", { text: n.name }));
        row.addEventListener("click", () => { selected = n; if (n.type === "file") nameInp.value = n.name; render(); });
        row.addEventListener("dblclick", () => { if (n.type === "dir") { cur = fs.pathOf(n); selected = null; render(); } else done(fs.pathOf(n)); });
        list.append(row);
      }
      okBtn.disabled = mode === "open" ? !(selected && selected.type === "file") : !nameInp.value.trim();
    };
    nameInp.addEventListener("input", render);
    const done = async v => {
      if (v && mode === "save") {
        const target = join(cur, nameInp.value.trim());
        const ex = fs.resolve(target);
        if (ex && ex.type === "dir") { cur = target; selected = null; render(); return; }
        if (ex && !(await confirm("Replace file?", `"${ex.name}" already exists. Replace it?`, { ok: "Replace" }))) return;
      }
      back.remove(); removeEventListener("keydown", key, true); resolve(v);
    };
    const key = e => { if (e.key === "Escape") { e.stopPropagation(); done(null); } if (e.key === "Enter" && document.activeElement === nameInp) { e.stopPropagation(); okBtn.click(); } };
    addEventListener("keydown", key, true);
    okBtn.addEventListener("click", () => mode === "save" ? done(join(cur, nameInp.value.trim())) : done(fs.pathOf(selected)));
    const d = el("div", { class: "dialog fp" }, el("h3", { text: title || (mode === "save" ? "Save as" : "Open") }), crumbs, list,
      el("div", { class: "fp-foot" }, mode === "save" ? nameInp : el("span", { class: "fp-hint", text: "Double-click a folder to open it" }), el("button", { class: "btn", text: "Cancel", onclick: () => done(null) }), okBtn));
    const back = el("div", { class: "dialog-backdrop" }, d);
    document.getElementById("overlay-layer").append(back);
    render(); if (mode === "save") nameInp.focus();
  });
}

// ---------- download a Blob to the real computer
export function downloadBlob(blob, name) {
  const a = el("a", { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
