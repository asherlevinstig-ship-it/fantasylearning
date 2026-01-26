import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

// noa ships an ndarray helper on the engine instance, but we can use a plain one.
// We'll use noa.ndarray for chunk data.
const hud = document.getElementById("hud")!;
const setHud = (t: string) => (hud.textContent = t);

async function start() {
  setHud("Starting noa...");

  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
  });

  // ---- Register block IDs (simple) ----
  // 0 = air by convention
  const AIR = 0;
  const GRASS = 1;
  const DIRT = 2;

  // Register blocks so they render as solid (colors are fine for now)
  // Some noa builds accept `color`, others use materials/textures - debug will still show something.
  noa.registry.registerBlock({ id: GRASS, solid: true, color: [0.2, 0.8, 0.2] });
  noa.registry.registerBlock({ id: DIRT, solid: true, color: [0.5, 0.3, 0.1] });

  // ---- Provide a simple world generator ----
  // This function is called whenever noa needs a chunk at (cx, cy, cz).
  // It must return an ndarray of block IDs for that chunk.
  const size = noa.world._chunkSize; // 16

  function flatChunkGenerator(cx: number, cy: number, cz: number) {
    // Create ndarray: [size, size, size]
    const data = new Uint8Array(size * size * size);
    const nd = noa.ndarray(data, [size, size, size]);

    // World y coordinate for each voxel in this chunk:
    // chunk origin in world coords: (cx*size, cy*size, cz*size)
    const baseY = cy * size;

    for (let x = 0; x < size; x++) {
      for (let z = 0; z < size; z++) {
        for (let y = 0; y < size; y++) {
          const worldY = baseY + y;

          let id = AIR;
          if (worldY === 0) id = GRASS;
          else if (worldY < 0 && worldY >= -3) id = DIRT;

          nd.set(x, y, z, id);
        }
      }
    }

    return nd;
  }

  // Hook generator into noa.
  // Many noa versions use world.on('needsChunk', ...) or world.setChunkGenerator(...)
  // Your build exposes events (world._events exists), so we use the event-based API.
  noa.world.on("needsChunk", (chunk: any) => {
    // chunk has .x .y .z chunk coords
    const voxels = flatChunkGenerator(chunk.x, chunk.y, chunk.z);
    chunk.setVoxels(voxels);
  });

  // Put player above ground
  if (noa.playerEntity && noa.ents?.setPosition) {
    noa.ents.setPosition(noa.playerEntity, [0, 5, 0]);
  }

  setHud("Connecting to server...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");
  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  room.onMessage("worldInfo", (info) => console.log("📩 worldInfo", info));

  (window as any).noa = noa;
  (window as any).room = room;
}

start().catch((e) => {
  console.error(e);
  setHud("Error (check console)");
});
