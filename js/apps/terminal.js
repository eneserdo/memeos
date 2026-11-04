// Terminal: a shell over the virtual file system with history, tab completion, pipes-free but honest commands.
import { registerApp, launch, openFile, APPS } from "../core/apps.js";
import { fs, join, normalize, dirname, basename, fmtSize, isImage } from "../core/fs.js";
import { el, esc, toast } from "../core/ui.js";
import { settings, WALLPAPERS } from "../core/settings.js";
import { procs, wins } from "../core/wm.js";
import { achieve, bluescreen, dogeRain, ACHIEVEMENTS, unlocked } from "../core/eggs.js";
import { sound } from "../core/sound.js";
import { power } from "../shell/power.js";

const H = "/home/pepe";
const short = p => p === H ? "~" : p.startsWith(H + "/") ? "~" + p.slice(H.length) : p;
const HIST_KEY = "memeos.term.history";
const FORTUNES = ["One does not simply walk into /system.", "There is no cloud, only other people's IndexedDB.", "rm -rf is not a backup strategy. Neither is hope.", "A file system is a hierarchy of regret.", "It works on my machine. This is my machine.", "The S in MemeOS stands for security.", "Have you tried turning it off and on again? Alt+S, power, Restart.", "99 little bugs in the code, 99 little bugs. Take one down, patch it around, 127 little bugs in the code.", "Real programmers count from 0. Memes count from wow.", "sudo make me a sandwich."];
// colour block art rendered from a real picture (used by neofetch and the ascii command)
async function pixelArt(url, cols = 26) {
  const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
  const rows = Math.max(1, Math.round(cols * img.naturalHeight / img.naturalWidth));
  const c = document.createElement("canvas"); c.width = cols; c.height = rows; const x = c.getContext("2d"); x.drawImage(img, 0, 0, cols, rows);
  const d = x.getImageData(0, 0, cols, rows).data, out = [];
  for (let y = 0; y < rows; y++) { let line = ""; for (let i = 0; i < cols; i++) { const k = (y * cols + i) * 4; line += `<span class="px" style="background:rgb(${d[k]},${d[k + 1]},${d[k + 2]})"></span>`; } out.push(line); }
  return out;
}

