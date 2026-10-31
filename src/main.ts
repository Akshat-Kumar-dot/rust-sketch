import { InkCanvas, type DrawableStroke } from './canvas';
import { loadEngine, type Engine } from './engine';
import { loadOptions, loadStrokes, saveOptions, saveStrokes, type Stroke } from './store';

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const statusEl = $('status');
const colorEl = $<HTMLInputElement>('color');
const sizeEl = $<HTMLInputElement>('size');
const smoothLiveEl = $<HTMLInputElement>('smoothLive');
const showRawEl = $<HTMLInputElement>('showRaw');
const undoBtn = $<HTMLButtonElement>('undo');
const redoBtn = $<HTMLButtonElement>('redo');
const clearBtn = $<HTMLButtonElement>('clear');

function setStatus(text: string, bad = false): void {
  statusEl.textContent = text;
  statusEl.classList.toggle('bad', bad);
  statusEl.title = text;
}

async function main(): Promise<void> {
  const options = loadOptions();
  colorEl.value = options.color;
  sizeEl.value = String(options.size);
  smoothLiveEl.checked = options.smoothLive;
  showRawEl.checked = options.showRaw;

  const canvas = new InkCanvas($('stage'));

  let engine: Engine;
  try {
    engine = await loadEngine();
  } catch (err) {
    setStatus('engine failed to load: run `npm run dev` (it builds the Rust first)', true);
    console.error(err);
    return;
  }
  setStatus(`${engine.info} · loaded ${new Date().toLocaleTimeString()}`);

  let engineError = false;
  const smooth = (raw: ArrayLike<number>): Float32Array => {
    const input = Float32Array.from(raw);
    try {
      const out = engine.smoothStroke(input);
      if (engineError) {
        engineError = false;
        setStatus(`${engine.info} · loaded ${new Date().toLocaleTimeString()}`);
      }
      return out;
    } catch (err) {
      // a Rust panic lands here; draw the raw stroke instead so the app keeps working
      engineError = true;
      setStatus(`Rust error (see console): ${String(err)}`, true);
      console.error('smooth_stroke failed', err);
      return input;
    }
  };

  let strokes: Stroke[] = loadStrokes();
  let redo: Stroke[] = [];
  const smoothed = new Map<number, Float32Array>();

  const drawable = (s: Stroke): DrawableStroke => {
    let pts = smoothed.get(s.id);
    if (!pts) {
      pts = smooth(s.raw);
      smoothed.set(s.id, pts);
    }
    return { color: s.color, width: s.width, pts };
  };

  const redrawAll = () => canvas.renderStatic(strokes.map(drawable));
  const syncButtons = () => {
    undoBtn.disabled = strokes.length === 0;
    redoBtn.disabled = redo.length === 0;
  };

  canvas.setResizeHandler(redrawAll);
  redrawAll();
  syncButtons();

  // ---- drawing ----
  let current: Stroke | null = null;
  let rafPending = false;
  let nextId = strokes.reduce((m, s) => Math.max(m, s.id), 0) + 1;

  const pushSamples = (e: PointerEvent) => {
    if (!current) return;
    const events = e.getCoalescedEvents?.() ?? [];
    for (const ev of events.length ? events : [e]) {
      const { x, y } = canvas.pointFromEvent(ev);
      current.raw.push(x, y, ev.pressure || 0.5, ev.timeStamp);
    }
  };

  const drawCurrent = () => {
    rafPending = false;
    if (!current) return;
    const rawPts = Float32Array.from(current.raw);
    const pts = options.smoothLive ? smooth(rawPts) : rawPts;
    canvas.drawLive({ color: current.color, width: current.width, pts }, options.showRaw ? rawPts : undefined);
  };

  canvas.live.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    canvas.live.setPointerCapture(e.pointerId);
    current = { id: nextId++, color: options.color, width: options.size, raw: [] };
    pushSamples(e);
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(drawCurrent);
    }
  });

  canvas.live.addEventListener('pointermove', (e) => {
    if (!current) return;
    pushSamples(e);
    if (!rafPending) {
      rafPending = true;
      requestAnimationFrame(drawCurrent);
    }
  });

  const finish = (e: PointerEvent) => {
    if (!current) return;
    pushSamples(e);
    const done = current;
    current = null;
    canvas.clearLive();
    if (done.raw.length === 0) return;
    strokes.push(done);
    redo = [];
    canvas.appendStatic(drawable(done));
    saveStrokes(strokes);
    syncButtons();
  };
  canvas.live.addEventListener('pointerup', finish);
  canvas.live.addEventListener('pointercancel', finish);

  // ---- toolbar ----
  const undo = () => {
    const s = strokes.pop();
    if (!s) return;
    redo.push(s);
    redrawAll();
    saveStrokes(strokes);
    syncButtons();
  };
  const redoAction = () => {
    const s = redo.pop();
    if (!s) return;
    strokes.push(s);
    redrawAll();
    saveStrokes(strokes);
    syncButtons();
  };

  undoBtn.onclick = undo;
  redoBtn.onclick = redoAction;
  clearBtn.onclick = () => {
    strokes = [];
    redo = [];
    smoothed.clear();
    redrawAll();
    saveStrokes(strokes);
    syncButtons();
  };

  colorEl.oninput = () => { options.color = colorEl.value; saveOptions(options); };
  sizeEl.oninput = () => { options.size = Number(sizeEl.value); saveOptions(options); };
  smoothLiveEl.onchange = () => { options.smoothLive = smoothLiveEl.checked; saveOptions(options); };
  showRawEl.onchange = () => { options.showRaw = showRawEl.checked; saveOptions(options); };

  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    const k = e.key.toLowerCase();
    if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
    else if ((k === 'z' && e.shiftKey) || k === 'y') { e.preventDefault(); redoAction(); }
  });
}

void main();
