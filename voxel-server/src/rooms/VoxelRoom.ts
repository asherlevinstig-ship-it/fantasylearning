import { Room, Client } from "colyseus";
import { VoxelState, PlayerState } from "../../../shared/schemas/GameState"; // Adjust path if needed
import { ChunkStore } from "../voxel/chunkStore"; 
import { TownGenerator } from "../voxel/TownGenerator";
import { chunkFromWorld, keyFromChunk } from "../voxel/chunkKey";

// ----------------------------------------------------------------------
// MESSAGE TYPES
// ----------------------------------------------------------------------
type MoveMsg = { x: number; y: number; z: number; yaw?: number; pitch?: number };
type SubscribeMsg = { cx: number; cy: number; cz: number; r: number }; 
type SetBlockMsg = { x: number; y: number; z: number; id: number };

export class VoxelRoom extends Room<VoxelState> {
  maxClients = 32;
  
  // Storage for user-modified chunks
  private chunks = new ChunkStore();

  // Tracks which chunk-keys each client is currently interested in
  private subscriptions = new Map<string, Set<string>>();

  // The procedural generator (Source of Truth for unedited blocks)
  private townGen: TownGenerator;

  onCreate() {
    console.log("Creating VoxelRoom...");

    // 0. INITIALIZE STATE
    // We set state here to ensure the Schema is correctly attached.
    this.setState(new VoxelState());
    
    // Set patch rate to 20fps (50ms) to bundle updates efficiently
    this.setPatchRate(20); 

    // 1. INITIALIZE GENERATOR
    console.log("🏙️ Initializing Town Generator (Server)...");
    this.townGen = new TownGenerator(4000, 4000, 12345);
    console.log("✅ Server Generator Ready.");
    
    // 2. MESSAGE HANDLERS
    this.onMessage("move", (client, msg: MoveMsg) => this.handleMove(client, msg));
    this.onMessage("subscribeChunks", (client, msg: SubscribeMsg) => this.handleSubscribe(client, msg));
    this.onMessage("setBlock", (client, msg: SetBlockMsg) => this.handleSetBlock(client, msg));
  }

  onJoin(client: Client) {
    console.log(`Client ${client.sessionId} joined.`);

    // Create player state in Schema
    const player = new PlayerState();
    
    // Default spawn (Drop from sky)
    player.x = 0; 
    player.y = 100; 
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

  // ==================================================================
  // GAME LOGIC HELPERS
  // ==================================================================

  /**
   * Hybrid World Logic:
   * 1. Check if user modified this chunk (ChunkStore).
   * 2. If yes, return that data.
   * 3. If no, ask the procedural generator.
   */
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

    // Update Schema (Colyseus automatically syncs this to all clients)
    p.x = clamp(msg.x, -1e6, 1e6);
    p.y = clamp(msg.y, -1e6, 1e6);
    p.z = clamp(msg.z, -1e6, 1e6);

    if (isFiniteNumber(msg.yaw)) p.yaw = msg.yaw!;
    if (isFiniteNumber(msg.pitch)) p.pitch = clamp(msg.pitch!, -89, 89);
  }

  private handleSubscribe(client: Client, msg: SubscribeMsg) {
    // Validate request
    if (![msg.cx, msg.cy, msg.cz, msg.r].every(isFiniteNumber)) return;

    const r = Math.max(0, Math.min(8, Math.floor(msg.r))); 
    const cx = Math.floor(msg.cx);
    const cz = Math.floor(msg.cz);
    
    // Simple vertical view distance for now
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

    // 1. Get key to see if we need to initialize a chunk
    const key = this.chunks.keyForBlock(msg.x, msg.y, msg.z);
    
    // 2. Initialize chunk if it's the first edit here
    if (!this.chunks.has(key)) {
        this.chunks.create(key);
        
        // CRITICAL STEP: When creating a chunk for the first time,
        // we MUST fill it with the Generator's existing terrain data,
        // otherwise setting 1 block will turn the rest of the chunk to AIR.
        this.hydrateChunkFromGen(key);
    }

    // 3. Apply the update
    const ok = this.chunks.setBlock(msg.x, msg.y, msg.z, msg.id);
    if (!ok) return;

    // 4. Notify relevant subscribers
    const changedKeys = this.chunks.getTouchedChunkKeys(msg.x, msg.y, msg.z);

    // Broadcast only to people subscribed to this chunk
    for (const [sessionId, sub] of this.subscriptions.entries()) {
      if (changedKeys.some((k: string) => sub.has(k))) {
        const c = this.clients.find(c => c.sessionId === sessionId);
        c?.send("blockUpdate", { x: msg.x, y: msg.y, z: msg.z, id: msg.id });
      }
    }
  }

  /**
   * Fills a newly created chunk with data from TownGenerator so we don't 
   * delete the world when a user places a block.
   */
  private hydrateChunkFromGen(key: string) {
      // Parse key back to coords (simple split since we know format is cx,cy,cz)
      const parts = key.split(',').map(Number);
      if (parts.length !== 3) return;
      const [cx, cy, cz] = parts;

      const chunkSize = 16; // hardcoded or imported from constant
      const startX = cx * chunkSize;
      const startY = cy * chunkSize;
      const startZ = cz * chunkSize;

      // We loop through the chunk logic manually to fill the store
      for (let x = 0; x < chunkSize; x++) {
          for (let z = 0; z < chunkSize; z++) {
              const globalX = startX + x;
              const globalZ = startZ + z;
              
              // Get column info once per column (Optimization)
              const colData = this.townGen.getColumnInfo(globalX, globalZ);

              for (let y = 0; y < chunkSize; y++) {
                  const globalY = startY + y;
                  const genID = this.townGen.resolveBlockID(globalY, colData);
                  
                  // Only set if not air to save ops (if your setBlock handles 0 correctly)
                  if (genID !== 0) {
                     this.chunks.setBlock(globalX, globalY, globalZ, genID);
                  }
              }
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