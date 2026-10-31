// Two stacked canvases:
//   static layer: finished strokes, redrawn only on load / undo / resize
//   live layer:   the stroke being drawn right now, cleared and redrawn each frame
// This is what keeps drawing fast as the page fills up.

export const STRIDE = 4; // x, y, pressure, time_ms

export interface DrawableStroke {
  color: string;
  width: number;
  pts: Float32Array;
}

function drawPolyline(ctx: CanvasRenderingContext2D, pts: Float32Array, color: string, width: number): void {
  const n = Math.floor(pts.length / STRIDE);
  if (n === 0) return;

  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  const lineWidth = (p: number) => width * (0.35 + 0.9 * p);

  if (n === 1) {
    ctx.beginPath();
    ctx.arc(pts[0], pts[1], lineWidth(pts[2]) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  for (let i = 1; i < n; i++) {
    const a = (i - 1) * STRIDE;
    const b = i * STRIDE;
    ctx.lineWidth = lineWidth((pts[a + 2] + pts[b + 2]) / 2);
    ctx.beginPath();
    ctx.moveTo(pts[a], pts[a + 1]);
    ctx.lineTo(pts[b], pts[b + 1]);
    ctx.stroke();
  }
}

export class InkCanvas {
  readonly live: HTMLCanvasElement;
  private readonly stat: HTMLCanvasElement;
  private readonly sctx: CanvasRenderingContext2D;
  private readonly lctx: CanvasRenderingContext2D;
  private dpr = 1;
  private onResize: () => void = () => {};

  constructor(private readonly host: HTMLElement) {
    this.stat = document.createElement('canvas');
    this.live = document.createElement('canvas');
    host.append(this.stat, this.live);
    this.sctx = this.stat.getContext('2d')!;
    // desynchronized lets the browser skip some compositor waiting = lower pen latency
    this.lctx = this.live.getContext('2d', { desynchronized: true })!;
    new ResizeObserver(() => this.resize()).observe(host);
    this.resize();
  }

  /** Called after the canvases change size so the owner can redraw saved strokes. */
  setResizeHandler(fn: () => void): void {
    this.onResize = fn;
  }

  private resize(): void {
    this.dpr = window.devicePixelRatio || 1;
    const w = this.host.clientWidth;
    const h = this.host.clientHeight;
    for (const c of [this.stat, this.live]) {
      c.width = Math.max(1, Math.round(w * this.dpr));
      c.height = Math.max(1, Math.round(h * this.dpr));
    }
    this.sctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.lctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.onResize();
  }

  renderStatic(strokes: DrawableStroke[]): void {
    this.sctx.clearRect(0, 0, this.stat.width, this.stat.height);
    for (const s of strokes) drawPolyline(this.sctx, s.pts, s.color, s.width);
  }

  appendStatic(stroke: DrawableStroke): void {
    drawPolyline(this.sctx, stroke.pts, stroke.color, stroke.width);
  }

  drawLive(stroke: DrawableStroke, rawOverlay?: Float32Array): void {
    this.clearLive();
    drawPolyline(this.lctx, stroke.pts, stroke.color, stroke.width);
    if (rawOverlay) drawPolyline(this.lctx, rawOverlay, '#ff3b30', 1);
  }

  clearLive(): void {
    this.lctx.clearRect(0, 0, this.live.width, this.live.height);
  }

  /** Raw overlay for finished strokes isn't kept: it only shows while drawing. */
  pointFromEvent(e: PointerEvent): { x: number; y: number } {
    const r = this.live.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
}
