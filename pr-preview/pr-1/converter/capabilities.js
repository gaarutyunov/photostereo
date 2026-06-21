// Capability detection (§4.1 device selection, §10 live readout).
// All checks are real feature probes, never user-agent sniffing.

export function hasWebGPU() {
  return typeof navigator !== 'undefined' && 'gpu' in navigator;
}

export function hasWebGL2() {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

export function hasWebCodecs() {
  return typeof window !== 'undefined' && 'VideoEncoder' in window;
}

// WebAssembly is the universal floor for the local engine.
export function hasWasm() {
  return typeof WebAssembly === 'object';
}

// The depth runtime backend the local engine will request.
export function localBackend() {
  return hasWebGPU() ? 'webgpu' : 'wasm';
}

/**
 * Probe whether the browser can actually create a WebGPU device, not just
 * expose the namespace. Used to give an honest "WebGPU ✓" readout (§10).
 */
export async function probeWebGPU() {
  if (!hasWebGPU()) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) return false;
    const device = await adapter.requestDevice();
    device?.destroy?.();
    return true;
  } catch {
    return false;
  }
}
