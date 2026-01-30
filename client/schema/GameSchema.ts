import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

// ==========================================================
// 1. PLAYER STATE (Implementation + Definition)
// ==========================================================
class PlayerStateImpl extends Schema {
    x: number = 0;
    y: number = 0;
    z: number = 0;
    yaw: number = 0;
    pitch: number = 0;
}

// 🔥 Run definition BEFORE export
defineTypes(PlayerStateImpl, {
    x: "number",
    y: "number",
    z: "number",
    yaw: "number",
    pitch: "number"
});

// 🔒 Export as const to prevent tree-shaking
export const PlayerState = PlayerStateImpl;

// ==========================================================
// 2. VOXEL STATE (Implementation + Definition)
// ==========================================================
class VoxelStateImpl extends Schema {
    players = new MapSchema<PlayerStateImpl>();
}

// 🔥 Run definition BEFORE export
defineTypes(VoxelStateImpl, {
    players: { map: PlayerStateImpl }
});

// 🔒 Export as const
export const VoxelState = VoxelStateImpl;