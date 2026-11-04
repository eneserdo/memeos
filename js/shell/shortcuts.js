// Global keyboard shortcuts and the Alt+W window switcher.
import { wins, activeWin, toggleDesktop } from "../core/wm.js";
import { launch } from "../core/apps.js";
import { toggleStart, closeStart, isStartOpen } from "./start.js";
import { closeFlyouts } from "./flyouts.js";
import { closeMenu, el } from "../core/ui.js";
import { power } from "./power.js";
import { achieve } from "../core/eggs.js";

let switcher = null, switchIdx = 0, switchList = [];
export function initShortcuts() {
  addEventListener("keydown", e => {
    if (document.getElementById("os").classList.contains("locked")) return;
    const w = activeWin(), inInput = e.target.closest?.("input, textarea, [contenteditable]");
    if (e.key === "Escape") { closeMenu(); closeFlyouts(); if (isStartOpen()) { closeStart(); e.preventDefault(); } if (switcher) commitSwitch(); return; }
    if (e.key === "F5" && !e.ctrlKey) { e.preventDefault(); return; }     // keep the OS alive
    if (!e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key.toLowerCase();
    const act = {
      s: () => toggleStart(), w: () => stepSwitch(e.shiftKey ? -1 : 1), t: () => launch("terminal"), e: () => launch("files"), r: () => launch("run"), l: () => power.lock(), d: () => toggleDesktop(), m: () => launch("taskman"),
      n: () => w?.minimize(), x: () => w?.close(), enter: () => w?.toggleMax(),
      arrowleft: () => { if (w) { w.snap("left"); achieve("snap"); } }, arrowright: () => { if (w) { w.snap("right"); achieve("snap"); } }, arrowup: () => w?.snap("max"), arrowdown: () => (w?.state === "max" || w?.snapped) ? w.restore() : w?.minimize(),
    }[k];
    if (act) { e.preventDefault(); e.stopPropagation(); act(); }
  }, true);
  addEventListener("keyup", e => { if (e.key === "Alt" && switcher) commitSwitch(); });
  addEventListener("blur", () => { if (switcher) commitSwitch(); });
}

function stepSwitch(dir) {
  if (!switcher) {
    switchList = [...wins.values()].sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
    if (!switchList.length) return;
    switchIdx = 0;
    switcher = document.getElementById("switcher"); switcher.innerHTML = ""; switcher.classList.remove("hidden");
    switchList.forEach((w, i) => switcher.append(el("div", { class: "sw-item", dataset: { i }, onclick: () => { switchIdx = i; commitSwitch(); } }, el("div", { class: "sw-ic", html: w.iconHtml }), el("div", { class: "sw-title", text: w.title }), el("small", { text: w.app.name }))));
  }
  switchIdx = (switchIdx + dir + switchList.length) % switchList.length;
  switcher.querySelectorAll(".sw-item").forEach((it, i) => it.classList.toggle("sel", i === switchIdx));
}
function commitSwitch() {
  if (!switcher) return;
  const w = switchList[switchIdx]; switcher.classList.add("hidden"); switcher = null;
  if (w && wins.has(w.id)) w.focus();
}
