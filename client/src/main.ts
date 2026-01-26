import { Client } from "colyseus.js";
import { Engine } from "noa-engine";
import { SkinViewer, WalkingAnimation } from "skinview3d";

// --------------------------------------------------------------------------
// HELPER: HUD
// --------------------------------------------------------------------------
const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

// --------------------------------------------------------------------------
// HELPER: TEXTURE GENERATION
// --------------------------------------------------------------------------
function makeTexture(colorHex: string) {
  const c = document.createElement("canvas");
  c.width = 16; c.height = 16;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = colorHex;
  ctx.fillRect(0, 0, 16, 16);
  return c.toDataURL();
}

// --------------------------------------------------------------------------
// HELPER: OVERLAY CANVAS
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
    pointerEvents: "none",
    imageRendering: "pixelated",
    zIndex: "100",
    ...opts.style,
  });
  
  document.body.appendChild(c);
  return c;
}

// --------------------------------------------------------------------------
// HELPER: THROTTLED RENDER LOOP
// --------------------------------------------------------------------------
function startThrottledRender(viewer: SkinViewer, fps = 30) {
  const frameMs = 1000 / fps;
  let last = performance.now();

  const loop = (t: number) => {
    if (t - last >= frameMs) {
      viewer.render();
      last = t;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
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
    playerStart: [0, 10, 0],
    texturePath: ""
  });
  (window as any).noa = noa;

  // ========================================================================
  // 2. REGISTER BLOCKS & GENERATE WORLD
  // ========================================================================
  const texGrass = makeTexture("#33cc33");
  const texDirt = makeTexture("#8b5a2b");

  const AIR = 0;
  const GRASS = noa.registry.registerBlock(1, { material: "grass", solid: true, opaque: true, texture: texGrass });
  const DIRT = noa.registry.registerBlock(2, { material: "dirt", solid: true, opaque: true, texture: texDirt });

  const chunkSize: number = noa.world?._chunkSize ?? 16;
  noa.world.on("worldDataNeeded", (requestID: string, dataArr: any, cx: number, cy: number, cz: number) => {
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

  // Common Skin URL (CORS friendly)
  const SKIN_URL = "https://heads.playcdu.co/skin/c06f89064c8a49119c29ea1dbd1aab82"; 

  // ========================================================================
  // 3. PLAYER OVERLAY (Bottom-Left)
  // ========================================================================
  const playerCanvas = createOverlayCanvas({
    id: "player-view",
    width: 160,
    height: 160,
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
    width: 160,
    height: 160,
  });

  // Optimize Player Viewer
  playerViewer.fov = 50;
  playerViewer.zoom = 0.8;
  playerViewer.autoRotate = true; 
  playerViewer.autoRotateSpeed = 0.5;
  await playerViewer.loadSkin(SKIN_URL);
  
  const walkAnim = new WalkingAnimation(playerViewer);
  walkAnim.speed = 1.0;
  playerViewer.animation = walkAnim;

  // Run at low FPS (15) since it's just a UI element
  startThrottledRender(playerViewer, 15);

  // ========================================================================
  // 4. HANDS OVERLAY (FPS View)
  // ========================================================================
  const handsCanvas = createOverlayCanvas({
    id: "hands-view",
    width: window.innerWidth,
    height: window.innerHeight * 0.28, // Reduced to 28vh
    style: {
      left: "0px",
      bottom: "0px",
      top: "auto",
      width: "100vw",
      height: "28vh", // Reduced height
      background: "transparent",
    },
  });

  const handsViewer = new SkinViewer({
    canvas: handsCanvas,
    width: handsCanvas.width,
    height: handsCanvas.height,
  });

  // FPS Camera Setup
  handsViewer.fov = 70;
  handsViewer.zoom = 1.0;
  
  await handsViewer.loadSkin(SKIN_URL);

  const po = handsViewer.playerObject;
  if (po && po.skin) {
    // 1. Rotate player 180 degrees so we see the "back" of the arms (FPS style)
    po.rotation.y = Math.PI;

    // 2. Hide body parts
    po.skin.head.visible = false;
    po.skin.body.visible = false;
    po.skin.leftLeg.visible = false;
    po.skin.rightLeg.visible = false;
    po.skin.leftArm.visible = true;
    po.skin.rightArm.visible = true;

    // 3. Position Arms (Wider & Angled for FPS view)
    // Left Arm
    po.skin.leftArm.rotation.x = -Math.PI / 4; // Point forward
    po.skin.leftArm.rotation.z = -0.3;         // Spread out to left
    po.skin.leftArm.position.x = 2.5;          // Move wider from body center
    
    // Right Arm
    po.skin.rightArm.rotation.x = -Math.PI / 4; // Point forward
    po.skin.rightArm.rotation.z = 0.3;          // Spread out to right
    po.skin.rightArm.position.x = -2.5;         // Move wider from body center
  }

  // Camera looking slightly down at the arms
  handsViewer.camera.position.set(0, 10, -25); // Behind the player (negative Z)
  handsViewer.camera.lookAt(0, -5, 10);        // Look forward/down

  // Run at medium FPS (30) for responsiveness without burning GPU
  startThrottledRender(handsViewer, 30);

  // ========================================================================
  // 5. INTERACTION & ANIMATION
  // ========================================================================
  const swingHand = () => {
    const skin = handsViewer.playerObject?.skin;
    if (!skin?.rightArm) return;

    const start = now();
    const duration = 150; 
    const baseRotX = -Math.PI / 4; 

    const animate = () => {
      const t = now() - start;
      const k = Math.min(1, t / duration);
      
      const swing = Math.sin(k * Math.PI) * 1.5;
      skin.rightArm.rotation.x = baseRotX - swing; 
      // Note: Swinging "negative" moves it "up" relative to the new rotation logic,
      // adjust sign if it swings the wrong way.

      if (k < 1) requestAnimationFrame(animate);
      else skin.rightArm.rotation.x = baseRotX;
    };
    requestAnimationFrame(animate);
  };

  // ========================================================================
  // 6. COLYSEUS NETWORKING
  // ========================================================================
  setHud("Connecting...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");
  (window as any).room = room;

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  room.onMessage("blockUpdate", (msg) => {
    noa.setBlock(msg.id, msg.x, msg.y, msg.z);
  });

  noa.inputs.down.on("fire", () => {
    swingHand(); 
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.position;
      room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: AIR });
      noa.setBlock(AIR, pos[0], pos[1], pos[2]);
    }
  });

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
  const OVERLAY_DPR = Math.min(1.25, window.devicePixelRatio || 1);

  const resizeHands = () => {
    const w = Math.floor(window.innerWidth * OVERLAY_DPR);
    const h = Math.floor(window.innerHeight * 0.28 * OVERLAY_DPR); // 28vh
    
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