// shared/schemas/GameState.ts
import { Schema, MapSchema, type } from "@colyseus/schema";

export class PlayerState extends Schema {
    @type("number") x: number = 0;
    @type("number") y: number = 0;
    @type("number") z: number = 0;
    @type("number") yaw: number = 0;
    @type("number") pitch: number = 0;
}

export class VoxelState extends Schema {
    @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}