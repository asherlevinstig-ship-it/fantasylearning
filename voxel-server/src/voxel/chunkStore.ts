import { chunkFromWorld, keyFromChunk } from "./chunkKey";

type Chunk = {
  key: string;
  version: number;
  // store blocks however you like; start simple:
  // a flat Uint16Array of size chunkSize^3 is common
  blocks: Uint16Array;
};

export class ChunkStore {
  private map = new Map<string, Chunk>();
  private chunkSize = 16;

  has(key: string) { return this.map.has(key); }

  create(key: string) {
    const blocks = new Uint16Array(this.chunkSize * this.chunkSize * this.chunkSize);
    // Note: If you want to preserve worldgen when editing, 
    // you would need to fill 'blocks' with the generator's data here.
    // Currently, creating a chunk initializes it to all AIR (0).
    this.map.set(key, { key, version: 1, blocks });
  }

  getVersion(key: string) {
    return this.map.get(key)?.version ?? 0;
  }

  // Encode as an object for now. Later: use ArrayBuffer for speed.
  encodeChunk(key: string) {
    const c = this.map.get(key);
    if (!c) return null;
    return {
      key,
      version: c.version,
      chunkSize: this.chunkSize,
      // send as normal array for simplicity; upgrade later
      blocks: Array.from(c.blocks),
    };
  }

  // =========================================================================
  // NEW METHODS (Required to fix VoxelRoom.ts compilation)
  // =========================================================================

  // 1. Helper to get the key string from world coords
  keyForBlock(x: number, y: number, z: number): string {
    const { cx, cy, cz } = chunkFromWorld(x, y, z, this.chunkSize);
    return keyFromChunk(cx, cy, cz);
  }

  // 2. Helper to check if we have data for this specific block
  hasBlock(x: number, y: number, z: number): boolean {
    const key = this.keyForBlock(x, y, z);
    // In this simple model, if the chunk exists, we return true.
    // This tells VoxelRoom: "Don't use the generator, use my data."
    return this.map.has(key);
  }

  // 3. Helper to get the specific block ID
  getBlock(x: number, y: number, z: number): number {
    const { key } = chunkFromWorld(x, y, z, this.chunkSize);
    const c = this.map.get(key);
    if (!c) return 0; // Should be handled by hasBlock check, but safety first

    // Calculate local index (Must match setBlock logic!)
    const lx = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const ly = ((y % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const lz = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;

    // Your originawl indexing math: x + size * (y + size * z)
    const idx = lx + this.chunkSize * (ly + this.chunkSize * lz);
    
    return c.blocks[idx];
  }

  // =========================================================================
  // EXISTING METHODS
  // =========================================================================

  setBlock(x: number, y: number, z: number, id: number) {
    const { cx, cy, cz, key } = chunkFromWorld(x, y, z, this.chunkSize);
    const c = this.map.get(key);
    if (!c) return false;

    const lx = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const ly = ((y % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const lz = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;

    // Matches logic in getBlock
    const idx = lx + this.chunkSize * (ly + this.chunkSize * lz);
    c.blocks[idx] = id;
    c.version++;
    return true;
  }

  // if edits can affect neighbors (edge blocks), include neighbor chunk keys too
  getTouchedChunkKeys(x: number, y: number, z: number) {
    const { cx, cy, cz } = chunkFromWorld(x, y, z, this.chunkSize);
    return [keyFromChunk(cx, cy, cz)];
  }
}