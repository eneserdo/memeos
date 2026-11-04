// Desktop: icons for the contents of ~/Desktop, selection, drag, context menu, drop import.
import { fs, join, isImage } from "../core/fs.js";
import { bus } from "../core/bus.js";
import { el, contextMenu, prompt, confirm, errorBox, toast, clamp, downloadBlob } from "../core/ui.js";
import { icon, tile } from "../core/icons.js";
import { APPS, launch, openFile } from "../core/apps.js";
import { settings, WALLPAPERS } from "../core/settings.js";
import { sound } from "../core/sound.js";
import { achieve } from "../core/eggs.js";

export const DESKTOP = "/home/pepe/Desktop";
const CELL = { w: 92, h: 100 };
let root, sel = new Set(), clipboard = null;
export const getClipboard = () => clipboard;
export const setClipboard = c => { clipboard = c; };

export function iconFor(node, size = 48) {
  if (node.type === "dir") return `<span class="fico">${icon("folder")}</span>`;
  const e = node.name.split(".").pop().toLowerCase();
  if (e === "app") return `<span class="fico app" data-app="${node.appId || ""}"></span>`;
  if (isImage(node)) return `<span class="fico img"><img src="${fs.url(node)}" alt="" loading="lazy"></span>`;
  if (e === "url") return `<span class="fico">${icon("globe")}</span>`;
  if (["md", "txt", "log", "json", "meme", "csv", "ini"].includes(e)) return `<span class="fico text">${icon("fileText")}</span>`;
  return `<span class="fico">${icon("file")}</span>`;
}
export async function resolveAppIcon(span, node) {
  try { const id = (await fs.readText(fs.pathOf(node))).trim(); const a = APPS.get(id); span.innerHTML = a ? tile(a.icon, a.color, 44) : icon("alert"); } catch { span.innerHTML = icon("alert"); }
}

export function initDesktop() {
  root = document.getElementById("desktop");
  render();
  bus.on("fs", ev => { if (ev.path?.startsWith(DESKTOP) || ev.from?.startsWith(DESKTOP) || ev.op === "restore" || ev.op === "empty") render(); });
  bus.on("settings", k => { if (k === "showHidden") render(); });
  root.addEventListener("pointerdown", e => { if (e.target === root && e.button === 0) rubberBand(e); });
  root.addEventListener("click", e => { if (e.target === root) { select([]); } });
  root.addEventListener("contextmenu", e => { e.preventDefault(); const ic = e.target.closest(".dicon"); if (ic) { if (!sel.has(ic.dataset.path)) select([ic.dataset.path]); itemMenu(e.clientX, e.clientY); } else desktopMenu(e.clientX, e.clientY); });
  root.addEventListener("keydown", e => {
    if (e.key === "Delete" && sel.size) { e.preventDefault(); trashSel(); }
    if (e.key === "F2" && sel.size === 1) { e.preventDefault(); renameSel(); }
    if (e.key === "Enter" && sel.size) { e.preventDefault(); [...sel].forEach(p => openFile(p)); }
    if (e.key === "a" && e.ctrlKey) { e.preventDefault(); select([...root.querySelectorAll(".dicon")].map(i => i.dataset.path)); }
    if (e.key === "c" && e.ctrlKey && sel.size) { clipboard = { op: "copy", paths: [...sel] }; }
    if (e.key === "x" && e.ctrlKey && sel.size) { clipboard = { op: "cut", paths: [...sel] }; }
    if (e.key === "v" && e.ctrlKey && clipboard) { pasteInto(DESKTOP); }
  });
  // external files dropped on the desktop
  root.addEventListener("dragover", e => { if (e.dataTransfer.types.includes("Files")) { e.preventDefault(); root.classList.add("drop"); } });
  root.addEventListener("dragleave", () => root.classList.remove("drop"));
  root.addEventListener("drop", async e => { root.classList.remove("drop"); if (!e.dataTransfer.files.length) return; e.preventDefault(); await importFiles(DESKTOP, e.dataTransfer.files); });
}

export async function importFiles(dir, files) {
  let n = 0;
  for (const f of files) { try { await fs.importFile(dir, f); n++; } catch (err) { errorBox("Import failed", err); } }
  if (n) { toast({ title: `Imported ${n} file${n > 1 ? "s" : ""}`, body: `Saved to ${dir.replace("/home/pepe", "~")}`, icon: "download", app: "Files" }); achieve("import"); }
}

