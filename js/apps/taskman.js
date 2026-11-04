// Task Manager: processes with measured handler time, end task, live performance graphs.
import { registerApp } from "../core/apps.js";
import { procs, wins } from "../core/wm.js";
import { bus } from "../core/bus.js";
import { el, esc, fmtDur, confirm } from "../core/ui.js";
import { icon, tile } from "../core/icons.js";
import { fmtSize, fs } from "../core/fs.js";
import { achieve } from "../core/eggs.js";

// system-wide samplers (frame rate, heap) running once, shared by all task manager windows
const perf = { fps: 0, frames: 0, heap: 0, fpsHist: new Array(60).fill(0), heapHist: new Array(60).fill(0), cpuHist: new Array(60).fill(0), longTasks: 0 };
let sampling = false;
function startSampling() {
  if (sampling) return; sampling = true;
  const f = () => { perf.frames++; requestAnimationFrame(f); }; requestAnimationFrame(f);
  setInterval(() => { perf.fps = perf.frames; perf.frames = 0; perf.fpsHist.push(perf.fps); perf.fpsHist.shift(); perf.heap = performance.memory ? performance.memory.usedJSHeapSize : 0; perf.heapHist.push(perf.heap); perf.heapHist.shift(); const cpu = Math.min(100, [...procs.values()].reduce((s, p) => s + p.cpu, 0)); perf.cpuHist.push(cpu); perf.cpuHist.shift(); }, 1000);
  try { new PerformanceObserver(l => { perf.longTasks += l.getEntries().length; }).observe({ entryTypes: ["longtask"] }); } catch { }
}

function graph(canvas, data, max, color, fill = true) {
  const c = canvas.getContext("2d"), w = canvas.width = canvas.clientWidth * devicePixelRatio, h = canvas.height = canvas.clientHeight * devicePixelRatio;
  c.clearRect(0, 0, w, h); c.strokeStyle = "rgba(128,128,128,.25)"; c.lineWidth = 1;
  for (let i = 1; i < 4; i++) { c.beginPath(); c.moveTo(0, h * i / 4); c.lineTo(w, h * i / 4); c.stroke(); }
  c.beginPath(); data.forEach((v, i) => { const x = i / (data.length - 1) * w, y = h - Math.min(1, v / (max || 1)) * (h - 4) - 2; i ? c.lineTo(x, y) : c.moveTo(x, y); });
  c.strokeStyle = color; c.lineWidth = 2 * devicePixelRatio; c.stroke();
  if (fill) { c.lineTo(w, h); c.lineTo(0, h); c.closePath(); c.fillStyle = color.replace(")", ",.15)").replace("rgb(", "rgba(").replace("hsl(", "hsla("); c.fill(); }
}

