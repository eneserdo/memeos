// Window manager: windows, processes, focus, drag, resize, snapping, minimize/maximize animations.
import { bus } from "./bus.js";
import { el, clamp } from "./ui.js";
import { icon, tile } from "./icons.js";
import { sound } from "./sound.js";
import { settings } from "./settings.js";

export const procs = new Map();   // pid -> Proc
export const wins = new Map();    // id -> Win
let nextPid = 100, nextWid = 1, zTop = 10, cascade = 0;

export class Proc {
  constructor(app, win) {
    this.pid = nextPid++; this.app = app; this.win = win; this.started = Date.now();
    this.cpuAcc = 0; this.cpu = 0; this.hist = new Array(60).fill(0); this.bytes = 0; this.events = 0; this.evAcc = 0;
    this.timers = new Set(); this.rafs = new Set(); this.status = "running"; this.system = !!app.system;
    procs.set(this.pid, this);
  }
  measure(fn, ...a) { const t = performance.now(); try { return fn(...a); } finally { this.cpuAcc += performance.now() - t; } }
  work(ms) { this.cpuAcc += ms; }
  setInterval(fn, ms) { const id = setInterval(() => this.measure(fn), ms); this.timers.add(id); return id; }
  setTimeout(fn, ms) { const id = setTimeout(() => { this.timers.delete(id); this.measure(fn); }, ms); this.timers.add(id); return id; }
  clear(id) { clearInterval(id); clearTimeout(id); this.timers.delete(id); }
  raf(loop) {   // loop(dt) called every frame until it returns false or the process dies
    let last = performance.now(), id;
    const step = now => { if (!procs.has(this.pid)) return; const r = this.measure(loop, now - last); last = now; if (r !== false) { id = requestAnimationFrame(step); this.rafs.add(id); } };
    id = requestAnimationFrame(step); this.rafs.add(id); return () => cancelAnimationFrame(id);
  }
  tick() {   // called once per second by the scheduler
    this.cpu = Math.min(100, this.cpuAcc / 10); this.cpuAcc = 0; this.hist.push(this.cpu); this.hist.shift();
    this.events = this.evAcc; this.evAcc = 0;
  }
  nodes() { return this.win ? this.win.el.querySelectorAll("*").length : 0; }
  memory() { return 1.2e6 + this.nodes() * 900 + this.bytes; }
  kill() { this.timers.forEach(id => { clearInterval(id); clearTimeout(id); }); this.rafs.forEach(id => cancelAnimationFrame(id)); procs.delete(this.pid); }
}

// shell pseudo-processes shown in the task manager
export const shellProc = new Proc({ id: "shell", name: "MemeOS Shell", icon: "monitor", system: true }, null);
export const wmProc = new Proc({ id: "wm", name: "Window Manager", icon: "square", system: true }, null);
setInterval(() => { for (const p of procs.values()) p.tick(); bus.emit("procs:tick"); }, 1000);

export const area = () => document.getElementById("windows").getBoundingClientRect();
export let minimizeTarget = () => null;      // set by the taskbar: win -> DOMRect of its button
export const setMinimizeTarget = fn => { minimizeTarget = fn; };

