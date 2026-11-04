// Boot sequence: settings, file system, shell, apps, lock screen, desktop.
import { settings } from "./core/settings.js";
import { fs } from "./core/fs.js";
import { seed } from "./core/seed.js";
import { bus } from "./core/bus.js";
import { sound, unlockAudio } from "./core/sound.js";
import { toast, contextMenu, sleep } from "./core/ui.js";
import { wins } from "./core/wm.js";
import { launch, openFile, APPS } from "./core/apps.js";
import { achieve, initEggs, dogeRain, wowMode, bluescreen } from "./core/eggs.js";
import { initDesktop } from "./shell/desktop.js";
import { initTaskbar } from "./shell/taskbar.js";
import { initStart } from "./shell/start.js";
import { initFlyouts } from "./shell/flyouts.js";
import { initShortcuts } from "./shell/shortcuts.js";
import { power } from "./shell/power.js";
import "./apps/files.js"; import "./apps/notepad.js"; import "./apps/terminal.js"; import "./apps/photos.js"; import "./apps/taskman.js";
import "./apps/settings.js"; import "./apps/calc.js"; import "./apps/factory.js"; import "./apps/sweeper.js"; import "./apps/surf.js"; import "./apps/misc.js";

const q = new URLSearchParams(location.search);
const fast = q.has("fast");                 // ?fast skips the boot animation (screenshots, tests)

async function boot() {
  settings.apply();
  const bar = document.querySelector(".boot-fill"), msg = document.querySelector(".boot-msg");
  const steps = ["Starting MemeOS", "Mounting file system", "Loading memes", "Waking up the dog", "Almost there"];
  const prog = (i) => { bar.style.width = ((i + 1) / steps.length * 100) + "%"; msg.textContent = steps[i]; };
  prog(0); if (!fast) await sleep(500);
  prog(1); await fs.init(seed); if (!fast) await sleep(350);
  prog(2); initDesktop(); initTaskbar(); initStart(); initFlyouts(); initShortcuts(); initEggs(); if (!fast) await sleep(350);
  prog(3); if (!fast) await sleep(350);
  prog(4); if (!fast) await sleep(250);
  document.getElementById("boot").classList.add("out"); await sleep(fast ? 0 : 400); document.getElementById("boot").classList.add("hidden");
  document.getElementById("os").classList.remove("hidden");
  bus.emit("boot");
  if (!q.has("nolock")) await power.lock(true);
  unlockAudio(); sound.startup();
  const first = settings.get("firstRun");
  if (first) {
    settings.set("firstRun", false);
    setTimeout(() => achieve("boot"), 900);
    setTimeout(() => toast({ title: "Welcome to MemeOS", body: "Everything here is real: files persist, the terminal works, the task manager measures. Start with the text file on the desktop.", img: "assets/memes/successkid.jpg", timeout: 9000, app: "MemeOS", onclick: () => openFile("/home/pepe/Desktop/Read me first.txt") }), 1500);
  }
  // window title-bar context menu (wm emits it, the shell decides what is in it)
  bus.on("win:menu", (w, x, y) => contextMenu(x, y, [{ label: w.state === "max" ? "Restore" : "Maximize", icon: w.state === "max" ? "restore" : "square", disabled: !w.resizable, action: () => w.toggleMax() }, { label: "Minimize", icon: "minus", action: () => w.minimize() },
    { label: "Snap left", icon: "chevronL", key: "Alt+Left", disabled: !w.resizable, action: () => { w.snap("left"); achieve("snap"); } }, { label: "Snap right", icon: "chevronR", key: "Alt+Right", disabled: !w.resizable, action: () => { w.snap("right"); achieve("snap"); } }, { sep: true }, { label: "Close", icon: "x", key: "Alt+X", action: () => w.close() }]));
  // auto-open from the URL: ?open=terminal,files
  if (q.get("open")) for (const id of q.get("open").split(",")) if (APPS.has(id)) launch(id);
  window.memeos = { fs, settings, wins, launch, openFile, bus, APPS, achieve, eggs: { dogeRain, wowMode, bluescreen } };   // for the curious (and for tests)
}
boot().catch(e => { console.error(e); document.querySelector(".boot-msg").textContent = "Boot failed: " + e.message; });
