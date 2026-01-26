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
type SubscribeMsg = { cx: number; cy: number; cz: number; r: number }; 
type SetBlockMsg = { x: number; y: number; z: number; id: number };

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
    this.setPatchRate(20); 

    // ==================================================================
    // 1. INITIALIZE GENERATOR (Lazy Mode)
    // ==================================================================
    console.log("🏙️ Initializing Town Generator...");
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

    // Send world settings (ChunkSize 16 matches server/generator logic)
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
      const chunkSize = 16; 
      
      for (let lx = 0; lx < chunkSize; lx++) {
          for (let ly = 0; ly < chunkSize; ly++) {
              for (let lz = 0; lz < chunkSize; lz++) {
                  const wx = cx * chunkSize + lx;
                  const wy = cy * chunkSize + ly;
                  const wz = cz * chunkSize + lz;

                  // 1. Calculate Block ID
                  const id = this.townGen.getBlockID(wx, wy, wz);
                  
                  // 2. Write EVERY block (even Air/0) to the store
                  // This ensures the encoded buffer is complete and not sparse.
                  this.chunks.setBlock(wx, wy, wz, id);
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

    p.x = clamp(msg.x, -1e6, 1e6);
    p.y = clamp(msg.y, -1e6, 1e6);
    p.z = clamp(msg.z, -1e6, 1e6);

    if (isFiniteNumber(msg.yaw)) p.yaw = msg.yaw!;
    if (isFiniteNumber(msg.pitch)) p.pitch = clamp(msg.pitch!, -89, 89);
  }

  // ==================================================================
  // LOGIC: CHUNK SUBSCRIPTION (Vertical Banding Optimization)
  // ==================================================================
  private handleSubscribe(client: Client, msg: SubscribeMsg) {
    const set = this.subscriptions.get(client.sessionId);
    if (!set) return;

    // Radius in chunks (horizontal)
    const r = Math.max(0, Math.min(8, Math.floor(msg.r))); 
    const cx = Math.floor(msg.cx);
    const cz = Math.floor(msg.cz);
    
    // OPTIMIZATION: Ignore Client Y (msg.cy). 
    // Force load the "Gameplay Band" (-1 to 4).
    // This ensures ground is always loaded and we don't waste CPU on sky/void.
    const Y_MIN = -1; // -16 to -1 (Underground)
    const Y_MAX = 4;  // 64 to 79  (Sky/Mountains)

    const wanted = new Set<string>();

    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        // Vertical Loop: Fixed Band
        for (let y = Y_MIN; y <= Y_MAX; y++) {
          
          const key = keyFromChunk(x, y, z);
          wanted.add(key);

          // A. Ensure chunk exists in Server Memory
          if (!this.chunks.has(key)) {
            this.chunks.create(key); 
            this.generateChunk(x, y, z); // Force Generate Full Buffer
          }

          // B. Sync Metadata via Schema
          if (!this.state.chunks.has(key)) {
            const cs = new ChunkState();
            cs.key = key;
            cs.version = this.chunks.getVersion(key);
            this.state.chunks.set(key, cs);
          }

          // C. Send Binary Data to Client (if not already subscribed)
          if (!set.has(key)) {
            const payload = this.chunks.encodeChunk(key);
            client.send("chunkData", payload);
          }
        }
      }
    }

    // Unsubscribe chunks no longer wanted
    for (const key of set) {
      if (!wanted.has(key)) client.send("chunkUnload", { key });
    }

    this.subscriptions.set(client.sessionId, wanted);
  }

  // ==================================================================
  // LOGIC: BLOCK EDITING
  // ==================================================================
  private handleSetBlock(client: Client, msg: SetBlockMsg) {
    if (![msg.x, msg.y, msg.z, msg.id].every(isFiniteNumber)) return;

    const ok = this.chunks.setBlock(msg.x, msg.y, msg.z, msg.id);
    if (!ok) return;

    const changedKeys = this.chunks.getTouchedChunkKeys(msg.x, msg.y, msg.z);

    for (const key of changedKeys) {
      const cs = this.state.chunks.get(key);
      if (cs) cs.version = this.chunks.getVersion(key);
    }

    for (const [sessionId, sub] of this.subscriptions.entries()) {
      if (changedKeys.some(k => sub.has(k))) {
        const c = this.clients.find(c => c.sessionId === sessionId);
        c?.send("blockUpdate", { x: msg.x, y: msg.y, z: msg.z, id: msg.id });
      }
    }
  }
}