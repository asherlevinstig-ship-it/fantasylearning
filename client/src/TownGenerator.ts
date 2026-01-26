import * as ROT from "rot-js";
import { createNoise2D } from "simplex-noise";

// Define Block IDs (Must match your client registry!)
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3; // Foundations/Plots
const GRAVEL = 4;      // Roads

export class TownGenerator {
    width: number;
    depth: number;
    noise2D: any;

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;
        // Initialize noise with a seed-based logic if needed, 
        // or just let it be random for now
        this.noise2D = createNoise2D(() => Math.random()); 
    }

    generate(setBlockCallback: (x: number, y: number, z: number, id: number) => void) {
        console.log("🏗️ Generating Town Layout...");

        // 1. DATA STRUCTURES
        // We need a 2D map to know where roads and houses are before we build height
        const townMap = new Array(this.width).fill(0).map(() => new Array(this.depth).fill(0));
        
        // 2. GENERATE LAYOUT using ROT.js
        // "Digger" creates rooms (plots) and corridors (roads)
        const digger = new ROT.Map.Digger(this.width, this.depth, {
            roomWidth: [6, 12],  // Min/Max plot width
            roomHeight: [6, 12], // Min/Max plot depth
            dugPercentage: 0.2,  // Density of town (0.2 = 20% town, 80% nature)
            corridorLength: [3, 10]
        });

        // ROT.js callback: x, y, value (0 = empty/nature, 1 = dug/town)
        digger.create((x, z, value) => {
            // Note: ROT.js uses 0 for wall (nature) and 1 for empty (town features)
            // We invert this logic slightly for our map:
            // 1 = Town Infrastructure (Road/Plot), 0 = Nature
            if (value === 0) townMap[x][z] = 1; 
        });

        // 3. IDENTIFY PLOTS vs ROADS
        const rooms = digger.getRooms();
        rooms.forEach(room => {
            for (let x = room.getLeft(); x <= room.getRight(); x++) {
                for (let z = room.getTop(); z <= room.getBottom(); z++) {
                    townMap[x][z] = 2; // 2 = Foundation/Plot
                }
            }
        });

        // 4. BUILD THE WORLD
        const BASE_HEIGHT = 10; // Town level
        
        for (let x = 0; x < this.width; x++) {
            for (let z = 0; z < this.depth; z++) {
                
                let height = 0;
                let surfaceBlock = GRASS;
                
                // --- LOGIC: FLATTEN TERRAIN FOR TOWN ---
                if (townMap[x][z] === 1) {
                    // Road
                    height = BASE_HEIGHT;
                    surfaceBlock = GRAVEL;
                } 
                else if (townMap[x][z] === 2) {
                    // Building Plot (Foundation)
                    height = BASE_HEIGHT + 1; // Raise foundations slightly
                    surfaceBlock = STONE_BRICK;
                } 
                else {
                    // Nature: Use Simplex Noise
                    // Scale coordinates for smooth hills
                    const n = this.noise2D(x / 40, z / 40); 
                    // Map -1..1 to height range (e.g., 5 to 25)
                    height = Math.floor(5 + (n + 1) * 10);
                }

                // --- FILL BLOCKS ---
                for (let y = 0; y <= height; y++) {
                    let id = DIRT; // Filler
                    
                    if (y === height) id = surfaceBlock; // Surface
                    
                    // Force bedrock at bottom
                    if (y === 0) id = STONE_BRICK; 

                    // Set the block
                    setBlockCallback(x - (this.width/2), y, z - (this.depth/2), id);
                }
            }
        }
        console.log("✅ Town Generation Complete.");
    }
}