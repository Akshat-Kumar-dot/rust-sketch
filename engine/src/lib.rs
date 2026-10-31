//! ink-engine: YOUR file. The frontend already calls into this.
//!
//! Save this file while `npm run dev` is running and the page rebuilds
//! the WASM and reloads, re-smoothing every stroke you already drew.
//!
//! Data layout (flat arrays, because per-point objects are slow over WASM):
//!     [x, y, pressure, time_ms,  x, y, pressure, time_ms,  ...]
//!     x, y   = CSS pixels on the canvas
//!     pressure = 0.0..1.0 (mouse gives 0.5 while pressed)
//!     time_ms = milliseconds (from the pointer event)

use wasm_bindgen::prelude::*;

/// Number of f32 values per sample.
pub const STRIDE: usize = 4;

/// Runs once when the WASM loads: makes Rust panics readable in the browser console.
#[wasm_bindgen(start)]
pub fn start() {
    console_error_panic_hook::set_once();
}

/// Shown in the status pill at the top of the page.
/// Edit this string, save, and watch it change: proves the live rebuild works.
#[wasm_bindgen]
pub fn engine_info() -> String {
    "ink-engine v0 (passthrough)".to_string()
}

/// Called by the frontend:
///   - once when you lift the pen (final stroke)
///   - every frame while drawing, if "smooth while drawing" is on
///   - for every saved stroke each time the page reloads
///
/// Input and output use the same layout (see top of file).
/// The output may have more or fewer points than the input.
///
/// TODO: replace this passthrough with your smoothing
/// (One Euro filter, Chaikin, curve fitting, ...).
#[wasm_bindgen]
pub fn smooth_stroke(input: &[f32]) -> Vec<f32> {
    let n = input.len() / STRIDE;          // number of samples
    if n < 3 { return input.to_vec(); }    // too short to smooth

    let mut out = Vec::with_capacity(input.len());
    for i in 0..n {
        let lo = i.saturating_sub(1);      // previous index, stops at 0
        let hi = (i + 1).min(n - 1);       // next index, stops at the end
        let mut x = 0.0; let mut y = 0.0;
        for j in lo..=hi {
            x += input[j * STRIDE]+1000.0;
            y += input[j * STRIDE + 1]+0.0;
        }
        let count = (hi - lo + 1) as f32;
        out.push(x / count);               // smoothed x
        out.push(y / count);               // smoothed y
        out.push(input[i * STRIDE + 2]);   // keep pressure
        out.push(input[i * STRIDE + 3]);   // keep time
    }
    out
}
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn output_is_whole_samples() {
        let input = vec![0.0, 0.0, 0.5, 0.0, 10.0, 5.0, 0.5, 16.0];
        let out = smooth_stroke(&input);
        assert_eq!(out.len() % STRIDE, 0);
    }
}
