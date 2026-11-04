// Surf: a browser inside the browser. Many sites refuse to be framed; the home page lists ones that do not.
import { registerApp } from "../core/apps.js";
import { fs } from "../core/fs.js";
import { el, esc } from "../core/ui.js";
import { icon } from "../core/icons.js";

const HOME = "memeos://home";
const LINKS = [["Wikipedia: Internet meme", "https://en.wikipedia.org/wiki/Internet_meme"], ["Wikipedia: Doge", "https://en.wikipedia.org/wiki/Doge_(meme)"], ["Wikipedia: Pepe the Frog", "https://en.wikipedia.org/wiki/Pepe_the_Frog"], ["Know Your Meme", "https://knowyourmeme.com/"], ["Imgflip", "https://imgflip.com/"], ["MDN Web Docs", "https://developer.mozilla.org/"], ["MemeOS on GitHub", "https://github.com/eneserdo/memeos"]];

registerApp({
  id: "surf", name: "Surf", desc: "A web browser, in a web browser", icon: "globe", color: "linear-gradient(135deg,#22d3ee,#3b82f6)", w: 960, h: 640, minW: 420, minH: 300, keywords: ["browser", "web", "internet"],
  mount(win, proc, args) {
    const st = { hist: [], i: -1 };
    const url = el("input", { class: "input sf-url", placeholder: "Type a web address", spellcheck: false });
    const frame = el("iframe", { class: "sf-frame", sandbox: "allow-scripts allow-same-origin allow-forms allow-popups", referrerpolicy: "no-referrer", title: "page" });
    const home = el("div", { class: "sf-home" });
    const b = (ic, title, fn) => el("button", { class: "btn ghost icon", title, html: icon(ic), onclick: fn });
    const back = b("arrowL", "Back", () => go(st.i - 1)), fwd = b("arrowR", "Forward", () => go(st.i + 1));
    const bar = el("div", { class: "sf-bar" }, back, fwd, b("refresh", "Reload", () => { if (st.i >= 0) nav(st.hist[st.i], false); }), b("home", "Home", () => nav(HOME)), url, b("external", "Open in a real tab", () => { if (st.i >= 0 && st.hist[st.i] !== HOME) window.open(st.hist[st.i], "_blank", "noopener"); }));
    const note = el("div", { class: "sf-note hidden" });
    win.body.append(el("div", { class: "sf" }, bar, note, el("div", { class: "sf-view" }, home, frame)));
    url.addEventListener("keydown", e => { if (e.key === "Enter") nav(url.value.trim()); if (e.key === "Escape") url.value = st.hist[st.i] || ""; });
    function renderHome() {
      home.innerHTML = "";
      home.append(el("div", { class: "sf-hero" }, el("img", { src: "assets/logo.png", alt: "", width: 56, height: 56 }), el("h1", { text: "Surf" }), el("p", { text: "Most big sites send X-Frame-Options and refuse to load inside another page. These do not (today)." })),
        el("div", { class: "sf-links" }, ...LINKS.map(([t, u]) => el("button", { class: "sf-link", onclick: () => nav(u) }, el("span", { html: icon("globe") }), el("b", { text: t }), el("small", { text: u.replace(/^https?:\/\//, "") })))),
        el("div", { class: "sf-local" }, el("h3", { text: "Local pages" }), ...["/system/release-notes.md", "/home/pepe/Documents/welcome.md"].map(p => el("button", { class: "sf-link", onclick: () => nav("memeos:/" + p) }, el("span", { html: icon("fileText") }), el("b", { text: p })))));
    }
    async function nav(u, push = true) {
      if (!u) return;
      if (u !== HOME && !u.startsWith("memeos:") && !/^https?:\/\//i.test(u)) u = /^[\w-]+(\.[\w-]+)+/.test(u) ? "https://" + u : "https://duckduckgo.com/html/?q=" + encodeURIComponent(u);
      if (push) { st.hist = st.hist.slice(0, st.i + 1); st.hist.push(u); st.i = st.hist.length - 1; }
      url.value = u === HOME ? "" : u; back.disabled = st.i <= 0; fwd.disabled = st.i >= st.hist.length - 1; note.classList.add("hidden");
      if (u === HOME) { frame.classList.add("hidden"); home.classList.remove("hidden"); frame.removeAttribute("src"); win.setTitle("Surf"); return; }
      if (u.startsWith("memeos:/")) { const p = u.slice("memeos:/".length); try { const t = await fs.readText(p); frame.classList.remove("hidden"); home.classList.add("hidden"); frame.srcdoc = `<!doctype html><meta charset=utf-8><style>body{font:15px/1.6 Inter,system-ui,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#222;background:#fff}pre{white-space:pre-wrap}</style><pre>${esc(t)}</pre>`; win.setTitle(`${p} - Surf`); } catch (e) { note.textContent = e.message; note.classList.remove("hidden"); } return; }
      frame.classList.remove("hidden"); home.classList.add("hidden"); frame.removeAttribute("srcdoc"); frame.src = u; win.setTitle(`${u.replace(/^https?:\/\//, "").split("/")[0]} - Surf`);
      note.innerHTML = `${icon("info")} If this stays blank, the site refuses to be embedded. Use the arrow button to open it in a real tab.`; note.classList.remove("hidden");
      setTimeout(() => note.classList.add("hidden"), 6000);
    }
    const go = i => { if (i < 0 || i >= st.hist.length) return; st.i = i; nav(st.hist[i], false); };
    renderHome(); nav(args.url || HOME);
  },
});
