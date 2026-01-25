import { Client } from "colyseus.js";

const client = new Client("http://localhost:2567");
const room = await client.joinOrCreate("voxel");

room.onMessage("worldInfo", (info) => console.log("worldInfo", info));
room.onMessage("chunkData", (payload) => {
  console.log("chunkData", payload.key, payload.version);
  // TODO: build mesh from payload.blocks
});
room.onMessage("chunkUnload", ({ key }) => {
  console.log("unload", key);
  // TODO: remove mesh
});
room.onMessage("blockUpdate", (u) => {
  console.log("blockUpdate", u);
  // TODO: update block + remesh affected chunk(s)
});

// send movement 10x/sec (example)
setInterval(() => {
  room.send("move", { x: Math.random()*2, y: 10, z: Math.random()*2, yaw: 0, pitch: 0 });
}, 100);

// request chunks around chunk center (0,0,0) radius 2
room.send("subscribeChunks", { cx: 0, cy: 0, cz: 0, r: 2 });

// example block edit
window.setBlock = (x,y,z,id) => room.send("setBlock", { x,y,z,id });
