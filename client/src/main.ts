// client/src/main.ts

import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

function makeRuntimeAtlas(tileSize = 16) {
  // 2 tiles wide (grass, dirt), 1 tile high
  const canvas = document.createElement("canvas");
  canvas.width = tileSize * 2;
  canvas.height = tileSize;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Could not get 2D context for runtime atlas.");

  // tile 0: grass (simple color)
  ctx.fillStyle = "#33cc33";
  ctx.fillRect(0, 0, tileSize, tileSize);

  // tile 1: dirt (simple color)
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(tileSize, 0, tileSize, tileSize);

  return canvas;
}

function canvasToImage(canvas: HTMLCanvasElement): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to convert runtime atlas canvas to image."));
    img.src = canvas.toDataURL("image/png");
  });
}

function configureTerrainAtlas(noa: any, atlasImg: HTMLImageElement, tileSizePx: number) {
  const mesher = noa?._terrainMesher;
  if (!mesher) throw new Error("noa._terrainMesher missing (terrain mesher not present)");

  // Different noa builds expose slightly different method names.
  // We'll try a bunch until one works.
  const fns = [
    "setAtlas",
    "setTextureAtlas",
    "setAtlasTexture",
    "setAtlasImage",
    "setTextureAtlasImage",
    "setAtlasData",
  ];

  let success = false;

  for (const fn of fns) {
    if (typeof mesher[fn] !== "function") continue;

    // Try common signatures
    try {
      mesher[fn](atlasImg, tileSizePx);
      console.log(`✅ terrain mesher: ${fn}(img, tileSizePx=${tileSizePx})`);
      success = true;
      break;
    } catch {}

    try {
      mesher[fn](atlasImg);
      console.log(`✅ terrain mesher: ${fn}(img)`);
      success = true;
      break;
    } catch {}

    try {
      // Some builds accept the canvas itself
      mesher[fn](atlasImg, tileSizePx, 2, 1);
      console.log(`✅ terrain mesher: ${fn}(img, tileSizePx, tilesX, tilesY)`);
      success = true;
      break;
    } catch {}
  }

  if (!success) {
    console.warn("⚠️ Could not attach runtime atlas to terrain mesher.");
    console.warn("Terrain mesher keys:", Object.keys(mesher));
    console.warn("Blocks will exist but may not render until atlas hookup method matches.");
  }

  return mesher;
}

async function main() {
  setHud("Starting noa...");

  const noa: any = new Engine({
    debug: true,
    chunkSize: 16,
    chunkAddDistance: 2,
    chunkRemoveDistance: 3,
    playerStart: [0, 6, 0],
  });

  console.log("noa-engine started:", noa?.version);
  (window as any).noa = noa;

  // --- Block IDs ---
  const AIR = 0;
  const GRASS = 1;
  const DIRT = 2;

  // --- Create a runtime atlas (NO files) ---
  setHud("Building runtime textures...");
  const tileSize = 16;
  const atlasCanvas = makeRuntimeAtlas(tileSize);
  const atlasImg = await canvasToImage(atlasCanvas);

  // --- Configure mesher to use runtime atlas ---
  const mesher = configureTerrainAtlas(noa, atlasImg, tileSize);

  // --- Register blocks with texture indices ---
  // index 0 = grass tile (left)
  // index 1 = dirt tile (right)
  try {
    noa.registry.registerBlock({
      id: GRASS,
      solid: true,
      texture: 0,
      textureIndex: 0,
      tex: 0,
    });

    noa.registry.registerBlock({
      id: DIRT,
      solid: true,
      texture: 1,
      textureIndex: 1,
      tex: 1,
    });
  } catch (e) {
    console.warn("registerBlock warning:", e);
  }

  // Look down so you definitely see ground
  try {
    if (noa.camera) noa.camera.pitch = -0.6;
  } catch {}

  // --- World generation (flat world) ---
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

  // --- Sanity logs ---
  setTimeout(() => {
    const a = typeof noa.getBlock === "function" ? noa.getBlock(0, 0, 0) : "(noa.getBlock missing)";
    const b = typeof noa.world?.getBlockID === "function" ? noa.world.getBlockID(0, 0, 0) : "(world.getBlockID missing)";
    console.log("After worldgen: getBlock(0,0,0) =", a, "| world.getBlockID(0,0,0) =", b);
    console.log("scene meshes:", noa.rendering?.scene?.meshes?.length);
    console.log("terrainMesher keys:", Object.keys(mesher));
  }, 900);

  // --- Colyseus connect ---
  setHud("Connecting to server...");
  const client = new Client(window.location.origin);
  const room = await client.joinOrCreate("voxel");

  console.log("✅ Joined:", room.roomId, room.sessionId);
  setHud(`Connected: ${room.sessionId}`);
  (window as any).room = room;

  room.onMessage("worldInfo", (info) => console.log("📩 worldInfo", info));
  room.onMessage("*", (type, msg) => console.log("📩 message:", type, msg));
}

main().catch((err) => {
  console.error(err);
  setHud("Error (check console)");
});
