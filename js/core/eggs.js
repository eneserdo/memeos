// Achievements and easter eggs. Everything here is optional fun layered on the real system.
import { bus } from "./bus.js";
import { el, toast } from "./ui.js";
import { sound } from "./sound.js";

export const ACHIEVEMENTS = [
  { id: "boot", title: "Hello world", desc: "Booted MemeOS for the first time.", hint: "You already did this.", img: "assets/memes/successkid.jpg" },
  { id: "trash", title: "Into the void", desc: "Sent a file to the Recycle Bin.", hint: "Delete something. It is not gone.", img: "assets/memes/sadpablo.jpg" },
  { id: "restore", title: "Undo culture", desc: "Restored a file from the Recycle Bin.", hint: "Regret is a feature.", img: "assets/memes/rollsafe.jpg" },
  { id: "empty", title: "No witnesses", desc: "Emptied the Recycle Bin.", hint: "Make it permanent.", img: "assets/memes/disastergirl.jpg" },
  { id: "import", title: "Smuggler", desc: "Imported a file from your real computer.", hint: "Drag a picture from your desktop into Files.", img: "assets/memes/distracted.jpg" },
  { id: "meme", title: "Content creator", desc: "Saved a meme from Meme Factory.", hint: "Impact font. White text. Black outline.", img: "assets/memes/drake.jpg" },
  { id: "wallpaper", title: "Interior design", desc: "Set a picture as wallpaper.", hint: "Right-click a picture.", img: "assets/memes/changemymind.jpg" },
  { id: "terminal", title: "Hackerman", desc: "Ran ten commands in the Terminal.", hint: "ls is a command.", img: "assets/memes/hackerman.jpg" },
  { id: "neofetch", title: "System aesthetic", desc: "Ran neofetch.", hint: "Every Linux user does it.", img: "assets/memes/morpheus.jpg" },
  { id: "rmrf", title: "Speedrun any%", desc: "Tried to delete the whole file system.", hint: "The forbidden command.", img: "assets/memes/thisisfine.jpg" },
  { id: "sudo", title: "Not in the sudoers file", desc: "Tried sudo.", hint: "This incident will be reported.", img: "assets/memes/batman.jpg" },
  { id: "konami", title: "Up up down down", desc: "Entered the Konami code on the desktop.", hint: "B A, start.", img: "assets/memes/nyancat.jpg" },
  { id: "doge", title: "Much type", desc: "Typed the name of the dog.", hint: "Four letters, on the desktop.", img: "assets/memes/doge.jpg" },
  { id: "calc", title: "Nice", desc: "Typed the number everyone types on a calculator.", hint: "Turn it upside down.", img: "assets/memes/spongebob.jpg" },
  { id: "sweeper", title: "Minesweeper, but dog", desc: "Won a game of Doge Sweeper.", hint: "Flags are free.", img: "assets/memes/stonks.jpg" },
  { id: "taskkill", title: "Task failed successfully", desc: "Ended a task from the Task Manager.", hint: "Something is not responding. Nothing is. Kill it anyway.", img: "assets/memes/fry.jpg" },
  { id: "snap", title: "Tidy", desc: "Snapped a window to the side of the screen.", hint: "Drag a window into the edge.", img: "assets/memes/handshake.jpg" },
  { id: "secret", title: "Curiosity", desc: "Opened the file that said not to.", hint: "Hidden files are hidden for a reason. Show them anyway.", img: "assets/memes/pepesilvia.jpg" },
  { id: "screensaver", title: "AFK", desc: "Watched the screensaver hit a corner.", hint: "Go touch grass for two minutes.", img: "assets/memes/touchgrass.jpg" },
  { id: "shutdown", title: "Goodnight", desc: "Shut the computer down properly.", hint: "Like a responsible adult.", img: "assets/memes/sleepingshaq.jpg" },
  { id: "all", title: "Completionist", desc: "Found every other achievement.", hint: "All of them.", img: "assets/memes/dicaprio.jpg" },
];
const KEY = "memeos.achievements";
export const unlocked = new Set(JSON.parse(localStorage.getItem(KEY) || "[]"));
export function achieve(id) {
  if (unlocked.has(id)) return false;
  const a = ACHIEVEMENTS.find(x => x.id === id); if (!a) return false;
  unlocked.add(id); localStorage.setItem(KEY, JSON.stringify([...unlocked]));
  sound.achievement();
  toast({ title: "Achievement unlocked: " + a.title, body: a.desc, img: a.img, app: "Achievements", silent: true, timeout: 6000, onclick: () => import("./apps.js").then(m => m.launch("achievements")) });
  bus.emit("achievement", a);
  if (!unlocked.has("all") && ACHIEVEMENTS.every(x => x.id === "all" || unlocked.has(x.id))) setTimeout(() => achieve("all"), 1500);
  return true;
}
export function resetAchievements() { unlocked.clear(); localStorage.removeItem(KEY); }

