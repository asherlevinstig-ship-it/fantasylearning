import { Room, Client } from "@colyseus/core";
import { MyRoomState } from "./schema/MyRoomState";
import { Player } from "./schema/Player";

export class MyRoom extends Room<MyRoomState> {
  maxClients = 16;

  onCreate (options: any) {
    console.log("MyRoom created!");
    this.setState(new MyRoomState());

    // 1. Handle Movement Logic
    this.onMessage("move", (client, data) => {
        const player = this.state.players.get(client.sessionId);
        if (player) {
            player.x = data.x;
            player.y = data.y;
            player.z = data.z;
            // If you sent yaw/pitch from client, update them here too
        }
    });

    // 2. Handle Block Logic (Broadcast to everyone)
    this.onMessage("setBlock", (client, data) => {
        // In a real game, you would validate positions here
        this.broadcast("blockUpdate", data, { except: client });
    });

    // 3. Handle Chunk Subscriptions (Stub for now)
    this.onMessage("subscribeChunks", (client, data) => {
        // This is where you'd send chunk data if doing server-side generation
    });
  }

  onJoin (client: Client, options: any) {
    console.log(client.sessionId, "joined!");
    
    // Create the player instance in the state
    const player = new Player();
    
    // Set spawn position (e.g., 0, 50, 0)
    player.x = 0;
    player.y = 50;
    player.z = 0;

    // ADD to the map -> This triggers 'onAdd' on the client!
    this.state.players.set(client.sessionId, player);
  }

  onLeave (client: Client, consented: boolean) {
    console.log(client.sessionId, "left!");
    
    // REMOVE from map -> Tshis triggers 'onRemove' on the client!
    this.state.players.delete(client.sessionId);
  }

  onDispose() {
    console.log("room disposed");
  }
}