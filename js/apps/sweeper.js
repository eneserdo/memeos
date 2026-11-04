// Doge Sweeper: Minesweeper with a dog. First click is always safe, best times are kept.
import { registerApp } from "../core/apps.js";
import { el, fmtDur } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { sound } from "../core/sound.js";
import { achieve } from "../core/eggs.js";

const LEVELS = { beginner: [9, 9, 10], intermediate: [16, 16, 40], expert: [30, 16, 99] };
const BEST_KEY = "memeos.sweeper.best";

registerApp({
  id: "sweeper", name: "Doge Sweeper", desc: "Minesweeper, but the mines are dogs", icon: "bomb", color: "linear-gradient(135deg,#fbbf24,#d97706)", w: 420, h: 520, minW: 300, minH: 360, keywords: ["minesweeper", "game", "doge"],
  mount(win, proc) {
    let level = localStorage.getItem("memeos.sweeper.level") || "beginner", best = JSON.parse(localStorage.getItem(BEST_KEY) || "{}");
    const st = { grid: [], w: 0, h: 0, mines: 0, started: false, over: false, flags: 0, t: 0, timer: null };
    const head = el("div", { class: "sw-head" });
    const board = el("div", { class: "sw-board" });
    const foot = el("div", { class: "sw-foot" });
    const face = el("button", { class: "sw-face", title: "New game", onclick: () => reset() }, el("img", { src: "assets/memes/doge.jpg", alt: "" }));
    const minesEl = el("span", { class: "sw-led" }), timeEl = el("span", { class: "sw-led" });
    const sel = el("select", { class: "input" }, ...Object.keys(LEVELS).map(k => el("option", { value: k, text: k[0].toUpperCase() + k.slice(1), selected: k === level })));
    sel.addEventListener("change", () => { level = sel.value; localStorage.setItem("memeos.sweeper.level", level); reset(); });
    head.append(minesEl, face, timeEl);
    win.body.append(el("div", { class: "sw" }, head, el("div", { class: "sw-wrap" }, board), foot));
    const idx = (x, y) => y * st.w + x;
    const around = (x, y) => { const r = []; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const nx = x + dx, ny = y + dy; if (nx >= 0 && ny >= 0 && nx < st.w && ny < st.h) r.push([nx, ny]); } return r; };
    function reset() {
      [st.w, st.h, st.mines] = LEVELS[level]; st.grid = Array.from({ length: st.w * st.h }, () => ({ m: false, o: false, f: false, n: 0 })); st.started = st.over = false; st.flags = 0; st.t = 0; clearInterval(st.timer);
      face.firstChild.src = "assets/memes/doge.jpg"; face.classList.remove("win", "lose");
      board.style.gridTemplateColumns = `repeat(${st.w}, 1fr)`; board.className = "sw-board " + level; board.innerHTML = "";
      for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) { const c = el("button", { class: "sw-c", dataset: { x, y } }); c.addEventListener("click", () => open(x, y)); c.addEventListener("contextmenu", e => { e.preventDefault(); flag(x, y); }); c.addEventListener("dblclick", () => chord(x, y)); c.addEventListener("auxclick", e => { if (e.button === 1) { e.preventDefault(); chord(x, y); } }); board.append(c); }
      win.setBounds({ w: Math.max(300, st.w * (level === "expert" ? 22 : 30) + 40), h: Math.max(360, st.h * (level === "expert" ? 22 : 30) + 170) }); win.center();
      paint(); status();
    }
    function place(sx, sy) {
      const safe = new Set([idx(sx, sy), ...around(sx, sy).map(([x, y]) => idx(x, y))]); let n = 0;
      while (n < st.mines) { const i = Math.floor(Math.random() * st.grid.length); if (st.grid[i].m || safe.has(i)) continue; st.grid[i].m = true; n++; }
      for (let y = 0; y < st.h; y++) for (let x = 0; x < st.w; x++) st.grid[idx(x, y)].n = around(x, y).filter(([a, b]) => st.grid[idx(a, b)].m).length;
      st.started = true; st.timer = proc.setInterval(() => { st.t++; status(); }, 1000);
    }
    function open(x, y) {
      if (st.over) return; const c = st.grid[idx(x, y)]; if (c.o || c.f) return;
      if (!st.started) place(x, y);
      c.o = true;
      if (c.m) { lose(x, y); return; }
      if (c.n === 0) { const stack = [[x, y]]; while (stack.length) { const [a, b] = stack.pop(); for (const [nx, ny] of around(a, b)) { const k = st.grid[idx(nx, ny)]; if (!k.o && !k.f && !k.m) { k.o = true; if (k.n === 0) stack.push([nx, ny]); } } } }
      sound.click(); paint(); check();
    }
    function flag(x, y) { if (st.over) return; const c = st.grid[idx(x, y)]; if (c.o) return; c.f = !c.f; st.flags += c.f ? 1 : -1; sound.flag(); paint(); status(); }
    function chord(x, y) { const c = st.grid[idx(x, y)]; if (!c.o || !c.n) return; const nb = around(x, y); if (nb.filter(([a, b]) => st.grid[idx(a, b)].f).length !== c.n) return; nb.forEach(([a, b]) => { if (!st.grid[idx(a, b)].f) open(a, b); }); }
    function lose(x, y) { st.over = true; clearInterval(st.timer); st.grid.forEach(c => { if (c.m) c.o = true; }); st.grid[idx(x, y)].hit = true; face.firstChild.src = "assets/memes/cheems.jpg"; face.classList.add("lose"); sound.boom(); paint(); foot.textContent = "Bonk. Click the dog to try again."; }
    function check() {
      if (st.grid.every(c => c.o || c.m)) { st.over = true; clearInterval(st.timer); st.grid.forEach(c => { if (c.m) c.f = true; }); st.flags = st.mines; face.firstChild.src = "assets/memes/dogecoin.jpg"; face.classList.add("win"); sound.win(); achieve("sweeper"); const b = best[level]; if (!b || st.t < b) { best[level] = st.t; localStorage.setItem(BEST_KEY, JSON.stringify(best)); foot.textContent = `New best time for ${level}: ${fmtDur(st.t)}`; } else foot.textContent = `Won in ${fmtDur(st.t)}. Best: ${fmtDur(b)}`; paint(); status(); }
    }
    function paint() {
      board.querySelectorAll(".sw-c").forEach(b => { const c = st.grid[idx(+b.dataset.x, +b.dataset.y)]; b.className = "sw-c" + (c.o ? " o" : "") + (c.f ? " f" : "") + (c.hit ? " hit" : "") + (c.o && c.n ? " n" + c.n : ""); b.innerHTML = c.o ? (c.m ? `<img src="assets/memes/doge.jpg" alt="">` : c.n ? c.n : "") : c.f ? icon("flag") : ""; });
    }
    function status() { minesEl.textContent = String(Math.max(0, st.mines - st.flags)).padStart(3, "0"); timeEl.textContent = String(Math.min(999, st.t)).padStart(3, "0"); if (!st.over) foot.innerHTML = ""; if (!st.over) { foot.append(el("span", { text: "Left click opens, right click flags, double click chords." }), el("span", { class: "grow" }), sel); } }
    reset();
  },
});
