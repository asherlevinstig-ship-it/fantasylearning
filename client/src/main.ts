// client/src/main.ts

import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

const hudEl = document.getElementById("hud") as HTMLDivElement | null;

function setHud(text: string) {
  if (hudEl) hudEl.textContent = text;
}

async function main() {
  setHud("Starting noa...");

  // Create noa engine
  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
  });

  console.log("noa-engine started:", noa?.version);

  // Expose for debugging in DevTools:
  (window as any).noa = noa;

  // --- Block IDs ---
  // 0 = air by convention
  const AIR = 0;
  const GRASS = 1;
  const DIRT = 2;

  // Register basic blocks (visible + solid)
  // (If your build ignores color/material, it should still render debug-style blocks.)
  try {
    noa.registry.registerBlock({
      id: GRASS,
      solid: true,
      color: [0.2, 0.8, 0.2],
    });

    noa.registry.registerBlock({
      id: DIRT,
      solid: true,
      color: [0.5, 0.3, 0.1],
    });
  } catch (e) {
    console.warn("Block registration warning (may be OK):", e);
  }

  // --- Create a visible flat platform using the Engine API ---
  // IMPORTANT: in your build, block placement is via `noa.setBlock(...)` (not `noa.world.setBlock`)
  if (typeof noa.setBlock !== "function") {
    console.error("Expected noa.setBlock to exist, but it doesn't.");
    setHud("Noa error: setBlock missing (check console)");
    return;
  }

  // Create a 33x33 platform centered at origin
  for (let x = -16; x <= 16; x++) {
    for (let z = -16; z <= 16; z++) {
      noa.setBlock(DIRT, x, -1, z);
      noa.setBlock(GRASS, x, 0, z);
    }
  }

  // Position the player above the platform
  try {
    if (noa.playerEntity && noa.ents?.setPosition) {
      noa.ents.setPosition(noa.playerEntity, [0, 6, 0]);
    }
  } catch (e) {
    console.warn("Player position warning (may be OK):", e);
  }

  // Quick sanity check: should be GRASS (1) at (0,0,0)
  try {
    if (typeof noa.getBlock === "function") {
      console.log("Block at (0,0,0):", noa.getBlock(0, 0, 0));
    }
  } catch (e) {
    console.warn("getBlock warning (may be OK):", e);
  }

  // --- Connect to Colyseus ---
  setHud("Connecting to server...");
  const serverUrl = window.location.origin; // works locally + hosted

  const client = new Client(serverUrl);
  const room = await client.joinOrCreate("voxel");

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  // Expose for debugging
  (window as any).room = room;

  // Listen for server info
  room.onMessage("worldInfo", (info) => {
    console.log("📩 worldInfo", info);
  });

  // Log all messages (handy while wiring up)
  room.onMessage("*", (type, message) => {
    console.log("📩 message:", type, message);
  });

  // Example: send a basic move ping occasionally
  setInterval(() => {
    room.send("move", { x: 0, y: 6, z: 0, yaw: 0, pitch: 0 });
  }, 500);
}

main().catch((err) => {
  console.error(err);
  setHud("Error (check console)");
});
