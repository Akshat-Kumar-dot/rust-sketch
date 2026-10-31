// Thin wrapper around the Rust WASM module (engine/src/lib.rs).
// To use a new Rust function: mark it #[wasm_bindgen] + pub in lib.rs, save,
// then call it here as `wasm.your_function(...)`. Types come from the generated .d.ts.
import init, * as wasm from './wasm/pkg/ink_engine.js';
import wasmUrl from './wasm/pkg/ink_engine_bg.wasm?url';

export interface Engine {
  info: string;
  /** Flat [x, y, pressure, time_ms, ...] in, same layout out. */
  smoothStroke(raw: Float32Array): Float32Array;
}

export async function loadEngine(): Promise<Engine> {
  // ?v= defeats the browser cache so a rebuilt .wasm is always fetched fresh
  await init({ module_or_path: `${wasmUrl}${wasmUrl.includes('?') ? '&' : '?'}v=${Date.now()}` });

  return {
    info: wasm.engine_info(),
    smoothStroke: (raw) => wasm.smooth_stroke(raw),
  };
}
