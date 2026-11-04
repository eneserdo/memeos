// Taskbar: start button, search, pinned + running apps, tray, clock, notification button.
import { bus } from "../core/bus.js";
import { wins, setMinimizeTarget, activeWin } from "../core/wm.js";
import { APPS, launch } from "../core/apps.js";
import { el, contextMenu, fmtTime, fmtDate } from "../core/ui.js";
import { icon, tile } from "../core/icons.js";
import { settings } from "../core/settings.js";
import { toggleFlyout } from "./flyouts.js";
import { toggleStart } from "./start.js";

const PINNED_KEY = "memeos.pinned";
export let pinned = JSON.parse(localStorage.getItem(PINNED_KEY) || '["files","terminal","surf","factory","settings"]');
const savePinned = () => localStorage.setItem(PINNED_KEY, JSON.stringify(pinned));
export const isPinned = id => pinned.includes(id);
export function togglePin(id) { pinned = isPinned(id) ? pinned.filter(p => p !== id) : [...pinned, id]; savePinned(); renderApps(); }

let appsEl;
export function initTaskbar() {
  appsEl = document.getElementById("tb-apps");
  document.getElementById("tb-start").addEventListener("click", e => { e.stopPropagation(); toggleStart(); });
  document.getElementById("tb-start").addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); contextMenu(e.clientX, e.clientY - 8, [
    { label: "Task Manager", icon: "activity", action: () => launch("taskman") }, { label: "Terminal", icon: "terminal", action: () => launch("terminal") }, { label: "Files", icon: "folder", action: () => launch("files") },
    { label: "Settings", icon: "settings", action: () => launch("settings") }, { sep: true }, { label: "Run", icon: "play", key: "Alt+R", action: () => launch("run") }, { label: "About MemeOS", icon: "info", action: () => launch("about") }]); });
  document.getElementById("tb-search").innerHTML = icon("search");
  document.getElementById("tb-search").addEventListener("click", e => { e.stopPropagation(); toggleStart(true); });
  document.getElementById("tb-tray").addEventListener("click", e => { e.stopPropagation(); toggleFlyout("quick"); });
  document.getElementById("tb-clock").addEventListener("click", e => { e.stopPropagation(); toggleFlyout("calendar"); });
  document.getElementById("tb-notif").innerHTML = icon("bell") + '<span class="notif-dot hidden"></span>';
  document.getElementById("tb-notif").addEventListener("click", e => { e.stopPropagation(); toggleFlyout("notifs"); });
  document.getElementById("taskbar").addEventListener("contextmenu", e => { if (e.target.closest(".tb-app")) return; e.preventDefault(); contextMenu(e.clientX, e.clientY - 8, [
    { label: "Taskbar alignment", icon: "list", sub: [{ label: "Center", check: settings.get("taskbarAlign") === "center", action: () => settings.set("taskbarAlign", "center") }, { label: "Left", check: settings.get("taskbarAlign") === "left", action: () => settings.set("taskbarAlign", "left") }] },
    { label: "Show seconds in clock", check: settings.get("showSeconds"), action: () => settings.set("showSeconds", !settings.get("showSeconds")) },
    { sep: true }, { label: "Task Manager", icon: "activity", action: () => launch("taskman") }, { label: "Taskbar settings", icon: "settings", action: () => launch("settings", { page: "taskbar" }) }]); });

  setMinimizeTarget(win => appsEl.querySelector(`.tb-app[data-app="${win.app.id}"]`)?.getBoundingClientRect() || document.getElementById("tb-start").getBoundingClientRect());
  ["win:open", "win:close", "win:focus", "win:minimize", "win:restore", "win:title"].forEach(ev => bus.on(ev, renderApps));
  bus.on("notify", () => document.querySelector("#tb-notif .notif-dot").classList.remove("hidden"));
  bus.on("notifs:seen", () => document.querySelector("#tb-notif .notif-dot").classList.add("hidden"));
  renderApps(); renderTray(); tickClock(); setInterval(tickClock, 1000);
  addEventListener("online", renderTray); addEventListener("offline", renderTray);
  bus.on("settings", k => { if (k === "volume" || k === "sounds" || k === "nightLight") renderTray(); });
}

function renderApps() {
  const running = new Map();
  for (const w of wins.values()) (running.get(w.app.id) || running.set(w.app.id, []).get(w.app.id)).push(w);
  const order = [...pinned.filter(id => APPS.has(id)), ...[...running.keys()].filter(id => !pinned.includes(id))];
  const act = activeWin();
  appsEl.innerHTML = "";
  for (const id of order) {
    const app = APPS.get(id), ws = running.get(id) || [];
    const b = el("button", { class: `tb-app${ws.length ? " running" : ""}${ws.some(w => w === act) ? " active" : ""}${ws.length > 1 ? " multi" : ""}`, dataset: { app: id }, title: app.name, html: tile(app.icon, app.color, 26) });
    b.addEventListener("click", () => {
      if (!ws.length) return launch(id);
      if (ws.length === 1) { const w = ws[0]; if (w.state === "min") w.restoreFromMin(); else if (w.focused) w.minimize(); else w.focus(); return; }
      const r = b.getBoundingClientRect();
      contextMenu(r.left, r.top - 8 - ws.length * 30 - 10, ws.map(w => ({ label: w.title, icon: w.state === "min" ? "minus" : "square", action: () => w.focus() })));
    });
    b.addEventListener("contextmenu", e => {
      e.preventDefault(); e.stopPropagation();
      const r = b.getBoundingClientRect();
      contextMenu(r.left, r.top - 10, [
        ...(ws.length ? ws.map(w => ({ label: w.title, icon: "square", action: () => w.focus() })) : []), ws.length ? { sep: true } : null,
        { label: app.name, icon: app.icon, action: () => launch(id) },
        { label: isPinned(id) ? "Unpin from taskbar" : "Pin to taskbar", icon: "pin", action: () => togglePin(id) },
        ws.length ? { label: ws.length > 1 ? "Close all windows" : "Close window", icon: "x", action: () => ws.forEach(w => w.close()) } : null,
      ]);
    });
    appsEl.append(b);
  }
}

function tickClock() {
  const d = new Date();
  document.querySelector("#tb-clock .tb-time").textContent = fmtTime(d, settings.get("showSeconds"));
  document.querySelector("#tb-clock .tb-date").textContent = fmtDate(d);
  if (d.getHours() === 13 && d.getMinutes() === 37) document.getElementById("tb-clock").classList.add("leet"); else document.getElementById("tb-clock").classList.remove("leet");
}
async function renderTray() {
  const t = document.getElementById("tb-tray");
  const vol = settings.get("sounds") ? (settings.get("volume") > 0 ? "volume" : "volumeX") : "volumeX";
  let bat = "";
  if (navigator.getBattery) { try { const b = await navigator.getBattery(); bat = `<span class="tray-bat" title="Battery ${Math.round(b.level * 100)}%${b.charging ? ", charging" : ""}">${icon("battery")}</span>`; } catch { } }
  t.innerHTML = `${settings.get("nightLight") ? `<span title="Night light on">${icon("moon")}</span>` : ""}<span title="${navigator.onLine ? "Connected" : "Offline"}">${icon(navigator.onLine ? "wifi" : "wifiOff")}</span><span title="Sound">${icon(vol)}</span>${bat}`;
}
