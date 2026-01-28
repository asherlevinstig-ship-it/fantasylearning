import { Client } from "colyseus.js";
import { Engine } from "noa-engine";
import { SkinViewer } from "skinview3d";
import { TownGenerator } from "./TownGenerator";

// --------------------------------------------------------------------------
// HELPER: HUD (Top Left Debug Info)
// --------------------------------------------------------------------------
const hudEl = document.getElementById("hud") as HTMLDivElement | null;

const setHud = (lines: string[]) => { 
    if (hudEl) {
        hudEl.innerHTML = lines.join("<br>");
        Object.assign(hudEl.style, {
            whiteSpace: "pre-wrap",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            padding: "10px",
            color: "white",
            fontFamily: "monospace",
            display: hudEl.style.display === "none" ? "none" : "block",
            borderRadius: "8px"
        });
    }
};

// --------------------------------------------------------------------------
// HELPER: BIOME NOTIFICATION UI
// --------------------------------------------------------------------------
let biomeEl: HTMLDivElement | null = null;
let biomeTitleEl: HTMLDivElement | null = null;
let biomeSubEl: HTMLDivElement | null = null;
let biomeHideTimer: number | null = null;
let biomeCooldownUntil = 0;

function createBiomeUI() {
  biomeEl = document.createElement("div");
  biomeTitleEl = document.createElement("div");
  biomeSubEl = document.createElement("div");

  biomeTitleEl.textContent = "";
  biomeSubEl.textContent = "";

  biomeEl.appendChild(biomeTitleEl);
  biomeEl.appendChild(biomeSubEl);

  Object.assign(biomeEl.style, {
    position: "fixed",
    top: "18%",
    left: "50%",
    transform: "translateX(-50%) translateY(-10px)",
    textAlign: "center",
    fontFamily: "Impact, system-ui, sans-serif",
    pointerEvents: "none",
    opacity: "0",
    transition: "opacity 300ms ease, transform 300ms ease",
    zIndex: "9999",
    userSelect: "none",
    whiteSpace: "nowrap",
  });

  Object.assign(biomeTitleEl.style, {
    fontSize: "48px",
    color: "#FFD700",
    textShadow: "4px 4px 0px #000",
    lineHeight: "1",
  });

  Object.assign(biomeSubEl.style, {
    marginTop: "6px",
    fontSize: "22px",
    color: "#ffffff",
    textShadow: "3px 3px 0px #000",
    opacity: "0.95",
  });

  document.body.appendChild(biomeEl);
}

