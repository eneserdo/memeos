// Virtual file system: a tree of nodes persisted in IndexedDB (binary files as Blobs), with a trash can.
// Paths are POSIX-like ("/home/pepe/Memes/Doge.jpg"); "~" expands to the home directory.
import { bus } from "./bus.js";

const DB = "memeos", STORE = "nodes", HOME = "/home/pepe", TRASH = "/.trash";
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const MIME = {
  txt: "text/plain", md: "text/markdown", json: "application/json", js: "text/javascript", css: "text/css", html: "text/html",
  meme: "text/x-memesis", csv: "text/csv", log: "text/plain", ini: "text/plain", sh: "text/x-shellscript", py: "text/x-python",
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml", bmp: "image/bmp",
  app: "application/x-memeos-app", url: "application/x-memeos-link",
};
export const ext = n => (n.lastIndexOf(".") > 0 ? n.slice(n.lastIndexOf(".") + 1).toLowerCase() : "");
export const mimeOf = n => MIME[ext(n)] || "application/octet-stream";
export const isImage = n => (n.mime || mimeOf(n.name)).startsWith("image/");
export const isText = n => { const m = n.mime || mimeOf(n.name); return m.startsWith("text/") || m === "application/json"; };
export const basename = p => p.replace(/\/+$/, "").split("/").pop() || "/";
export const dirname = p => { const s = p.replace(/\/+$/, ""); const i = s.lastIndexOf("/"); return i <= 0 ? "/" : s.slice(0, i); };
export const join = (...p) => normalize(p.join("/"));
export function normalize(p) {
  if (!p) return "/";
  if (p === "~" || p.startsWith("~/")) p = HOME + p.slice(1);
  const out = [];
  for (const part of p.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") out.pop(); else out.push(part);
  }
  return "/" + out.join("/");
}
export const fmtSize = b => b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : b < 1073741824 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1073741824).toFixed(2)} GB`;

function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" }); };
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
const tx = (db, mode, fn) => new Promise((res, rej) => {
  const t = db.transaction(STORE, mode), s = t.objectStore(STORE); let out;
  try { out = fn(s); } catch (e) { rej(e); }
  t.oncomplete = () => res(out && "result" in out ? out.result : out);
  t.onerror = () => rej(t.error); t.onabort = () => rej(t.error);
});

class FileSystem {
  constructor() { this.nodes = new Map(); this.children = new Map(); this.db = null; this.urls = new Map(); this.HOME = HOME; this.TRASH = TRASH; this.ready = false; }

  async init(seed) {
    try { this.db = await idb(); } catch (e) { console.warn("IndexedDB unavailable, running in memory", e); this.db = null; }
    let all = [];
    if (this.db) all = await tx(this.db, "readonly", s => s.getAll());
    if (!all.length) {
      this._add({ id: "root", parent: null, name: "", type: "dir", created: Date.now(), modified: Date.now() });
      if (seed) await seed(this);
      await this._persistAll();
    } else {
      all.forEach(n => this._add(n));
    }
    this.ready = true;
    bus.emit("fs:ready");
    return this;
  }
  _add(n) {
    this.nodes.set(n.id, n);
    if (n.parent !== null) (this.children.get(n.parent) || this.children.set(n.parent, new Set()).get(n.parent)).add(n.id);
  }
  _detach(n) { this.children.get(n.parent)?.delete(n.id); }
  async _put(n) { if (this.db) await tx(this.db, "readwrite", s => s.put(n)); }
  async _del(id) { if (this.db) await tx(this.db, "readwrite", s => s.delete(id)); }
  async _persistAll() { if (this.db) await tx(this.db, "readwrite", s => { this.nodes.forEach(n => s.put(n)); }); }

  // --- lookup
  childByName(parentId, name) {
    for (const id of this.children.get(parentId) || []) { const n = this.nodes.get(id); if (n.name === name) return n; }
    return null;
  }
  resolve(path) {
    const p = normalize(path); let cur = this.nodes.get("root");
    if (p === "/") return cur;
    for (const part of p.slice(1).split("/")) { cur = this.childByName(cur.id, part); if (!cur) return null; }
    return cur;
  }
  pathOf(n) { const parts = []; while (n && n.parent !== null) { parts.unshift(n.name); n = this.nodes.get(n.parent); } return "/" + parts.join("/"); }
  exists(path) { return !!this.resolve(path); }
  stat(path) { const n = this.resolve(path); if (!n) throw new Error(`No such file or directory: ${path}`); return n; }
  isDir(path) { return this.resolve(path)?.type === "dir"; }
  list(path, { hidden = true } = {}) {
    const n = this.stat(path); if (n.type !== "dir") throw new Error(`Not a directory: ${path}`);
    const out = [...(this.children.get(n.id) || [])].map(id => this.nodes.get(id)).filter(c => hidden || !c.name.startsWith("."));
    return out.sort((a, b) => (a.type === b.type ? a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }) : a.type === "dir" ? -1 : 1));
  }
  uniqueName(parentId, name) {
    if (!this.childByName(parentId, name)) return name;
    const e = ext(name), base = e ? name.slice(0, -(e.length + 1)) : name;
    for (let i = 2; ; i++) { const cand = `${base} (${i})${e ? "." + e : ""}`; if (!this.childByName(parentId, cand)) return cand; }
  }
  static validName(name) {
    if (!name || name === "." || name === "..") return "Name cannot be empty.";
    if (/[\/\\:*?"<>|\u0000-\u001f]/.test(name)) return 'A name cannot contain / \\ : * ? " < > |';
    if (name.length > 120) return "Name is too long.";
    return null;
  }

  // --- create
  async mkdir(path, { recursive = false } = {}) {
    const p = normalize(path);
    if (this.resolve(p)) { const n = this.resolve(p); if (n.type === "dir" && recursive) return n; throw new Error(`File exists: ${p}`); }
    const parentPath = dirname(p); let parent = this.resolve(parentPath);
    if (!parent) { if (!recursive) throw new Error(`No such directory: ${parentPath}`); parent = await this.mkdir(parentPath, { recursive: true }); }
    if (parent.type !== "dir") throw new Error(`Not a directory: ${parentPath}`);
    const err = FileSystem.validName(basename(p)); if (err) throw new Error(err);
    const n = { id: uid(), parent: parent.id, name: basename(p), type: "dir", created: Date.now(), modified: Date.now() };
    this._add(n); await this._put(n); this._touch(parent);
    bus.emit("fs", { op: "create", path: p, node: n }); return n;
  }
  async writeFile(path, content, { mime, ref, size, meta } = {}) {
    const p = normalize(path), parent = this.resolve(dirname(p));
    if (!parent || parent.type !== "dir") throw new Error(`No such directory: ${dirname(p)}`);
    const name = basename(p), err = FileSystem.validName(name); if (err) throw new Error(err);
    let n = this.childByName(parent.id, name);
    if (n && n.type === "dir") throw new Error(`Is a directory: ${p}`);
    const isNew = !n;
    n = n || { id: uid(), parent: parent.id, name, type: "file", created: Date.now() };
    n.mime = mime || n.mime || mimeOf(name); n.modified = Date.now();
    if (ref) { n.ref = ref; delete n.content; n.size = size ?? 0; }
    else { n.content = content ?? ""; delete n.ref; n.size = content instanceof Blob ? content.size : new TextEncoder().encode(String(content ?? "")).length; }
    if (meta) n.meta = { ...(n.meta || {}), ...meta };
    this.urls.delete(n.id);
    if (isNew) this._add(n);
    await this._put(n); this._touch(parent);
    bus.emit("fs", { op: isNew ? "create" : "write", path: p, node: n }); return n;
  }
  async importFile(dirPath, file) {        // File/Blob from the real OS
    const parent = this.stat(dirPath), name = this.uniqueName(parent.id, file.name || "file");
    return this.writeFile(join(dirPath, name), file, { mime: file.type || mimeOf(name) });
  }

  // --- read
  async readText(path) {
    const n = this.stat(path); if (n.type === "dir") throw new Error(`Is a directory: ${path}`);
    if (n.ref) return (await fetch(n.ref)).text();
    if (n.content instanceof Blob) return n.content.text();
    return String(n.content ?? "");
  }
  async blob(node) {
    if (node.ref) return (await fetch(node.ref)).blob();
    if (node.content instanceof Blob) return node.content;
    return new Blob([String(node.content ?? "")], { type: node.mime || "text/plain" });
  }
  url(node) {   // a URL usable in <img src>: asset path for seeded files, object URL for stored blobs
    if (node.ref) return node.ref;
    if (this.urls.has(node.id)) return this.urls.get(node.id);
    const u = node.content instanceof Blob ? URL.createObjectURL(node.content) : "data:" + (node.mime || "text/plain") + "," + encodeURIComponent(String(node.content ?? ""));
    this.urls.set(node.id, u); return u;
  }

  // --- modify
  _touch(n) { n.modified = Date.now(); this._put(n); }
  async rename(path, newName) {
    const n = this.stat(path), err = FileSystem.validName(newName); if (err) throw new Error(err);
    if (n.parent === null) throw new Error("Cannot rename the root.");
    if (newName === n.name) return n;
    if (this.childByName(n.parent, newName)) throw new Error(`"${newName}" already exists here.`);
    const old = this.pathOf(n); n.name = newName; n.modified = Date.now(); if (n.type === "file") n.mime = mimeOf(newName);
    await this._put(n); bus.emit("fs", { op: "rename", path: this.pathOf(n), from: old, node: n }); return n;
  }
  _isAncestor(a, b) { let c = b; while (c) { if (c.id === a.id) return true; c = this.nodes.get(c.parent); } return false; }
  async move(path, destDir, { rename = true } = {}) {
    const n = this.stat(path), d = this.stat(destDir);
    if (d.type !== "dir") throw new Error(`Not a directory: ${destDir}`);
    if (n.parent === null) throw new Error("Cannot move the root.");
    if (this._isAncestor(n, d)) throw new Error("Cannot move a folder into itself.");
    if (n.parent === d.id) return n;
    const old = this.pathOf(n);
    const clash = this.childByName(d.id, n.name);
    if (clash) { if (!rename) throw new Error(`"${n.name}" already exists in ${destDir}.`); n.name = this.uniqueName(d.id, n.name); }
    this._detach(n); n.parent = d.id; this._add(n); n.modified = Date.now();
    await this._put(n); this._touch(d);
    bus.emit("fs", { op: "move", path: this.pathOf(n), from: old, node: n }); return n;
  }
  async copy(path, destDir) {
    const n = this.stat(path), d = this.stat(destDir);
    if (d.type !== "dir") throw new Error(`Not a directory: ${destDir}`);
    if (this._isAncestor(n, d) && n.type === "dir") throw new Error("Cannot copy a folder into itself.");
    const clone = async (src, parentId, name) => {
      const c = { ...src, id: uid(), parent: parentId, name, created: Date.now(), modified: Date.now() };
      delete c.meta; this._add(c); await this._put(c);
      if (src.type === "dir") for (const ch of this.list(this.pathOf(src))) await clone(ch, c.id, ch.name);
      return c;
    };
    const c = await clone(n, d.id, this.uniqueName(d.id, n.name)); this._touch(d);
    bus.emit("fs", { op: "copy", path: this.pathOf(c), from: path, node: c }); return c;
  }
  async remove(path) {       // permanent
    const n = this.stat(path); if (n.parent === null) throw new Error("Cannot delete the root.");
    const p = this.pathOf(n);
    const walk = async m => { if (m.type === "dir") for (const id of [...(this.children.get(m.id) || [])]) await walk(this.nodes.get(id)); this._detach(m); this.nodes.delete(m.id); this.children.delete(m.id); const u = this.urls.get(m.id); if (u && u.startsWith("blob:")) URL.revokeObjectURL(u); this.urls.delete(m.id); await this._del(m.id); };
    const parent = this.nodes.get(n.parent); await walk(n); this._touch(parent);
    bus.emit("fs", { op: "remove", path: p }); return true;
  }
  async trash(path) {
    const n = this.stat(path), p = this.pathOf(n);
    if (p === TRASH || p === HOME || p === "/home" || p === "/system") throw new Error("This folder cannot be deleted.");
    if (p.startsWith(TRASH + "/")) return this.remove(p);
    const bin = this.resolve(TRASH) || await this.mkdir(TRASH);
    n.meta = { ...(n.meta || {}), origPath: p, trashedAt: Date.now() };
    await this.move(p, TRASH);
    bus.emit("fs", { op: "trash", path: p, node: n }); return n;
  }
  async restore(path) {
    const n = this.stat(path), orig = n.meta?.origPath || join(HOME, "Desktop", n.name);
    let dir = dirname(orig); if (!this.resolve(dir)) await this.mkdir(dir, { recursive: true });
    n.name = basename(orig); delete n.meta.origPath; delete n.meta.trashedAt;
    await this.move(path, dir);
    bus.emit("fs", { op: "restore", path: this.pathOf(n), node: n }); return n;
  }
  async emptyTrash() { for (const c of this.list(TRASH)) await this.remove(this.pathOf(c)); bus.emit("fs", { op: "empty", path: TRASH }); }
  trashCount() { return this.resolve(TRASH) ? (this.children.get(this.resolve(TRASH).id)?.size || 0) : 0; }

  // --- info
  sizeOf(n) { if (n.type === "file") return n.size || 0; let s = 0; for (const id of this.children.get(n.id) || []) s += this.sizeOf(this.nodes.get(id)); return s; }
  countOf(n) { let f = 0, d = 0; const walk = m => { for (const id of this.children.get(m.id) || []) { const c = this.nodes.get(id); if (c.type === "dir") { d++; walk(c); } else f++; } }; walk(n); return { files: f, dirs: d }; }
  usage() { return this.sizeOf(this.nodes.get("root")); }
  search(query, root = "/") {
    const q = query.toLowerCase(), out = [], walk = m => { for (const id of this.children.get(m.id) || []) { const c = this.nodes.get(id); if (c.name.toLowerCase().includes(q)) out.push(c); if (c.type === "dir") walk(c); } };
    walk(this.stat(root)); return out;
  }
  async wipe() {
    if (this.db) { await tx(this.db, "readwrite", s => s.clear()); }
    this.nodes.clear(); this.children.clear(); this.urls.clear();
  }
}

export const fs = new FileSystem();
