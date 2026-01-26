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
    texturePath: "" // Important: prevents 404s on missing textures
  });

  console.log("noa-engine started:", noa?.version);
  (window as any).noa = noa;

  // --- 1. Register Materials (v0.33 Object Syntax) ---
  noa.registry.registerMaterial("grass", {
    color: [0.2, 0.8, 0.2], 
    // textureURL: null,   // optional
    // texHasAlpha: false, // optional
  });

  noa.registry.registerMaterial("dirt", {
    color: [0.55, 0.35, 0.17],
  });

  // --- 2. Register Blocks ---
  const AIR = 0;
  
  // Note: registerBlock returns the integer ID (e.g. 1), which we store in GRASS
  const GRASS = noa.registry.registerBlock(1, {
    material: "grass",
    solid: true,
    opaque: true,
  });

  const DIRT = noa.registry.registerBlock(2, {
    material: "dirt",
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

  room.onMessage("worldInfo", (info) => console.log("📩 worldInfo", info));
  room.onMessage("*", (type, msg) => console.log("📩 message:", type, msg));
}

main().catch((err) => {
  console.error(err);
  setHud("Error (check console)");
});