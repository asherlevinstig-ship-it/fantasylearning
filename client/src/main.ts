import { Client } from "colyseus.js";
import { Engine } from "noa-engine";
import { SkinViewer } from "skinview3d";

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
  // CONFIGURATION
  // ========================================================================
  const WORLD_RADIUS = 100; // World ends at x=100, z=100
  const BORDER_BUFFER = 32; // Generate terrain slightly past border for visuals

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

  // Bind 'F' key to 'fire' (Action)
  noa.inputs.bind('fire', 'F');

  // ========================================================================
  // 2. WORLD BORDER LOGIC (Movement Constraint)
  // ========================================================================
  noa.on('tick', () => {
    const pos = noa.entities.getPosition(noa.playerEntity);
    let modified = false;

    // Check X Bounds
    if (pos[0] > WORLD_RADIUS) { 
      pos[0] = WORLD_RADIUS; 
      modified = true; 
    } else if (pos[0] < -WORLD_RADIUS) { 
      pos[0] = -WORLD_RADIUS; 
      modified = true; 
    }

    // Check Z Bounds
    if (pos[2] > WORLD_RADIUS) { 
      pos[2] = WORLD_RADIUS; 
      modified = true; 
    } else if (pos[2] < -WORLD_RADIUS) { 
      pos[2] = -WORLD_RADIUS; 
      modified = true; 
    }

    if (modified) {
      noa.entities.setPosition(noa.playerEntity, pos);
      setHud("🚫 World Border Reached");
    }
  });

  // ========================================================================
  // 3. REGISTER BLOCKS & GENERATE WORLD
  // ========================================================================
  const texGrass = makeTexture("#33cc33");
  const texDirt = makeTexture("#8b5a2b");

  const AIR = 0;
  const GRASS = noa.registry.registerBlock(1, { material: "grass", solid: true, opaque: true, texture: texGrass });
  const DIRT = noa.registry.registerBlock(2, { material: "dirt", solid: true, opaque: true, texture: texDirt });

  const chunkSize: number = noa.world?._chunkSize ?? 16;
  
  noa.world.on("worldDataNeeded", (requestID: string, dataArr: any, cx: number, cy: number, cz: number) => {
      // WORLD BORDER GENERATION CHECK
      // If the chunk is way outside the radius, don't generate terrain (save memory)
      const chunkX = cx * chunkSize;
      const chunkZ = cz * chunkSize;
      
      if (Math.abs(chunkX) > WORLD_RADIUS + BORDER_BUFFER || 
          Math.abs(chunkZ) > WORLD_RADIUS + BORDER_BUFFER) {
        // Return empty air chunk
        noa.world.setChunkData(requestID, dataArr, null);
        return;
      }

      // Normal Terrain Generation
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

  // Common Skin URL
  const SKIN_URL = "https://heads.playcdu.co/skin/c06f89064c8a49119c29ea1dbd1aab82"; 

  // ========================================================================
  // 4. HANDS OVERLAY (Classic Minecraft FPS View)
  // ========================================================================
  const handsCanvas = createOverlayCanvas({
    id: "hands-view",
    width: 400,
    height: 400,
    style: {
      left: "auto",      // Unset left
      right: "0px",      // Anchor to right
      bottom: "0px",     // Anchor to bottom
      top: "auto",
      width: "35vw",     // Responsive width for the arm area
      height: "45vh",    // Responsive height
      background: "transparent",
    },
  });

  const handsViewer = new SkinViewer({
    canvas: handsCanvas,
    width: 400,
    height: 400,
  });

  handsViewer.fov = 70;
  handsViewer.zoom = 1.0;
  
  await handsViewer.loadSkin(SKIN_URL);

  const po = handsViewer.playerObject;
  if (po && po.skin) {
    // Hide everything except the right arm
    po.skin.head.visible = false;
    po.skin.body.visible = false;
    po.skin.leftLeg.visible = false;
    po.skin.rightLeg.visible = false;
    po.skin.leftArm.visible = false; 
    po.skin.rightArm.visible = true;

    // Position the right arm like Minecraft FPS
    po.skin.rightArm.rotation.x = -0.4;  // Tilt forward
    po.skin.rightArm.rotation.z = 0.2;   // Slight outward angle
    po.skin.rightArm.rotation.y = 0.1;   // Slight twist
    
    // Move arm to be centered in our canvas view
    po.skin.rightArm.position.set(-2, -6, 0);
  }

  // Camera: Close up, looking at the arm from the player's POV
  handsViewer.camera.position.set(-4, 0, -8);
  handsViewer.camera.lookAt(-2, -8, 4);

  // Run at 30 FPS for smooth animation
  startThrottledRender(handsViewer, 30);

  // ========================================================================
  // 5. INTERACTION & ANIMATION
  // ========================================================================
  const swingHand = () => {
    const skin = handsViewer.playerObject?.skin;
    if (!skin?.rightArm) return;

    const start = now();
    const duration = 200; // Fast snap
    
    // Base rotations
    const baseX = -0.4;
    const baseZ = 0.2;

    const animate = () => {
      const t = now() - start;
      const k = Math.min(1, t / duration);
      
      // Swing arc
      const swing = Math.sin(k * Math.PI);
      
      // Apply swing
      skin.rightArm.rotation.x = baseX - swing * 1.2;
      skin.rightArm.rotation.z = baseZ - swing * 0.3;

      if (k < 1) requestAnimationFrame(animate);
      else {
        skin.rightArm.rotation.x = baseX;
        skin.rightArm.rotation.z = baseZ;
      }
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

  // LEFT CLICK or 'F' Key: Break Block
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
  const OVERLAY_DPR = Math.min(1.25, window.devicePixelRatio || 1);

  const resizeHands = () => {
    // Scale canvas based on window size, but cap it at 400px raw size
    const rawSize = Math.min(window.innerWidth * 0.35, 400);
    const size = Math.floor(rawSize * OVERLAY_DPR);
    
    handsCanvas.width = size;
    handsCanvas.height = size;
    handsViewer.setSize(size, size);
  };

  window.addEventListener("resize", resizeHands);
  resizeHands();
}

main().catch((e) => {
  console.error(e);
  setHud("Error (check console)");
});