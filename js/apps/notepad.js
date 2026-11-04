// Notepad: plain text editor over the virtual file system, with a Markdown preview.
import { registerApp } from "../core/apps.js";
import { fs, basename, isText } from "../core/fs.js";
import { el, confirm, errorBox, filePicker, toast, esc, downloadBlob } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { achieve } from "../core/eggs.js";
import { bus } from "../core/bus.js";

function md(src) {   // small Markdown renderer: headings, lists, code, bold/italic, links, quotes
  const inline = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>").replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>").replace(/\*([^*]+)\*/g, "<i>$1</i>").replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
  const lines = src.split("\n"); let out = "", list = null, code = false;
  const closeList = () => { if (list) { out += `</${list}>`; list = null; } };
  for (const l of lines) {
    if (l.startsWith("```")) { closeList(); code = !code; out += code ? "<pre>" : "</pre>"; continue; }
    if (code) { out += esc(l) + "\n"; continue; }
    const h = /^(#{1,4})\s+(.*)/.exec(l); if (h) { closeList(); out += `<h${h[1].length}>${inline(h[2])}</h${h[1].length}>`; continue; }
    const ul = /^\s*[-*]\s+(.*)/.exec(l), ol = /^\s*\d+[.)]\s+(.*)/.exec(l);
    if (ul || ol) { const t = ul ? "ul" : "ol"; if (list !== t) { closeList(); out += `<${t}>`; list = t; } const txt = (ul || ol)[1]; out += `<li>${/^\[x\]/i.test(txt) ? "<input type=checkbox checked disabled> " + inline(txt.slice(3)) : /^\[ \]/.test(txt) ? "<input type=checkbox disabled> " + inline(txt.slice(3)) : inline(txt)}</li>`; continue; }
    closeList();
    if (/^>\s?/.test(l)) { out += `<blockquote>${inline(l.replace(/^>\s?/, ""))}</blockquote>`; continue; }
    if (/^-{3,}$/.test(l.trim())) { out += "<hr>"; continue; }
    if (l.trim()) out += `<p>${inline(l)}</p>`;
  }
  closeList(); return out;
}

