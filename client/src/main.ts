import { Client } from "colyseus.js";
// noa-engine exports can vary by build; this pattern works in most setups
// If TS complains, see the note below.
import { Engine } from "noa-engine";

const hud = document.getElementById("hud")!;

function setHud(text: string) {
  hud.textContent = text;
}

async function start() {
  setHud("Starting engine...");

  // 1) Start noa
  const noa = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
  });

  // Make sure the canvas takes the full screen
  // noa handles its own canvas insertion; this just keeps UI readable
  setHud("Connecting to server...");

  // 2) Connect to Colyseus
  // IMPORTANT: when hosted, use same origin so it works on Colyseus Cloud:
  // const serverUrl = window.location.origin;
  const serverUrl = window.location.origin;

  const client = new Client(serverUrl);
  const room = await client.joinOrCreate("voxel");

  console.log("✅ Joined room:", room.id, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  // 3) Listen for any test messages
  room.onMessage("*", (type, message) => {
    console.log("📩 message:", type, message);
  });

  // 4) Send position occasionally (example)
  setInterval(() => {
    // noa has player position accessible via camera/physics
    // This is a simple placeholder until we wire it properly
    room.send("move", { x: 0, y: 10, z: 0 });
  }, 200);

  // Expose for quick debugging
  (window as any).noa = noa;
  (window as any).room = room;
}

start().catch((err) => {
  console.error(err);
  setHud("Error (check console)");
});
