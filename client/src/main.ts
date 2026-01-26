// client/src/main.ts

import { Client } from "colyseus.js";
import { Engine } from "noa-engine";

import {
  StandardMaterial,
  Color3,
  DynamicTexture,
  Texture,
} from "@babylonjs/core";

const hudEl = document.getElementById("hud") as HTMLDivElement | null;
const setHud = (t: string) => { if (hudEl) hudEl.textContent = t; };

function makeRuntimeAtlasTexture(scene: any, tileSize = 16) {
  // 2 tiles wide: [grass, dirt]
  const texW = tileSize * 2;
  const texH = tileSize;

  const dynTex = new DynamicTexture("atlas", { width: texW, height: texH }, scene, false);
  dynTex.wrapU = Texture.CLAMP_ADDRESSMODE;
  dynTex.wrapV = Texture.CLAMP_ADDRESSMODE;
  dynTex.updateSamplingMode(Texture.NEAREST_SAMPLINGMODE);

  const ctx = dynTex.getContext();

  // tile 0: grass (green)
  ctx.fillStyle = "#33cc33";
  ctx.fillRect(0, 0, tileSize, tileSize);

  // tile 1: dirt (brown)
  ctx.fillStyle = "#8b5a2b";
  ctx.fillRect(tileSize, 0, tileSize, tileSize);

  dynTex.update(false);

  return { dynTex, tileSize };
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

  const scene = noa?.rendering?.scene;
  if (!scene) {
    throw new Error("noa.rendering.scene missing");
  }

  // Terrain mesher (we know what methods/fields it has from your logs)
  const mesher = noa?._terrainMesher;
  if (!mesher) {
    throw new Error("noa._terrainMesher missing");
  }

  // --- Create a Babylon material + runtime atlas texture (NO FILES) ---
  setHud("Creating terrain material...");
  const { dynTex } = makeRuntimeAtlasTexture(scene, 16);

  const terrainMat = new StandardMaterial("terrainMat", scene);
  terrainMat.diffuseTexture = dynTex;
  terrainMat.specularColor = new Color3(0, 0, 0);
  terrainMat.backFaceCulling = true;

  // Hook material into noa's terrain mesher
  // This build exposes only _defaultMaterial and allTerrainMaterials.
  mesher._defaultMaterial = terrainMat;
  if (Array.isArray(mesher.allTerrainMaterials)) {
    mesher.allTerrainMaterials.length = 0;
    mesher.allTerrainMaterials.push(terrainMat);
  }

  // --- Block IDs ---
  const AIR = 0;
  const GRASS = 1;
  const DIRT = 2;

  // Register blocks with texture indices into our 2-tile atlas:
  // tile 0 = grass, tile 1 = dirt
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

  // Look down so you definitely see ground
  try {
    if (noa.camera) noa.camera.pitch = -0.6;
  } catch {}

  // --- World generation: flat world ---
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

  // Debug checks
  setTimeout(() => {
    const a = typeof noa.getBlock === "function" ? noa.getBlock(0, 0, 0) : "(noa.getBlock missing)";
    console.log("After worldgen getBlock(0,0,0):", a);

    const meshCount = noa.rendering?.scene?.meshes?.length;
    console.log("scene meshes:", meshCount);

    console.log("terrainMesher keys:", Object.keys(mesher));
    console.log("terrainMesher default material:", mesher._defaultMaterial);
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
