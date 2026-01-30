// src/schema/GameSchema.ts
import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

// ==========================================================================
// PLAYER STATE (No decorators - uses defineTypes)
// ==========================================================================
export class PlayerState extends Schema {
    x: number = 0;
    y: number = 0;
    z: number = 0;
    yaw: number = 0;
    pitch: number = 0;
}

// Register schema IMMEDIATELY after class definition
defineTypes(PlayerState, {
    x: "number",
    y: "number",
    z: "number",
    yaw: "number",
    pitch: "number"
});

// ==========================================================================
// VOXEL STATE (No decorators - uses defineTypes)
// ==========================================================================
export class VoxelState extends Schema {
    players = new MapSchema<PlayerState>();
}

// Register schema IMMEDIATELY after class definition
defineTypes(VoxelState, {
    players: { map: PlayerState }
});

// ==========================================================================
// FORCE SIDE EFFECTS (Anti-tree-shaking)
// ==========================================================================
const _ensureSchema = (() => {
    const p = new PlayerState();
    const v = new VoxelState();
    // Access properties to ensure they're not dead-code eliminated
    return p.x + v.players.size;
})();

// Verify registration worked
if (!(PlayerState as any)._schema) {
    throw new Error("PlayerState schema registration failed!");
}
if (!(VoxelState as any)._schema) {
    throw new Error("VoxelState schema registration failed!");
}

console.log("✅ Schemas registered:", {
    PlayerState: Object.keys((PlayerState as any)._schema || {}),
    VoxelState: Object.keys((VoxelState as any)._schema || {})
});