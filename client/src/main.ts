import { Client } from "colyseus.js";
import { Engine } from "noa-engine";
import { SkinViewer } from "skinview3d";
import { TownGenerator, BlockIDs } from "./TownGenerator";

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
function createOverlayCanvas(opts: { id: string; width: number; height: number; style: Partial<CSSStyleDeclaration>; }) {
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
  setHud(["Initializing Engine..."]);
  createBiomeUI();

  // ========================================================================
  // 1. SETUP NOA ENGINE
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

  // ========================================================================
  // 2. REGISTER BLOCKS & MATERIALS (FIXED: FORCED NUMERIC IDs)
  // ========================================================================
  // Define Materials
  noa.registry.registerMaterial("grass", { color: [0.2, 0.8, 0.2] });
  noa.registry.registerMaterial("dirt", { color: [0.55, 0.35, 0.17] });
  noa.registry.registerMaterial("stone_brick", { color: [0.5, 0.5, 0.5] });
  noa.registry.registerMaterial("gravel", { color: [0.7, 0.7, 0.7] });
  noa.registry.registerMaterial("bedrock", { color: [0.1, 0.1, 0.1] });
  noa.registry.registerMaterial("wood_plank", { color: [0.76, 0.60, 0.42] }); 
  noa.registry.registerMaterial("wood_log", { color: [0.4, 0.3, 0.2] });     
  noa.registry.registerMaterial("roof", { color: [0.3, 0.3, 0.35] });       
  noa.registry.registerMaterial("beacon", { color: [0.2, 1.0, 1.0], alpha: 0.6 }); 
  noa.registry.registerMaterial("glass", { color: [0.8, 0.9, 1.0], alpha: 0.4 });

  // ⚠️ MANUAL ID ASSIGNMENT
  // We explicitly define integers here. Do NOT rely on the engine's return value for the ID logic.
  const ID_GRASS = 1;
  const ID_DIRT = 2;
  const ID_STONE = 3;
  const ID_GRAVEL = 4;
  const ID_BEACON = 5;
  const ID_BEDROCK = 6;
  const ID_WOOD = 7;
  const ID_LOG = 8;
  const ID_GLASS = 9;
  const ID_ROOF = 10;

  // Register them using these IDs
  noa.registry.registerBlock(ID_GRASS, { material: "grass" });
  noa.registry.registerBlock(ID_DIRT, { material: "dirt" });
  noa.registry.registerBlock(ID_STONE, { material: "stone_brick" });
  noa.registry.registerBlock(ID_GRAVEL, { material: "gravel" });
  noa.registry.registerBlock(ID_BEACON, { material: "beacon", opaque: false });
  noa.registry.registerBlock(ID_BEDROCK, { material: "bedrock" });
  noa.registry.registerBlock(ID_WOOD, { material: "wood_plank" });
  noa.registry.registerBlock(ID_LOG, { material: "wood_log" });
  noa.registry.registerBlock(ID_GLASS, { material: "glass", opaque: false });
  noa.registry.registerBlock(ID_ROOF, { material: "roof" });

  // Construct the map using the forced Integers
  const blockIDs: BlockIDs = {
    AIR: 0,
    GRASS: ID_GRASS,
    DIRT: ID_DIRT,
    STONE_BRICK: ID_STONE,
    GRAVEL: ID_GRAVEL,
    BEACON_RAY: ID_BEACON,
    BEDROCK: ID_BEDROCK,
    WOOD_PLANKS: ID_WOOD,
    WOOD_LOG: ID_LOG,
    GLASS: ID_GLASS,
    ROOF_STONE: ID_ROOF,
  };

  // DEBUG CHECK: Ensure these are numbers!
  console.log("✅ Block IDs registered:", blockIDs);
  if (typeof blockIDs.GRASS !== 'number') {
      console.error("❌ CRITICAL ERROR: IDs are strings! World will be broken.");
      setHud(["CRITICAL ERROR", "ID Mismatch", "Check Console"]);
  }

  // ========================================================================
  // 3. INITIALIZE GENERATOR WITH IDs
  // ========================================================================
  console.time("GenInit");
  const townGen = new TownGenerator(4000, 4000, 12345, blockIDs);
  console.timeEnd("GenInit");

  const TOWN_RADIUS_LIMIT = townGen.townRadius + townGen.wallThickness; 
  const WORLD_RADIUS = 2000;

  // ========================================================================
  // 4. INPUTS
  // ========================================================================
  noa.inputs.bind('fire', 'KeyF'); noa.inputs.bind('fire', 'f');
  noa.inputs.bind('alt-fire', 'KeyR'); 
  noa.inputs.bind('home', 'KeyG'); noa.inputs.bind('wall', 'KeyH'); noa.inputs.bind('wild', 'KeyJ');
  noa.inputs.bind('debug', 'F3'); noa.inputs.bind('debug', 'KeyZ'); noa.inputs.bind('debug', 'KeyP'); 

  let showDebug = true; 
  noa.inputs.down.on('debug', () => {
      showDebug = !showDebug; 
      if (hudEl) hudEl.style.display = showDebug ? "block" : "none";
  });

  // ========================================================================
  // 5. TICK LOOP
  // ========================================================================
  noa.on('tick', () => {
    const pos = noa.entities.getPosition(noa.playerEntity);
    let modified = false;

    if (pos[0] > WORLD_RADIUS) { pos[0] = WORLD_RADIUS; modified = true; } 
    else if (pos[0] < -WORLD_RADIUS) { pos[0] = -WORLD_RADIUS; modified = true; }
    if (pos[2] > WORLD_RADIUS) { pos[2] = WORLD_RADIUS; modified = true; } 
    else if (pos[2] < -WORLD_RADIUS) { pos[2] = -WORLD_RADIUS; modified = true; }

    if (modified) noa.entities.setPosition(noa.playerEntity, pos);

    if (showDebug) {
        const x = Math.floor(pos[0]);
        const y = Math.floor(pos[1]);
        const z = Math.floor(pos[2]);
        const dist = Math.floor(Math.sqrt(pos[0]*pos[0] + pos[2]*pos[2]));
        const zoneName = townGen.getZoneName(pos[0], pos[2]);
        let boundaryMsg = zoneName === "Town of Beginnings" 
            ? `Wall Boundary at: ${TOWN_RADIUS_LIMIT}m` 
            : `Distance to Wall: ${dist - TOWN_RADIUS_LIMIT}m`;

        setHud([
            `📍 POS: [${x}, ${y}, ${z}]`,
            `📏 DIST: ${dist}m`,
            `🌍 ZONE: ${zoneName.toUpperCase()}`,
            `🚧 ${boundaryMsg}`
        ]);
    }
  });

  // ========================================================================
  // 6. CHUNK LOADING
  // ========================================================================
  const chunkSize = noa.world._chunkSize;
  noa.world.on("worldDataNeeded", (requestID: string, dataArr: any, cx: number, cy: number, cz: number) => {
      try {
        const chunkX = cx * chunkSize;
        const chunkY = cy * chunkSize;
        const chunkZ = cz * chunkSize;

        // Sampling Logger: Prints 1% of chunk requests to console for debugging
        if (Math.random() < 0.01) { 
             console.log(`[ChunkGen] Generating cx=${cx} cy=${cy} cz=${cz}`);
        }
        
        for (let x = 0; x < chunkSize; x++) {
            const globalX = chunkX + x;
            for (let z = 0; z < chunkSize; z++) {
                const globalZ = chunkZ + z;
                
                // 1. Get Column Data
                const colData = townGen.getColumnInfo(globalX, globalZ);

                for (let y = 0; y < chunkSize; y++) {
                    const globalY = chunkY + y;
                    
                    // 2. Resolve Block ID
                    const id = townGen.resolveBlockID(globalY, colData);
                    
                    // 3. Set the Block (Ensure it is a valid Number)
                    // If the generator returns garbage, default to Grass so we see SOMETHING.
                    const safeID = (typeof id === 'number' && isFinite(id)) ? id : ID_GRASS;
                    
                    dataArr.set(x, y, z, safeID);
                }
            }
        }
        noa.world.setChunkData(requestID, dataArr, null);

      } catch (e) {
          console.error("❌ Generator Crashed at", cx, cy, cz, e);
          // Fallback to solid block so user doesn't fall into void
          for (let i = 0; i < dataArr.data.length; i++) dataArr.data[i] = ID_GRASS;
          noa.world.setChunkData(requestID, dataArr, null);
      }
    }
  );

  // ========================================================================
  // 7. SKINS & HANDS
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

    po.skin.rightArm.rotation.set(-0.4, 0.1, 0.2);
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

  // ========================================================================
  // 8. ACTIONS & TELEPORTS
  // ========================================================================
  noa.inputs.down.on("home", () => { noa.entities.setPosition(noa.playerEntity, [0, 50, 0]); });
  noa.inputs.down.on("wall", () => { noa.entities.setPosition(noa.playerEntity, [800, 50, 40]); });
  noa.inputs.down.on("wild", () => { 
      const h = townGen.getHeight(1200, 1200);
      noa.entities.setPosition(noa.playerEntity, [1200, h + 5, 1200]); 
  });

  // ========================================================================
  // 9. COLYSEUS NETWORKING
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
      if (id === blockIDs.BEDROCK) return;
      if (room.connection && room.connection.isOpen) {
        room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: blockIDs.AIR });
      }
      noa.setBlock(blockIDs.AIR, pos[0], pos[1], pos[2]);
    }
  });

  noa.inputs.down.on("alt-fire", () => {
    swingHand();
    if (noa.targetedBlock) {
      const pos = noa.targetedBlock.adjacent;
      if (room.connection && room.connection.isOpen) {
        room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: blockIDs.GRASS });
      }
      noa.setBlock(blockIDs.GRASS, pos[0], pos[1], pos[2]);
    }
  });

  // ========================================================================
  // 10. SERVER SYNC & ZONE LOGIC
  // ========================================================================
  const SERVER_CHUNK_SIZE = 16; 
  let currentZone = "Unknown";
  let pendingZone = "Unknown";
  let pendingSince = 0;

  setInterval(() => {
    if (!room || !room.connection || !room.connection.isOpen) return;

    const p = noa.entities.getPosition(noa.playerEntity);
    const cx = Math.floor(p[0] / SERVER_CHUNK_SIZE);
    const cy = Math.floor(p[1] / SERVER_CHUNK_SIZE);
    const cz = Math.floor(p[2] / SERVER_CHUNK_SIZE);
    room.send("subscribeChunks", { cx, cy, cz, r: 8 });

    const newZone = townGen.getZoneName(p[0], p[2]);
    const t = performance.now();
    if (newZone !== pendingZone) {
        pendingZone = newZone;
        pendingSince = t;
    }

    if (pendingZone !== currentZone && (t - pendingSince) > 350) {
        if (pendingZone === "Town of Beginnings") showBiomeNotification(pendingZone, "Safe Zone");
        else showBiomeNotification(pendingZone, "PvP Enabled");
        currentZone = pendingZone;
    }
  }, 250);

  // Debug Log (Slow)
  setInterval(() => {
    if (!noa.playerEntity) return;
    const p = noa.entities.getPosition(noa.playerEntity);
    const zone = townGen.getZoneName(p[0], p[2]);
    console.log(`[ZONE DEBUG] x=${p[0].toFixed(1)} z=${p[2].toFixed(1)} => ${zone}`);
  }, 1000);

  const resizeHands = () => {
    const rawSize = Math.min(window.innerWidth * 0.35, 400);
    const size = Math.floor(rawSize * Math.min(1.25, window.devicePixelRatio || 1));
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