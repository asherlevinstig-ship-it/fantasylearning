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
    minify: 'esbuild'
  },
  server: {
    host: true,
    port: 3000
  }
});
