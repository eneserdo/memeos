// Taskbar flyouts: quick settings, calendar, notification centre.
import { el, notifications, fmtTime, fmtAgo } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { settings } from "../core/settings.js";
import { launch } from "../core/apps.js";
import { bus } from "../core/bus.js";

let current = null;
export function initFlyouts() {
  addEventListener("pointerdown", e => { if (current && !document.getElementById(current).contains(e.target) && !e.target.closest("#tb-tray, #tb-clock, #tb-notif")) closeFlyouts(); });
  bus.on("notify", () => { if (current === "notifs") renderNotifs(); });
}
export function closeFlyouts() { if (!current) return; const f = document.getElementById(current); f.classList.add("hidden"); f.classList.remove("in"); current = null; }
export function toggleFlyout(id) {
  if (current === id) return closeFlyouts();
  closeFlyouts();
  import("./start.js").then(m => m.closeStart());
  current = id; const f = document.getElementById(id);
  ({ quick: renderQuick, calendar: renderCalendar, notifs: renderNotifs })[id]();
  f.classList.remove("hidden"); f.classList.add("in");
  if (id === "notifs") bus.emit("notifs:seen");
}

function tileBtn(label, ic, on, action, sub) {
  return el("button", { class: "qs-tile" + (on ? " on" : ""), onclick: action }, el("span", { class: "qs-ic", html: icon(ic) }), el("span", { class: "qs-l" }, el("b", { text: label }), sub ? el("small", { text: sub }) : null));
}
function renderQuick() {
  const f = document.getElementById("quick"); f.innerHTML = "";
  const grid = el("div", { class: "qs-grid" },
    tileBtn("Network", navigator.onLine ? "wifi" : "wifiOff", navigator.onLine, () => { }, navigator.onLine ? "Connected" : "Offline"),
    tileBtn("Night light", "moon", settings.get("nightLight"), () => { settings.set("nightLight", !settings.get("nightLight")); renderQuick(); }),
    tileBtn(settings.resolvedTheme() === "dark" ? "Dark mode" : "Light mode", settings.resolvedTheme() === "dark" ? "moon" : "sun", true, () => { settings.set("theme", settings.resolvedTheme() === "dark" ? "light" : "dark"); renderQuick(); }, "tap to switch"),
    tileBtn("Transparency", "sparkle", settings.get("transparency"), () => { settings.set("transparency", !settings.get("transparency")); renderQuick(); }),
    tileBtn("Animations", "zap", settings.get("animations"), () => { settings.set("animations", !settings.get("animations")); renderQuick(); }),
    tileBtn("Sounds", settings.get("sounds") ? "volume" : "volumeX", settings.get("sounds"), () => { settings.set("sounds", !settings.get("sounds")); renderQuick(); }));
  const vol = el("input", { class: "range", type: "range", min: 0, max: 100, value: Math.round(settings.get("volume") * 100) });
  vol.addEventListener("input", () => settings.patch({ volume: vol.value / 100, sounds: vol.value > 0 }));
  f.append(grid, el("div", { class: "qs-row" }, el("span", { html: icon("volume") }), vol),
    el("div", { class: "qs-foot" }, el("span", { class: "qs-bat", text: "" }), el("button", { class: "btn ghost sm", html: icon("settings") + " Settings", onclick: () => { closeFlyouts(); launch("settings"); } })));
  if (navigator.getBattery) navigator.getBattery().then(b => { f.querySelector(".qs-bat").textContent = `Battery ${Math.round(b.level * 100)}%${b.charging ? " (charging)" : ""}`; }).catch(() => { });
  else f.querySelector(".qs-bat").textContent = "Plugged in";
}

let calMonth = null;
function renderCalendar() {
  const f = document.getElementById("calendar"); f.innerHTML = "";
  const now = new Date(); if (!calMonth) calMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const head = el("div", { class: "cal-head" }, el("div", { class: "cal-time", text: fmtTime(now, true) }), el("div", { class: "cal-date", text: now.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long", year: "numeric" }) }));
  const mname = calMonth.toLocaleDateString([], { month: "long", year: "numeric" });
  const nav = el("div", { class: "cal-nav" }, el("b", { text: mname }), el("span", {}, el("button", { class: "btn ghost icon", html: icon("chevronU"), onclick: () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); renderCalendar(); } }), el("button", { class: "btn ghost icon", html: icon("chevronD"), onclick: () => { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); renderCalendar(); } })));
  const grid = el("div", { class: "cal-grid" });
  const dow = []; for (let i = 0; i < 7; i++) { const d = new Date(2024, 0, 1 + i); dow.push(d.toLocaleDateString([], { weekday: "narrow" })); }
  dow.forEach(d => grid.append(el("span", { class: "cal-dow", text: d })));
  const first = new Date(calMonth), start = (first.getDay() + 6) % 7; // week starts Monday
  const days = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 0).getDate();
  const prevDays = new Date(calMonth.getFullYear(), calMonth.getMonth(), 0).getDate();
  for (let i = 0; i < 42; i++) {
    const n = i - start + 1; let cls = "cal-d", label;
    if (n < 1) { label = prevDays + n; cls += " dim"; } else if (n > days) { label = n - days; cls += " dim"; } else { label = n; if (n === now.getDate() && calMonth.getMonth() === now.getMonth() && calMonth.getFullYear() === now.getFullYear()) cls += " today"; }
    grid.append(el("span", { class: cls, text: label }));
  }
  f.append(head, nav, grid, el("div", { class: "cal-foot", text: `Day ${Math.ceil((now - new Date(now.getFullYear(), 0, 1)) / 864e5)} of the year, week ${isoWeek(now)}` }));
  if (f._t) clearInterval(f._t); f._t = setInterval(() => { if (current !== "calendar") return clearInterval(f._t); head.querySelector(".cal-time").textContent = fmtTime(new Date(), true); }, 1000);
}
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y) / 864e5 + 1) / 7); }

function renderNotifs() {
  const f = document.getElementById("notifs"); f.innerHTML = "";
  f.append(el("div", { class: "nc-head" }, el("b", { text: "Notifications" }), notifications.length ? el("button", { class: "st-link", text: "Clear all", onclick: () => { notifications.length = 0; renderNotifs(); } }) : null));
  if (!notifications.length) { f.append(el("div", { class: "nc-empty" }, el("span", { html: icon("bellOff") }), "No new notifications")); return; }
  const list = el("div", { class: "nc-list" });
  for (const n of notifications) list.append(el("div", { class: "nc-item" }, n.img ? el("img", { src: n.img }) : el("span", { class: "toast-ic", style: { background: n.color || "var(--accent)" }, html: icon(n.icon || "bell") }), el("div", { class: "t" }, el("b", { text: n.title }), n.body ? el("span", { text: n.body }) : null, el("small", { text: `${n.app} · ${fmtAgo(n.time)}` })),
    el("button", { class: "x", html: icon("x"), onclick: () => { notifications.splice(notifications.indexOf(n), 1); renderNotifs(); } })));
  f.append(list);
}
