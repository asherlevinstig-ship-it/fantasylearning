import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

// ----------------------------------------------------------------------
// ⚡ AUTO-SYNC SCHEMA (The Deployment Fix)
// This guarantees files exist even if 'npx vite build' is run directly
// ----------------------------------------------------------------------
try {
  // Use process.cwd() to ensure paths are relative to the project root
  const serverSchemaPath = path.resolve(process.cwd(), '../voxel-server/src/state');
  const clientSchemaPath = path.resolve(process.cwd(), 'src/schema');

  // Check if we are in a monorepo structure where server exists
  if (fs.existsSync(serverSchemaPath)) {
    console.log("🔄 Syncing schemas from server...");
    
    // Ensure destination exists
    if (!fs.existsSync(clientSchemaPath)) {
      fs.mkdirSync(clientSchemaPath, { recursive: true });
    }

    // Copy the files
    const filesToCopy = ['VoxelState.ts', 'PlayerState.ts'];
    
    filesToCopy.forEach(file => {
        const src = path.join(serverSchemaPath, file);
        const dest = path.join(clientSchemaPath, file);
        if (fs.existsSync(src)) {
            fs.copyFileSync(src, dest);
            console.log(`   ✅ Copied ${file}`);
        } else {
            console.warn(`   ⚠️ Source file missing: ${src}`);
        }
    });
    
    console.log("✅ Schema sync complete.");
  } else {
    console.warn("⚠️  Could not find server folder. Skipping sync (this is normal if building in isolation).");
  }
} catch (e) {
  console.warn("⚠️  Schema sync failed:", e);
}

// ----------------------------------------------------------------------
// VITE CONFIG
// ----------------------------------------------------------------------
export default defineConfig({
  esbuild: {
    // 🔥 CRITICAL: This keeps class names (PlayerState, VoxelState) intact
    keepNames: true, 
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