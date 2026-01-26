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

  // ---- Rendering setup (Babylon materials) ----
  // noa uses Babylon under the hood. In many builds, you must provide materials
  // so the terrain mesher knows what to draw for each block id.
  const scene = noa.rendering?._scene || noa.rendering?.scene;
  const BABYLON = (window as any).BABYLON; // Babylon is usually global in noa builds

  if (!scene || !BABYLON) {
    console.warn("Scene or BABYLON not found. Terrain may not render. scene:", scene, "BABYLON:", BABYLON);
  } else {
    const grassMat = new BABYLON.StandardMaterial("grassMat", scene);
    grassMat.diffuseColor = new BABYLON.Color3(0.2, 0.8, 0.2);

    const dirtMat = new BABYLON.StandardMaterial("dirtMat", scene);
    dirtMat.diffuseColor = new BABYLON.Color3(0.5, 0.3, 0.1);

    // Register blocks + assign materials for rendering
    noa.registry.registerBlock({
      id: GRASS,
      solid: true,
      material: grassMat,
    });

    noa.registry.registerBlock({
      id: DIRT,
      solid: true,
      material: dirtMat,
    });
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

  // --- Helpful camera sanity: look at origin ---
  // If the camera is looking away, you’ll only see sky.
  // Try to force camera to look slightly downward toward the ground.
  try {
    if (noa.camera && noa.camera.heading !== undefined) {
      noa.camera.heading = 0;
      noa.camera.pitch = -0.6; // look down a bit
    }
  } catch (e) {
    console.warn("Camera tweak warning:", e);
  }

  // --- Sanity check after a short delay ---
  setTimeout(() => {
    const a = typeof noa.getBlock === "function" ? noa.getBlock(0, 0, 0) : "(noa.getBlock missing)";
    const b = typeof noa.world?.getBlockID === "function" ? noa.world.getBlockID(0, 0, 0) : "(world.getBlockID missing)";
    console.log("After worldgen: getBlock(0,0,0) =", a, "| world.getBlockID(0,0,0) =", b);

    // Also: confirm meshes exist
    const chunksKnown = noa.world?._chunksKnown ? Object.keys(noa.world._chunksKnown).length : "(unknown)";
    console.log("chunksKnown:", chunksKnown);
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