registerApp({
  id: "notepad", name: "Notepad", desc: "Write text and Markdown", icon: "edit", color: "linear-gradient(135deg,#5ec8ff,#2f7cf6)", w: 720, h: 520, minW: 380, minH: 240, keywords: ["text", "editor", "markdown", "note"],
  mount(win, proc, args) {
    const st = { path: args.path || null, dirty: false, preview: false, wrap: true, mono: false, size: 14 };
    const ta = el("textarea", { class: "np-text", spellcheck: false, placeholder: "Type something. Ctrl+S saves it into the file system." });
    const prev = el("div", { class: "np-preview hidden" });
    const status = el("div", { class: "np-status" });
    const tb = el("div", { class: "np-bar" });
    const btn = (ic, label, fn, title) => el("button", { class: "btn ghost sm", html: icon(ic) + (label ? " " + label : ""), title, onclick: fn });
    const previewBtn = btn("eye", "Preview", () => togglePreview(), "Markdown preview (Ctrl+P)");
    tb.append(btn("file", "New", () => newFile(), "New (Ctrl+N)"), btn("folderOpen", "Open", () => open(), "Open (Ctrl+O)"), btn("save", "Save", () => save(), "Save (Ctrl+S)"), btn("download", "", () => downloadBlob(new Blob([ta.value], { type: "text/plain" }), st.path ? basename(st.path) : "untitled.txt"), "Download to your computer"),
      el("span", { class: "grow" }), previewBtn,
      btn("type", "", () => { st.mono = !st.mono; ta.classList.toggle("mono", st.mono); }, "Toggle monospace"),
      btn("zoomOut", "", () => zoom(-1), "Smaller"), btn("zoomIn", "", () => zoom(1), "Larger"));
    win.body.append(el("div", { class: "np" }, tb, el("div", { class: "np-main" }, ta, prev), status));
    const zoom = d => { st.size = Math.max(10, Math.min(32, st.size + d)); ta.style.fontSize = prev.style.fontSize = st.size + "px"; };
    const title = () => win.setTitle(`${st.dirty ? "* " : ""}${st.path ? basename(st.path) : "Untitled"} - Notepad`);
    const stat = () => { const v = ta.value, words = v.trim() ? v.trim().split(/\s+/).length : 0, pos = v.slice(0, ta.selectionStart), ln = pos.split("\n").length, col = pos.length - pos.lastIndexOf("\n"); status.innerHTML = `<span>Ln ${ln}, Col ${col}</span><span>${v.length} chars, ${words} words</span><span class="grow"></span><span>${st.path ? esc(st.path.replace("/home/pepe", "~")) : "not saved"}</span><span>${(/\r\n/.test(v) ? "CRLF" : "LF")}  UTF-8</span>`; };
    ta.addEventListener("input", () => { if (!st.dirty) { st.dirty = true; title(); } stat(); if (st.preview) prev.innerHTML = md(ta.value); });
    ["keyup", "click"].forEach(ev => ta.addEventListener(ev, stat));
    ta.addEventListener("keydown", e => {
      if (e.ctrlKey && e.key === "s") { e.preventDefault(); save(); }
      else if (e.ctrlKey && e.key === "o") { e.preventDefault(); open(); }
      else if (e.ctrlKey && e.key === "n") { e.preventDefault(); newFile(); }
      else if (e.ctrlKey && e.key === "p") { e.preventDefault(); togglePreview(); }
      else if (e.key === "Tab") { e.preventDefault(); const s = ta.selectionStart; ta.setRangeText("  ", s, ta.selectionEnd, "end"); ta.dispatchEvent(new Event("input")); }
    });
    function togglePreview() { st.preview = !st.preview; prev.classList.toggle("hidden", !st.preview); prev.innerHTML = md(ta.value); previewBtn.classList.toggle("on", st.preview); }
    async function load(path) {
      try { const n = fs.stat(path); if (n.type === "dir") throw new Error("That is a folder."); if (!isText(n) && n.size > 200000) throw new Error("This file is binary and large. Notepad only shows text."); ta.value = await fs.readText(path); st.path = path; st.dirty = false; proc.bytes = n.size || 0; title(); stat(); if (path.endsWith(".md") && !st.preview) togglePreview(); else if (st.preview) prev.innerHTML = md(ta.value); if (path.endsWith("do not open.txt")) achieve("secret"); }
      catch (e) { errorBox("Cannot open file", e); }
    }
    async function save(as = false) {
      let p = st.path;
      if (!p || as) { p = await filePicker({ mode: "save", start: st.path ? st.path.replace(/\/[^/]*$/, "") : "~/Documents", name: st.path ? basename(st.path) : "untitled.txt", title: "Save as" }); if (!p) return false; }
      try { await fs.writeFile(p, ta.value); st.path = p; st.dirty = false; title(); stat(); bus.emit("file:open", p); return true; } catch (e) { errorBox("Cannot save", e); return false; }
    }
    async function askDiscard() { if (!st.dirty) return true; const r = await import("../core/ui.js").then(m => m.dialog({ title: "Save changes?", message: `Do you want to save changes to ${st.path ? basename(st.path) : "Untitled"}?`, icon: "alert", buttons: [{ label: "Don't save", value: "no" }, { label: "Cancel", value: "cancel", cancel: true }, { label: "Save", value: "yes", primary: true }] })); if (r === "cancel") return false; if (r === "yes") return save(); return true; }
    async function open() { if (!await askDiscard()) return; const p = await filePicker({ mode: "open", start: "~/Documents", filter: n => isText(n) || n.size < 200000 }); if (p) load(p); }
    async function newFile() { if (!await askDiscard()) return; ta.value = ""; st.path = null; st.dirty = false; title(); stat(); if (st.preview) togglePreview(); }
    win.on("close", askDiscard);
    if (st.path) load(st.path); else { title(); stat(); }
    setTimeout(() => ta.focus(), 50);
  },
});
