import { Client } from "colyseus.js";
import { Engine } from "noa-engine";
import { SkinViewer } from "skinview3d";
import { TownGenerator } from "./TownGenerator"; 

// --------------------------------------------------------------------------
// HELPER: HUD
// --------------------------------------------------------------------------
const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

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
  setHud("Generating World...");

  // ========================================================================
  // CONFIGURATION (SCALED UP)
  // ========================================================================
  const WORLD_RADIUS = 500; // World ends at x=500, z=500 (1000x1000 total)
  const BORDER_BUFFER = 32;

  // ========================================================================
  // 1. CLIENT-SIDE TOWN GENERATION (SHARED SEED)
  // ========================================================================
  // A fast lookup map for our static world data
  // Key: "x,y,z" -> Value: BlockID
  const clientWorldMap = new Map<string, number>();

  // Generate 1000x1000 area (Same as Server)
  const townGen = new TownGenerator(1000, 1000, 12345); 
  
  townGen.generate((x, y, z, id) => {
      clientWorldMap.set(`${x},${y},${z}`, id);
  });
  
  console.log(`✅ Client World Generated: ${clientWorldMap.size} blocks.`);
  setHud("Starting noa...");

  // ========================================================================
  // 2. SETUP NOA ENGINE (Optimized Chunk Settings)
  // ========================================================================
  const noa: any = new Engine({
    debug: true,
    chunkSize: 32,           // Optimized: 32 blocks per chunk (fewer draw calls)
    chunkAddDistance: 8,     // Optimized: Load chunks far away (~256 blocks)
    chunkRemoveDistance: 10, // Optimized: Keep them in memory longer
    playerStart: [0, 15, 0], // Start safely above ground
    texturePath: ""          // Not used with color materials
  });
  (window as any).noa = noa;

  // ------------------------------------------------------------------------
  // ACTION BINDING: 'F' acts as 'Fire' (Left Click)
  // ------------------------------------------------------------------------
  // FIX: Use 'KeyF' (physical key) instead of 'F' (character)
  // We also bind 'f' just in case, but 'KeyF' is the robust standard.
  noa.inputs.bind('fire', 'KeyF'); 
  noa.inputs.bind('fire', 'f'); 

  // ========================================================================
  // 3. WORLD BORDER LOGIC
  // ========================================================================
  noa.on('tick', () => {
    const pos = noa.entities.getPosition(noa.playerEntity);
    let modified = false;

    if (pos[0] > WORLD_RADIUS) { pos[0] = WORLD_RADIUS; modified = true; } 
    else if (pos[0] < -WORLD_RADIUS) { pos[0] = -WORLD_RADIUS; modified = true; }

    if (pos[2] > WORLD_RADIUS) { pos[2] = WORLD_RADIUS; modified = true; } 
    else if (pos[2] < -WORLD_RADIUS) { pos[2] = -WORLD_RADIUS; modified = true; }

    if (modified) {
      noa.entities.setPosition(noa.playerEntity, pos);
      setHud("🚫 World Border Reached");
    }
  });

  // ========================================================================
  // 4. REGISTER MATERIALS & BLOCKS
  // ========================================================================
  
  // -- A. Register Materials --
  // Colors are [R, G, B] from 0.0 to 1.0
  noa.registry.registerMaterial("grass", { color: [0.2, 0.8, 0.2] });
  noa.registry.registerMaterial("dirt", { color: [0.55, 0.35, 0.17] });
  noa.registry.registerMaterial("stone", { color: [0.5, 0.5, 0.5] });
  noa.registry.registerMaterial("gravel", { color: [0.7, 0.7, 0.7] });

  // -- B. Register Blocks --
  const AIR = 0;
  
  const GRASS = noa.registry.registerBlock(1, { material: "grass", solid: true, opaque: true });
  const DIRT = noa.registry.registerBlock(2, { material: "dirt", solid: true, opaque: true });
  const STONE_BRICK = noa.registry.registerBlock(3, { material: "stone", solid: true, opaque: true });
  const GRAVEL = noa.registry.registerBlock(4, { material: "gravel", solid: true, opaque: true });

  const chunkSize: number = noa.world?._chunkSize ?? 32;
  
  // ------------------------------------------------------------------------
  // CHUNK LOADING (FROM GENERATED MAP)
  // ------------------------------------------------------------------------
  noa.world.on("worldDataNeeded", (requestID: string, dataArr: any, cx: number, cy: number, cz: number) => {
      const chunkX = cx * chunkSize;
      const chunkY = cy * chunkSize;
      const chunkZ = cz * chunkSize;
      
      // Optimization: Don't render far outside the world boundaries
      if (Math.abs(chunkX) > WORLD_RADIUS + BORDER_BUFFER || 
          Math.abs(chunkZ) > WORLD_RADIUS + BORDER_BUFFER) {
        noa.world.setChunkData(requestID, dataArr, null);
        return;
      }

      for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
          for (let y = 0; y < chunkSize; y++) {
            const gx = chunkX + x;
            const gy = chunkY + y;
            const gz = chunkZ + z;

            const id = clientWorldMap.get(`${gx},${gy},${gz}`) || AIR;
            dataArr.set(x, y, z, id);
          }
        }
      }
      noa.world.setChunkData(requestID, dataArr, null);
    }
  );

  const SKIN_URL = "https://heads.playcdu.co/skin/c06f89064c8a49119c29ea1dbd1aab82"; 

  // ========================================================================
  // 5. HANDS OVERLAY
  // ========================================================================
  const handsCanvas = createOverlayCanvas({
    id: "hands-view",
    width: 400,
    height: 400,
    style: {
      left: "auto", right: "0px", bottom: "0px", top: "auto",
      width: "35vw", height: "45vh", background: "transparent",
    },
  });

  const handsViewer = new SkinViewer({ canvas: handsCanvas, width: 400, height: 400 });
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
    po.skin.rightArm.rotation.x = -0.4; // Tilt forward
    po.skin.rightArm.rotation.z = 0.2;  // Slight outward angle
    po.skin.rightArm.rotation.y = 0.1;  // Slight twist
    
    // Move arm to be centered in our canvas view
    po.skin.rightArm.position.set(-2, -6, 0);
  }

  // Camera: Close up, looking at the arm from the player's POV
  handsViewer.camera.position.set(-4, 0, -8);
  handsViewer.camera.lookAt(-2, -8, 4);
  startThrottledRender(handsViewer, 30);

  // ========================================================================
  // 6. INTERACTION
  // ========================================================================
  const swingHand = () => {
    const skin = handsViewer.playerObject?.skin;
    if (!skin?.rightArm) return;
    const start = now();
    const duration = 200; 
    const baseX = -0.4;
    const baseZ = 0.2;

    const animate = () => {
      const t = now() - start;
      const k = Math.min(1, t / duration);
      const swing = Math.sin(k * Math.PI);
      
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
  // 7. COLYSEUS NETWORKING
  // ========================================================================
  setHud("Connecting...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");
  (window as any).room = room;

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);

  // Handle Server Updates
  room.onMessage("blockUpdate", (msg) => {
    noa.setBlock(msg.id, msg.x, msg.y, msg.z);
    clientWorldMap.set(`${msg.x},${msg.y},${msg.z}`, msg.id);
  });

  // LEFT CLICK or 'F' Key: Break Block
  // Both trigger the 'fire' event.
  // We added 'KeyF' to the binding above, so this will now catch the keypress.
  noa.inputs.down.on("fire", () => {
    swingHand(); 
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.position;
      room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: AIR });
      
      // Optimistic Update
      noa.setBlock(AIR, pos[0], pos[1], pos[2]);
      clientWorldMap.set(`${pos[0]},${pos[1]},${pos[2]}`, AIR);
    }
  });

  // RIGHT CLICK: Place Block
  noa.inputs.down.on("alt-fire", () => {
    swingHand();
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.adjacent;
      room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: GRASS });
      
      // Optimistic Update
      noa.setBlock(GRASS, pos[0], pos[1], pos[2]);
      clientWorldMap.set(`${pos[0]},${pos[1]},${pos[2]}`, GRASS);
    }
  });

  // ========================================================================
  // 8. RESIZE HANDLING
  // ========================================================================
  const OVERLAY_DPR = Math.min(1.25, window.devicePixelRatio || 1);
  const resizeHands = () => {
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