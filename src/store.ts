// Raw pen samples are what gets saved, never smoothed output.
// That is what lets a Rust change re-smooth your old strokes after a reload.

export interface Stroke {
  id: number;
  color: string;
  width: number;
  /** flat [x, y, pressure, time_ms, ...] exactly as captured */
  raw: number[];
}

const STROKES_KEY = 'ink-app:strokes:v1';
const OPTIONS_KEY = 'ink-app:options:v1';

export interface Options {
  smoothLive: boolean;
  showRaw: boolean;
  color: string;
  size: number;
}

export const defaultOptions: Options = { smoothLive: true, showRaw: false, color: '#111111', size: 4 };

export function loadStrokes(): Stroke[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STROKES_KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveStrokes(strokes: Stroke[]): void {
  try {
    localStorage.setItem(STROKES_KEY, JSON.stringify(strokes));
  } catch {
    /* storage full or blocked: drawing still works, it just won't survive a reload */
  }
}

export function loadOptions(): Options {
  try {
    return { ...defaultOptions, ...JSON.parse(localStorage.getItem(OPTIONS_KEY) ?? '{}') };
  } catch {
    return { ...defaultOptions };
  }
}

export function saveOptions(options: Options): void {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(options));
  } catch {
    /* ignore */
  }
}
