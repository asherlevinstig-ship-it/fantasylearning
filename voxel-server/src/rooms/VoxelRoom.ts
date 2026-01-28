import { Room, Client } from "@colyseus/core";
import { VoxelState } from "./state/VoxelState";
import { PlayerState } from "./state/PlayerState";

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

  // OPTIMIZATION: This now stores ONLY modified chunks/blocks
  // If a chunk is not in here, it is purely procedural (implicit).
  private chunks = new ChunkStore();

  // which chunk-keys each client is currently subscribed to
  private subscriptions = new Map<string, Set<string>>();

  // The procedural generator (Source of Truth for unedited blocks)
  private townGen: TownGenerator;

  onCreate() {
    this.setPatchRate(20); 

    // ==================================================================
    // 1. INITIALIZE GENERATOR
    // ==================================================================
    console.log("🏙️ Initializing Town Generator (Server)...");
    // We use the same seed/size as client so the math matches 1:1
    this.townGen = new TownGenerator(4000, 4000, 12345);
    console.log("✅ Server Generator Ready (Implicit Mode).");
    
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

    // Send world settings 
    client.send("worldInfo", { seed: 12345, chunkSize: 16, height: 256 });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.subscriptions.delete(client.sessionId);
  }

  // ==================================================================
  // HELPER: IMPLICIT BLOCK CHECK (For Anti-Cheat/Collision)
  // ==================================================================
  // If we need to know what block is at X,Y,Z, we check edits first,
  // then fall back to the generator.
  private getWorldBlock(x: number, y: number, z: number): number {
      // 1. Check if user edited this block (Sparse storage)
      if (this.chunks.hasBlock(x, y, z)) {
          return this.chunks.getBlock(x, y, z);
      }
      // 2. If not edited, calculate it procedurally
      return this.townGen.getBlockID(x, y, z);
  }

  // ==================================================================
  // LOGIC: MOVEMENT
  // ==================================================================
  private handleMove(client: Client, msg: MoveMsg) {
    const p = this.state.players.get(client.sessionId);
    if (!p) return;

    if (![msg.x, msg.y, msg.z].every(isFiniteNumber)) return;

    // Optional: Add server-side collision validation here using this.getWorldBlock()
    
    p.x = clamp(msg.x, -1e6, 1e6);
    p.y = clamp(msg.y, -1e6, 1e6);
    p.z = clamp(msg.z, -1e6, 1e6);

    if (isFiniteNumber(msg.yaw)) p.yaw = msg.yaw!;
    if (isFiniteNumber(msg.pitch)) p.pitch = clamp(msg.pitch!, -89, 89);
  }

  // ==================================================================
  // LOGIC: CHUNK SUBSCRIPTION (Lightweight)
  // ==================================================================
  private handleSubscribe(client: Client, msg: SubscribeMsg) {
    const set = this.subscriptions.get(client.sessionId);
    if (!set) return;

    const r = Math.max(0, Math.min(8, Math.floor(msg.r))); 
    const cx = Math.floor(msg.cx);
    const cz = Math.floor(msg.cz);
    
    // Only subscribe to the relevant band
    const Y_MIN = -1; 
    const Y_MAX = 4;  

    const wanted = new Set<string>();

    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        for (let y = Y_MIN; y <= Y_MAX; y++) {
          
          const key = keyFromChunk(x, y, z);
          wanted.add(key);
          
          // OPTIMIZATION: We DO NOT generate chunks here anymore.
          // We simply track that the user is interested in this area.
          // If there are edits in this chunk, we could send them now (delta compression),
          // but for this implementation, we just track interest.
        }
      }
    }

    this.subscriptions.set(client.sessionId, wanted);
  }

  // ==================================================================
  // LOGIC: BLOCK EDITING (Sparse Storage)
  // ==================================================================
  private handleSetBlock(client: Client, msg: SetBlockMsg) {
    if (![msg.x, msg.y, msg.z, msg.id].every(isFiniteNumber)) return;

    // 1. Ensure chunk exists in storage (Lazy Creation)
    const chunkKey = this.chunks.keyForBlock(msg.x, msg.y, msg.z);
    
    // If this is the first time ANYONE has touched this chunk, create a container for it.
    // Note: This container should start empty, not filled with generator data.
    if (!this.chunks.has(chunkKey)) {
        this.chunks.create(chunkKey); 
    }

    // 2. Apply the Edit
    const ok = this.chunks.setBlock(msg.x, msg.y, msg.z, msg.id);
    if (!ok) return;

    const changedKeys = this.chunks.getTouchedChunkKeys(msg.x, msg.y, msg.z);

    // 3. Broadcast change to relevant players
    // This is the "Delta Update" that keeps clients in sync
    for (const [sessionId, sub] of this.subscriptions.entries()) {
      if (changedKeys.some(k => sub.has(k))) {
        const c = this.clients.find(c => c.sessionId === sessionId);
        c?.send("blockUpdate", { x: msg.x, y: msg.y, z: msg.z, id: msg.id });
      }
    }
  }
}