function showBiomeNotification(title: string, subtext: string = "") {
  if (!biomeEl || !biomeTitleEl || !biomeSubEl) return;

  const t = performance.now();
  if (t < biomeCooldownUntil) return;
  biomeCooldownUntil = t + 1200; 

  biomeTitleEl.textContent = title;
  biomeSubEl.textContent = subtext;

  if (biomeHideTimer !== null) window.clearTimeout(biomeHideTimer);

  biomeEl.style.opacity = "1";
  biomeEl.style.transform = "translateX(-50%) translateY(0px)";

  biomeHideTimer = window.setTimeout(() => {
    if (!biomeEl) return;
    biomeEl.style.opacity = "0";
    biomeEl.style.transform = "translateX(-50%) translateY(-10px)";
  }, 2500);
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
  setHud(["Initializing Town Generator..."]);
  createBiomeUI();

  // ========================================================================
  // 1. CONFIGURATION
  // ========================================================================
  const WORLD_RADIUS = 2000;
  // REMOVED BORDER_BUFFER used for culling since we removed culling

  // ========================================================================
  // 2. INITIALIZE GENERATOR
  // ========================================================================
  console.time("GenInit");
  const townGen = new TownGenerator(4000, 4000, 12345);
  console.timeEnd("GenInit");

  const TOWN_RADIUS_LIMIT = townGen.townRadius + townGen.wallThickness; 

  setHud(["Starting Engine..."]);

  // ========================================================================
  // 3. SETUP NOA ENGINE
  // ========================================================================
  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,           
    chunkAddDistance: 32,    
    chunkRemoveDistance: 40, 
    playerStart: [0, 50, 0], 
    texturePath: ""          
  });
  (window as any).noa = noa;

  // Inputs
  noa.inputs.bind('fire', 'KeyF'); 
  noa.inputs.bind('fire', 'f');
  noa.inputs.bind('alt-fire', 'KeyR'); 
  noa.inputs.bind('home', 'KeyG'); 
  noa.inputs.bind('wall', 'KeyH'); 
  noa.inputs.bind('wild', 'KeyJ');
  noa.inputs.bind('debug', 'F3'); 
  noa.inputs.bind('debug', 'KeyZ'); 
  noa.inputs.bind('debug', 'KeyP'); 

  let showDebug = true; 

  noa.inputs.down.on('debug', () => {
      showDebug = !showDebug; 
      if (hudEl) hudEl.style.display = showDebug ? "block" : "none";
  });

  // ========================================================================
  // 4. REAL-TIME TRACKER & BORDER LOGIC
  // ========================================================================
  noa.on('tick', () => {
    const pos = noa.entities.getPosition(noa.playerEntity);
    let modified = false;

    // World Border Physics Clamp (Keeps player inside allowed area)
    if (pos[0] > WORLD_RADIUS) { pos[0] = WORLD_RADIUS; modified = true; } 
    else if (pos[0] < -WORLD_RADIUS) { pos[0] = -WORLD_RADIUS; modified = true; }
    if (pos[2] > WORLD_RADIUS) { pos[2] = WORLD_RADIUS; modified = true; } 
    else if (pos[2] < -WORLD_RADIUS) { pos[2] = -WORLD_RADIUS; modified = true; }

    if (modified) noa.entities.setPosition(noa.playerEntity, pos);

    // Update HUD Tracker
    if (showDebug) {
        const x = Math.floor(pos[0]);
        const y = Math.floor(pos[1]);
        const z = Math.floor(pos[2]);
        const dist = Math.floor(Math.sqrt(pos[0]*pos[0] + pos[2]*pos[2]));
        
        const zoneName = townGen.getZoneName(pos[0], pos[2]);
        let boundaryMsg = "";

        if (zoneName === "Town of Beginnings") {
            boundaryMsg = `Wall Boundary at: ${TOWN_RADIUS_LIMIT}m`;
        } else {
            boundaryMsg = `Distance to Wall: ${dist - TOWN_RADIUS_LIMIT}m`;
        }

        setHud([
            `📍 POS: [${x}, ${y}, ${z}]`,
            `📏 DIST: ${dist}m`,
            `🌍 ZONE: ${zoneName.toUpperCase()}`,
            `🚧 ${boundaryMsg}`
        ]);
    }
  });

  // ========================================================================
  // 5. REGISTRY & CHUNKS
  // ========================================================================
  noa.registry.registerMaterial("grass", { color: [0.2, 0.8, 0.2] });
  noa.registry.registerMaterial("dirt", { color: [0.55, 0.35, 0.17] });
  noa.registry.registerMaterial("stone", { color: [0.5, 0.5, 0.5] });
  noa.registry.registerMaterial("gravel", { color: [0.7, 0.7, 0.7] });
  noa.registry.registerMaterial("beacon", { color: [1.0, 0.0, 0.0] });
  noa.registry.registerMaterial("bedrock", { color: [0.1, 0.1, 0.1] });

  const AIR = 0;
  const GRASS = noa.registry.registerBlock(1, { material: "grass", solid: true, opaque: true });
  const DIRT = noa.registry.registerBlock(2, { material: "dirt", solid: true, opaque: true });
  const STONE_BRICK = noa.registry.registerBlock(3, { material: "stone", solid: true, opaque: true });
  const GRAVEL = noa.registry.registerBlock(4, { material: "gravel", solid: true, opaque: true });
  const BEACON = noa.registry.registerBlock(5, { material: "beacon", solid: true, opaque: true });
  const BEDROCK = noa.registry.registerBlock(6, { material: "bedrock", solid: true, opaque: true });

  const chunkSize = noa.world._chunkSize;

  noa.world.on("worldDataNeeded", (requestID: string, dataArr: any, cx: number, cy: number, cz: number) => {
      const chunkX = cx * chunkSize;
      const chunkY = cy * chunkSize;
      const chunkZ = cz * chunkSize;
      
      // FIX: REMOVED THE VOID CULLING LOGIC HERE
      // Previously, we returned null if x > 2000, which made "The Wilderness" invisible.
      // Now we just generate everything. The clamp in tick() stops the player.

      for (let x = 0; x < chunkSize; x++) {
        const globalX = chunkX + x;
        for (let z = 0; z < chunkSize; z++) {
          const globalZ = chunkZ + z;
          const colData = townGen.getColumnInfo(globalX, globalZ);

          for (let y = 0; y < chunkSize; y++) {
            const globalY = chunkY + y;
            const id = townGen.resolveBlockID(globalY, colData);
            dataArr.set(x, y, z, id);
          }
        }
      }
      noa.world.setChunkData(requestID, dataArr, null);
    }
  );

  // ========================================================================
  // 6. HANDS OVERLAY
  // ========================================================================
  const SKIN_URL = "https://heads.playcdu.co/skin/c06f89064c8a49119c29ea1dbd1aab82"; 
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

  noa.inputs.down.on("home", () => {
      noa.entities.setPosition(noa.playerEntity, [0, 50, 0]);
      noa.entities.getPhysicsBody(noa.playerEntity).velocity = [0,0,0];
  });
  noa.inputs.down.on("wall", () => {
      noa.entities.setPosition(noa.playerEntity, [800, 50, 40]);
      noa.entities.getPhysicsBody(noa.playerEntity).velocity = [0,0,0];
  });
  noa.inputs.down.on("wild", () => {
      // Use generator to find safe height
      const h = townGen.getHeight(1200, 1200);
      noa.entities.setPosition(noa.playerEntity, [1200, h + 5, 1200]);
      noa.entities.getPhysicsBody(noa.playerEntity).velocity = [0,0,0];
  });

  // ========================================================================
  // 7. COLYSEUS NETWORKING
  // ========================================================================
  setHud(["Connecting..."]);
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");
  (window as any).room = room;

  console.log(`🟢 Connected: ${room.sessionId}`);

  room.onMessage("worldInfo", (msg) => console.log("WorldInfo:", msg));
  room.onMessage("blockUpdate", (msg) => noa.setBlock(msg.id, msg.x, msg.y, msg.z));

  noa.inputs.down.on("fire", () => {
    swingHand(); 
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.position;
      const id = noa.getBlock(pos[0], pos[1], pos[2]);
      if (id === BEDROCK) return;
      if (room.connection && room.connection.isOpen) {
        room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: AIR });
      }
      noa.setBlock(AIR, pos[0], pos[1], pos[2]);
    }
  });

  noa.inputs.down.on("alt-fire", () => {
    swingHand();
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.adjacent;
      if (room.connection && room.connection.isOpen) {
        room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: GRASS });
      }
      noa.setBlock(GRASS, pos[0], pos[1], pos[2]);
    }
  });

  // ========================================================================
  // 8. SERVER SYNC & ZONE CHECK
  // ========================================================================
  const SERVER_CHUNK_SIZE = 16; 
  const SUBSCRIPTION_RADIUS = 8;
  
  let currentZone = "Unknown";
  let pendingZone = "Unknown";
  let pendingSince = 0;

  // FAST LOOP (250ms) - Subscriptions & UI Updates
  setInterval(() => {
    if (!room || !room.connection || !room.connection.isOpen) return;

    const p = noa.entities.getPosition(noa.playerEntity);
    const cx = Math.floor(p[0] / SERVER_CHUNK_SIZE);
    const cy = Math.floor(p[1] / SERVER_CHUNK_SIZE);
    const cz = Math.floor(p[2] / SERVER_CHUNK_SIZE);
    room.send("subscribeChunks", { cx, cy, cz, r: SUBSCRIPTION_RADIUS });

    const newZone = townGen.getZoneName(p[0], p[2]);

    const t = performance.now();
    if (newZone !== pendingZone) {
        pendingZone = newZone;
        pendingSince = t;
    }

    if (pendingZone !== currentZone && (t - pendingSince) > 350) {
        console.log(`🗺️ Zone Change: ${currentZone} -> ${pendingZone}`);
        if (pendingZone === "Town of Beginnings") {
            showBiomeNotification(pendingZone, "Safe Zone");
        } else {
            showBiomeNotification(pendingZone, "PvP Enabled");
        }
        currentZone = pendingZone;
    }
  }, 250);

  // ========================================================================
  // 9. DEBUG: FORCED ZONE CHECKER (1000ms)
  // ========================================================================
  // This is the "Brutal Debug" line to verify coordinate math
  setInterval(() => {
    if (!noa.playerEntity) return;
    const p = noa.entities.getPosition(noa.playerEntity);
    const x = p[0], z = p[2];

    const dist = Math.sqrt(x * x + z * z);
    const limit = townGen.townRadius + townGen.wallThickness;
    const zone = townGen.getZoneName(x, z);

    console.log(`[ZONE DEBUG] x=${x.toFixed(1)} z=${z.toFixed(1)} dist=${dist.toFixed(1)} limit=${limit} => ${zone}`);
  }, 1000);

  // ========================================================================
  // 10. RESIZE
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
  setHud(["Error (check console)"]);
});