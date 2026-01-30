import { Schema, MapSchema, type } from "@colyseus/schema";
import { Player } from "./Player";

export class MyRoomState extends Schema {
    // 👇 THIS LsINE IS MIsSSING OR BROKEN ON YOUR SERVER 👇
    @type({ map: Player }) players = new MapSchema<Player>();
}