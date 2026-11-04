// Lock, sleep, restart, shut down.
import { el, fmtTime, fmtLongDate } from "../core/ui.js";
import { sound } from "../core/sound.js";
import { settings } from "../core/settings.js";
import { bus } from "../core/bus.js";
import { achieve } from "../core/eggs.js";

let lockTimer = null;
function tickLock() { const d = new Date(); document.querySelector("#lock .lock-clock").textContent = fmtTime(d); document.querySelector("#lock .lock-date").textContent = fmtLongDate(d); }

export const power = {
  lock(first = false) {
    const lock = document.getElementById("lock");
    lock.querySelector(".lock-avatar").src = settings.get("avatar"); lock.querySelector(".lock-name").textContent = settings.get("user");
    lock.querySelector(".lock-btn").textContent = first ? "Sign in" : "Unlock";
    lock.style.backgroundImage = getComputedStyle(document.getElementById("wallpaper")).backgroundImage;
    tickLock(); lockTimer = setInterval(tickLock, 1000);
    lock.classList.remove("hidden"); lock.classList.remove("unlocking");
    document.getElementById("os").classList.add("locked");
    bus.emit("locked");
    return new Promise(res => {
      const go = e => { if (e.type === "keydown" && e.key !== "Enter" && e.key !== " ") return; e.preventDefault?.(); lock.removeEventListener("click", go); removeEventListener("keydown", go); lock.classList.add("unlocking"); clearInterval(lockTimer);
        setTimeout(() => { lock.classList.add("hidden"); document.getElementById("os").classList.remove("locked"); bus.emit("unlocked"); res(); }, 450); };
      setTimeout(() => { lock.addEventListener("click", go); addEventListener("keydown", go); }, 200);
    });
  },
  sleep() {
    const o = el("div", { class: "sleep-screen" }); document.body.append(o); bus.emit("locked");
    requestAnimationFrame(() => o.classList.add("in"));
    const wake = () => { removeEventListener("keydown", wake); removeEventListener("pointerdown", wake); o.classList.remove("in"); setTimeout(() => o.remove(), 500); bus.emit("unlocked"); };
    setTimeout(() => { addEventListener("keydown", wake); addEventListener("pointerdown", wake); }, 600);
  },
  async restart() { await fadeOut("Restarting"); location.reload(); },
  async shutdown() {
    await fadeOut("Shutting down"); achieve("shutdown");
    const s = el("div", { class: "off-screen" }, el("div", { class: "off-text" }, el("b", { text: "It is now safe to close this tab." }), el("span", { text: "Or turn the computer back on." })), el("button", { class: "btn primary", text: "Turn on", onclick: () => location.reload() }));
    document.body.innerHTML = ""; document.body.append(s);
  },
};
function fadeOut(text) {
  sound.shutdown();
  const o = el("div", { class: "fade-screen" }, el("div", { class: "spin" }), el("span", { text: text }));
  document.body.append(o); requestAnimationFrame(() => o.classList.add("in"));
  return new Promise(r => setTimeout(r, 1300));
}
