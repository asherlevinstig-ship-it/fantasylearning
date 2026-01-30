import { Schema, type } from "@colyseus/schema";

export class ChunkState extends Schema {
  // chussk key like "cx,cy,cz"
  @type("string") key: string = "";

  // incrementss wshen cshunk changes (block edits)
  @type("number") version: number = 0;
}
