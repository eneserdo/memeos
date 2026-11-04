// Start menu: pinned apps, recent files, search over apps / files / settings / arithmetic, power menu.
import { appList, launch, openFile, APPS } from "../core/apps.js";
import { fs, isImage } from "../core/fs.js";
import { el, contextMenu, esc } from "../core/ui.js";
import { icon, tile } from "../core/icons.js";
import { settings } from "../core/settings.js";
import { closeFlyouts } from "./flyouts.js";
import { power } from "./power.js";
import { bus } from "../core/bus.js";
import { iconFor } from "./desktop.js";
import { togglePin, isPinned } from "./taskbar.js";

const RECENT_KEY = "memeos.recent";
export let recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
export function addRecent(path) { recent = [path, ...recent.filter(p => p !== path)].slice(0, 8); localStorage.setItem(RECENT_KEY, JSON.stringify(recent)); }
bus.on("app:launch", (app, win) => { /* files opened through openFile are tracked in apps.js via bus */ });
bus.on("file:open", addRecent);

let root, open = false, query = "", cursor = -1;
export const isStartOpen = () => open;
export function initStart() { root = document.getElementById("start"); addEventListener("pointerdown", e => { if (open && !root.contains(e.target) && !e.target.closest("#tb-start, #tb-search")) closeStart(); }); }
export function toggleStart(search = false) { open ? closeStart() : openStart(search); }
export function openStart(search = false) {
  closeFlyouts(); open = true; query = ""; cursor = -1; render(); root.classList.remove("hidden"); root.classList.add("in");
  setTimeout(() => root.querySelector(".st-search")?.focus(), 30);
}
export function closeStart() { if (!open) return; open = false; root.classList.add("hidden"); root.classList.remove("in"); }

const SETTINGS_PAGES = [["Personalization", "personalization", "wand"], ["Taskbar", "taskbar", "list"], ["Sounds", "sounds", "volume"], ["System", "system", "cpu"], ["Storage and reset", "storage", "hdd"], ["About", "about", "info"]];

function results(q) {
  const lq = q.toLowerCase().trim(); if (!lq) return [];
  const out = [];
  // arithmetic
  if (/^[\d\s+\-*/().%^,]+$/.test(lq) && /\d/.test(lq)) { try { const v = Function(`"use strict";return (${lq.replace(/\^/g, "**").replace(/,/g, ".")})`)(); if (Number.isFinite(v)) out.push({ kind: "calc", label: `= ${v}`, sub: "Copy result", icon: "calc", action: () => navigator.clipboard?.writeText(String(v)) }); } catch { } }
  for (const a of appList()) if (a.name.toLowerCase().includes(lq) || (a.keywords || []).some(k => k.includes(lq))) out.push({ kind: "app", label: a.name, sub: a.desc, app: a, action: () => launch(a.id) });
  for (const [name, page, ic] of SETTINGS_PAGES) if (name.toLowerCase().includes(lq) || "settings".includes(lq)) out.push({ kind: "settings", label: name, sub: "Settings", icon: ic, action: () => launch("settings", { page }) });
  for (const n of fs.search(lq, "/home").slice(0, 8)) if (!fs.pathOf(n).startsWith(fs.TRASH)) out.push({ kind: "file", label: n.name, sub: fs.pathOf(fs.nodes.get(n.parent)).replace("/home/pepe", "~"), node: n, action: () => openFile(fs.pathOf(n)) });
  if (lq === "doge" || lq === "wow") out.push({ kind: "egg", label: "wow", sub: "such search", icon: "sparkle", action: () => import("../core/eggs.js").then(m => m.dogeRain()) });
  return out.slice(0, 14);
}

