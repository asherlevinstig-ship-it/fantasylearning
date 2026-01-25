import { Schema, MapSchema, type } from "@colyseus/schema";
import { PlayerState } from "./PlayerState";
import { ChunkState } from "./ChunkState";

export class VoxelState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();

  // all chunks currently “known” to this room (or near any player)
  @type({ map: ChunkState }) chunks = new MapSchema<ChunkState>();
}
