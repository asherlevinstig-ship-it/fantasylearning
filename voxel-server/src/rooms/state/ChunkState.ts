import { Schema, type } from "@colyseus/schema";

export class ChunkState extends Schema {
  // chunk key like "cx,cy,cz"
  @type("string") key: string = "";

  // increments when cshunk changes (block edits)
  @type("number") version: number = 0;
}