function render() {
  const items = fs.list(DESKTOP, { hidden: settings.get("showHidden") });
  const pos = settings.get("desktopIcons") || {};
  const a = root.getBoundingClientRect(), cols = Math.max(1, Math.floor((a.width - 16) / CELL.w)), rows = Math.max(1, Math.floor((a.height - 16) / CELL.h));
  const taken = new Set(Object.values(pos).map(p => `${p.c},${p.r}`));
  root.innerHTML = "";
  let auto = 0;
  const free = () => { while (true) { const c = Math.floor(auto / rows), r = auto % rows; auto++; if (!taken.has(`${c},${r}`)) return { c, r }; } };
  for (const n of items) {
    const path = fs.pathOf(n);
    let p = pos[n.name]; if (!p || p.c >= cols || p.r >= rows) { p = free(); taken.add(`${p.c},${p.r}`); }
    const d = el("div", { class: "dicon" + (sel.has(path) ? " sel" : ""), dataset: { path, name: n.name }, style: { left: 8 + p.c * CELL.w + "px", top: 8 + p.r * CELL.h + "px" }, tabindex: 0, title: n.name },
      el("div", { class: "dicon-img", html: iconFor(n) }), el("div", { class: "dicon-name", text: n.name.replace(/\.app$/, "") }));
    const ap = d.querySelector(".fico.app"); if (ap) resolveAppIcon(ap, n);
    d.addEventListener("pointerdown", e => { if (e.button !== 0) return; e.stopPropagation(); if (e.ctrlKey) toggle(path); else if (!sel.has(path)) select([path]); dragIcon(e, d, n); });
    d.addEventListener("dblclick", e => { e.stopPropagation(); openFile(path); });
    d.addEventListener("keydown", e => { if (e.key === "Enter") { e.stopPropagation(); openFile(path); } });
    root.append(d);
  }
}
function select(paths) { sel = new Set(paths); root.querySelectorAll(".dicon").forEach(i => i.classList.toggle("sel", sel.has(i.dataset.path))); }
function toggle(p) { sel.has(p) ? sel.delete(p) : sel.add(p); select([...sel]); }

function dragIcon(e, d, node) {
  const start = { x: e.clientX, y: e.clientY }, ghosts = [], a = root.getBoundingClientRect();
  let moved = false, target = null;
  const move = ev => {
    const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) { moved = true; document.body.classList.add("no-select"); for (const p of sel) { const i = root.querySelector(`.dicon[data-path="${CSS.escape(p)}"]`); if (i) { const g = i.cloneNode(true); g.classList.add("ghost"); g.style.left = i.style.left; g.style.top = i.style.top; root.append(g); ghosts.push([g, i]); i.classList.add("src"); } } }
    ghosts.forEach(([g, i]) => { g.style.transform = `translate(${dx}px, ${dy}px)`; });
    const under = document.elementFromPoint(ev.clientX, ev.clientY);
    const t = under?.closest?.(".dicon:not(.ghost), .win[data-app='files'] .fx-row, .win[data-app='files'] .fx-tile, .win[data-app='files'] .fx-nav-item, .win[data-app='files'] .fx-content");
    if (t !== target) { target?.classList.remove("drop-target"); target = t && t !== d ? t : null; target?.classList.add("drop-target"); }
  };
  const up = async ev => {
    removeEventListener("pointermove", move); removeEventListener("pointerup", up);
    document.body.classList.remove("no-select"); ghosts.forEach(([g, i]) => { g.remove(); i.classList.remove("src"); }); target?.classList.remove("drop-target");
    if (!moved) return;
    const paths = [...sel];
    if (target) {
      const dest = target.dataset.path || target.closest("[data-path]")?.dataset.path;
      const dn = dest && fs.resolve(dest);
      if (dn && dn.type === "dir" && !paths.includes(dest)) { for (const p of paths) { try { await fs.move(p, dest); } catch (err) { errorBox("Move failed", err); } } return; }
      if (dn && dn.name.endsWith(".app") && paths.length === 1 && fs.resolve(paths[0])?.type === "file") { const id = (await fs.readText(dest)).trim(); launch(id, { path: paths[0] }); return; }
      if (target.classList.contains("fx-content") && dest) { for (const p of paths) { try { await fs.move(p, dest); } catch (err) { errorBox("Move failed", err); } } return; }
    }
    // reposition on the grid
    const pos = { ...(settings.get("desktopIcons") || {}) };
    const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
    const rows = Math.max(1, Math.floor((a.height - 16) / CELL.h)), cols = Math.max(1, Math.floor((a.width - 16) / CELL.w));
    for (const p of paths) {
      const i = root.querySelector(`.dicon[data-path="${CSS.escape(p)}"]`); if (!i) continue;
      const c = clamp(Math.round((parseFloat(i.style.left) - 8 + dx) / CELL.w), 0, cols - 1), r = clamp(Math.round((parseFloat(i.style.top) - 8 + dy) / CELL.h), 0, rows - 1);
      if (Object.entries(pos).some(([n, q]) => n !== i.dataset.name && q.c === c && q.r === r && !paths.includes(join(DESKTOP, n)))) continue;
      pos[i.dataset.name] = { c, r };
    }
    settings.set("desktopIcons", pos); render();
  };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
}

