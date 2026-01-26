import { Room, Client } from "@colyseus/core";
import { VoxelState } from "./state/VoxelState";
import { PlayerState } from "./state/PlayerState";
import { ChunkState } from "./state/ChunkState";

import { keyFromChunk } from "../voxel/chunkKey";
import { ChunkStore } from "../voxel/chunkStore";
import { clamp, isFiniteNumber } from "../voxel/validate";
import { TownGenerator } from "../voxel/TownGenerator";

// ----------------------------------------------------------------------
// MESSAGE TYPES
// ----------------------------------------------------------------------
type MoveMsg = { x: number; y: number; z: number; yaw?: number; pitch?: number };
type SubscribeMsg = { cx: number; cy: number; cz: number; r: number }; // center + radius (in chunks)
type SetBlockMsg = { x: number; y: number; z: number; id: number }; // world coords + block id

export class VoxelRoom extends Room<VoxelState> {
  maxClients = 32;
  state = new VoxelState();

  // server-side chunk data store (authoritative)
  private chunks = new ChunkStore();

  // which chunk-keys each client is currently subscribed to
  private subscriptions = new Map<string, Set<string>>();

  // The procedural generator
  private townGen: TownGenerator;

  onCreate() {
    // Tune patch rate; voxel games often benefit from a bit lower for bandwidth stability
    this.setPatchRate(20); // 20 patches/s

    // ==================================================================
    // 1. INITIALIZE GENERATOR (Lazy Mode)
    // ==================================================================
    console.log("🏙️ Initializing Town Generator...");
    
    // We do NOT generate the whole world loop here anymore. 
    // We instantiate the generator and use it on-demand in handleSubscribe.
    this.townGen = new TownGenerator(1000, 1000, 12345);

    console.log("✅ Town Generator Ready (Chunks will be generated on-demand).");
    
    // ==================================================================
    // 2. MESSAGE HANDLERS
    // ==================================================================
    this.onMessage("move", (client, msg: MoveMsg) => this.handleMove(client, msg));
    this.onMessage("subscribeChunks", (client, msg: SubscribeMsg) => this.handleSubscribe(client, msg));
    this.onMessage("setBlock", (client, msg: SetBlockMsg) => this.handleSetBlock(client, msg));
  }

  onJoin(client: Client) {
    this.state.players.set(client.sessionId, new PlayerState());
    this.subscriptions.set(client.sessionId, new Set());

    // Send seed / world settings once
    // Ensure chunkSize matches what we use in generation logic (16)
    client.send("worldInfo", { seed: 12345, chunkSize: 16, height: 256 });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.subscriptions.delete(client.sessionId);
  }

  // ==================================================================
  // HELPER: SERVER-SIDE CHUNK GENERATION
  // ==================================================================
  private generateChunk(cx: number, cy: number, cz: number) {
      const chunkSize = 16; // Must match ChunkStore/Client settings
      
      for (let lx = 0; lx < chunkSize; lx++) {
          for (let ly = 0; ly < chunkSize; ly++) {
              for (let lz = 0; lz < chunkSize; lz++) {
                  const wx = cx * chunkSize + lx;
                  const wy = cy * chunkSize + ly;
                  const wz = cz * chunkSize + lz;

                  // Query the generator for this specific block
                  const id = this.townGen.getBlockID(wx, wy, wz);
                  
                  // If it's not air, write it to the server's chunk store
                  // This ensures server physics knows about the ground/walls
                  if (id !== 0) {
                      this.chunks.setBlock(wx, wy, wz, id);
                  }
              }
          }
      }
  }

  // ==================================================================
  // LOGIC: MOVEMENT
  // ==================================================================
  private handleMove(client: Client, msg: MoveMsg) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;

    if (![msg.x, msg.y, msg.z].every(isFiniteNumber)) return;

    // basic sanity bounds (tune for your world)
    p.x = clamp(msg.x, -1e6, 1e6);
    p.y = clamp(msg.y, -1e6, 1e6);
    p.z = clamp(msg.z, -1e6, 1e6);

    if (isFiniteNumber(msg.yaw)) p.yaw = msg.yaw!;
    if (isFiniteNumber(msg.pitch)) p.pitch = clamp(msg.pitch!, -89, 89);
  }

  // ==================================================================
  // LOGIC: CHUNK SUBSCRIPTION (Spatial Hashing)
  // ==================================================================
  private handleSubscribe(client: Client, msg: SubscribeMsg) {
    const set = this.subscriptions.get(client.sessionId);
    if (!set) return;

    const r = Math.max(0, Math.min(8, Math.floor(msg.r))); // cap radius in chunks
    const cx = Math.floor(msg.cx), cy = Math.floor(msg.cy), cz = Math.floor(msg.cz);

    const wanted = new Set<string>();

    for (let x = cx - r; x <= cx + r; x++) {
      for (let y = cy - r; y <= cy + r; y++) {
        for (let z = cz - r; z <= cz + r; z++) {
          const key = keyFromChunk(x, y, z);
          wanted.add(key);

          // ensure chunk exists server-side
          if (!this.chunks.has(key)) {
            this.chunks.create(key); // init empty chunk
            this.generateChunk(x, y, z); // POPULATE IT immediately
          }

          // ensure chunk metadata exists in synced state
          if (!this.state.chunks.has(key)) {
            const cs = new ChunkState();
            cs.key = key;
            cs.version = this.chunks.getVersion(key);
            this.state.chunks.set(key, cs);
          }

          // send raw chunk data to THIS client (not via schema)
          if (!set.has(key)) {
            const payload = this.chunks.encodeChunk(key);
            client.send("chunkData", payload);
          }
        }
      }
    }

    // unsubscribe chunks no longer wanted
    for (const key of set) {
      if (!wanted.has(key)) client.send("chunkUnload", { key });
    }

    this.subscriptions.set(client.sessionId, wanted);
  }

  // ==================================================================
  // LOGIC: BLOCK EDITING
  // ==================================================================
  private handleSetBlock(client: Client, msg: SetBlockMsg) {
    // validate message
    if (![msg.x, msg.y, msg.z, msg.id].every(isFiniteNumber)) return;

    // TODO: permission checks, distance checks, anti-cheat checks, etc.
    const ok = this.chunks.setBlock(msg.x, msg.y, msg.z, msg.id);
    if (!ok) return;

    // figure out which chunk changed
    const changedKeys = this.chunks.getTouchedChunkKeys(msg.x, msg.y, msg.z);

    // bump versions in synchronized state (clients can react)
    for (const key of changedKeys) {
      const cs = this.state.chunks.get(key);
      if (cs) cs.version = this.chunks.getVersion(key);
    }

    // push block edit event to subscribed clients only
    for (const [sessionId, sub] of this.subscriptions.entries()) {
      if (changedKeys.some(k => sub.has(k))) {
        const c = this.clients.find(c => c.sessionId === sessionId);
        c?.send("blockUpdate", { x: msg.x, y: msg.y, z: msg.z, id: msg.id });
      }
    }
  }
}