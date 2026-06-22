// Tiny event emitter used by the converter's public API (§0).
// Brand-agnostic, no external dependencies.

export class Emitter {
  constructor() {
    /** @type {Map<string, Set<Function>>} */
    this._listeners = new Map();
  }

  on(type, fn) {
    if (!this._listeners.has(type)) this._listeners.set(type, new Set());
    this._listeners.get(type).add(fn);
    return () => this.off(type, fn);
  }

  off(type, fn) {
    this._listeners.get(type)?.delete(fn);
  }

  emit(type, payload) {
    const set = this._listeners.get(type);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        // A listener throwing must never break the pipeline.
        console.error(`[StereoConverter] listener for "${type}" threw`, err);
      }
    }
  }

  clear() {
    this._listeners.clear();
  }
}
