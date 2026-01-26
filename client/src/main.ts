import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

const hud = document.getElementById("hud")!;
const setHud = (t: string) => (hud.textContent = t);

async function start() {
  setHud("Starting noa...");

  const noa = new Engine({
    debug: true,
    // make sure it actually renders full screen
    canvas: undefined, // noa will create one
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
  });

  // --- DEFINE SOME BLOCKS ---
  // 1 = grass, 2 = dirt (ids are arbitrary)
  const grass = noa.registry.registerBlock({
    id: 1,
    material: "grass",
    color: [0.2, 0.8, 0.2],
    solid: true,
  });

  const dirt = noa.registry.registerBlock({
    id: 2,
    material: "dirt",
    color: [0.5, 0.3, 0.1],
    solid: true,
  });

  // --- PLACE A SIMPLE GROUND PLANE ---
  // Put a 32x32 platform at y=0, dirt below, grass on top
  for (let x = -16; x <= 16; x++) {
    for (let z = -16; z <= 16; z++) {
      noa.world.setBlock(dirt, [x, -1, z]);
      noa.world.setBlock(grass, [x, 0, z]);
    }
  }

  // --- POSITION PLAYER ABOVE GROUND ---
  // (If you spawn inside blocks, you’ll see nothing / weirdness)
  noa.playerEntity && noa.ents.setPosition(noa.playerEntity, [0, 5, 0]);

  // Optional: add a little text so we know render loop is alive
  setHud("Connecting to server...");

  // --- CONNECT TO COLYSEUS ---
  const serverUrl = window.location.origin;
  const client = new Client(serverUrl);
  const room = await client.joinOrCreate("voxel");

  console.log("✅ Joined room:", room.id, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  room.onMessage("worldInfo", (info) => {
    console.log("📩 worldInfo", info);
  });

  // Debug handles
  (window as any).noa = noa;
  (window as any).room = room;
}

start().catch((e) => {
  console.error(e);
  setHud("Error (check console)");
});
