// App registry, launching, file associations.
import { Win, wins } from "./wm.js";
import { fs, isImage, isText, ext } from "./fs.js";
import { errorBox, toast } from "./ui.js";
import { bus } from "./bus.js";

export const APPS = new Map();
export function registerApp(def) { APPS.set(def.id, def); return def; }
export const appList = () => [...APPS.values()].filter(a => !a.hidden);

export function launch(id, args = {}, winOpts = {}) {
  const app = APPS.get(id);
  if (!app) { toast({ title: "App not found", body: `There is no app called "${id}".`, icon: "alert", color: "var(--danger)" }); return null; }
  if (app.single) { const ex = [...wins.values()].find(w => w.app.id === id); if (ex) { ex.focus(); app.reopen?.(ex, args); return ex; } }
  const win = new Win(app, { ...winOpts, title: args.title || app.name });
  try {
    const r = app.mount(win, win.proc, args);
    if (r && typeof r.then === "function") r.catch(e => { console.error(e); errorBox(`${app.name} crashed`, e); });
  } catch (e) { console.error(e); errorBox(`${app.name} crashed`, e); }
  bus.emit("app:launch", app, win);
  return win;
}

export function appForFile(node) {
  const e = ext(node.name);
  if (e === "app") return "run-app";
  if (e === "url") return "surf";
  if (isImage(node)) return "photos";
  if (isText(node) || !e) return "notepad";
  return null;
}
export async function openFile(path, opts = {}) {
  const node = fs.resolve(path);
  if (!node) return errorBox("Open", new Error(`File not found: ${path}`));
  if (node.type === "dir") return launch("files", { path });
  const app = opts.app || appForFile(node);
  if (app === "run-app") { const id = (await fs.readText(path)).trim(); return launch(id); }
  if (!app) { toast({ title: "No app for this file", body: `MemeOS does not know how to open .${ext(node.name)} files. Try Notepad.`, icon: "alert", color: "var(--warn)" }); return null; }
  bus.emit("file:open", path);
  return launch(app, { path, ...opts.args });
}
