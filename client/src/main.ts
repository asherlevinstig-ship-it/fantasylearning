// client/src/main.ts

import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

const hudEl = document.getElementById("hud") as HTMLDivElement | null;

function setHud(text: string) {
  if (hudEl) hudEl.textContent = text;
}

async function main() {
  setHud("Starting noa...");

  // Start the player above where our ground will be (y=0)
  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
    playerStart: [0, 6, 0],
  });

  console.log("noa-engine started:", noa?.version);
  (window as any).noa = noa;

  // --- Block IDs ---
  const AIR = 0;
  const GRASS = 1;
  const DIRT = 2;

  // Register blocks (simple solid colored blocks)
  // If your build ignores color, debug mode still usually shows something.
  try {
    noa.registry.registerBlock({ id: GRASS, solid: true, color: [0.2, 0.8, 0.2] });
    noa.registry.registerBlock({ id: DIRT, solid: true, color: [0.5, 0.3, 0.1] });
  } catch (e) {
    console.warn("Block registration warning (may be OK):", e);
  }

  // --- Worldgen: respond when noa asks for chunk voxel data ---
  // Event + setChunkData are the intended APIs for feeding voxel data into noa. :contentReference[oaicite:1]{index=1}
  const chunkSize: number = noa.world?._chunkSize ?? 16;

  noa.world.on(
    "worldDataNeeded",
    (requestID: string, dataArr: any, cx: number, cy: number, cz: number, worldName: string) => {
      // dataArr is an ndarray for this chunk that we should fill with voxel IDs
      // coords passed are chunk coords. world voxel origin of chunk:
      const baseY = cy * chunkSize;

      for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
          for (let y = 0; y < chunkSize; y++) {
            const worldY = baseY + y;

            let id = AIR;

            // Flat world:
            // y === 0 -> grass surface
            // y < 0 down to -3 -> dirt
            if (worldY === 0) id = GRASS;
            else if (worldY < 0 && worldY >= -3) id = DIRT;

            dataArr.set(x, y, z, id);
          }
        }
      }

      // Hand the filled voxel array back to noa
      noa.world.setChunkData(requestID, dataArr, null);
    }
  );

  // Log when player enters chunks (useful to confirm chunks are loading)
  noa.world.on("playerEnteredChunk", (i: number, j: number, k: number) => {
    // console.log("playerEnteredChunk:", i, j, k);
  });

  // --- Connect to Colyseus (you already have this working) ---
  setHud("Connecting to server...");
  const serverUrl = window.location.origin;
  const client = new Client(serverUrl);
  const room = await client.joinOrCreate("voxel");

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  (window as any).room = room;

  room.onMessage("worldInfo", (info) => {
    console.log("📩 worldInfo", info);
  });

  room.onMessage("*", (type, message) => {
    console.log("📩 message:", type, message);
  });

  // Sanity check after a short delay (gives time for initial chunks to generate)
  setTimeout(() => {
    try {
      // Engine has getBlock; world also has getBlockID. Both should show GRASS at y=0 once chunk is loaded. :contentReference[oaicite:2]{index=2}
      const a = typeof noa.getBlock === "function" ? noa.getBlock(0, 0, 0) : "(noa.getBlock missing)";
      const b = typeof noa.world?.getBlockID === "function" ? noa.world.getBlockID(0, 0, 0) : "(world.getBlockID missing)";
      console.log("After worldgen: getBlock(0,0,0) =", a, "| world.getBlockID(0,0,0) =", b);
    } catch (e) {
      console.warn("Sanity check failed:", e);
    }
  }, 750);
}

main().catch((err) => {
  console.error(err);
  setHud("Error (check console)");
});
