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
    // TODO: worldgen fill blocks
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

  setBlock(x: number, y: number, z: number, id: number) {
    const { cx, cy, cz, key } = chunkFromWorld(x, y, z, this.chunkSize);
    const c = this.map.get(key);
    if (!c) return false;

    const lx = ((x % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const ly = ((y % this.chunkSize) + this.chunkSize) % this.chunkSize;
    const lz = ((z % this.chunkSize) + this.chunkSize) % this.chunkSize;

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
