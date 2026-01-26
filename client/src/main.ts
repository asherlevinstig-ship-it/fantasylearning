import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

// --- Helper: Create Texture (Keep this!) ---
function makeTexture(colorHex: string) {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 16, 16);
  return c.toDataURL();
}

const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

async function main() {
  setHud("Starting noa...");

  // 1. Setup Engine
  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
    playerStart: [0, 10, 0],
    texturePath: "" 
  });

  (window as any).noa = noa;

  // 2. Register Blocks
  const AIR = 0;
  const texGrass = makeTexture("#33cc33");
  const texDirt = makeTexture("#8b5a2b");

  const GRASS = noa.registry.registerBlock(1, {
    material: "grass",
    solid: true,
    opaque: true,
    texture: texGrass,
  });

  const DIRT = noa.registry.registerBlock(2, {
    material: "dirt",
    solid: true,
    opaque: true,
    texture: texDirt,
  });

  // 3. World Generation (Flat Grass)
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

  // --- 4. INTERACTION SETUP ---

  // Connect to Server
  setHud("Connecting...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");
  setHud(`Connected: ${room.sessionId}`);
  
  // Handle server updates (other players breaking blocks)
  room.onMessage("blockUpdate", (msg) => {
    noa.setBlock(msg.id, msg.x, msg.y, msg.z);
  });

  // LEFT CLICK: Break Block (Fire)
  noa.inputs.down.on("fire", () => {
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.position;
      // Send "setBlock" to server with ID 0 (Air)
      room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: AIR });
      // Predict locally for instant feedback
      noa.setBlock(AIR, pos[0], pos[1], pos[2]);
    }
  });

  // RIGHT CLICK: Place Block (Alt-Fire)
  noa.inputs.down.on("alt-fire", () => {
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.adjacent; // Get the empty space next to the block
      // Send "setBlock" to server with ID 1 (Grass)
      room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: GRASS });
      // Predict locally
      noa.setBlock(GRASS, pos[0], pos[1], pos[2]);
    }
  });
  
  // MID CLICK: Pick Block (Optional - nice to have)
  noa.inputs.down.on("mid-fire", () => {
     if (noa.targetedBlock) {
         const pickedID = noa.getBlock(noa.targetedBlock.position);
         console.log("Picked block ID:", pickedID);
     }
  });
}

main().catch((err) => {
  console.error(err);
  setHud("Error (check console)");
});