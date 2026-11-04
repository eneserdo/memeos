// UI sounds synthesised with WebAudio (no audio files). Volume and mute come from settings.
import { settings } from "./settings.js";

let ctx = null;
function ac() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === "suspended") ctx.resume().catch(() => {});
  return ctx;
}

function tone(freq, { t = 0, dur = .12, type = "sine", gain = .25, slide = 0 } = {}) {
  const c = ac(); if (!c) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, c.currentTime + t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq + slide), c.currentTime + t + dur);
  const v = gain * (settings.get("volume") ?? .5);
  g.gain.setValueAtTime(0, c.currentTime + t);
  g.gain.linearRampToValueAtTime(v, c.currentTime + t + .01);
  g.gain.exponentialRampToValueAtTime(.0001, c.currentTime + t + dur);
  o.connect(g).connect(c.destination);
  o.start(c.currentTime + t); o.stop(c.currentTime + t + dur + .02);
}

const SOUNDS = {
  startup() { tone(392, { dur: .5, gain: .18 }); tone(523, { t: .12, dur: .5, gain: .18 }); tone(659, { t: .24, dur: .6, gain: .18 }); tone(784, { t: .36, dur: .9, gain: .15 }); },
  notify() { tone(880, { dur: .09, gain: .2 }); tone(1174, { t: .09, dur: .16, gain: .2 }); },
  error() { tone(220, { dur: .18, type: "square", gain: .08 }); tone(174, { t: .16, dur: .22, type: "square", gain: .08 }); },
  trash() { tone(300, { dur: .12, type: "triangle", gain: .15, slide: -200 }); },
  click() { tone(1500, { dur: .03, gain: .06 }); },
  open() { tone(600, { dur: .08, gain: .08, slide: 300 }); },
  close() { tone(700, { dur: .08, gain: .08, slide: -300 }); },
  achievement() { [523, 659, 784, 1046].forEach((f, i) => tone(f, { t: i * .08, dur: .25, gain: .18 })); },
  boom() { tone(80, { dur: .6, type: "sawtooth", gain: .25, slide: -60 }); },
  flag() { tone(1000, { dur: .05, type: "triangle", gain: .1 }); },
  win() { [659, 784, 1046, 1318].forEach((f, i) => tone(f, { t: i * .1, dur: .3, gain: .18 })); },
  shutdown() { tone(784, { dur: .4, gain: .15 }); tone(523, { t: .18, dur: .5, gain: .15 }); tone(392, { t: .36, dur: .8, gain: .12 }); },
  type() { tone(2200, { dur: .015, gain: .02 }); },
};

export const sound = new Proxy({}, {
  get: (_, name) => (...a) => { if (settings.get("sounds") && SOUNDS[name]) try { SOUNDS[name](...a); } catch {} },
});
export function unlockAudio() { ac(); }
