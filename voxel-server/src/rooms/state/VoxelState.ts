import { Schema, MapSchema, defineTypes } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";

export class VoxelState extends Schema {
    players = new MapSchema<PlayerState>();
}

defineTypes(VoxelState, {
    players: { map: PlayerState }
});