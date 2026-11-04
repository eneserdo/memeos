// Small apps: Achievements, Run, About.
import { registerApp, launch, APPS, openFile } from "../core/apps.js";
import { ACHIEVEMENTS, unlocked } from "../core/eggs.js";
import { bus } from "../core/bus.js";
import { el, esc } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { fs } from "../core/fs.js";

registerApp({
  id: "achievements", name: "Achievements", desc: "What you have found so far", icon: "trophy", color: "linear-gradient(135deg,#fde047,#f59e0b)", w: 720, h: 560, minW: 420, minH: 300, single: true, keywords: ["easter", "eggs", "trophy", "secrets"],
  mount(win) {
    const root = el("div", { class: "ac" }); win.body.append(root);
    const render = () => {
      const n = ACHIEVEMENTS.filter(a => unlocked.has(a.id)).length;
      root.innerHTML = "";
      root.append(el("div", { class: "ac-head" }, el("div", {}, el("b", { text: `${n} of ${ACHIEVEMENTS.length} unlocked` }), el("small", { text: "Locked ones show a hint. No spoilers beyond that." })), el("div", { class: "ac-bar" }, el("span", { style: { width: n / ACHIEVEMENTS.length * 100 + "%" } }))));
      const grid = el("div", { class: "ac-grid" });
      for (const a of ACHIEVEMENTS) { const on = unlocked.has(a.id); grid.append(el("div", { class: "ac-item" + (on ? " on" : "") }, el("div", { class: "ac-img" }, el("img", { src: a.img, alt: "" }), on ? el("span", { class: "ac-check", html: icon("check") }) : el("span", { class: "ac-lock", html: icon("lock") })), el("div", { class: "ac-t" }, el("b", { text: on ? a.title : "???" }), el("span", { text: on ? a.desc : a.hint })))); }
      root.append(grid);
    };
    const off = bus.on("achievement", render); win.on("close", () => off()); render();
  },
});

registerApp({
  id: "run", name: "Run", desc: "Launch an app or open a path", icon: "play", color: "linear-gradient(135deg,#a3e635,#16a34a)", w: 420, h: 190, minW: 420, minH: 190, resizable: false, single: true, hidden: true,
  mount(win) {
    const inp = el("input", { class: "input", placeholder: "files, terminal, ~/Documents/todo.txt ...", autofocus: true, style: { width: "100%" } });
    const list = el("datalist", { id: "run-list" }, ...[...APPS.values()].filter(a => !a.hidden).map(a => el("option", { value: a.id })));
    inp.setAttribute("list", "run-list");
    const go = () => { const v = inp.value.trim(); if (!v) return; const [cmd, ...rest] = v.split(/\s+/); if (APPS.has(cmd)) { launch(cmd, rest[0] ? { path: rest[0].replace(/^~/, "/home/pepe"), url: rest[0] } : {}); win.close(); } else if (fs.resolve(v.replace(/^~/, "/home/pepe"))) { openFile(v.replace(/^~/, "/home/pepe")); win.close(); } else if (/^https?:\/\//.test(v)) { launch("surf", { url: v }); win.close(); } else { inp.classList.add("shake"); setTimeout(() => inp.classList.remove("shake"), 400); } };
    inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); if (e.key === "Escape") win.close(); });
    win.body.append(el("div", { class: "rn" }, el("p", { text: "Type the name of an app, a file path or a web address, and MemeOS will open it for you." }), inp, list, el("div", { class: "row" }, el("button", { class: "btn primary", text: "OK", onclick: go }), el("button", { class: "btn", text: "Cancel", onclick: () => win.close() }))));
    win.center(); setTimeout(() => inp.focus(), 50);
  },
});

registerApp({
  id: "about", name: "About MemeOS", desc: "Version and credits", icon: "info", color: "linear-gradient(135deg,#c084fc,#7c3aed)", w: 460, h: 380, minW: 460, minH: 380, resizable: false, single: true, hidden: true,
  mount(win) {
    win.body.append(el("div", { class: "ab" }, el("img", { src: "assets/logo.png", alt: "", width: 80, height: 80 }), el("h2", { text: "MemeOS" }), el("p", { class: "ab-v", text: "Version 1.0 (build wow)" }),
      el("p", { text: "A desktop operating system that runs in a single browser tab. Window manager, persistent file system, terminal, task manager, apps and easter eggs. No servers, no accounts, no telemetry." }),
      el("p", { html: `<a href="https://github.com/eneserdo/memeos" target="_blank" rel="noopener">github.com/eneserdo/memeos</a>` }),
      el("div", { class: "row" }, el("button", { class: "btn primary", text: "OK", onclick: () => win.close() }))));
    win.center();
  },
});
