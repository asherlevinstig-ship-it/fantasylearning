import { defineConfig } from 'vite';

export default defineConfig({
  esbuild: {
    keepNames: true,
    tsconfigRaw: {
      compilerOptions: {
        experimentalDecorators: true,
        useDefineForClassFields: false,  // ← Force esbuild to respect this
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    minify: 'esbuild',
    sourcemap: false, // <--- CRITICAL FIX: Disables source maps to save ~50% RAM during build
    chunkSizeWarningLimit: 2000 // Optional: Increases warning limit to prevent console noise
  },
  server: {
    host: true,
    port: 3000
  }
});