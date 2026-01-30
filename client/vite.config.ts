import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    keepNames: true, // ✅ CRITICAL: Keeps class names for Colyseus
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild'
  },
  server: {
    host: true,
    port: 3000
  }
});