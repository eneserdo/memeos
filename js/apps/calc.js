// Calculator: a real one, with keyboard input, history and the number everyone types.
import { registerApp } from "../core/apps.js";
import { el } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { achieve } from "../core/eggs.js";

registerApp({
  id: "calc", name: "Calculator", desc: "Numbers go in, numbers come out", icon: "calc", color: "linear-gradient(135deg,#6b7280,#1f2937)", w: 340, h: 520, minW: 300, minH: 440, keywords: ["math", "calculator"],
  mount(win, proc) {
    const st = { expr: "", display: "0", hist: [], fresh: true };
    const disp = el("div", { class: "ca-disp" }, el("div", { class: "ca-expr" }), el("div", { class: "ca-val", text: "0" }));
    const hist = el("div", { class: "ca-hist" });
    const keys = [["C", "⌫", "%", "/"], ["7", "8", "9", "*"], ["4", "5", "6", "-"], ["1", "2", "3", "+"], ["±", "0", ".", "="]];
    const pad = el("div", { class: "ca-pad" }, ...keys.flat().map(k => el("button", { class: "ca-k" + ("/*-+=".includes(k) ? " op" : "") + (k === "=" ? " eq" : ""), text: k, onclick: () => press(k) })));
    win.body.append(el("div", { class: "ca" }, disp, pad, hist));
    const show = () => { disp.querySelector(".ca-expr").textContent = st.expr; disp.querySelector(".ca-val").textContent = st.display; disp.querySelector(".ca-val").style.fontSize = st.display.length > 12 ? "22px" : st.display.length > 9 ? "28px" : "36px"; };
    const evaluate = () => {
      const src = (st.expr + st.display).replace(/×/g, "*").replace(/÷/g, "/").replace(/(\d+(?:\.\d+)?)%/g, "($1/100)");
      if (!/^[\d.+\-*/() ]+$/.test(src)) throw new Error("bad");
      const v = Function(`"use strict";return (${src})`)(); if (!Number.isFinite(v)) throw new Error("div0");
      return +v.toPrecision(12);
    };
    function press(k) {
      if (k === "C") { st.expr = ""; st.display = "0"; st.fresh = true; }
      else if (k === "⌫") { st.display = st.display.length > 1 ? st.display.slice(0, -1) : "0"; }
      else if (k === "±") { st.display = st.display.startsWith("-") ? st.display.slice(1) : st.display === "0" ? "0" : "-" + st.display; }
      else if ("+-*/".includes(k)) { if (/[+\-*/]\s$/.test(st.expr) && st.fresh) st.expr = st.expr.slice(0, -2) + k + " "; else { st.expr += st.display + " " + k + " "; } st.fresh = true; st.display = "0"; }
      else if (k === "%") { st.display = String(+st.display / 100); }
      else if (k === "=") { try { const e = st.expr + st.display; const v = evaluate(); st.hist.unshift(`${e} = ${v}`); st.hist = st.hist.slice(0, 20); hist.innerHTML = ""; st.hist.forEach(h => hist.append(el("div", { text: h, onclick: () => { st.display = h.split(" = ")[1]; st.expr = ""; st.fresh = true; show(); } }))); st.expr = ""; st.display = String(v); st.fresh = true; } catch { st.display = "Error"; st.expr = ""; st.fresh = true; } }
      else { if (st.fresh || st.display === "0" || st.display === "Error") { st.display = k === "." ? "0." : k; st.fresh = false; } else if (!(k === "." && st.display.includes("."))) st.display += k; }
      if (st.display === "80085" || st.display === "5318008") achieve("calc");
      show();
    }
    win.body.tabIndex = 0;
    win.body.addEventListener("keydown", e => { const m = { Enter: "=", "=": "=", Backspace: "⌫", Escape: "C", Delete: "C" }; const k = m[e.key] || ("0123456789.+-*/%".includes(e.key) ? e.key : null); if (k) { e.preventDefault(); press(k); pad.querySelectorAll(".ca-k").forEach(b => { if (b.textContent === k) { b.classList.add("hit"); setTimeout(() => b.classList.remove("hit"), 120); } }); } });
    show(); setTimeout(() => win.body.focus(), 50);
  },
});
