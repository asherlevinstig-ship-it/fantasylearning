import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

// Helper: Create a 16x16 solid color texture and return it as a Base64 string
function createColorTexture(colorHex: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 16;
  canvas.height = 16;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 16, 16);
  return canvas.toDataURL("image/png");
}

const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

async function main() {
  setHud("Starting noa...");

  // Generate our texture "files" in memory
  const grassTextureURL = createColorTexture("#33cc33");
  const dirtTextureURL = createColorTexture("#8b5a2b");

  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
    playerStart: [0, 6, 0],
    // IMPORTANT: Tell noa not to look for files in a 'textures/' folder
    texturePath: "" 
  });

  // --- Block IDs ---
  const AIR = 0;
  const GRASS = 1;
  const DIRT = 2;

  // --- Register Blocks ---
  // We pass the Data URI directly to 'texture'. 
  // noa will handle the atlas and UV mapping automatically.
  
  noa.registry.registerBlock({
    id: GRASS,
    solid: true,
    texture: grassTextureURL, // Pass the base64 string
  });

  noa.registry.registerBlock({
    id: DIRT,
    solid: true,
    texture: dirtTextureURL, // Pass the base64 string
  });

  // --- No manual mesher/material code needed! ---
  // (You can delete the makeRuntimeAtlasTexture function and the mesher hacking)

  // Look down so you definitely see ground
  try {
    if (noa.camera) noa.camera.pitch = -0.6;
  } catch {}

  // --- World generation: flat world ---
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

  // --- Colyseus connect (Unchanged) ---
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