export class Win {
  constructor(app, opts = {}) {
    this.id = nextWid++; this.app = app; this.state = "normal"; this.prev = null; this.hooks = {};
    this.title = opts.title || app.name; this.iconHtml = opts.iconHtml || tile(app.icon, app.color, 18);
    this.resizable = opts.resizable ?? app.resizable ?? true;
    this.minW = opts.minW || app.minW || 320; this.minH = opts.minH || app.minH || 200;
    const a = area();
    let w = Math.min(opts.w || app.w || 760, a.width - 24), h = Math.min(opts.h || app.h || 520, a.height - 24);
    const c = (cascade++ % 8) * 28;
    let x = opts.x ?? clamp(Math.round((a.width - w) / 2 - 80 + c), 8, a.width - w - 8);
    let y = opts.y ?? clamp(Math.round((a.height - h) / 2 - 40 + c), 8, a.height - h - 8);
    if (opts.center) { x = Math.round((a.width - w) / 2); y = Math.round((a.height - h) / 2); }
    this.b = { x, y, w, h };
    this.proc = new Proc(app, this);
    this.render();
    wins.set(this.id, this);
    bus.emit("win:open", this);
    this.focus();
    sound.open();
  }
  render() {
    const ctl = (name, cls, title) => el("button", { class: `wc ${cls}`, title, html: icon(name), onpointerdown: e => e.stopPropagation(), onclick: e => { e.stopPropagation(); this[cls === "close" ? "close" : cls === "min" ? "minimize" : "toggleMax"](); } });
    this.titleEl = el("div", { class: "win-title" }, el("span", { class: "win-ic", html: this.iconHtml }), this.textEl = el("span", { class: "win-text", text: this.title }),
      el("div", { class: "win-ctl" }, ctl("minus", "min", "Minimize"), this.maxBtn = ctl("square", "max", "Maximize"), ctl("x", "close", "Close")));
    if (!this.resizable) this.maxBtn.classList.add("hidden");
    this.body = el("div", { class: "win-body" });
    this.el = el("div", { class: `win opening${this.app.dark ? " win-dark" : ""}${this.app.noTitle ? " win-notitle" : ""}`, dataset: { id: this.id, app: this.app.id }, role: "dialog", "aria-label": this.title }, this.titleEl, this.body,
      ...(this.resizable ? ["n", "s", "e", "w", "ne", "nw", "se", "sw"].map(d => el("div", { class: `rz ${d}`, dataset: { d } })) : []));
    this.applyBounds();
    document.getElementById("windows").append(this.el);
    setTimeout(() => this.el.classList.remove("opening"), 220);
    // focus on any pointer interaction
    this.el.addEventListener("pointerdown", () => this.focus(), true);
    // event accounting for the task manager: time between capture and bubble on the window root
    let t0 = 0; const evs = ["click", "pointerdown", "pointermove", "keydown", "input", "wheel", "dblclick"];
    evs.forEach(ev => { this.el.addEventListener(ev, () => { t0 = performance.now(); }, true); this.el.addEventListener(ev, () => { this.proc.cpuAcc += performance.now() - t0; this.proc.evAcc++; }); });
    // titlebar drag + double click
    this.titleEl.addEventListener("pointerdown", e => { if (e.button === 0) this.dragStart(e); });
    this.titleEl.addEventListener("dblclick", e => { if (!e.target.closest(".wc") && this.resizable) this.toggleMax(); });
    this.titleEl.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); bus.emit("win:menu", this, e.clientX, e.clientY); });
    this.el.querySelectorAll(".rz").forEach(h => h.addEventListener("pointerdown", e => this.resizeStart(e, h.dataset.d)));
  }
  applyBounds() { const { x, y, w, h } = this.b; Object.assign(this.el.style, { left: x + "px", top: y + "px", width: w + "px", height: h + "px" }); }
  setTitle(t) { this.title = t; this.textEl.textContent = t; this.el.setAttribute("aria-label", t); bus.emit("win:title", this); }
  setIcon(html) { this.iconHtml = html; this.el.querySelector(".win-ic").innerHTML = html; bus.emit("win:title", this); }
  on(ev, fn) { this.hooks[ev] = fn; return this; }
  get focused() { return this.el.classList.contains("active"); }
  focus() {
    if (this.state === "min") { this.restoreFromMin(); return; }
    if (this.focused && this.el.style.zIndex == zTop) return;
    for (const w of wins.values()) w.el.classList.remove("active");
    this.el.classList.add("active"); this.el.style.zIndex = ++zTop;
    bus.emit("win:focus", this); this.hooks.focus?.();
    if (!this.el.contains(document.activeElement)) { const f = this.body.querySelector("[autofocus], input, textarea, [tabindex]"); (f || this.body).focus?.({ preventScroll: true }); }
  }
  async close(force = false) {
    if (!force && this.hooks.close) { const r = await this.hooks.close(); if (r === false) return false; }
    this.el.classList.add("closing"); sound.close();
    wins.delete(this.id); this.proc.kill();
    setTimeout(() => this.el.remove(), 180);
    bus.emit("win:close", this);
    const next = [...wins.values()].filter(w => w.state !== "min").sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
    next?.focus();
    return true;
  }
  minimize() {
    if (this.state === "min") return;
    this.prevState = this.state; this.state = "min";
    const r = minimizeTarget(this), a = area(), b = this.el.getBoundingClientRect();
    if (r && settings.get("animations")) {
      const dx = r.left + r.width / 2 - (b.left + b.width / 2), dy = r.top + r.height / 2 - (b.top + b.height / 2);
      this.el.style.transition = "transform .22s cubic-bezier(.4,0,1,1), opacity .2s"; this.el.style.transformOrigin = "center";
      this.el.style.transform = `translate(${dx}px, ${dy}px) scale(.08)`; this.el.style.opacity = "0";
      setTimeout(() => { this.el.classList.add("minimized"); this.el.style.transition = ""; }, 220);
    } else this.el.classList.add("minimized");
    this.el.classList.remove("active"); bus.emit("win:minimize", this);
    const next = [...wins.values()].filter(w => w.state !== "min" && w !== this).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
    next?.focus();
  }
  restoreFromMin() {
    this.state = this.prevState || "normal"; this.el.classList.remove("minimized");
    requestAnimationFrame(() => { this.el.style.transition = "transform .22s cubic-bezier(.2,.8,.2,1), opacity .2s"; this.el.style.transform = ""; this.el.style.opacity = ""; setTimeout(() => { this.el.style.transition = ""; }, 230); });
    bus.emit("win:restore", this); this.focus();
  }
  maximize() {
    if (!this.resizable || this.state === "max") return;
    if (this.state !== "max") this.prev = { ...this.b };
    this.state = "max"; const a = area(); this.b = { x: 0, y: 0, w: a.width, h: a.height };
    this.el.classList.add("maximized", "anim-bounds"); this.applyBounds(); this.maxBtn.innerHTML = icon("restore"); this.maxBtn.title = "Restore";
    setTimeout(() => this.el.classList.remove("anim-bounds"), 220); this.hooks.resize?.(); bus.emit("win:bounds", this);
  }
  restore() {
    if (this.state === "min") return this.restoreFromMin();
    if (this.state !== "max" && !this.snapped) return;
    this.state = "normal"; this.snapped = null; if (this.prev) this.b = { ...this.prev };
    this.el.classList.remove("maximized"); this.el.classList.add("anim-bounds"); this.applyBounds(); this.maxBtn.innerHTML = icon("square"); this.maxBtn.title = "Maximize";
    setTimeout(() => this.el.classList.remove("anim-bounds"), 220); this.hooks.resize?.(); bus.emit("win:bounds", this);
  }
  toggleMax() { this.state === "max" ? this.restore() : this.maximize(); }
  snap(side) {
    if (!this.resizable) return;
    if (side === "max") return this.maximize();
    if (this.state === "max") { this.el.classList.remove("maximized"); this.state = "normal"; this.maxBtn.innerHTML = icon("square"); }
    if (!this.snapped) this.prev = { ...this.b };
    const a = area(), half = Math.round(a.width / 2);
    this.b = side === "left" ? { x: 0, y: 0, w: half, h: a.height } : side === "right" ? { x: half, y: 0, w: a.width - half, h: a.height }
      : side === "top" ? { x: this.b.x, y: 0, w: this.b.w, h: Math.round(a.height / 2) } : { x: this.b.x, y: Math.round(a.height / 2), w: this.b.w, h: a.height - Math.round(a.height / 2) };
    this.snapped = side; this.el.classList.add("anim-bounds"); this.applyBounds(); setTimeout(() => this.el.classList.remove("anim-bounds"), 220);
    this.hooks.resize?.(); bus.emit("win:bounds", this);
  }
  setBounds(b) { Object.assign(this.b, b); this.applyBounds(); this.hooks.resize?.(); bus.emit("win:bounds", this); }
  center() { const a = area(); this.setBounds({ x: Math.round((a.width - this.b.w) / 2), y: Math.round((a.height - this.b.h) / 2) }); }

  dragStart(e) {
    if (e.target.closest(".wc")) return;
    e.preventDefault(); this.focus();
    const a = area(), start = { x: e.clientX, y: e.clientY }, preview = document.getElementById("snap-preview");
    let b = { ...this.b }, moved = false, zone = null, wasMax = this.state === "max" || this.snapped;
    const move = ev => {
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!moved && Math.hypot(dx, dy) < 4) return;
      if (!moved) { moved = true; this.el.classList.add("dragging"); document.body.classList.add("no-select"); this.titleEl.setPointerCapture(e.pointerId); }
      if (wasMax) {   // un-maximize under the cursor, keeping the relative grab point
        const p = this.prev || { w: 760, h: 520 }; const fx = (ev.clientX - a.left) / this.b.w;
        this.state = "normal"; this.snapped = null; this.el.classList.remove("maximized"); this.maxBtn.innerHTML = icon("square");
        b = { x: Math.round(ev.clientX - a.left - p.w * fx), y: Math.round(ev.clientY - a.top - 19), w: p.w, h: p.h }; start.x = ev.clientX; start.y = ev.clientY; wasMax = false; this.b = { ...b }; this.applyBounds(); return;
      }
      const nx = clamp(b.x + dx, -b.w + 120, a.width - 120), ny = clamp(b.y + dy, 0, a.height - 36);
      this.b.x = nx; this.b.y = ny; this.applyBounds();
      const px = ev.clientX - a.left, py = ev.clientY - a.top;
      const z = !this.resizable ? null : px <= 6 ? "left" : px >= a.width - 7 ? "right" : py <= 4 ? "max" : null;
      if (z !== zone) {
        zone = z; preview.classList.toggle("hidden", !z);
        if (z) { const half = Math.round(a.width / 2); Object.assign(preview.style, z === "left" ? { left: 0, top: 0, width: half + "px", height: a.height + "px" } : z === "right" ? { left: half + "px", top: 0, width: a.width - half + "px", height: a.height + "px" } : { left: 0, top: 0, width: a.width + "px", height: a.height + "px" }); }
      }
    };
    const up = () => {
      this.titleEl.removeEventListener("pointermove", move); this.titleEl.removeEventListener("pointerup", up); this.titleEl.removeEventListener("pointercancel", up);
      this.el.classList.remove("dragging"); document.body.classList.remove("no-select"); preview.classList.add("hidden");
      if (zone) this.snap(zone); else if (moved) { this.hooks.move?.(); bus.emit("win:bounds", this); }
    };
    this.titleEl.addEventListener("pointermove", move); this.titleEl.addEventListener("pointerup", up); this.titleEl.addEventListener("pointercancel", up);
  }
  resizeStart(e, d) {
    e.preventDefault(); e.stopPropagation(); this.focus();
    if (this.state === "max") return;
    const h = e.currentTarget, a = area(), s = { x: e.clientX, y: e.clientY }, b = { ...this.b };
    h.setPointerCapture(e.pointerId); document.body.classList.add("no-select"); document.body.style.cursor = getComputedStyle(h).cursor;
    const move = ev => {
      const dx = ev.clientX - s.x, dy = ev.clientY - s.y, n = { ...b };
      if (d.includes("e")) n.w = clamp(b.w + dx, this.minW, a.width - b.x);
      if (d.includes("s")) n.h = clamp(b.h + dy, this.minH, a.height - b.y);
      if (d.includes("w")) { const w = clamp(b.w - dx, this.minW, b.x + b.w); n.x = b.x + b.w - w; n.w = w; }
      if (d.includes("n")) { const hh = clamp(b.h - dy, this.minH, b.y + b.h); n.y = b.y + b.h - hh; n.h = hh; }
      this.b = n; this.snapped = null; this.applyBounds(); this.hooks.resize?.();
    };
    const up = () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); document.body.classList.remove("no-select"); document.body.style.cursor = ""; bus.emit("win:bounds", this); };
    h.addEventListener("pointermove", move); h.addEventListener("pointerup", up);
  }
}

export const activeWin = () => [...wins.values()].find(w => w.focused) || null;
export const visibleWins = () => [...wins.values()].filter(w => w.state !== "min");
export function cycleWindows(dir = 1) {
  const list = [...wins.values()].sort((a, b) => b.el.style.zIndex - a.el.style.zIndex);
  if (list.length < 2) { list[0]?.focus(); return; }
  (dir > 0 ? list[list.length - 1] : list[1]).focus();
}
let desktopShown = false, shownSet = [];
export function toggleDesktop() {
  if (!desktopShown) { shownSet = visibleWins(); shownSet.forEach(w => w.minimize()); desktopShown = shownSet.length > 0; }
  else { shownSet.forEach(w => w.state === "min" && w.restoreFromMin()); desktopShown = false; }
}
// keep windows inside the area when the viewport changes
addEventListener("resize", () => { const a = area(); for (const w of wins.values()) { if (w.state === "max" || w.snapped) w.snap(w.snapped || "max"); else w.setBounds({ x: clamp(w.b.x, -w.b.w + 120, a.width - 120), y: clamp(w.b.y, 0, Math.max(0, a.height - 36)), w: Math.min(w.b.w, a.width), h: Math.min(w.b.h, a.height) }); } });
