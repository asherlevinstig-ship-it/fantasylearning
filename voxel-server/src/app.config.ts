import config from "@colyseus/tools";
import { VoxelRoom } from "./rooms/VoxelRoom";
import express from "express";
import path from "path";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("voxel", VoxelRoom);
  },

  initializeExpress: (app) => {
    const clientDistPath = path.resolve(
      __dirname,
      "..",          // from dist/
      "..",          // from voxel-server/
      "client",
      "dist"
    );

    console.log("📂 [Express] Serving static files from:", clientDistPath);

    app.use(express.static(clientDistPath));
  }
});
