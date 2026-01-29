import { Room, Client } from "colyseus";
import { VoxelState } from "./state/VoxelState";
import { PlayerState } from "./state/PlayerState";

import { keyFromChunk } from "../voxel/chunkKey";
// FIX: Lowercase "chunkStore" to match the actual filename on your server
import { ChunkStore } from "../voxel/chunkStore"; 
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

  // OPTIMIZATION: Sparse storage (only stores modified blocks)
  private chunks = new ChunkStore();

  // Tracks which chunk-keys each client is currently interested in
  private subscriptions = new Map<string, Set<string>>();

  // The procedural generator (Source of Truth for unedited blocks)
  private townGen: TownGenerator;

  onCreate() {
    this.setPatchRate(20); 

    // ==================================================================
    // 1. INITIALIZE GENERATOR
    // ==================================================================
    console.log("🏙️ Initializing Town Generator (Server)...");
    
    // FIX: Using only 3 arguments (Width, Depth, Seed).
    // The generator now imports BLOCKS internally from 'blocks.ts'.
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
    // Create player state
    this.state.players.set(client.sessionId, new PlayerState());
    
    // Initialize empty subscription set
    this.subscriptions.set(client.sessionId, new Set());

    // Send world settings to the new client
    client.send("worldInfo", { seed: 12345, chunkSize: 16, height: 256 });
  }

  onLeave(client: Client) {
    this.state.players.delete(client.sessionId);
    this.subscriptions.delete(client.sessionId);
  }

  // ==================================================================
  // HELPER: IMPLICIT BLOCK CHECK (Anti-Cheat / Collision)
  // ==================================================================
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

    // Sanity check coordinates
    p.x = clamp(msg.x, -1e6, 1e6);
    p.y = clamp(msg.y, -1e6, 1e6);
    p.z = clamp(msg.z, -1e6, 1e6);

    if (isFiniteNumber(msg.yaw)) p.yaw = msg.yaw!;
    if (isFiniteNumber(msg.pitch)) p.pitch = clamp(msg.pitch!, -89, 89);
  }

  // ==================================================================
  // LOGIC: CHUNK SUBSCRIPTION
  // ==================================================================
  private handleSubscribe(client: Client, msg: SubscribeMsg) {
    const set = this.subscriptions.get(client.sessionId);
    if (!set) return;

    const r = Math.max(0, Math.min(8, Math.floor(msg.r))); 
    const cx = Math.floor(msg.cx);
    const cz = Math.floor(msg.cz);
    
    // Only subscribe to the relevant vertical band
    const Y_MIN = -1; 
    const Y_MAX = 4;  

    const wanted = new Set<string>();

    for (let x = cx - r; x <= cx + r; x++) {
      for (let z = cz - r; z <= cz + r; z++) {
        for (let y = Y_MIN; y <= Y_MAX; y++) {
          const key = keyFromChunk(x, y, z);
          wanted.add(key);
        }
      }
    }

    this.subscriptions.set(client.sessionId, wanted);
  }

  // ==================================================================
  // LOGIC: BLOCK EDITING
  // ==================================================================
  private handleSetBlock(client: Client, msg: SetBlockMsg) {
    if (![msg.x, msg.y, msg.z, msg.id].every(isFiniteNumber)) return;

    // 1. Ensure chunk container exists (Lazy Creation)
    const chunkKey = this.chunks.keyForBlock(msg.x, msg.y, msg.z);
    
    if (!this.chunks.has(chunkKey)) {
        this.chunks.create(chunkKey); 
    }

    // 2. Apply the Edit to storage
    const ok = this.chunks.setBlock(msg.x, msg.y, msg.z, msg.id);
    if (!ok) return;

    // 3. Determine who needs to know about this change
    const changedKeys = this.chunks.getTouchedChunkKeys(msg.x, msg.y, msg.z);

    // 4. Broadcast change to subscribed players
    for (const [sessionId, sub] of this.subscriptions.entries()) {
      // FIX: Explicitly type 'k' as string to satisfy TypeScript strictness
      if (changedKeys.some((k: string) => sub.has(k))) {
        const c = this.clients.find(c => c.sessionId === sessionId);
        c?.send("blockUpdate", { x: msg.x, y: msg.y, z: msg.z, id: msg.id });
      }
    }
  }
}

// ==================================================================
// INLINED VALIDATION HELPERS
// ==================================================================
function isFiniteNumber(val: any): val is number {
  return typeof val === "number" && isFinite(val);
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(Math.max(val, min), max);
}