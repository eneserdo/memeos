// Files: the explorer. Sidebar, breadcrumbs, grid/list views, search, rename, drag and drop, Recycle Bin.
import { registerApp, openFile, launch } from "../core/apps.js";
import { fs, join, dirname, isImage, fmtSize, ext } from "../core/fs.js";
import { bus } from "../core/bus.js";
import { el, contextMenu, errorBox, confirm, esc, fmtAgo } from "../core/ui.js";
import { icon } from "../core/icons.js";
import { settings } from "../core/settings.js";
import { iconFor, resolveAppIcon, fileMenuItems, newItemMenu, pasteInto, getClipboard, setClipboard, importFiles, trashPaths, renamePath } from "../shell/desktop.js";
import { achieve } from "../core/eggs.js";

const H = "/home/pepe";
const QUICK = [["Desktop", join(H, "Desktop"), "monitor"], ["Documents", join(H, "Documents"), "fileText"], ["Pictures", join(H, "Pictures"), "image"], ["Memes", join(H, "Memes"), "sparkle"], ["Downloads", join(H, "Downloads"), "download"]];
const VIEW_KEY = "memeos.files.view";
const typeName = n => n.type === "dir" ? "Folder" : ({ app: "Application", url: "Internet shortcut", md: "Markdown", txt: "Text", json: "JSON", jpg: "JPEG image", jpeg: "JPEG image", png: "PNG image", gif: "GIF image", webp: "WebP image", svg: "SVG image", log: "Log", meme: "Memesis script" }[ext(n.name)] || (ext(n.name) ? ext(n.name).toUpperCase() + " file" : "File"));
const DT = "application/x-memeos-paths";

