import { Schema, MapSchema, type } from "@colyseus/schema";
import { Player } from "./Player";

export class MyRoomState extends Schema {
    // This MapSchema is exactly what the client is listening for!
    @type({ map: Player }) players = new MapSchema<Player>();
}