function rubberBand(e) {
  const a = root.getBoundingClientRect(), box = el("div", { class: "rubber" }); root.append(box);
  const sx = e.clientX - a.left, sy = e.clientY - a.top; let moved = false;
  const move = ev => {
    const x = ev.clientX - a.left, y = ev.clientY - a.top; if (!moved && Math.hypot(x - sx, y - sy) < 4) return; moved = true;
    const l = Math.min(sx, x), t = Math.min(sy, y), w = Math.abs(x - sx), h = Math.abs(y - sy);
    Object.assign(box.style, { left: l + "px", top: t + "px", width: w + "px", height: h + "px", display: "block" });
    const hits = [...root.querySelectorAll(".dicon")].filter(i => { const r = i.getBoundingClientRect(); const il = r.left - a.left, it = r.top - a.top; return il < l + w && il + r.width > l && it < t + h && it + r.height > t; });
    select(hits.map(i => i.dataset.path));
  };
  const up = () => { removeEventListener("pointermove", move); removeEventListener("pointerup", up); box.remove(); if (!moved) select([]); };
  addEventListener("pointermove", move); addEventListener("pointerup", up);
}

export function newItemMenu(dir, after) {
  return [
    { label: "Folder", icon: "folder", action: async () => { const n = await prompt("New folder", "New folder", { select: "all", ok: "Create" }); if (n) try { await fs.mkdir(join(dir, n)); after?.(); } catch (e) { errorBox("Cannot create folder", e); } } },
    { label: "Text document", icon: "fileText", action: async () => { const n = await prompt("New text document", "New text document.txt", { ok: "Create" }); if (n) try { await fs.writeFile(join(dir, fs.uniqueName(fs.stat(dir).id, n)), ""); after?.(); } catch (e) { errorBox("Cannot create file", e); } } },
    { label: "Markdown note", icon: "edit", action: async () => { const n = await prompt("New note", "note.md", { ok: "Create" }); if (n) try { const p = join(dir, fs.uniqueName(fs.stat(dir).id, n)); await fs.writeFile(p, "# " + n.replace(/\.md$/, "") + "\n\n"); openFile(p); } catch (e) { errorBox("Cannot create file", e); } } },
    { label: "App shortcut", icon: "zap", sub: [...APPS.values()].filter(a => !a.hidden).map(a => ({ label: a.name, action: async () => { try { await fs.writeFile(join(dir, fs.uniqueName(fs.stat(dir).id, a.name + ".app")), a.id); after?.(); } catch (e) { errorBox("Cannot create shortcut", e); } } })) },
  ];
}
export function wallpaperMenu() {
  return WALLPAPERS.map(w => ({ label: w.name, check: settings.get("wallpaper") === w.id, action: () => settings.patch({ wallpaper: w.id, theme: w.theme }) }));
}
function desktopMenu(x, y) {
  contextMenu(x, y, [
    { label: "View", icon: "grid", sub: [{ label: "Show hidden files", check: settings.get("showHidden"), action: () => settings.set("showHidden", !settings.get("showHidden")) }, { label: "Auto arrange icons", icon: "refresh", action: () => { settings.set("desktopIcons", {}); render(); } }] },
    { label: "Sort by name", icon: "list", action: () => { settings.set("desktopIcons", {}); render(); } },
    { label: "Refresh", icon: "refresh", key: "F5", action: render },
    { sep: true },
    { label: "New", icon: "plus", sub: newItemMenu(DESKTOP) },
    { label: "Paste", icon: "clipboard", key: "Ctrl+V", disabled: !clipboard, action: () => pasteInto(DESKTOP) },
    { sep: true },
    { label: "Wallpaper", icon: "image", sub: wallpaperMenu() },
    { label: "Open in Terminal", icon: "terminal", action: () => launch("terminal", { cwd: DESKTOP }) },
    { label: "Personalize", icon: "wand", action: () => launch("settings", { page: "personalization" }) },
    { label: "Display settings", icon: "monitor", action: () => launch("settings", { page: "system" }) },
  ]);
}
export function fileMenuItems(paths, { after, inTrash = false } = {}) {
  const one = paths.length === 1 ? fs.resolve(paths[0]) : null;
  if (inTrash) return [
    { label: "Restore", icon: "undo", action: async () => { for (const p of paths) await fs.restore(p); after?.(); } },
    { label: "Delete permanently", icon: "x", danger: true, action: async () => { if (await confirm("Delete permanently?", `${paths.length} item${paths.length > 1 ? "s" : ""} will be gone for good.`, { ok: "Delete", danger: true })) { for (const p of paths) await fs.remove(p); after?.(); } } },
    { sep: true }, { label: "Properties", icon: "info", action: () => properties(paths[0]) },
  ];
  const items = [
    { label: "Open", icon: "external", key: "Enter", action: () => paths.forEach(p => openFile(p)) },
  ];
  if (one && one.type === "file") {
    const e = one.name.split(".").pop().toLowerCase();
    if (e !== "app") items.push({ label: "Open with", icon: "more", sub: [{ label: "Notepad", action: () => openFile(paths[0], { app: "notepad" }) }, ...(isImage(one) ? [{ label: "Photos", action: () => openFile(paths[0], { app: "photos" }) }, { label: "Meme Factory", action: () => launch("factory", { path: paths[0] }) }] : [])] });
    if (isImage(one)) items.push({ label: "Set as wallpaper", icon: "image", action: async () => { await setWallpaperFrom(one); } });
    if (one.type === "file") items.push({ label: "Download", icon: "download", action: async () => downloadBlob(await fs.blob(one), one.name) });
  }
  if (one && one.type === "dir") items.push({ label: "Open in Terminal", icon: "terminal", action: () => launch("terminal", { cwd: paths[0] }) });
  items.push({ sep: true },
    { label: "Cut", icon: "scissors", key: "Ctrl+X", action: () => { clipboard = { op: "cut", paths }; } },
    { label: "Copy", icon: "copy", key: "Ctrl+C", action: () => { clipboard = { op: "copy", paths }; } },
    { sep: true },
    { label: "Rename", icon: "edit", key: "F2", disabled: !one, action: () => renamePath(paths[0], after) },
    { label: "Delete", icon: "trash", key: "Del", danger: true, action: () => trashPaths(paths, after) },
    { sep: true },
    { label: "Properties", icon: "info", action: () => properties(paths[0]) });
  return items;
}
function itemMenu(x, y) { contextMenu(x, y, fileMenuItems([...sel])); }
export async function renamePath(path, after) {
  const n = fs.resolve(path); if (!n) return;
  const name = await prompt("Rename", n.name, { select: "stem", ok: "Rename" });
  if (name && name !== n.name) try { await fs.rename(path, name); after?.(); } catch (e) { errorBox("Cannot rename", e); }
}
export async function trashPaths(paths, after) {
  let n = 0;
  for (const p of paths) { try { await fs.trash(p); n++; } catch (e) { errorBox("Cannot delete", e); } }
  if (n) { sound.trash(); achieve("trash"); }
  after?.();
}
const renameSel = () => renamePath([...sel][0]);
const trashSel = () => trashPaths([...sel]);
export async function pasteInto(dir) {
  if (!clipboard) return;
  for (const p of clipboard.paths) { try { if (clipboard.op === "cut") await fs.move(p, dir); else await fs.copy(p, dir); } catch (e) { errorBox("Paste failed", e); } }
  if (clipboard.op === "cut") clipboard = null;
}
export async function setWallpaperFrom(node) {
  const blob = await fs.blob(node);
  const url = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
  if (url.length > 4e6) { toast({ title: "Picture too large", body: "Wallpapers are stored in settings, pick something under 3 MB.", icon: "alert", color: "var(--warn)" }); return; }
  settings.patch({ wallpaper: "custom", wallpaperCustom: url }); achieve("wallpaper");
  toast({ title: "Wallpaper changed", body: node.name, img: fs.url(node), app: "Settings" });
}
export async function properties(path) {
  const n = fs.resolve(path); if (!n) return;
  const size = fs.sizeOf(n), cnt = n.type === "dir" ? fs.countOf(n) : null;
  const rows = [["Name", n.name], ["Type", n.type === "dir" ? "Folder" : (n.mime || "file")], ["Location", fs.pathOf(fs.nodes.get(n.parent))], ["Size", `${(size / 1024).toFixed(1)} KB (${size.toLocaleString()} bytes)`],
    ...(cnt ? [["Contains", `${cnt.files} files, ${cnt.dirs} folders`]] : []), ...(n.meta?.w ? [["Dimensions", `${n.meta.w} x ${n.meta.h}`]] : []), ...(n.meta?.source ? [["Source", n.meta.source]] : []),
    ["Created", new Date(n.created).toLocaleString()], ["Modified", new Date(n.modified).toLocaleString()], ...(n.meta?.origPath ? [["Original location", n.meta.origPath]] : [])];
  const { dialog } = await import("../core/ui.js");
  dialog({ title: n.name + " properties", html: `<table class="props">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${String(v).replace(/</g, "&lt;")}</td></tr>`).join("")}</table>`, width: 440 });
}