registerApp({
  id: "files", name: "Files", desc: "Browse, organise and open your files", icon: "folder", color: "linear-gradient(135deg,#f6c04b,#f28c28)", w: 900, h: 580, minW: 520, minH: 320, keywords: ["explorer", "folder", "recycle", "bin", "trash"],
  mount(win, proc, args) {
    const st = { path: "/", hist: [], fwd: [], sel: new Set(), view: localStorage.getItem(VIEW_KEY) || "grid", sort: "name", dir: 1, q: "", expanded: new Set([H]) };
    const root = el("div", { class: "fx" });
    const bar = el("div", { class: "fx-bar" }), nav = el("div", { class: "fx-nav" }), content = el("div", { class: "fx-content", tabindex: 0 }), status = el("div", { class: "fx-status" });
    root.append(bar, el("div", { class: "fx-main" }, nav, content), status);
    win.body.append(root);

    // ---- toolbar
    const b = (ic, title, fn) => el("button", { class: "btn ghost icon", title, html: icon(ic), onclick: fn });
    const back = b("arrowL", "Back", () => { if (st.hist.length) { st.fwd.push(st.path); go(st.hist.pop(), false); } });
    const fwdB = b("arrowR", "Forward", () => { if (st.fwd.length) { st.hist.push(st.path); go(st.fwd.pop(), false); } });
    const up = b("arrowUp", "Up", () => go(dirname(st.path)));
    const crumbs = el("div", { class: "fx-crumbs", title: "Click to edit the path" });
    const search = el("input", { class: "input fx-search", placeholder: "Search", value: "" });
    search.addEventListener("input", () => { st.q = search.value; render(); });
    search.addEventListener("keydown", e => { if (e.key === "Escape") { search.value = ""; st.q = ""; render(); content.focus(); } });
    const viewBtn = b("grid", "Toggle view", () => { st.view = st.view === "grid" ? "list" : "grid"; localStorage.setItem(VIEW_KEY, st.view); render(); });
    const newBtn = el("button", { class: "btn sm", html: icon("plus") + " New", onclick: e => { const r = e.currentTarget.getBoundingClientRect(); contextMenu(r.left, r.bottom + 4, newItemMenu(st.path)); } });
    bar.append(back, fwdB, up, b("refresh", "Refresh", render), crumbs, newBtn, search, viewBtn);
    crumbs.addEventListener("click", e => {
      if (e.target.closest(".fx-crumb")) return;
      const inp = el("input", { class: "input fx-path", value: st.path });
      crumbs.replaceWith(inp); inp.focus(); inp.select();
      const done = ok => { inp.replaceWith(crumbs); if (ok) { const p = inp.value.trim(); if (fs.resolve(p)?.type === "dir") go(p); else errorBox("Files", new Error(`Cannot find "${p}". Check the spelling and try again.`)); } };
      inp.addEventListener("keydown", ev => { if (ev.key === "Enter") done(true); if (ev.key === "Escape") done(false); });
      inp.addEventListener("blur", () => done(false));
    });

    // ---- navigation
    function go(path, push = true) {
      const n = fs.resolve(path); if (!n || n.type !== "dir") return;
      if (push && path !== st.path) { st.hist.push(st.path); st.fwd = []; }
      st.path = fs.pathOf(n); st.sel.clear(); st.q = ""; search.value = ""; render();
    }
    function renderNav() {
      nav.innerHTML = "";
      const item = (label, path, ic, cls = "") => { const it = el("div", { class: `fx-nav-item ${cls}` + (st.path === path ? " cur" : ""), dataset: { path }, html: `<span class="ni">${icon(ic)}</span><span>${esc(label)}</span>`, onclick: () => go(path) }); dropTarget(it, path); return it; };
      nav.append(el("div", { class: "fx-nav-h", text: "Quick access" }));
      QUICK.forEach(([l, p, i]) => nav.append(item(l, p, i)));
      const tc = fs.trashCount();
      nav.append(item(tc ? `Recycle Bin (${tc})` : "Recycle Bin", fs.TRASH, "trash", tc ? "has-items" : ""));
      nav.append(el("div", { class: "fx-nav-h", text: "This PC" }));
      const tree = (path, depth) => {
        const n = fs.resolve(path); if (!n) return;
        const kids = fs.list(path, { hidden: settings.get("showHidden") }).filter(k => k.type === "dir");
        const open = st.expanded.has(path);
        const row = el("div", { class: "fx-nav-item tree" + (st.path === path ? " cur" : ""), dataset: { path }, style: { paddingLeft: 10 + depth * 14 + "px" } },
          el("span", { class: "tw" + (kids.length ? "" : " none"), html: kids.length ? icon(open ? "chevronD" : "chevronR") : "", onclick: e => { e.stopPropagation(); open ? st.expanded.delete(path) : st.expanded.add(path); renderNav(); } }),
          el("span", { class: "ni", html: icon(path === "/" ? "monitor" : open ? "folderOpen" : "folder") }), el("span", { text: path === "/" ? "This PC" : n.name }));
        row.addEventListener("click", () => go(path)); dropTarget(row, path); nav.append(row);
        if (open) kids.forEach(k => tree(fs.pathOf(k), depth + 1));
      };
      st.expanded.add("/"); tree("/", 0);
    }

    // ---- content
    function items() {
      let list;
      if (st.q.trim()) list = fs.search(st.q, st.path).filter(n => settings.get("showHidden") || !fs.pathOf(n).split("/").some(p => p.startsWith(".") && p !== ".trash"));
      else list = fs.list(st.path, { hidden: settings.get("showHidden") });
      const key = { name: n => n.name.toLowerCase(), modified: n => n.modified, size: n => n.type === "dir" ? -1 : n.size || 0, type: n => typeName(n) }[st.sort];
      return list.sort((a, b) => { if (a.type !== b.type) return a.type === "dir" ? -1 : 1; const x = key(a), y = key(b); return (x < y ? -1 : x > y ? 1 : a.name.localeCompare(b.name, undefined, { numeric: true })) * st.dir; });
    }
    function render() {
      const inTrash = st.path === fs.TRASH || st.path.startsWith(fs.TRASH + "/");
      renderNav();
      crumbs.innerHTML = "";
      const parts = st.path === "/" ? [] : st.path.slice(1).split("/");
      const mk = (label, path) => { const c = el("button", { class: "fx-crumb", text: label, onclick: () => go(path) }); dropTarget(c, path); return c; };
      crumbs.append(mk("This PC", "/"));
      parts.forEach((p, i) => { crumbs.append(el("span", { class: "fx-csep", html: icon("chevronR") })); crumbs.append(mk(p === ".trash" ? "Recycle Bin" : p, "/" + parts.slice(0, i + 1).join("/"))); });
      win.setTitle(st.q ? `Search results in ${parts.pop() || "This PC"}` : inTrash ? "Recycle Bin" : (parts.pop() || "This PC"));
      back.disabled = !st.hist.length; fwdB.disabled = !st.fwd.length; up.disabled = st.path === "/";
      viewBtn.innerHTML = icon(st.view === "grid" ? "list" : "grid"); newBtn.classList.toggle("hidden", inTrash || !!st.q);
      const list = items();
      content.innerHTML = ""; content.className = `fx-content ${st.view}${inTrash ? " trash" : ""}`; content.dataset.path = st.path;
      if (inTrash) content.append(el("div", { class: "fx-trashbar" }, el("span", { html: icon("trash") + ` ${list.length} item${list.length === 1 ? "" : "s"} in the Recycle Bin` }),
        el("button", { class: "btn sm", html: icon("undo") + " Restore all", disabled: !list.length, onclick: async () => { for (const n of list) await fs.restore(fs.pathOf(n)); achieve("restore"); } }),
        el("button", { class: "btn sm danger", html: icon("x") + " Empty Recycle Bin", disabled: !list.length, onclick: async () => { if (await confirm("Empty the Recycle Bin?", `${list.length} item${list.length === 1 ? "" : "s"} will be permanently deleted.`, { ok: "Empty", danger: true })) { await fs.emptyTrash(); achieve("empty"); } } })));
      if (!list.length) content.append(el("div", { class: "empty" }, el("span", { html: icon(st.q ? "search" : inTrash ? "trash" : "folderOpen") }), el("b", { text: st.q ? "No results" : inTrash ? "The Recycle Bin is empty" : "This folder is empty" }), !st.q && !inTrash ? el("span", { text: "Right-click for New, or drop files here" }) : null));
      if (st.view === "list" && list.length) {
        const hd = el("div", { class: "fx-head" }, ...[["name", "Name"], ["modified", "Date modified"], ["type", "Type"], ["size", "Size"]].map(([k, l]) => el("span", { class: "fx-col " + k + (st.sort === k ? " on" : ""), html: esc(l) + (st.sort === k ? icon(st.dir > 0 ? "chevronU" : "chevronD") : ""), onclick: () => { if (st.sort === k) st.dir = -st.dir; else { st.sort = k; st.dir = 1; } render(); } })));
        content.append(hd);
      }
      for (const n of list) {
        const path = fs.pathOf(n), isDir = n.type === "dir";
        const it = st.view === "grid"
          ? el("div", { class: "fx-tile" + (st.sel.has(path) ? " sel" : ""), dataset: { path }, draggable: true, title: `${n.name}\n${typeName(n)}${isDir ? "" : ", " + fmtSize(n.size || 0)}` }, el("div", { class: "fx-ico", html: iconFor(n) }), el("div", { class: "fx-name", text: n.name.replace(/\.app$/, "") }), st.q ? el("small", { class: "fx-sub", text: fs.pathOf(fs.nodes.get(n.parent)).replace(H, "~") }) : (inTrash && n.meta?.origPath ? el("small", { class: "fx-sub", text: dirname(n.meta.origPath).replace(H, "~") }) : null))
          : el("div", { class: "fx-row" + (st.sel.has(path) ? " sel" : ""), dataset: { path }, draggable: true }, el("span", { class: "fx-col name" }, el("span", { class: "fx-ico", html: iconFor(n) }), el("span", { class: "fx-name", text: n.name })),
            el("span", { class: "fx-col modified", text: inTrash && n.meta?.origPath ? n.meta.origPath : st.q ? fs.pathOf(fs.nodes.get(n.parent)) : new Date(n.modified).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) }), el("span", { class: "fx-col type", text: typeName(n) }), el("span", { class: "fx-col size", text: isDir ? "" : fmtSize(n.size || 0) }));
        const ap = it.querySelector(".fico.app"); if (ap) resolveAppIcon(ap, n);
        it.addEventListener("click", e => { e.stopPropagation(); if (e.ctrlKey) st.sel.has(path) ? st.sel.delete(path) : st.sel.add(path); else if (e.shiftKey && st.sel.size) { const all = list.map(x => fs.pathOf(x)); const a = all.indexOf([...st.sel][0]), c = all.indexOf(path); all.slice(Math.min(a, c), Math.max(a, c) + 1).forEach(p => st.sel.add(p)); } else { st.sel.clear(); st.sel.add(path); } paint(); });
        it.addEventListener("dblclick", e => { e.stopPropagation(); if (inTrash) return; isDir ? go(path) : openFile(path); });
        it.addEventListener("contextmenu", e => { e.preventDefault(); e.stopPropagation(); if (!st.sel.has(path)) { st.sel.clear(); st.sel.add(path); paint(); } contextMenu(e.clientX, e.clientY, fileMenuItems([...st.sel], { after: render, inTrash })); });
        it.addEventListener("dragstart", e => { if (!st.sel.has(path)) { st.sel.clear(); st.sel.add(path); paint(); } e.dataTransfer.setData(DT, JSON.stringify([...st.sel])); e.dataTransfer.effectAllowed = "copyMove"; it.classList.add("src"); });
        it.addEventListener("dragend", () => it.classList.remove("src"));
        if (isDir) dropTarget(it, path);
        content.append(it);
      }
      paint();
    }
    function paint() {
      content.querySelectorAll("[data-path]").forEach(i => i.classList.toggle("sel", st.sel.has(i.dataset.path)));
      const list = items(), selNodes = [...st.sel].map(p => fs.resolve(p)).filter(Boolean);
      const bytes = selNodes.reduce((s, n) => s + fs.sizeOf(n), 0);
      status.innerHTML = `<span>${list.length} item${list.length === 1 ? "" : "s"}</span>${selNodes.length ? `<span>${selNodes.length} selected, ${fmtSize(bytes)}</span>` : ""}<span class="grow"></span><span>${esc(st.path.replace(H, "~"))}</span>`;
    }
    function dropTarget(elm, path) {
      elm.addEventListener("dragover", e => { if (e.dataTransfer.types.includes(DT) || e.dataTransfer.types.includes("Files")) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = e.ctrlKey ? "copy" : "move"; elm.classList.add("drop-target"); } });
      elm.addEventListener("dragleave", () => elm.classList.remove("drop-target"));
      elm.addEventListener("drop", async e => {
        elm.classList.remove("drop-target"); e.preventDefault(); e.stopPropagation();
        if (e.dataTransfer.files.length) return importFiles(path, e.dataTransfer.files);
        const paths = JSON.parse(e.dataTransfer.getData(DT) || "[]");
        for (const p of paths) { if (p === path || dirname(p) === path) continue; try { e.ctrlKey ? await fs.copy(p, path) : await fs.move(p, path); } catch (err) { errorBox("Move failed", err); } }
      });
    }
    content.addEventListener("dragover", e => { if (e.dataTransfer.types.includes(DT) || e.dataTransfer.types.includes("Files")) { e.preventDefault(); } });
    content.addEventListener("drop", async e => {
      if (e.defaultPrevented) return; e.preventDefault();
      if (e.dataTransfer.files.length) return importFiles(st.path, e.dataTransfer.files);
      const paths = JSON.parse(e.dataTransfer.getData(DT) || "[]");
      for (const p of paths) { if (dirname(p) === st.path) continue; try { e.ctrlKey ? await fs.copy(p, st.path) : await fs.move(p, st.path); } catch (err) { errorBox("Move failed", err); } }
    });
    content.addEventListener("click", e => { if (e.target === content || e.target.classList.contains("fx-head")) { st.sel.clear(); paint(); } });
    content.addEventListener("contextmenu", e => {
      if (e.target.closest("[data-path]") && e.target.closest("[data-path]") !== content) return;
      e.preventDefault(); const inTrash = st.path === fs.TRASH;
      contextMenu(e.clientX, e.clientY, inTrash ? [{ label: "Empty Recycle Bin", icon: "trash", danger: true, disabled: !fs.trashCount(), action: async () => { if (await confirm("Empty the Recycle Bin?", "Everything in it will be permanently deleted.", { ok: "Empty", danger: true })) { await fs.emptyTrash(); achieve("empty"); } } }] : [
        { label: "View", icon: "grid", sub: [{ label: "Icons", check: st.view === "grid", action: () => { st.view = "grid"; render(); } }, { label: "Details", check: st.view === "list", action: () => { st.view = "list"; render(); } }, { sep: true }, { label: "Show hidden files", check: settings.get("showHidden"), action: () => settings.set("showHidden", !settings.get("showHidden")) }] },
        { label: "Sort by", icon: "list", sub: ["name", "modified", "type", "size"].map(k => ({ label: k[0].toUpperCase() + k.slice(1), check: st.sort === k, action: () => { st.sort = k; render(); } })) },
        { label: "Refresh", icon: "refresh", action: render }, { sep: true },
        { label: "New", icon: "plus", sub: newItemMenu(st.path, render) },
        { label: "Paste", icon: "clipboard", key: "Ctrl+V", disabled: !getClipboard(), action: () => pasteInto(st.path) },
        { sep: true }, { label: "Open in Terminal", icon: "terminal", action: () => launch("terminal", { cwd: st.path }) },
        { label: "Properties", icon: "info", action: () => import("../shell/desktop.js").then(m => m.properties(st.path)) }]);
    });
    content.addEventListener("keydown", e => {
      const list = items(), all = list.map(n => fs.pathOf(n)), inTrash = st.path === fs.TRASH;
      if (e.key === "Backspace") { e.preventDefault(); back.click(); }
      else if (e.key === "Enter" && st.sel.size && !inTrash) { e.preventDefault(); [...st.sel].forEach(p => fs.resolve(p)?.type === "dir" ? go(p) : openFile(p)); }
      else if (e.key === "Delete" && st.sel.size) { e.preventDefault(); inTrash ? fileMenuItems([...st.sel], { after: render, inTrash: true })[1].action() : trashPaths([...st.sel], render); }
      else if (e.key === "F2" && st.sel.size === 1) { e.preventDefault(); renamePath([...st.sel][0], render); }
      else if (e.key === "a" && e.ctrlKey) { e.preventDefault(); st.sel = new Set(all); paint(); }
      else if (e.key === "c" && e.ctrlKey && st.sel.size) { setClipboard({ op: "copy", paths: [...st.sel] }); }
      else if (e.key === "x" && e.ctrlKey && st.sel.size) { setClipboard({ op: "cut", paths: [...st.sel] }); }
      else if (e.key === "v" && e.ctrlKey) { pasteInto(st.path); }
      else if (e.key === "f" && e.ctrlKey) { e.preventDefault(); search.focus(); }
      else if (["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) && all.length) {
        e.preventDefault(); const cur = all.indexOf([...st.sel].pop()); const cols = st.view === "grid" ? Math.max(1, Math.floor(content.clientWidth / 104)) : 1;
        const step = { ArrowDown: cols, ArrowUp: -cols, ArrowLeft: -1, ArrowRight: 1 }[e.key];
        const nx = e.key === "Home" ? 0 : e.key === "End" ? all.length - 1 : Math.max(0, Math.min(all.length - 1, (cur < 0 ? (step > 0 ? -1 : all.length) : cur) + step));
        st.sel = new Set([all[nx]]); paint(); content.querySelector(`[data-path="${CSS.escape(all[nx])}"]`)?.scrollIntoView({ block: "nearest" });
      }
      else if (e.key.length === 1 && !e.ctrlKey && !e.altKey) { const hit = list.find(n => n.name.toLowerCase().startsWith(e.key.toLowerCase())); if (hit) { st.sel = new Set([fs.pathOf(hit)]); paint(); content.querySelector(`[data-path="${CSS.escape(fs.pathOf(hit))}"]`)?.scrollIntoView({ block: "nearest" }); } }
    });

    const off = [bus.on("fs", () => { if (!fs.resolve(st.path)) go(H); else render(); }), bus.on("settings", k => { if (k === "showHidden") render(); })];
    win.on("close", () => off.forEach(f => f()));
    go(args.path && fs.resolve(args.path)?.type === "dir" ? args.path : H, false);
    setTimeout(() => content.focus(), 50);
  },
});