registerApp({
  id: "terminal", name: "Terminal", desc: "A real shell over the file system", icon: "terminal", color: "linear-gradient(135deg,#2b2f3a,#0f1117)", dark: true, w: 760, h: 460, minW: 360, minH: 200, keywords: ["shell", "console", "bash", "cmd"],
  mount(win, proc, args) {
    const st = { cwd: args.cwd && fs.resolve(args.cwd)?.type === "dir" ? fs.pathOf(fs.resolve(args.cwd)) : H, hist: JSON.parse(localStorage.getItem(HIST_KEY) || "[]"), hi: -1, count: 0, env: { USER: "pepe", HOME: H, SHELL: "/bin/wow", TERM: "memeos-256color", LANG: "en_US.UTF-8" }, theme: "" };
    const out = el("div", { class: "tm-out" });
    const inp = el("input", { class: "tm-in", spellcheck: false, autocomplete: "off", autocapitalize: "off" });
    const ps = el("span", { class: "tm-ps" });
    const line = el("div", { class: "tm-line" }, ps, inp);
    const root = el("div", { class: "tm", onclick: e => { if (!getSelection().toString()) inp.focus(); } }, out, line);
    win.body.append(root);
    const prompt = () => { ps.innerHTML = `<span class="u">pepe@memeos</span>:<span class="p">${esc(short(st.cwd))}</span>$ `; };
    const print = (s = "", cls = "") => { const d = el("div", { class: "tm-l " + cls }); d.innerHTML = s; out.append(d); out.scrollTop = out.scrollHeight; return d; };
    const echo = (s = "", cls = "") => print(esc(s), cls);
    const err = s => print(esc(s), "err");
    const res = p => normalize(p.startsWith("/") ? p : p.startsWith("~") ? p : join(st.cwd, p));
    const ls = (p, flags) => {
      const n = fs.resolve(p); if (!n) throw new Error(`ls: cannot access '${p}': No such file or directory`);
      if (n.type === "file") { return [n]; }
      return fs.list(p, { hidden: flags.includes("a") });
    };
    const fmtLs = (nodes, flags) => {
      if (flags.includes("l")) return nodes.map(n => `${n.type === "dir" ? "d" : "-"}rw-r--r--  pepe  ${String(n.type === "dir" ? 4096 : n.size || 0).padStart(8)}  ${new Date(n.modified).toLocaleString([], { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" })}  ${n.type === "dir" ? `<span class="dir">${esc(n.name)}/</span>` : n.name.endsWith(".app") ? `<span class="exe">${esc(n.name)}</span>` : isImage(n) ? `<span class="img">${esc(n.name)}</span>` : esc(n.name)}`).join("\n");
      return nodes.map(n => n.type === "dir" ? `<span class="dir">${esc(n.name)}/</span>` : n.name.endsWith(".app") ? `<span class="exe">${esc(n.name)}</span>` : isImage(n) ? `<span class="img">${esc(n.name)}</span>` : esc(n.name)).join("  ");
    };
    const tree = (p, prefix = "", depth = 0, acc = { d: 0, f: 0 }) => {
      const kids = fs.list(p, { hidden: false }); let s = "";
      kids.forEach((k, i) => { const last = i === kids.length - 1; s += `${prefix}${last ? "└── " : "├── "}${k.type === "dir" ? `<span class="dir">${esc(k.name)}</span>` : esc(k.name)}\n`; if (k.type === "dir") { acc.d++; if (depth < 6) s += tree(fs.pathOf(k), prefix + (last ? "    " : "│   "), depth + 1, acc); } else acc.f++; });
      return depth === 0 ? s + `\n${acc.d} directories, ${acc.f} files` : s;
    };

    const CMDS = {
      help: () => print(`<span class="hl">MemeOS shell</span>. Commands:\n` + Object.keys(CMDS).sort().join("  ") + `\n\nPaths work like Linux: <span class="dir">~</span>, <span class="dir">..</span>, absolute and relative. Tab completes names, arrows browse history.`),
      pwd: () => echo(st.cwd),
      cd: ([p = "~"]) => { const t = res(p); const n = fs.resolve(t); if (!n) throw new Error(`cd: no such file or directory: ${p}`); if (n.type !== "dir") throw new Error(`cd: not a directory: ${p}`); st.cwd = t; prompt(); },
      ls: (a) => { const flags = a.filter(x => x.startsWith("-")).join(""), ps = a.filter(x => !x.startsWith("-")); const targets = ps.length ? ps : ["."]; targets.forEach(t => { if (targets.length > 1) echo(t + ":"); print(fmtLs(ls(res(t), flags), flags)); }); },
      dir: a => CMDS.ls(a), ll: a => CMDS.ls(["-la", ...a]), la: a => CMDS.ls(["-a", ...a]),
      tree: ([p = "."]) => { const t = res(p); if (fs.resolve(t)?.type !== "dir") throw new Error(`tree: ${p}: Not a directory`); print(`<span class="dir">${esc(short(t))}</span>\n` + tree(t)); },
      cat: async a => { if (!a.length) throw new Error("cat: missing file operand"); for (const p of a) { const n = fs.resolve(res(p)); if (!n) throw new Error(`cat: ${p}: No such file or directory`); if (n.type === "dir") throw new Error(`cat: ${p}: Is a directory`); if (isImage(n)) { print(`<img class="tm-img" src="${fs.url(n)}" alt="">`); continue; } echo(await fs.readText(res(p))); if (res(p).endsWith("do not open.txt")) achieve("secret"); } },
      head: async a => { const n = a.includes("-n") ? parseInt(a[a.indexOf("-n") + 1]) : 10; const p = a.filter((x, i) => !x.startsWith("-") && a[i - 1] !== "-n")[0]; echo((await fs.readText(res(p))).split("\n").slice(0, n).join("\n")); },
      tail: async a => { const n = a.includes("-n") ? parseInt(a[a.indexOf("-n") + 1]) : 10; const p = a.filter((x, i) => !x.startsWith("-") && a[i - 1] !== "-n")[0]; echo((await fs.readText(res(p))).split("\n").slice(-n).join("\n")); },
      wc: async a => { for (const p of a) { const t = await fs.readText(res(p)); echo(`${t.split("\n").length} ${t.trim() ? t.trim().split(/\s+/).length : 0} ${new TextEncoder().encode(t).length} ${p}`); } },
      grep: async a => { const [pat, ...files] = a.filter(x => !x.startsWith("-")); const ci = a.includes("-i"); const re = new RegExp(pat, ci ? "i" : ""); for (const f of files) { const t = await fs.readText(res(f)); t.split("\n").forEach(l => { if (re.test(l)) print((files.length > 1 ? `<span class="dir">${esc(f)}</span>:` : "") + esc(l).replace(new RegExp(esc(pat), ci ? "gi" : "g"), m => `<span class="hl">${m}</span>`)); }); } },
      echo: a => echo(a.join(" ").replace(/\$(\w+)/g, (_, k) => st.env[k] ?? "")),
      mkdir: async a => { const rec = a.includes("-p"); for (const p of a.filter(x => !x.startsWith("-"))) await fs.mkdir(res(p), { recursive: rec }); },
      touch: async a => { for (const p of a) { const t = res(p); if (fs.resolve(t)) { fs.resolve(t).modified = Date.now(); } else await fs.writeFile(t, ""); } },
      rm: async a => {
        const flags = a.filter(x => x.startsWith("-")).join(""), ps = a.filter(x => !x.startsWith("-"));
        if (ps.some(p => ["/", "/*", "~", "/home", H, "/system"].includes(res(p)) || p === "/" || p === "/*")) { achieve("rmrf"); echo("rm: it is dangerous to operate recursively on '/'"); echo("rm: use --no-preserve-root to override this failsafe"); if (flags.includes("no-preserve-root") || a.includes("--no-preserve-root")) { await bluescreen("KERNEL_SECURITY_CHECK_FAILURE"); echo("Just kidding. Nothing was deleted. Much safety."); } return; }
        for (const p of ps) { const n = fs.resolve(res(p)); if (!n) throw new Error(`rm: cannot remove '${p}': No such file or directory`); if (n.type === "dir" && !flags.includes("r")) throw new Error(`rm: cannot remove '${p}': Is a directory (use -r)`); await fs.trash(res(p)); }
        if (ps.length) { sound.trash(); achieve("trash"); echo(`moved ${ps.length} item${ps.length > 1 ? "s" : ""} to the Recycle Bin (rm --forever deletes permanently)`); }
      },
      rmdir: async a => { for (const p of a) { const n = fs.resolve(res(p)); if (!n || n.type !== "dir") throw new Error(`rmdir: failed to remove '${p}': Not a directory`); if (fs.list(res(p)).length) throw new Error(`rmdir: failed to remove '${p}': Directory not empty`); await fs.remove(res(p)); } },
      mv: async ([s, d]) => { if (!s || !d) throw new Error("usage: mv SOURCE DEST"); const sp = res(s), dp = res(d); const dn = fs.resolve(dp); if (dn && dn.type === "dir") await fs.move(sp, dp); else if (dirname(sp) === dirname(dp)) await fs.rename(sp, basename(dp)); else { await fs.move(sp, dirname(dp)); await fs.rename(join(dirname(dp), basename(sp)), basename(dp)); } },
      cp: async a => { const ps = a.filter(x => !x.startsWith("-")); const [s, d] = ps; if (!s || !d) throw new Error("usage: cp [-r] SOURCE DEST"); const sp = res(s), dp = res(d); const sn = fs.resolve(sp); if (!sn) throw new Error(`cp: cannot stat '${s}'`); if (sn.type === "dir" && !a.includes("-r")) throw new Error(`cp: -r not specified; omitting directory '${s}'`); const dn = fs.resolve(dp); if (dn && dn.type === "dir") await fs.copy(sp, dp); else { const c = await fs.copy(sp, dirname(dp)); await fs.rename(fs.pathOf(c), basename(dp)); } },
      write: async ([p, ...rest]) => { if (!p) throw new Error("usage: write FILE text..."); await fs.writeFile(res(p), rest.join(" ") + "\n"); },
      append: async ([p, ...rest]) => { if (!p) throw new Error("usage: append FILE text..."); const t = fs.resolve(res(p)) ? await fs.readText(res(p)) : ""; await fs.writeFile(res(p), t + rest.join(" ") + "\n"); },
      stat: a => { for (const p of a) { const n = fs.resolve(res(p)); if (!n) throw new Error(`stat: cannot stat '${p}'`); echo(`  File: ${n.name}\n  Size: ${fs.sizeOf(n)}\tType: ${n.type}${n.mime ? "\tMIME: " + n.mime : ""}\nCreate: ${new Date(n.created).toISOString()}\nModify: ${new Date(n.modified).toISOString()}`); } },
      du: ([p = "."]) => { const n = fs.resolve(res(p)); if (!n) throw new Error(`du: cannot access '${p}'`); if (n.type === "dir") fs.list(res(p)).forEach(k => echo(`${fmtSize(fs.sizeOf(k)).padStart(10)}  ${k.name}`)); echo(`${fmtSize(fs.sizeOf(n)).padStart(10)}  total`); },
      df: () => navigator.storage?.estimate ? navigator.storage.estimate().then(e => echo(`Filesystem      Size      Used     Avail  Use%\nmemeos-idb  ${fmtSize(e.quota || 0).padStart(8)}  ${fmtSize(e.usage || 0).padStart(8)}  ${fmtSize((e.quota || 0) - (e.usage || 0)).padStart(8)}  ${e.quota ? Math.round(e.usage / e.quota * 100) : 0}%\nvfs (nodes) ${fmtSize(fs.usage()).padStart(8)}  ${fs.nodes.size} inodes`)) : echo("storage estimate not available"),
      find: a => { const p = a[0] && !a[0].startsWith("-") ? res(a[0]) : st.cwd; const name = a.includes("-name") ? a[a.indexOf("-name") + 1].replace(/\*/g, "") : ""; fs.search(name, p).forEach(n => echo(short(fs.pathOf(n)))); },
      open: a => { if (!a.length) throw new Error("usage: open FILE|APP"); const t = res(a[0]); if (fs.resolve(t)) openFile(t); else if (APPS.has(a[0])) launch(a[0]); else throw new Error(`open: ${a[0]}: not found`); },
      trash: ([c]) => { if (c === "empty") return fs.emptyTrash().then(() => { echo("Recycle Bin emptied."); achieve("empty"); }); if (c === "restore") return Promise.all(fs.list(fs.TRASH).map(n => fs.restore(fs.pathOf(n)))).then(r => { echo(`restored ${r.length} items`); if (r.length) achieve("restore"); }); const l = fs.list(fs.TRASH); echo(l.length ? l.map(n => `${n.name}  (from ${n.meta?.origPath || "?"})`).join("\n") : "Recycle Bin is empty. Usage: trash [empty|restore]"); },
      clear: () => { out.innerHTML = ""; }, cls: () => CMDS.clear(),
      history: () => st.hist.forEach((h, i) => echo(`${String(i + 1).padStart(4)}  ${h}`)),
      date: () => echo(new Date().toString()), uptime: () => echo(`up ${fmtUp(performance.now() / 1000)}, ${wins.size} windows, load average: ${[...procs.values()].reduce((s, p) => s + p.cpu, 0).toFixed(2)}`),
      whoami: () => echo("pepe"), hostname: () => echo("memeos"), uname: a => echo(a.includes("-a") ? `MemeOS memeos 1.0.0-wow #1 SMP ${navigator.platform} ${navigator.userAgent.split(" ").pop()}` : "MemeOS"),
      env: () => Object.entries(st.env).forEach(([k, v]) => echo(`${k}=${v}`)), export: ([kv = ""]) => { const [k, v] = kv.split("="); if (k) st.env[k] = v ?? ""; }, printenv: a => a.length ? echo(st.env[a[0]] ?? "") : CMDS.env(),
      ps: () => { echo("  PID  CPU%   MEM     TIME NAME"); [...procs.values()].forEach(p => echo(`${String(p.pid).padStart(5)}  ${p.cpu.toFixed(1).padStart(4)}  ${fmtSize(p.memory()).padStart(7)}  ${fmtUp((Date.now() - p.started) / 1000).padStart(7)} ${p.app.name}${p.win ? " (" + p.win.title + ")" : ""}`)); },
      kill: ([pid]) => { const p = procs.get(+pid); if (!p) throw new Error(`kill: (${pid}): No such process`); if (p.system) throw new Error(`kill: (${pid}): Operation not permitted`); p.win?.close(true); echo(`killed ${pid}`); achieve("taskkill"); },
      top: () => launch("taskman"), htop: () => launch("taskman"),
      apps: () => [...APPS.values()].filter(a => !a.hidden).forEach(a => echo(`${a.id.padEnd(14)} ${a.name}  -  ${a.desc || ""}`)),
      wallpaper: ([id]) => { const w = WALLPAPERS.find(w => w.id === id); if (!w) { echo("available: " + WALLPAPERS.map(w => w.id).join(", ")); return; } settings.patch({ wallpaper: id, theme: w.theme }); },
      theme: ([t]) => { if (!["dark", "light", "system"].includes(t)) return echo("usage: theme dark|light|system"); settings.set("theme", t); },
      lock: () => power.lock(), reboot: () => power.restart(), shutdown: () => power.shutdown(), exit: () => win.close(), logout: () => power.lock(),
      notify: a => toast({ title: a.join(" ") || "Hello from the terminal", icon: "terminal", app: "Terminal" }),
      fortune: () => echo(FORTUNES[Math.floor(Math.random() * FORTUNES.length)]),
      cowsay: a => { const t = a.join(" ") || "wow"; const b = "-".repeat(t.length + 2); echo(` ${b}\n< ${t} >\n ${b}\n        \\   ^__^\n         \\  (oo)\\_______\n            (__)\\       )\\/\\\n                ||----w |\n                ||     ||`); },
      dogesay: a => { const t = a.join(" ") || "wow"; echo(`  ${"_".repeat(t.length + 2)}\n < ${t} >\n  ${"-".repeat(t.length + 2)}\n    \\   ▄▀▀▀▄\n     \\ ▐ ●  ● ▌  much shell\n       ▐  ▽  ▌   very command\n        ▀▄▄▄▀`); },
      neofetch: async () => {
        achieve("neofetch"); const up = fmtUp(performance.now() / 1000); const gl = document.createElement("canvas").getContext("webgl"); const gpu = gl ? (gl.getExtension("WEBGL_debug_renderer_info") ? gl.getParameter(gl.getExtension("WEBGL_debug_renderer_info").UNMASKED_RENDERER_WEBGL) : "WebGL") : "none";
        const info = [`<span class="u">pepe</span>@<span class="u">memeos</span>`, "-------------", `<span class="k">OS</span>: MemeOS 1.0 (browser edition)`, `<span class="k">Host</span>: ${navigator.platform}`, `<span class="k">Kernel</span>: ${navigator.userAgent.match(/(Chrome|Firefox|Safari|Edg)\/[\d.]+/)?.[0] || "unknown"}`, `<span class="k">Uptime</span>: ${up}`, `<span class="k">Packages</span>: ${APPS.size} (memeos)`, `<span class="k">Shell</span>: wow 1.0`, `<span class="k">Resolution</span>: ${innerWidth}x${innerHeight} @${devicePixelRatio}x`, `<span class="k">DE</span>: MemeShell`, `<span class="k">WM</span>: memewm (${wins.size} windows)`, `<span class="k">Theme</span>: ${settings.resolvedTheme()} / ${settings.get("wallpaper")}`, `<span class="k">Terminal</span>: memeos-terminal`, `<span class="k">CPU</span>: ${navigator.hardwareConcurrency || "?"} cores`, `<span class="k">GPU</span>: ${esc(String(gpu)).slice(0, 48)}`, `<span class="k">Memory</span>: ${performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) + " MiB / " + Math.round(performance.memory.jsHeapSizeLimit / 1048576) + " MiB" : (navigator.deviceMemory || "?") + " GiB"}`, `<span class="k">Files</span>: ${fs.nodes.size} inodes, ${fmtSize(fs.usage())}`, "", ["#e5484d", "#f5a524", "#f6e05e", "#30a46c", "#2f7cf6", "#8b5cf6", "#ec4899", "#eceef3"].map(c => `<span style="background:${c}">   </span>`).join("")];
        const art = await pixelArt("assets/memes/doge.jpg", 22).catch(() => []);
        const n = Math.max(art.length, info.length);
        print(Array.from({ length: n }, (_, i) => `${art[i] || `<span class="px-gap"></span>`}  ${info[i] || ""}`).join("\n"), "neo");
      },
      ascii: async ([p, w]) => { if (!p) throw new Error("usage: ascii PICTURE [columns]"); const n = fs.resolve(res(p)); if (!n || !isImage(n)) throw new Error(`ascii: ${p}: not a picture`); print((await pixelArt(fs.url(n), Math.min(80, Math.max(8, parseInt(w) || 36)))).join("\n"), "neo"); },
      sl: () => { const d = print("", "sl"); let x = 60; const t = setInterval(() => { d.textContent = " ".repeat(Math.max(0, x)) + "wow   =^..^=  ~~~  much train"; x -= 2; if (x < -40) { clearInterval(t); d.remove(); } }, 60); },
      matrix: () => { const d = print("", "mtx"); let n = 0; const t = proc.setInterval(() => { d.textContent += Array.from({ length: 70 }, () => Math.random() < .5 ? String.fromCharCode(0x30a0 + Math.random() * 96 | 0) : " ").join("") + "\n"; out.scrollTop = out.scrollHeight; if (++n > 18) { proc.clear(t); print("wake up, pepe...", "hl"); } }, 70); },
      hackerman: () => { achieve("terminal"); const lines = ["Initializing mainframe handshake...", "Bypassing 4096-bit meme encryption...", "Downloading more RAM...", "ACCESS GRANTED", "You are now in. In what? Unclear."]; let i = 0; const t = proc.setInterval(() => { echo("[" + "#".repeat(i * 4).padEnd(20) + "] " + lines[i]); if (++i >= lines.length) { proc.clear(t); root.classList.add("hacker"); setTimeout(() => root.classList.remove("hacker"), 4000); } }, 500); },
      sudo: a => { achieve("sudo"); if (a.join(" ") === "make me a sandwich") return echo("Okay."); err("pepe is not in the sudoers file. This incident will be reported."); toast({ title: "Incident reported", body: "pepe tried to use sudo.", icon: "alert", color: "var(--danger)", app: "Terminal" }); },
      doge: () => { dogeRain(); echo("wow"); }, wow: () => echo("such shell"), yes: a => { for (let i = 0; i < 40; i++) echo(a.join(" ") || "y"); echo("(stopped after 40 lines, this is a browser)"); },
      achievements: () => ACHIEVEMENTS.forEach(a => echo(`${unlocked.has(a.id) ? "[x]" : "[ ]"} ${a.title.padEnd(26)} ${unlocked.has(a.id) ? a.desc : a.hint}`)),
      which: ([c]) => echo(CMDS[c] ? `/bin/${c}` : `${c} not found`), man: ([c]) => echo(c && CMDS[c] ? `${c}: a MemeOS shell builtin. No manual entry, use your imagination.` : "What manual page do you want?"), ping: ([h = "doge"]) => { for (let i = 0; i < 4; i++) echo(`64 bytes from ${h}: icmp_seq=${i + 1} ttl=42 time=${(Math.random() * 20 + 1).toFixed(1)} ms`); },
      version: () => echo("MemeOS 1.0.0 (wow)"), xdg: a => CMDS.open(a), nano: a => CMDS.vim(a), vim: a => { if (a[0]) openFile(res(a[0]), { app: "notepad" }); else launch("notepad"); echo("opening in Notepad (this shell does not do modal editors)"); }, vi: a => CMDS.vim(a), emacs: () => echo("emacs: not installed. Notepad is right there."),
    };
    const fmtUp = s => { s = Math.floor(s); return s < 60 ? `${s}s` : s < 3600 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${Math.floor(s / 3600)}h ${Math.floor(s % 3600 / 60)}m`; };

    async function run(cmdline) {
      const t0 = performance.now();
      print(`<span class="tm-echo">${ps.innerHTML}${esc(cmdline)}</span>`);
      const line = cmdline.trim(); if (!line) return;
      st.hist.push(line); if (st.hist.length > 200) st.hist.shift(); localStorage.setItem(HIST_KEY, JSON.stringify(st.hist)); st.hi = -1;
      if (++st.count >= 10) achieve("terminal");
      for (const part of line.split("&&")) {
        const args = tokens(part.trim()); const c = args.shift(); if (!c) continue;
        if (c.includes("=") && !CMDS[c]) { const [k, v] = c.split("="); st.env[k] = v; continue; }
        try { if (CMDS[c]) await CMDS[c](args); else if (fs.resolve(res(c))?.type === "dir") { CMDS.cd([c]); } else if (APPS.has(c)) launch(c); else err(`${c}: command not found (type help)`); }
        catch (e) { err(e.message || String(e)); }
      }
      proc.work(performance.now() - t0);
    }
    const tokens = s => { const r = []; let cur = "", q = null; for (const ch of s) { if (q) { if (ch === q) q = null; else cur += ch; } else if (ch === '"' || ch === "'") q = ch; else if (/\s/.test(ch)) { if (cur) { r.push(cur); cur = ""; } } else cur += ch; } if (cur) r.push(cur); return r; };
    function complete() {
      const v = inp.value, parts = v.split(/\s+/), last = parts[parts.length - 1] || "";
      let cands;
      if (parts.length === 1) cands = [...Object.keys(CMDS), ...APPS.keys()].filter(c => c.startsWith(last));
      else { const dir = last.includes("/") ? res(last.slice(0, last.lastIndexOf("/") + 1)) : st.cwd, pre = last.includes("/") ? last.slice(last.lastIndexOf("/") + 1) : last; const base = last.includes("/") ? last.slice(0, last.lastIndexOf("/") + 1) : ""; cands = (fs.resolve(dir) ? fs.list(dir, { hidden: pre.startsWith(".") }) : []).filter(n => n.name.toLowerCase().startsWith(pre.toLowerCase())).map(n => base + (n.name.includes(" ") ? `"${n.name}"` : n.name) + (n.type === "dir" ? "/" : "")); }
      if (!cands.length) return;
      if (cands.length === 1) { parts[parts.length - 1] = cands[0]; inp.value = parts.join(" ") + (cands[0].endsWith("/") ? "" : " "); return; }
      let common = cands[0]; for (const c of cands) while (!c.startsWith(common)) common = common.slice(0, -1);
      if (common.length > last.length) { parts[parts.length - 1] = common; inp.value = parts.join(" "); } else echo(cands.join("  "));
    }
    inp.addEventListener("keydown", e => {
      if (e.key === "Enter") { const v = inp.value; inp.value = ""; run(v); }
      else if (e.key === "ArrowUp") { e.preventDefault(); if (st.hist.length) { st.hi = st.hi < 0 ? st.hist.length - 1 : Math.max(0, st.hi - 1); inp.value = st.hist[st.hi]; } }
      else if (e.key === "ArrowDown") { e.preventDefault(); if (st.hi >= 0) { st.hi = st.hi + 1 >= st.hist.length ? -1 : st.hi + 1; inp.value = st.hi < 0 ? "" : st.hist[st.hi]; } }
      else if (e.key === "Tab") { e.preventDefault(); complete(); }
      else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); CMDS.clear(); }
      else if (e.key === "c" && e.ctrlKey && !getSelection().toString()) { e.preventDefault(); print(`<span class="tm-echo">${ps.innerHTML}${esc(inp.value)}^C</span>`); inp.value = ""; }
      else if (e.key === "u" && e.ctrlKey) { e.preventDefault(); inp.value = ""; }
      else if (e.key === "d" && e.ctrlKey && !inp.value) { e.preventDefault(); win.close(); }
    });
    print(`<span class="hl">MemeOS</span> shell 1.0  -  type <span class="hl">help</span> for commands, <span class="hl">neofetch</span> for the obligatory screenshot.`);
    prompt();
    if (args.run) run(args.run);
    win.on("focus", () => inp.focus());
    setTimeout(() => inp.focus(), 50);
  },
});
