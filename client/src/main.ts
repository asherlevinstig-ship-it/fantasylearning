import { Client } from "colyseus.js";
import { Engine } from "noa-engine";
import { SkinViewer } from "skinview3d";
import { TownGenerator } from "./TownGenerator";

// --------------------------------------------------------------------------
// HELPER: HUD
// --------------------------------------------------------------------------
const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { 
    if (hudEl) hudEl.textContent = t; 
    console.log(`[HUD] ${t}`);
};

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
  console.log("🚀 Starting Client...");
  setHud("Initializing...");

  // ========================================================================
  // 1. CONFIGURATION
  // ========================================================================
  const WORLD_RADIUS = 2000;
  const BORDER_BUFFER = 64;

  // ========================================================================
  // 2. INITIALIZE GENERATOR
  // ========================================================================
  const townGen = new TownGenerator(4000, 4000, 12345);

  setHud("Starting Engine...");

  // ========================================================================
  // 3. SETUP NOA ENGINE
  // ========================================================================
  const noa: any = new Engine({
    debug: true,
    chunkSize: 32,           
    chunkAddDistance: 12,    // Reduced for debugging
    chunkRemoveDistance: 14, 
    playerStart: [0, 15, 0], // Start above ground (ground is y=10)
    texturePath: ""          
  });
  (window as any).noa = noa;

  noa.inputs.bind('fire', 'KeyF'); 
  noa.inputs.bind('fire', 'f');

  // ========================================================================
  // 4. WORLD BORDER LOGIC
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
    }
  });

  // ========================================================================
  // 5. REGISTER MATERIALS & BLOCKS
  // ========================================================================
  console.log("🎨 Registering Materials & Blocks...");
  
  noa.registry.registerMaterial("grass", { color: [0.2, 0.8, 0.2] });
  noa.registry.registerMaterial("dirt", { color: [0.55, 0.35, 0.17] });
  noa.registry.registerMaterial("stone", { color: [0.5, 0.5, 0.5] });
  noa.registry.registerMaterial("gravel", { color: [0.7, 0.7, 0.7] });

  const AIR = 0;
  const GRASS = noa.registry.registerBlock(1, { material: "grass", solid: true, opaque: true });
  const DIRT = noa.registry.registerBlock(2, { material: "dirt", solid: true, opaque: true });
  const STONE_BRICK = noa.registry.registerBlock(3, { material: "stone", solid: true, opaque: true });
  const GRAVEL = noa.registry.registerBlock(4, { material: "gravel", solid: true, opaque: true });

  console.log(`📦 Block IDs: AIR=${AIR}, GRASS=${GRASS}, DIRT=${DIRT}, STONE=${STONE_BRICK}, GRAVEL=${GRAVEL}`);

  // ========================================================================
  // 6. CHUNK GENERATION - WITH DEBUG
  // ========================================================================
  const chunkSize = noa.world._chunkSize;
  console.log(`📐 Chunk size: ${chunkSize}`);

  let chunkCount = 0;
  let debuggedSpawnChunk = false;

  noa.world.on("worldDataNeeded", (requestID: string, dataArr: any, cx: number, cy: number, cz: number) => {
      chunkCount++;
      
      const chunkX = cx * chunkSize;
      const chunkY = cy * chunkSize;
      const chunkZ = cz * chunkSize;
      
      // DEBUG: Log the spawn chunk in detail
      if (!debuggedSpawnChunk && cx === 0 && cy === 0 && cz === 0) {
          debuggedSpawnChunk = true;
          console.log(`🎯 SPAWN CHUNK [0,0,0] being generated!`);
          console.log(`   World coords: (${chunkX} to ${chunkX + chunkSize - 1}, ${chunkY} to ${chunkY + chunkSize - 1}, ${chunkZ} to ${chunkZ + chunkSize - 1})`);
          
          // Test specific blocks near spawn
          for (let testY = 8; testY <= 12; testY++) {
              const id = townGen.getBlockID(0, testY, 0);
              const name = ["AIR", "GRASS", "DIRT", "STONE", "GRAVEL"][id];
              console.log(`   Block at [0, ${testY}, 0] = ${name} (${id})`);
          }
      }

      // Skip chunks outside world
      if (Math.abs(chunkX) > WORLD_RADIUS + BORDER_BUFFER || 
          Math.abs(chunkZ) > WORLD_RADIUS + BORDER_BUFFER) {
        noa.world.setChunkData(requestID, dataArr, null);
        return;
      }

      // Fill the chunk
      let solidCount = 0;
      for (let x = 0; x < chunkSize; x++) {
        for (let z = 0; z < chunkSize; z++) {
          for (let y = 0; y < chunkSize; y++) {
            const globalX = chunkX + x;
            const globalY = chunkY + y;
            const globalZ = chunkZ + z;

            const id = townGen.getBlockID(globalX, globalY, globalZ);
            dataArr.set(x, y, z, id);
            
            if (id !== AIR) solidCount++;
          }
        }
      }
      
      // Log chunk stats for first few chunks
      if (chunkCount <= 10) {
          console.log(`📦 Chunk #${chunkCount} [${cx},${cy},${cz}]: ${solidCount} solid blocks`);
      }

      noa.world.setChunkData(requestID, dataArr, null);
    }
  );

  // ========================================================================
  // 7. PLAYER POSITION DEBUG
  // ========================================================================
  let lastLogTime = 0;
  noa.on('tick', () => {
      const now = Date.now();
      if (now - lastLogTime > 2000) { // Log every 2 seconds
          lastLogTime = now;
          const pos = noa.entities.getPosition(noa.playerEntity);
          console.log(`👤 Player at [${pos[0].toFixed(1)}, ${pos[1].toFixed(1)}, ${pos[2].toFixed(1)}]`);
          
          // Check if there's a block under the player
          const blockBelow = noa.getBlock(Math.floor(pos[0]), Math.floor(pos[1]) - 1, Math.floor(pos[2]));
          const blockAt = noa.getBlock(Math.floor(pos[0]), Math.floor(pos[1]), Math.floor(pos[2]));
          console.log(`   Block below feet: ${blockBelow}, Block at feet: ${blockAt}`);
      }
  });

  const SKIN_URL = "https://heads.playcdu.co/skin/c06f89064c8a49119c29ea1dbd1aab82"; 

  // ========================================================================
  // 8. HANDS OVERLAY
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
    po.skin.head.visible = false;
    po.skin.body.visible = false;
    po.skin.leftLeg.visible = false;
    po.skin.rightLeg.visible = false;
    po.skin.leftArm.visible = false; 
    po.skin.rightArm.visible = true;

    po.skin.rightArm.rotation.x = -0.4;
    po.skin.rightArm.rotation.z = 0.2;
    po.skin.rightArm.rotation.y = 0.1;
    po.skin.rightArm.position.set(-2, -6, 0);
  }

  handsViewer.camera.position.set(-4, 0, -8);
  handsViewer.camera.lookAt(-2, -8, 4);
  startThrottledRender(handsViewer, 30);

  // ========================================================================
  // 9. INTERACTION
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
  // 10. COLYSEUS NETWORKING
  // ========================================================================
  setHud("Connecting...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");
  (window as any).room = room;

  console.log(`🟢 Connected: ${room.sessionId}`);
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
  // 11. CHUNK SUBSCRIPTION
  // ========================================================================
  const SERVER_CHUNK_SIZE = 16; 
  const SUBSCRIPTION_RADIUS = 8;

  setInterval(() => {
    const p = noa.entities.getPosition(noa.playerEntity);
    const cx = Math.floor(p[0] / SERVER_CHUNK_SIZE);
    const cy = Math.floor(p[1] / SERVER_CHUNK_SIZE);
    const cz = Math.floor(p[2] / SERVER_CHUNK_SIZE);
    room.send("subscribeChunks", { cx, cy, cz, r: SUBSCRIPTION_RADIUS });
  }, 250);

  // ========================================================================
  // 12. RESIZE HANDLING
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
  console.error("❌ FATAL:", e);
  setHud("Error (check console)");
});