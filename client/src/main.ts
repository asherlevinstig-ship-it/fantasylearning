import { Client } from "colyseus.js";
import { Engine } from "noa-engine";
import { SkinViewer, WalkingAnimation } from "skinview3d";

// --------------------------------------------------------------------------
// HELPER: HUD
// --------------------------------------------------------------------------
const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

// --------------------------------------------------------------------------
// HELPER: TEXTURE GENERATION (Fixes "Invisible World" bug)
// --------------------------------------------------------------------------
function makeTexture(colorHex: string) {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 16, 16);
  return c.toDataURL(); // Returns "data:image/png..."
}

// --------------------------------------------------------------------------
// HELPER: OVERLAY CANVAS (Fixes "Invisible Hands" bug via zIndex)
// --------------------------------------------------------------------------
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
    pointerEvents: "none", // Let clicks pass through to the game
    imageRendering: "pixelated",
    zIndex: "100", // Forces this canvas ABOVE the game world
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

  // ========================================================================
  // 1. SETUP NOA ENGINE
  // ========================================================================
  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
    playerStart: [0, 10, 0], // Fall from sky
    texturePath: "" // We use data URLs, so no path needed
  });

  // Expose for debugging
  (window as any).noa = noa;

  // ========================================================================
  // 2. REGISTER BLOCKS & GENERATE WORLD
  // ========================================================================
  
  // 2a. Generate Textures
  const texGrass = makeTexture("#33cc33"); // Green
  const texDirt = makeTexture("#8b5a2b");  // Brown

  // 2b. Register Blocks
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

  // 2c. World Generation Logic (Flat Grass)
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

  // ========================================================================
  // 3. PLAYER OVERLAY (Bottom-Left)
  // ========================================================================
  const playerCanvas = createOverlayCanvas({
    id: "player-view",
    width: 320,
    height: 320,
    style: {
      left: "12px",
      bottom: "12px",
      top: "auto",
      width: "160px", 
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

  playerViewer.fov = 60;
  playerViewer.zoom = 0.9;
  playerViewer.autoRotate = true; 
  playerViewer.autoRotateSpeed = 0.5;

  // Load Valid Skin (Crafatar URL)
  const SKIN_URL = "https://crafatar.com/skins/c06f89064c8a49119c29ea1dbd1aab82"; // Steve
  await playerViewer.loadSkin(SKIN_URL);
  
  const walkAnim = new WalkingAnimation(playerViewer);
  walkAnim.speed = 1.0;
  playerViewer.animation = walkAnim;

  // ========================================================================
  // 4. HANDS OVERLAY (Bottom-Center, First Person)
  // ========================================================================
  const handsCanvas = createOverlayCanvas({
    id: "hands-view",
    width: window.innerWidth,
    height: window.innerHeight * 0.4,
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
  
  await handsViewer.loadSkin(SKIN_URL);

  // FIX: Access body parts via playerObject.skin property
  const po = handsViewer.playerObject;
  
  if (po && po.skin) {
    // Hide body parts we don't want
    po.skin.head.visible = false;
    po.skin.body.visible = false;
    po.skin.leftLeg.visible = false;
    po.skin.rightLeg.visible = false;

    // Ensure arms are visible
    po.skin.leftArm.visible = true;
    po.skin.rightArm.visible = true;

    // Position arms slightly forward/inward for FPS view
    // Note: The library uses Three.js objects
    // This adjusts the 'rest' position of the arms relative to the body center
    // Values are approximate to make them look like "hands holding items"
    po.skin.leftArm.rotation.x = -0.5;
    po.skin.rightArm.rotation.x = -0.5;
    
    // Slight spread
    po.skin.leftArm.rotation.z = 0.1;
    po.skin.rightArm.rotation.z = -0.1;
  }

  // Adjust camera to look down at where the hands are
  // Camera is relative to the player center
  handsViewer.camera.position.set(0, 0, 30); // Move camera back
  handsViewer.camera.lookAt(0, 0, 0);       // Look at center
  
  // NOTE: skinview3d camera controls might override lookAt if orbit controls are active,
  // but for a static view, we often just zoom/position the camera manually.
  // Let's force a specific view:
  handsViewer.camera.position.set(0, 10, 40);
  handsViewer.camera.lookAt(0, -10, 0);

  // CRITICAL: Continuous Render Loop for Hands
  const renderLoop = () => {
    handsViewer.render();
    requestAnimationFrame(renderLoop);
  };
  renderLoop();

  // ========================================================================
  // 5. INTERACTION & ANIMATION
  // ========================================================================
  
  const swingHand = () => {
    // FIX: Access via .skin
    const skin = handsViewer.playerObject?.skin;
    if (!skin?.rightArm) return;

    const start = now();
    const duration = 150; // ms
    const baseRot = -0.5; // The resting rotation we set earlier

    const animate = () => {
      const t = now() - start;
      const k = Math.min(1, t / duration);
      
      // Swing logic
      const swing = Math.sin(k * Math.PI) * 1.5;
      skin.rightArm.rotation.x = baseRot - swing;

      if (k < 1) requestAnimationFrame(animate);
      else skin.rightArm.rotation.x = baseRot; // Reset
    };
    requestAnimationFrame(animate);
  };

  // ========================================================================
  // 6. COLYSEUS NETWORKING
  // ========================================================================
  setHud("Connecting to server...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");
  (window as any).room = room;

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  // Handle incoming block updates
  room.onMessage("blockUpdate", (msg) => {
    noa.setBlock(msg.id, msg.x, msg.y, msg.z);
  });

  // LEFT CLICK: Break Block
  noa.inputs.down.on("fire", () => {
    swingHand(); 
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.position;
      room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: AIR });
      noa.setBlock(AIR, pos[0], pos[1], pos[2]);
    }
  });

  // RIGHT CLICK: Place Block
  noa.inputs.down.on("alt-fire", () => {
    swingHand();
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.adjacent;
      room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: GRASS });
      noa.setBlock(GRASS, pos[0], pos[1], pos[2]);
    }
  });

  // ========================================================================
  // 7. WINDOW RESIZE HANDLING
  // ========================================================================
  const resizeHands = () => {
    const w = Math.floor(window.innerWidth * devicePixelRatio);
    const h = Math.floor(window.innerHeight * 0.4 * devicePixelRatio); 
    handsCanvas.width = w;
    handsCanvas.height = h;
    handsViewer.setSize(w, h);
  };

  window.addEventListener("resize", resizeHands);
  resizeHands();
}

main().catch((e) => {
  console.error(e);
  setHud("Error (check console)");
});