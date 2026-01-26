import * as ROT from "rot-js";
import { createNoise2D } from "simplex-noise";

// BLOCK REGISTRY (Must match main.ts)
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3; // Foundations & Walls
const GRAVEL = 4;      // Roads & Plaza

export class TownGenerator {
    width: number;
    depth: number;
    noise2D: any;
    rng: any;

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;
        // Use a seeded RNG for consistent town layout
        ROT.RNG.setSeed(seed);
        this.noise2D = createNoise2D(() => ROT.RNG.getUniform());
    }

    generate(setBlockCallback: (x: number, y: number, z: number, id: number) => void) {
        console.log("🏰 constructing 'The Town of Beginning'...");

        const TOWN_RADIUS = 45;
        const PLAZA_RADIUS = 8;
        const WALL_HEIGHT = 4;
        const BASE_HEIGHT = 10; // Level of the town floor

        // Helper to check if a point is a road
        const isRoad = (x: number, z: number) => {
            // Main Cross Roads (width 4)
            if (Math.abs(x) <= 2 || Math.abs(z) <= 2) return true;
            
            // Ring Road (at radius ~35)
            const dist = Math.sqrt(x*x + z*z);
            if (dist > 33 && dist < 37) return true;

            return false;
        };

        // 1. GENERATE FOUNDATIONS (Houses)
        // We use a simple grid approach to place houses in the empty quadrants
        const houseMap = new Set<string>();
        for (let i = 0; i < 40; i++) {
            // Pick a random spot inside the town
            const hx = Math.floor((ROT.RNG.getUniform() * 2 - 1) * (TOWN_RADIUS - 5));
            const hz = Math.floor((ROT.RNG.getUniform() * 2 - 1) * (TOWN_RADIUS - 5));

            // Don't build on roads or plaza
            if (isRoad(hx, hz) || Math.sqrt(hx*hx + hz*hz) < PLAZA_RADIUS + 2) continue;

            // Save a 5x5 plot
            for (let px = hx - 2; px <= hx + 2; px++) {
                for (let pz = hz - 2; pz <= hz + 2; pz++) {
                    houseMap.add(`${px},${pz}`);
                }
            }
        }

        // 2. BUILD THE WORLD
        const halfW = Math.floor(this.width / 2);
        const halfD = Math.floor(this.depth / 2);

        for (let x = -halfW; x < halfW; x++) {
            for (let z = -halfD; z < halfD; z++) {
                
                const dist = Math.sqrt(x*x + z*z);
                let height = 0;
                let surface = GRASS;
                let isTown = false;

                // --- ZONE 1: THE TOWN (Inside Walls) ---
                if (dist <= TOWN_RADIUS) {
                    isTown = true;
                    height = BASE_HEIGHT; // Flat town
                    
                    if (dist <= PLAZA_RADIUS) {
                        surface = STONE_BRICK; // Central Plaza
                    } else if (isRoad(x, z)) {
                        surface = GRAVEL; // Roads
                    } else if (houseMap.has(`${x},${z}`)) {
                        surface = STONE_BRICK; // House Foundation
                        height += 1; // Raise foundation
                    } else {
                        surface = GRASS; // Lawns
                    }
                } 
                
                // --- ZONE 2: THE WALLS ---
                else if (dist > TOWN_RADIUS && dist <= TOWN_RADIUS + 2) {
                    // Skip gates for roads
                    if (Math.abs(x) > 3 && Math.abs(z) > 3) {
                        height = BASE_HEIGHT + WALL_HEIGHT;
                        surface = STONE_BRICK;
                        isTown = true; // Use simple filling
                    } else {
                        // Gate opening
                        height = BASE_HEIGHT;
                        surface = GRAVEL;
                        isTown = true;
                    }
                }

                // --- ZONE 3: WILDERNESS (Outside) ---
                else {
                    // Simplex noise for rolling hills
                    const n = this.noise2D(x / 60, z / 60); 
                    height = Math.floor(BASE_HEIGHT - 2 + (n + 1) * 8);
                }

                // --- FILL BLOCKS ---
                // Optimization: Don't fill 10 layers of dirt for every block.
                // Just fill surface and a few layers down, then assume solid below.
                
                // 1. Place Surface Block
                setBlockCallback(x, height, z, surface);

                // 2. Fill Dirt Underneath (down to bedrock or a limit)
                for (let y = height - 1; y >= Math.max(0, height - 5); y--) {
                    // Inside town walls, use stone for stability/look, outside use dirt
                    setBlockCallback(x, y, z, isTown ? STONE_BRICK : DIRT);
                }
                
                // 3. Optional: Add Bedrock at y=0 if you want a hard bottom
                if (height > 0) setBlockCallback(x, 0, z, STONE_BRICK);
            }
        }
        
        console.log("✅ 'Town of Beginning' Built.");
    }
}