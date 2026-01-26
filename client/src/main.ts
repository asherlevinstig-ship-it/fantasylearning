import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

const hud = document.getElementById("hud")!;
const setHud = (t: string) => (hud.textContent = t);

function placeBlock(noa: any, id: number, x: number, y: number, z: number) {
  const w = noa.world;
  if (w?.setBlockID) return w.setBlockID(id, x, y, z);
  if (w?.setBlock) return w.setBlock(id, x, y, z);
  throw new Error("No supported block placement method found on noa.world");
}

async function start() {
  setHud("Starting noa...");
  const noa: any = new Engine({ debug: true, chunkSize: 16 });

  console.log("noa keys:", Object.keys(noa));
  console.log("world keys:", noa.world ? Object.keys(noa.world) : "no world");

  // Basic ground
  for (let x = -16; x <= 16; x++) {
    for (let z = -16; z <= 16; z++) {
      placeBlock(noa, 2, x, -1, z); // dirt
      placeBlock(noa, 1, x, 0, z);  // grass
    }
  }

  // Move player above ground (method varies, so guard it)
  if (noa.playerEntity && noa.ents?.setPosition) {
    noa.ents.setPosition(noa.playerEntity, [0, 5, 0]);
  }

  setHud("Connecting to server...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  room.onMessage("worldInfo", (info) => console.log("📩 worldInfo", info));

  (window as any).noa = noa;
  (window as any).room = room;
}

start().catch((e) => {
  console.error(e);
  setHud("Error (check console)");
});