registerApp({
  id: "taskman", name: "Task Manager", desc: "Processes and performance", icon: "activity", color: "linear-gradient(135deg,#34d399,#0ea5e9)", w: 780, h: 520, minW: 460, minH: 300, single: true, keywords: ["process", "cpu", "memory", "kill", "performance"],
  mount(win, proc) {
    startSampling();
    const st = { tab: "processes", sort: "cpu", dir: -1, sel: null };
    const tabs = el("div", { class: "tk-tabs" }, ...[["processes", "Processes", "list"], ["performance", "Performance", "activity"], ["details", "Details", "cpu"]].map(([id, l, ic]) => el("button", { class: "tk-tab" + (st.tab === id ? " on" : ""), dataset: { id }, html: icon(ic) + " " + l, onclick: () => { st.tab = id; tabs.querySelectorAll(".tk-tab").forEach(t => t.classList.toggle("on", t.dataset.id === id)); render(); } })));
    const body = el("div", { class: "tk-body" });
    const foot = el("div", { class: "tk-foot" });
    const endBtn = el("button", { class: "btn danger sm", text: "End task", disabled: true, onclick: endTask });
    foot.append(el("span", { class: "tk-sum" }), el("span", { class: "grow" }), endBtn);
    win.body.append(el("div", { class: "tk" }, tabs, body, foot));

    async function endTask() {
      const p = procs.get(st.sel); if (!p) return;
      if (p.system) return confirm("Cannot end this process", `${p.app.name} is part of MemeOS. Ending it would end you.`, { ok: "Understood" });
      if (p.win && await p.win.close() !== false) { achieve("taskkill"); st.sel = null; render(); }
    }
    const rows = () => [...procs.values()].sort((a, b) => { const k = st.sort; const va = k === "name" ? a.app.name : k === "cpu" ? a.cpu : k === "mem" ? a.memory() : k === "pid" ? a.pid : a.started, vb = k === "name" ? b.app.name : k === "cpu" ? b.cpu : k === "mem" ? b.memory() : k === "pid" ? b.pid : b.started; return (va < vb ? -1 : va > vb ? 1 : 0) * st.dir; });
    function render() {
      body.innerHTML = "";
      const total = [...procs.values()].reduce((s, p) => s + p.cpu, 0), mem = [...procs.values()].reduce((s, p) => s + p.memory(), 0);
      foot.querySelector(".tk-sum").textContent = `${procs.size} processes · ${perf.fps} fps · handler time ${Math.min(100, total).toFixed(0)}%` + (perf.heap ? ` · JS heap ${fmtSize(perf.heap)}` : "");
      endBtn.disabled = !st.sel || !procs.has(st.sel);
      if (st.tab === "processes") {
        const hd = (k, l, cls = "") => el("span", { class: `tk-c ${cls}` + (st.sort === k ? " on" : ""), html: esc(l) + (st.sort === k ? icon(st.dir > 0 ? "chevronU" : "chevronD") : ""), onclick: () => { if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = k === "name" ? 1 : -1; } render(); } });
        const t = el("div", { class: "tk-table" }, el("div", { class: "tk-head" }, hd("name", "Name", "name"), hd("cpu", `${Math.min(100, total).toFixed(0)}% CPU`, "num"), hd("mem", `${fmtSize(mem)} Memory`, "num"), hd("started", "Uptime", "num")));
        for (const p of rows()) {
          const r = el("div", { class: "tk-row" + (st.sel === p.pid ? " sel" : "") + (p.system ? " sys" : ""), onclick: () => { st.sel = p.pid; render(); }, ondblclick: () => p.win?.focus() },
            el("span", { class: "tk-c name" }, el("span", { class: "tk-ic", html: p.win ? p.win.iconHtml : tile(p.app.icon, "var(--surface-3)", 18) }), el("span", { class: "tk-n" }, el("b", { text: p.app.name }), p.win && p.win.title !== p.app.name ? el("small", { text: p.win.title }) : null)),
            el("span", { class: "tk-c num heat", style: { "--heat": Math.min(1, p.cpu / 40) }, text: p.cpu.toFixed(1) + "%" }), el("span", { class: "tk-c num heat", style: { "--heat": Math.min(1, p.memory() / 2e7) }, text: fmtSize(p.memory()) }), el("span", { class: "tk-c num", text: fmtDur((Date.now() - p.started) / 1000) }));
          r.addEventListener("contextmenu", e => { e.preventDefault(); st.sel = p.pid; render(); import("../core/ui.js").then(m => m.contextMenu(e.clientX, e.clientY, [{ label: "Switch to", icon: "square", disabled: !p.win, action: () => p.win.focus() }, { label: "End task", icon: "x", danger: true, disabled: p.system, action: endTask }, { sep: true }, { label: "Details", icon: "info", action: () => { st.tab = "details"; tabs.querySelectorAll(".tk-tab").forEach(t => t.classList.toggle("on", t.dataset.id === "details")); render(); } }])); });
          t.append(r);
        }
        body.append(t);
      } else if (st.tab === "performance") {
        const card = (title, value, sub, cls) => { const c = el("canvas", { class: "tk-graph" }); const d = el("div", { class: `tk-card ${cls}` }, el("div", { class: "tk-ct" }, el("b", { text: title }), el("span", { text: value })), c, el("small", { text: sub })); return [d, c]; };
        const [c1, g1] = card("Handler time", `${Math.min(100, total).toFixed(0)}%`, "Sum of time all windows spent in event handlers, timers and frames per second. Measured, not simulated.", "cpu");
        const [c2, g2] = card("Frame rate", `${perf.fps} fps`, "requestAnimationFrame calls per second for this tab.", "fps");
        const [c3, g3] = card("JS heap", perf.heap ? fmtSize(perf.heap) : "n/a", perf.heap ? `of ${fmtSize(performance.memory.jsHeapSizeLimit)} limit (Chromium only)` : "performance.memory is only exposed by Chromium browsers.", "heap");
        const est = fs.usage();
        const [c4, g4] = card("Storage", fmtSize(est), `${fs.nodes.size} inodes in IndexedDB · ${wins.size} windows · ${perf.longTasks} long tasks since boot`, "disk");
        body.append(el("div", { class: "tk-cards" }, c1, c2, c3, c4));
        requestAnimationFrame(() => { graph(g1, perf.cpuHist, 100, "rgb(52,211,153)"); graph(g2, perf.fpsHist, 120, "rgb(14,165,233)"); graph(g3, perf.heapHist, Math.max(...perf.heapHist, 1), "rgb(139,92,246)"); graph(g4, [...procs.values()].slice(0, 60).map(p => p.memory()), Math.max(...[...procs.values()].map(p => p.memory()), 1), "rgb(245,165,36)", false); });
        if (navigator.storage?.estimate) navigator.storage.estimate().then(e => { c4.querySelector("small").textContent += ` · browser quota ${fmtSize(e.quota || 0)}, used ${fmtSize(e.usage || 0)}`; });
      } else {
        const t = el("div", { class: "tk-table details" }, el("div", { class: "tk-head" }, el("span", { class: "tk-c num", text: "PID" }), el("span", { class: "tk-c name", text: "Name" }), el("span", { class: "tk-c", text: "Status" }), el("span", { class: "tk-c num", text: "DOM nodes" }), el("span", { class: "tk-c num", text: "Events/s" }), el("span", { class: "tk-c num", text: "Timers" }), el("span", { class: "tk-c num", text: "Started" })));
        for (const p of rows()) t.append(el("div", { class: "tk-row" + (st.sel === p.pid ? " sel" : ""), onclick: () => { st.sel = p.pid; render(); } }, el("span", { class: "tk-c num", text: p.pid }), el("span", { class: "tk-c name", text: p.app.id }), el("span", { class: "tk-c", text: p.win ? (p.win.state === "min" ? "Suspended" : "Running") : "System" }), el("span", { class: "tk-c num", text: p.nodes() }), el("span", { class: "tk-c num", text: p.events }), el("span", { class: "tk-c num", text: p.timers.size + p.rafs.size }), el("span", { class: "tk-c num", text: new Date(p.started).toLocaleTimeString() })));
        body.append(t);
      }
    }
    const off = [bus.on("procs:tick", () => proc.measure(render)), bus.on("win:open", render), bus.on("win:close", render)];
    win.on("close", () => off.forEach(f => f())); win.on("resize", () => { if (st.tab === "performance") render(); });
    render();
  },
});