function render() {
  const apps = appList();
  root.innerHTML = "";
  const search = el("input", { class: "st-search input", placeholder: "Search apps, files and settings", value: query, autocomplete: "off" });
  search.addEventListener("input", () => { query = search.value; cursor = -1; renderBody(); });
  search.addEventListener("keydown", e => {
    const rows = [...root.querySelectorAll(".st-result")];
    if (e.key === "ArrowDown") { cursor = Math.min(rows.length - 1, cursor + 1); hl(rows); e.preventDefault(); }
    else if (e.key === "ArrowUp") { cursor = Math.max(0, cursor - 1); hl(rows); e.preventDefault(); }
    else if (e.key === "Enter") { (rows[cursor] || rows[0])?.click(); }
    else if (e.key === "Escape") { closeStart(); }
  });
  const hl = rows => rows.forEach((r, i) => r.classList.toggle("focus", i === cursor));
  const body = el("div", { class: "st-body" });
  const renderBody = () => {
    body.innerHTML = "";
    if (query.trim()) {
      const rs = results(query);
      body.append(el("div", { class: "st-h", text: rs.length ? "Best matches" : "No results" }));
      for (const r of rs) {
        const row = el("div", { class: "st-result", onclick: () => { closeStart(); r.action(); } },
          el("span", { class: "st-ric", html: r.app ? tile(r.app.icon, r.app.color, 32) : r.node ? iconFor(r.node) : `<span class="tile" style="--tile:var(--surface-3);width:32px;height:32px;font-size:17px;color:var(--text)">${icon(r.icon)}</span>` }),
          el("span", { class: "st-rt" }, el("b", { text: r.label }), el("small", { text: r.sub || "" })));
        if (r.app) row.addEventListener("contextmenu", e => { e.preventDefault(); appMenu(e, r.app); });
        body.append(row);
      }
      return;
    }
    body.append(el("div", { class: "st-h" }, "Pinned", el("span", { class: "st-hint", text: "right-click for options" })));
    const grid = el("div", { class: "st-grid" });
    for (const a of apps) {
      const t = el("button", { class: "st-app", title: a.desc || a.name, html: `${tile(a.icon, a.color, 40)}<span>${esc(a.name)}</span>`, onclick: () => { closeStart(); launch(a.id); } });
      t.addEventListener("contextmenu", e => { e.preventDefault(); appMenu(e, a); });
      grid.append(t);
    }
    body.append(grid);
    const rec = recent.map(p => fs.resolve(p)).filter(Boolean);
    body.append(el("div", { class: "st-h" }, "Recommended", rec.length ? el("button", { class: "st-hint st-link", text: "clear", onclick: () => { recent = []; localStorage.setItem(RECENT_KEY, "[]"); renderBody(); } }) : null));
    const rl = el("div", { class: "st-recent" });
    if (!rec.length) rl.append(el("div", { class: "st-empty", text: "Files you open will show up here." }));
    for (const n of rec.slice(0, 6)) rl.append(el("div", { class: "st-result", onclick: () => { closeStart(); openFile(fs.pathOf(n)); } }, el("span", { class: "st-ric", html: iconFor(n) }), el("span", { class: "st-rt" }, el("b", { text: n.name }), el("small", { text: new Date(n.modified).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) }))));
    body.append(rl);
  };
  renderBody();
  const foot = el("div", { class: "st-foot" },
    el("button", { class: "st-user", onclick: () => { closeStart(); launch("settings", { page: "about" }); } }, el("img", { src: settings.get("avatar"), alt: "" }), el("span", { text: settings.get("user") })),
    el("button", { class: "st-power", title: "Power", html: icon("power"), onclick: e => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); contextMenu(r.left - 150, r.top - 150, [
      { label: "Lock", icon: "lock", key: "Alt+L", action: () => { closeStart(); power.lock(); } }, { label: "Sleep", icon: "moon", action: () => { closeStart(); power.sleep(); } },
      { sep: true }, { label: "Restart", icon: "refresh", action: () => { closeStart(); power.restart(); } }, { label: "Shut down", icon: "power", action: () => { closeStart(); power.shutdown(); } }]); } }));
  root.append(search, body, foot);
}
function appMenu(e, a) {
  contextMenu(e.clientX, e.clientY, [
    { label: "Open", icon: "external", action: () => { closeStart(); launch(a.id); } },
    { label: isPinned(a.id) ? "Unpin from taskbar" : "Pin to taskbar", icon: "pin", action: () => togglePin(a.id) },
    { label: "Create desktop shortcut", icon: "monitor", action: async () => { const d = "/home/pepe/Desktop"; await fs.writeFile(d + "/" + fs.uniqueName(fs.stat(d).id, a.name + ".app"), a.id); } },
  ]);
}
