import config from "@colyseus/tools";
import { VoxelRoom } from "./rooms/VoxelRoom";

export default config({
  initializeGameServer: (gameServer) => {
    gameServer.define("voxel", VoxelRoom);
  },
});
