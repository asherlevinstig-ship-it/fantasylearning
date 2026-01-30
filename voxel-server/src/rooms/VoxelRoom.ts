import { Room, Client } from "colyseus";
import { MapSchema } from "@colyseus/schema"; // Import for debug check
import { VoxelState } from "./state/VoxelState";
import { PlayerState } from "./state/PlayerState";

import { keyFromChunk } from "../voxel/chunkKey";
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
  
  // 🔴 REMOVED: state = new VoxelState(); 
  // We will set this in onCreate to ensure Schema patching attaches correctly.

  // OPTIMIZATION: Sparse storage (only stores modified blocks)
  private chunks = new ChunkStore();

  // Tracks which chunk-keys each client is currently interested in
  private subscriptions = new Map<string, Set<string>>();

  // The procedural generator (Source of Truth for unedited blocks)
  private townGen: TownGenerator;

  onCreate() {
    console.log("Creating VoxelRoom...");

    // ==================================================================
    // 0. INITIALIZE STATE (The Fix)
    // ==================================================================
    this.setState(new VoxelState());
    
    // 🔍 SANITY CHECK (As requested)
    console.log("--- STATE DIAGNOSTICS ---");
    console.log("players is MapSchema:", this.state.players instanceof MapSchema);
    console.log("players ctor:", this.state.players?.constructor?.name);
    // Note: 'players' is empty on create, so keys will be empty, 
    // but the object itself should be a proxy/schema structure.
    console.log("-------------------------");

    this.setPatchRate(20); 

    // ==================================================================
    // 1. INITIALIZE GENERATOR
    // ==================================================================
    console.log("🏙️ Initializing Town Generator (Server)...");
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
    console.log(`Client ${client.sessionId} joined.`);

    // Create player state
    const player = new PlayerState();
    
    // Optional: Set default spawn (prevents spawning at 0,0,0 if that's underground)
    player.x = 0; 
    player.y = 100; // Drop from sky for safety
    player.z = 0;

    this.state.players.set(client.sessionId, player);
    
    // Initialize empty subscription set
    this.subscriptions.set(client.sessionId, new Set());

    // Send world settings to the new client
    client.send("worldInfo", { seed: 12345, chunkSize: 16, height: 256 });
  }

  onLeave(client: Client) {
    console.log(`Client ${client.sessionId} left.`);
    this.state.players.delete(client.sessionId);
    this.subscriptions.delete(client.sessionId);
  }

  // ... (Rest of your helper methods: getWorldBlock, handleMove, handleSubscribe, etc.) ...
  
  // ==================================================================
  // HELPER: IMPLICIT BLOCK CHECK (Anti-Cheat / Collision)
  // ==================================================================
  private getWorldBlock(x: number, y: number, z: number): number {
      if (this.chunks.hasBlock(x, y, z)) {
          return this.chunks.getBlock(x, y, z);
      }
      return this.townGen.getBlockID(x, y, z);
  }

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

  private handleSubscribe(client: Client, msg: SubscribeMsg) {
    const set = this.subscriptions.get(client.sessionId);
    if (!set) return;

    const r = Math.max(0, Math.min(8, Math.floor(msg.r))); 
    const cx = Math.floor(msg.cx);
    const cz = Math.floor(msg.cz);
    
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

  private handleSetBlock(client: Client, msg: SetBlockMsg) {
    if (![msg.x, msg.y, msg.z, msg.id].every(isFiniteNumber)) return;

    const chunkKey = this.chunks.keyForBlock(msg.x, msg.y, msg.z);
    
    if (!this.chunks.has(chunkKey)) {
        this.chunks.create(chunkKey); 
    }

    const ok = this.chunks.setBlock(msg.x, msg.y, msg.z, msg.id);
    if (!ok) return;

    const changedKeys = this.chunks.getTouchedChunkKeys(msg.x, msg.y, msg.z);

    for (const [sessionId, sub] of this.subscriptions.entries()) {
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