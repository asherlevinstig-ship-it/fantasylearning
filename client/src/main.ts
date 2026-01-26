import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

async function main() {
  setHud("Starting noa...");

  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
    playerStart: [0, 6, 0],
    // Explicitly empty texturePath to prevent 404 errors looking for files
    texturePath: "" 
  });

  console.log("noa-engine started:", noa?.version);
  (window as any).noa = noa;

  // --- 1. Register Materials (Flat Colors) ---
  // Args: name, color [r,g,b], textureURL (null), texHasAlpha (false)
  noa.registry.registerMaterial("grass_mat", [0.1, 0.8, 0.1], null, false);
  noa.registry.registerMaterial("dirt_mat", [0.5, 0.3, 0.1], null, false);

  // --- 2. Register Blocks ---
  const AIR = 0;
  
  // Register Grass (ID 1)
  const GRASS = 1;
  noa.registry.registerBlock(GRASS, {
    material: "grass_mat",
    solid: true,
    opaque: true,
  });

  // Register Dirt (ID 2)
  const DIRT = 2;
  noa.registry.registerBlock(DIRT, {
    material: "dirt_mat",
    solid: true,
    opaque: true,
  });

  // Look down so you definitely see ground
  try {
    if (noa.camera) noa.camera.pitch = -0.6;
  } catch {}

  // --- 3. World Generation ---
  const chunkSize: number = noa.world?._chunkSize ?? 16;

  noa.world.on(
    "worldDataNeeded",
    (requestID: string, dataArr: any, cx: number, cy: number, cz: number) => {
      const baseY = cy * chunkSize;

      for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
          for (let y = 0; y < chunkSize; y++) {
            const worldY = baseY + y;
            let id = AIR;
            
            if (worldY === 0) id = GRASS;
            else if (worldY < 0 && worldY >= -3) id = DIRT;

            dataArr.set(x, y, z, id);
          }
        }
      }
      noa.world.setChunkData(requestID, dataArr, null);
    }
  );

  // --- 4. Colyseus Connection ---
  setHud("Connecting to server...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);
  (window as any).room = room;

  // Listen for block updates from server
  room.onMessage("blockUpdate", (msg) => {
    // When server says a block changed, update local noa world
    noa.setBlock(msg.id, msg.x, msg.y, msg.z);
  });
}

main().catch((err) => {
  console.error(err);
  setHud("Error (check console)");
});