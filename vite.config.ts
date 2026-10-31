import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    watch: {
      // scripts/dev.mjs rebuilds the WASM and tells the page to reload itself,
      // so Vite must not react to these folders on its own (avoids double reloads).
      ignored: ['**/engine/**', '**/src/wasm/pkg/**'],
    },
  },
});
