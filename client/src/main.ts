import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

// --- Helper: Create a solid color texture in memory ---
function makeTexture(colorHex: string) {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 16, 16);
  return c.toDataURL(); // Returns a "data:image/png..." string
}

const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

async function main() {
  setHud("Starting noa...");

  // 1. Generate texture "files"
  const texGrass = makeTexture("#33cc33"); // Green
  const texDirt = makeTexture("#8b5a2b");  // Brown

  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
    playerStart: [0, 10, 0], // Start high to fall onto ground
    texturePath: ""          // We are passing full data URLs, so no path needed
  });

  console.log("noa-engine started:", noa?.version);
  (window as any).noa = noa;

  // --- 2. Register Blocks (Using Textures!) ---
  const AIR = 0;
  
  // Register Grass
  const GRASS = 1;
  noa.registry.registerBlock(GRASS, {
    material: "grass", // Optional name
    solid: true,
    opaque: true,
    texture: texGrass, // <--- IMPORTANT: Pass the Data URL here
  });

  // Register Dirt
  const DIRT = 2;
  noa.registry.registerBlock(DIRT, {
    material: "dirt",
    solid: true,
    opaque: true,
    texture: texDirt,  // <--- IMPORTANT: Pass the Data URL here
  });

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
            
            // Simple flat ground at y=0, dirt below
            if (worldY === 0) id = GRASS;
            else if (worldY < 0 && worldY >= -3) id = DIRT;

            dataArr.set(x, y, z, id);
          }
        }
      }
      noa.world.setChunkData(requestID, dataArr, null);
    }
  );

  // --- 4. Debug: Check if blocks exist ---
  setTimeout(() => {
     // Check the block directly under the center of the world
     const id = noa.getBlock(0, 0, 0);
     console.log("🔍 Debug Check - Block at (0,0,0) ID is:", id);
     if (id === 0) console.error("⚠️ World Gen failed: Block is AIR");
     else console.log("✅ World Gen success: Block exists");
  }, 2000);

  // --- 5. Colyseus Connection ---
  setHud("Connecting...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);
  (window as any).room = room;

  room.onMessage("blockUpdate", (msg) => {
    noa.setBlock(msg.id, msg.x, msg.y, msg.z);
  });
}

main().catch((err) => {
  console.error(err);
  setHud("Error (check console)");
});