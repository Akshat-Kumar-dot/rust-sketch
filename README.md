# ink-app

Rust ink engine (`engine/`) compiled to WASM + TypeScript canvas frontend (`src/`).
You write the Rust; the frontend already calls it.

## One-time setup
1. Install Rust: https://rustup.rs
2. `cargo install wasm-pack`
3. `npm install`

## Run
```
npm run dev
```
Open the printed URL. Edit `engine/src/lib.rs` and save: the WASM rebuilds and the page
reloads. Your strokes are saved as raw pen samples, so every reload re-smooths them with
your new Rust code. Compile errors show as an overlay in the browser.

- `npm run dev:release` optimized WASM (use this to judge real pen speed; debug builds are slow)
- `npm run test:engine` runs the Rust tests natively (no browser)
- `npm run build` production build

## Contract
`smooth_stroke(&[f32]) -> Vec<f32>` in `engine/src/lib.rs`, flat `[x, y, pressure, time_ms, ...]`
in and out. To add more Rust functions: mark them `#[wasm_bindgen] pub fn`, then call them from
`src/engine.ts` as `wasm.your_function(...)`.

Toolbar: "Smooth while drawing" runs your Rust on the live stroke every frame;
"Show raw (red)" overlays the unsmoothed pen path so you can compare.
