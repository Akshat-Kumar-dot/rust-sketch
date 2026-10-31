// `npm run dev`: builds the Rust crate to WASM, starts Vite, and rebuilds + reloads
// the page every time you save a file in engine/src.
//   npm run dev            fast debug WASM builds
//   npm run dev:release    optimized WASM (use this to judge real pen speed)
import { spawn, spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const release = process.argv.includes('--release');
const isWin = process.platform === 'win32';

const check = spawnSync('wasm-pack', ['--version'], { shell: isWin, encoding: 'utf8' });
if (check.status !== 0) {
  console.error(
    '\nwasm-pack is not installed. Install it once, then run npm run dev again:\n\n' +
      '    cargo install wasm-pack\n\n' +
      '(needs Rust from https://rustup.rs)\n',
  );
  process.exit(1);
}

let server;
let lastError = null;
let building = false;
let dirty = false;

function build() {
  return new Promise((resolve) => {
    const args = [
      'build', 'engine',
      '--target', 'web',
      '--out-dir', '../src/wasm/pkg',
      '--out-name', 'ink_engine',
      release ? '--release' : '--dev',
    ];
    const started = Date.now();
    const child = spawn('wasm-pack', args, { cwd: root, shell: isWin });
    let output = '';
    child.stdout.on('data', (d) => (output += d));
    child.stderr.on('data', (d) => (output += d));
    child.on('close', (code) => {
      const secs = ((Date.now() - started) / 1000).toFixed(1);
      resolve({ ok: code === 0, output, secs });
    });
  });
}

function sendError(message) {
  server?.ws.send({ type: 'error', err: { message, stack: '', plugin: 'rust / wasm-pack' } });
}

async function rebuild(reason) {
  if (building) {
    dirty = true;
    return;
  }
  building = true;
  do {
    dirty = false;
    console.log(`\n[rust] building (${reason})...`);
    const { ok, output, secs } = await build();
    if (ok) {
      lastError = null;
      console.log(`[rust] built in ${secs}s, reloading page`);
      if (server) {
        server.moduleGraph.invalidateAll();
        server.ws.send({ type: 'full-reload' });
      }
    } else {
      lastError = output.trim() || 'wasm-pack failed';
      console.error(`[rust] build FAILED after ${secs}s\n\n${output}`);
      sendError(lastError);
    }
  } while (dirty);
  building = false;
}

await rebuild('first build');

server = await createServer({ root });
await server.listen();
server.printUrls();

// a page that opens (or refreshes) while the last build is broken still sees the error
server.ws.on('connection', () => {
  if (lastError) sendError(lastError);
});

let timer;
const onChange = (_event, file) => {
  if (!file) return;
  const f = String(file);
  if (!f.endsWith('.rs') && !f.endsWith('Cargo.toml')) return;
  clearTimeout(timer);
  timer = setTimeout(() => rebuild(`changed ${f}`), 150);
};
watch(path.join(root, 'engine', 'src'), { recursive: true }, onChange);
watch(path.join(root, 'engine'), {}, onChange); // Cargo.toml

console.log('\nWatching engine/src. Edit your Rust, save, and the page reloads.\n');
