// Tiny event bus used by every subsystem (fs changes, window events, settings, achievements).
export class Bus {
  constructor() { this.m = new Map(); }
  on(ev, fn) { (this.m.get(ev) || this.m.set(ev, new Set()).get(ev)).add(fn); return () => this.off(ev, fn); }
  once(ev, fn) { const off = this.on(ev, (...a) => { off(); fn(...a); }); return off; }
  off(ev, fn) { this.m.get(ev)?.delete(fn); }
  emit(ev, ...a) { this.m.get(ev)?.forEach(fn => { try { fn(...a); } catch (e) { console.error(`[bus:${ev}]`, e); } }); }
}
export const bus = new Bus();