// --- key sequences on the desktop (not inside inputs or windows)
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];
let buf = [];
export function initEggs() {
  addEventListener("keydown", e => {
    if (e.target.closest?.("input, textarea, [contenteditable], .win")) return;
    buf.push(e.key.length === 1 ? e.key.toLowerCase() : e.key); if (buf.length > 12) buf.shift();
    if (buf.slice(-10).join() === KONAMI.join()) { buf = []; achieve("konami"); dogeRain(); }
    const w = buf.filter(k => k.length === 1).join("");
    if (w.endsWith("doge")) { buf = []; achieve("doge"); wowMode(); }
  });
  initScreensaver();
}

export function dogeRain(n = 60) {
  const layer = el("div", { class: "doge-rain" }); document.body.append(layer);
  for (let i = 0; i < n; i++) {
    const d = el("img", { src: "assets/memes/doge.jpg", alt: "", style: { left: Math.random() * 100 + "vw", animationDelay: Math.random() * 2.5 + "s", animationDuration: 2.5 + Math.random() * 2 + "s", width: 40 + Math.random() * 60 + "px", "--rot": Math.random() * 720 - 360 + "deg" } });
    layer.append(d);
  }
  setTimeout(() => layer.remove(), 6000);
}
export function wowMode() {
  document.documentElement.classList.add("wow");
  const words = ["wow", "such os", "very window", "much file", "so desktop", "many app", "wow", "such taskbar", "very click", "so persistent"];
  const layer = el("div", { class: "wow-layer" }); document.body.append(layer);
  words.forEach((w, i) => setTimeout(() => layer.append(el("span", { class: "wow-word", text: w, style: { left: 5 + Math.random() * 80 + "vw", top: 5 + Math.random() * 80 + "vh", color: `hsl(${Math.random() * 360} 90% 60%)` } })), i * 350));
  setTimeout(() => { layer.remove(); document.documentElement.classList.remove("wow"); }, 7000);
}

// --- blue screen (nothing is harmed)
export function bluescreen(reason = "CRITICAL_PROCESS_DIED") {
  return new Promise(res => {
    sound.boom();
    const s = el("div", { class: "bsod" },
      el("div", { class: "bsod-face", text: ":(" }),
      el("div", { class: "bsod-text" },
        el("p", { text: "Your PC ran into a problem that it could not handle, and now it needs to restart. Nothing was actually deleted. This is a web page." }),
        el("p", { class: "bsod-pct", text: "0% complete" }),
        el("div", { class: "bsod-qr" }, el("img", { src: "assets/memes/doge.jpg", alt: "" }), el("div", {}, el("small", { text: "For more information about this issue and possible fixes, ask the dog." }), el("small", { text: "Stop code: " + reason }), el("small", { text: "What failed: much.sys" })))));
    document.body.append(s);
    let p = 0; const t = setInterval(() => { p = Math.min(100, p + Math.floor(Math.random() * 18)); s.querySelector(".bsod-pct").textContent = p + "% complete"; if (p >= 100) { clearInterval(t); setTimeout(() => { s.remove(); res(); }, 900); } }, 350);
  });
}

// --- screensaver: the bouncing logo, after two idle minutes
function initScreensaver() {
  let idle = 0, active = false;
  const reset = () => { idle = 0; };
  ["pointermove", "pointerdown", "keydown", "wheel"].forEach(ev => addEventListener(ev, reset, true));
  setInterval(() => { if (document.getElementById("os").classList.contains("locked") || document.getElementById("os").classList.contains("hidden")) return; idle++; if (idle >= 120 && !active) start(); }, 1000);
  function start() {
    active = true;
    const s = el("div", { class: "saver" }), logo = el("img", { src: "assets/logo.svg", alt: "", class: "saver-logo" }); s.append(logo); document.body.append(s);
    let x = 100, y = 100, vx = 2.4, vy = 1.9, hits = 0, w = 140;
    const memes = ["doge", "smugpepe", "trollface", "pikachu", "grumpycat", "nyancat", "stonks", "harold", "wojak", "cheems"];
    let raf; const step = () => {
      x += vx; y += vy; let corner = false, hit = false;
      if (x <= 0 || x + w >= innerWidth) { vx = -vx; hit = true; x = Math.max(0, Math.min(innerWidth - w, x)); }
      if (y <= 0 || y + w >= innerHeight) { vy = -vy; hit = hit ? (corner = true) || true : true; y = Math.max(0, Math.min(innerHeight - w, y)); }
      if (hit) { hits++; const m = memes[hits % memes.length]; logo.src = `assets/memes/${m}.jpg`; logo.style.filter = `hue-rotate(0deg)`; if (corner) { achieve("screensaver"); s.classList.add("corner"); setTimeout(() => s.classList.remove("corner"), 1200); } }
      logo.style.transform = `translate(${x}px, ${y}px)`; raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    const stop = () => { cancelAnimationFrame(raf); s.remove(); active = false; idle = 0; ["pointermove", "pointerdown", "keydown"].forEach(ev => removeEventListener(ev, stop, true)); };
    setTimeout(() => ["pointermove", "pointerdown", "keydown"].forEach(ev => addEventListener(ev, stop, true)), 500);
  }
}
