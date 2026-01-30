import { Schema, MapSchema, type } from "@colyseus/schema";
import { Player } from "./Player";

export class MyRoomState extends Schema {
    // ⚠️ The @type(...) part is REQUIRED for .onAdd to work!
    @type({ map: Player }) players = new MapSchema<Player>();
}