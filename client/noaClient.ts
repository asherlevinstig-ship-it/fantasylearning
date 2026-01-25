import { Engine } from "noa-engine";
import { Client } from "colyseus.js";

export async function start() {
  // 1) Start noa
  const noa = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3
  });

  // 2) Connect to Colyseus
  const client = new Client("http://localhost:2567");
  const room = await client.joinOrCreate("voxel");

  // 3) Example: send player position 10x/sec
  setInterval(() => {
    const p = noa.playerEntity && noa.ents.getPosition(noa.playerEntity);
    if (!p) return;
    room.send("move", { x: p[0], y: p[1], z: p[2] });
  }, 100);

  // 4) Receive chunk payloads (you’ll mesh them into noa)
  room.onMessage("chunkData", (payload) => {
    console.log("chunkData", payload.key, payload.version);
    // TODO: translate payload.blocks -> noa world setBlock / chunk build
  });

  room.onMessage("blockUpdate", (u) => {
    // TODO: noa.setBlock(u.x,u.y,u.z,u.id)
  });

  return { noa, room };
}
