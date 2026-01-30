import { Schema, MapSchema, defineTypes } from "@colyseus/schema";

// 1. Define PlayerState Class
export class PlayerState extends Schema {
    x: number = 0;
    y: number = 0;
    z: number = 0;
    yaw: number = 0;
    pitch: number = 0;
}

// 2. Register PlayerState Types (IMMEDIATELY AFTER)
defineTypes(PlayerState, {
    x: "number",
    y: "number",
    z: "number",
    yaw: "number",
    pitch: "number"
});

// 3. Define VoxelState Class
export class VoxelState extends Schema {
    players = new MapSchema<PlayerState>();
}

// 4. Register VoxelState Types (IMMEDIATELY AFTER)
defineTypes(VoxelState, {
    players: { map: PlayerState }
});