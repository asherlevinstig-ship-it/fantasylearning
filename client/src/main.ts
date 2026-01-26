// client/src/main.ts

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
  });

  console.log("noa-engine started:", noa?.version);
  (window as any).noa = noa;

  // --- Block IDs ---
  const AIR = 0;
  const GRASS = 1;
  const DIRT = 2;

  // --- Register blocks using noa's material names ---
  // This avoids needing BABYLON global.
  // Many noa builds accept `material` as a string that maps to internal materials.
  // If your build uses textures later, we’ll swap this out cleanly.
  try {
    noa.registry.registerBlock({
      id: GRASS,
      solid: true,
      material: "grass",
      color: [0.2, 0.8, 0.2],
    });

    noa.registry.registerBlock({
      id: DIRT,
      solid: true,
      material: "dirt",
      color: [0.5, 0.3, 0.1],
    });
  } catch (e) {
    console.warn("registerBlock warning:", e);
  }

  // --- Worldgen: fill chunk voxel data ---
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

  // --- Force camera to look down slightly (often needed) ---
  try {
    if (noa.camera) {
      noa.camera.pitch = -0.6;
    }
  } catch {}

  // --- After a moment, force remesh (debug helper) ---
  setTimeout(() => {
    const a = typeof noa.getBlock === "function" ? noa.getBlock(0, 0, 0) : "(noa.getBlock missing)";
    const b = typeof noa.world?.getBlockID === "function" ? noa.world.getBlockID(0, 0, 0) : "(world.getBlockID missing)";
    console.log("After worldgen: getBlock(0,0,0) =", a, "| world.getBlockID(0,0,0) =", b);

    // Print some rendering internals so we know meshing is happening
    console.log("rendering keys:", noa.rendering ? Object.keys(noa.rendering) : "no rendering");
    console.log("mesher:", noa._terrainMesher ? "present" : "missing");
  }, 750);

  // --- Connect to Colyseus ---
  setHud("Connecting to server...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);
  (window as any).room = room;

  room.onMessage("worldInfo", (info) => console.log("📩 worldInfo", info));
}

main().catch((err) => {
  console.error(err);
  setHud("Error (check console)");
});
