import { Client } from "colyseus.js";
import { Engine } from "noa-engine";
import { SkinViewer, WalkingAnimation } from "minecraft-skin-viewer";

// ---------- HUD ----------
const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

// ---------- Helpers ----------

// Helper: Create a solid color texture in memory (Fixes invisible world issue)
function makeTexture(colorHex: string) {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 16, 16);
  return c.toDataURL(); // Returns a "data:image/png..." string
}

function createOverlayCanvas(opts: {
  id: string;
  width: number;
  height: number;
  style: Partial<CSSStyleDeclaration>;
}) {
  const c = document.createElement("canvas");
  c.id = opts.id;
  c.width = opts.width;
  c.height = opts.height;
  Object.assign(c.style, {
    position: "fixed",
    left: "0px",
    top: "0px",
    pointerEvents: "none",
    imageRendering: "pixelated",
    ...opts.style,
  });
  document.body.appendChild(c);
  return c;
}

function now() {
  return performance.now();
}

async function main() {
  setHud("Starting noa...");

  // -------------------------
  // 1. NOA WORLD ENGINE
  // -------------------------
  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
    playerStart: [0, 10, 0],
    texturePath: "" // Important: We use data URLs, so no path needed
  });

  (window as any).noa = noa;

  // -------------------------
  // 2. REGISTER BLOCKS & GENERATE WORLD
  // -------------------------
  
  // Generate texture "files"
  const texGrass = makeTexture("#33cc33"); // Green
  const texDirt = makeTexture("#8b5a2b");  // Brown

  const AIR = 0;
  
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

  // World Generation Logic
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
            // Simple flat ground
            if (worldY === 0) id = GRASS;
            else if (worldY < 0 && worldY >= -3) id = DIRT;
            dataArr.set(x, y, z, id);
          }
        }
      }
      noa.world.setChunkData(requestID, dataArr, null);
    }
  );

  // -------------------------
  // 3. THREE OVERLAY: THIRD PERSON PLAYER
  // -------------------------
  // A small canvas in bottom-left
  const playerCanvas = createOverlayCanvas({
    id: "player-view",
    width: 320,
    height: 320,
    style: {
      left: "12px",
      bottom: "12px",
      top: "auto",
      width: "160px", // Display size
      height: "160px",
      borderRadius: "12px",
      background: "rgba(0,0,0,0.2)",
    },
  });

  const playerViewer = new SkinViewer({
    canvas: playerCanvas,
    width: 320,
    height: 320,
  });

  // Camera settings
  playerViewer.fov = 60;
  playerViewer.zoom = 0.9;
  playerViewer.autoRotate = true; // Spin slowly in the HUD
  playerViewer.autoRotateSpeed = 0.5;

  // Load Skin
  await playerViewer.loadSkin("https://textures.minecraft.net/texture/1f8b0f8d1a0cfe6f2c2c6b0a9d0d1e7d83c20f62ab2e6b4c0f5c5e6b3a4c2a1");
  
  // Walking Animation
  const walkAnim = new WalkingAnimation(playerViewer);
  walkAnim.speed = 1.0;
  playerViewer.animation = walkAnim;

  // -------------------------
  // 4. THREE OVERLAY: FIRST PERSON HANDS
  // -------------------------
  const handsCanvas = createOverlayCanvas({
    id: "hands-view",
    width: window.innerWidth,
    height: window.innerHeight * 0.4, // Bottom 40% of screen
    style: {
      left: "0px",
      bottom: "0px",
      top: "auto",
      width: "100vw",
      height: "40vh",
      background: "transparent",
    },
  });

  const handsViewer = new SkinViewer({
    canvas: handsCanvas,
    width: handsCanvas.width,
    height: handsCanvas.height,
  });

  handsViewer.fov = 70;
  handsViewer.zoom = 1.15;
  
  // Load same skin
  await handsViewer.loadSkin(playerViewer.skin);

  // Hide Body Parts (Show only Arms)
  const hv: any = handsViewer as any;
  const po: any = hv.playerObject;

  if (po) {
    if (po.head) po.head.visible = false;
    if (po.body) po.body.visible = false;
    if (po.leftLeg) po.leftLeg.visible = false;
    if (po.rightLeg) po.rightLeg.visible = false;

    // Ensure arms are visible
    if (po.leftArm) po.leftArm.visible = true;
    if (po.rightArm) po.rightArm.visible = true;
  }

  // Position camera to look at hands
  handsViewer.camera.position.set(0, 1.4, 1.5);
  handsViewer.camera.lookAt(0, 1.3, 0);

  // -------------------------
  // 5. COLYSEUS CONNECT & INTERACTION
  // -------------------------
  setHud("Connecting to server...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");
  (window as any).room = room;

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  // Handle server block updates
  room.onMessage("blockUpdate", (msg) => {
    noa.setBlock(msg.id, msg.x, msg.y, msg.z);
  });

  // --- Hand Swing Animation Function ---
  const swingHand = () => {
    const p: any = (handsViewer as any).playerObject;
    if (!p?.rightArm) return;

    const start = now();
    const duration = 150; // ms

    const animate = () => {
      const t = now() - start;
      const k = Math.min(1, t / duration);
      
      // Simple sine wave swing
      const swing = Math.sin(k * Math.PI) * 1.5;

      // Rotate arm around X axis
      p.rightArm.rotation.x = -swing;

      if (k < 1) requestAnimationFrame(animate);
      else p.rightArm.rotation.x = 0; // Reset
    };
    requestAnimationFrame(animate);
  };

  // --- Input Handling ---

  // LEFT CLICK: Break Block
  noa.inputs.down.on("fire", () => {
    swingHand(); // Visual feedback
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.position;
      room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: AIR });
      noa.setBlock(AIR, pos[0], pos[1], pos[2]);
    }
  });

  // RIGHT CLICK: Place Block
  noa.inputs.down.on("alt-fire", () => {
    swingHand(); // Visual feedback
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.adjacent;
      room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: GRASS });
      noa.setBlock(GRASS, pos[0], pos[1], pos[2]);
    }
  });

  // --- Window Resize Handling ---
  const resizeHands = () => {
    const w = Math.floor(window.innerWidth * devicePixelRatio);
    const h = Math.floor(window.innerHeight * 0.4 * devicePixelRatio); // Keep 40% height ratio
    handsCanvas.width = w;
    handsCanvas.height = h;
    handsViewer.setSize(w, h);
  };

  window.addEventListener("resize", resizeHands);
  // Initial call
  resizeHands();
}

main().catch((e) => {
  console.error(e);
  setHud("Error (check console)");
});