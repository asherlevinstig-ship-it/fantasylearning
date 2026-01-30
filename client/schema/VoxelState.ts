import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";

export class VoxelState extends Schema {
    players = new MapSchema<PlayerState>();
}

// 🔥 THIS IS THE FIX
defineTypes(VoxelState, {
    players: { map: PlayerState }
});