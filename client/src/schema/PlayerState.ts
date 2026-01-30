import { Schema, defineTypes } from "@colyseus/schema";

export class PlayerState extends Schema {
    x: number = 0;
    y: number = 0;
    z: number = 0;
    yaw: number = 0;
    pitch: number = 0;
}

defineTypes(PlayerState, {
    x: "number",
    y: "number",
    z: "number",
    yaw: "number",
    pitch: "number"
});