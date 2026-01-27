import { Schema, MapSchema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";

export class VoxelState extends Schema {
  // We ONLY sync players now. 
  // Terrain is generatedssss deterministically on the client, 
  // and modifications are sent via messages, not schema.
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
}