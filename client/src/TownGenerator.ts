import * as ROT from "rot-js";
import { createNoise2D } from "simplex-noise";

// BLOCK REGISTRY (Must match main.ts IDs)
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3; // Foundations, Walls, Plaza
const GRAVEL = 4;      // Roads

export class TownGenerator {
    width: number;
    depth: number;
    noise2D: any;

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;
        
        // Initialize RNG with seed for consistent generation
        ROT.RNG.setSeed(seed);
        // Initialize Simplex noise (noise2D returns values between -1 and 1)
        this.noise2D = createNoise2D(() => ROT.RNG.getUniform());
    }

    generate(setBlockCallback: (x: number, y: number, z: number, id: number) => void) {
        console.log(`🏰 constructing 'The Town of Beginning' (${this.width}x${this.depth})...`);

        // ==================================================================
        // CONFIGURATION (SCALED UP)
        // ==================================================================
        const TOWN_RADIUS = 150;      // Town extends 150 blocks from center
        const PLAZA_RADIUS = 20;      // Safe spawn area size
        const WALL_THICKNESS = 3;     // Thickness of the city walls
        const WALL_HEIGHT = 6;        // Height of walls above ground
        const BASE_HEIGHT = 10;       // The flat y-level of the town
        const MAIN_ROAD_WIDTH = 4;    // Half-width (Total width = 9)

        // Helper: Defines where roads are located
        const isRoad = (x: number, z: number) => {
            // 1. Main Cross Roads (North/South/East/West)
            if (Math.abs(x) <= MAIN_ROAD_WIDTH || Math.abs(z) <= MAIN_ROAD_WIDTH) return true;
            
            // 2. The Great Ring Road (at radius ~100)
            const dist = Math.sqrt(x*x + z*z);
            if (dist > 95 && dist < 105) return true;

            return false;
        };

        // ==================================================================
        // 1. GENERATE HOUSE PLOTS (Foundations)
        // ==================================================================
        const houseMap = new Set<string>();
        const houseAttempts = 400; // Try to place many houses

        for (let i = 0; i < houseAttempts; i++) {
            // Pick random spot inside town, leaving buffer from walls
            const r = (ROT.RNG.getUniform() * (TOWN_RADIUS - 15)); 
            const theta = ROT.RNG.getUniform() * 2 * Math.PI;
            
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            // CHECKS:
            // 1. Don't build on roads
            if (isRoad(hx, hz)) continue;
            
            // 2. Don't build in the central plaza
            if (Math.sqrt(hx*hx + hz*hz) < PLAZA_RADIUS + 5) continue;

            // 3. Place a House Plot (7x7 area)
            // We verify if the corners are safe, then mark the area
            let safe = true;
            for (let px = hx - 3; px <= hx + 3; px++) {
                for (let pz = hz - 3; pz <= hz + 3; pz++) {
                    if (isRoad(px, pz)) safe = false;
                }
            }

            if (safe) {
                // Mark foundation in our set
                for (let px = hx - 3; px <= hx + 3; px++) {
                    for (let pz = hz - 3; pz <= hz + 3; pz++) {
                        houseMap.add(`${px},${pz}`);
                    }
                }
            }
        }

        // ==================================================================
        // 2. GENERATE THE WORLD (Block by Block)
        // ==================================================================
        const halfW = Math.floor(this.width / 2);
        const halfD = Math.floor(this.depth / 2);

        // Iterate over the entire requested area
        for (let x = -halfW; x < halfW; x++) {
            for (let z = -halfD; z < halfD; z++) {
                
                const dist = Math.sqrt(x*x + z*z);
                let height = 0;
                let surface = GRASS;
                let isTown = false;
                let isWall = false;

                // --- ZONE 1: INSIDE THE TOWN ---
                if (dist <= TOWN_RADIUS) {
                    isTown = true;
                    height = BASE_HEIGHT; // Flat terrain for town
                    
                    if (dist <= PLAZA_RADIUS) {
                        surface = STONE_BRICK; // Central Plaza
                    } else if (isRoad(x, z)) {
                        surface = GRAVEL; // Roads
                    } else if (houseMap.has(`${x},${z}`)) {
                        surface = STONE_BRICK; // House Foundation
                        height += 1; // Foundations sit 1 block higher
                    } else {
                        surface = GRASS; // Lawns / Empty space
                    }
                } 
                
                // --- ZONE 2: THE CITY WALLS ---
                else if (dist > TOWN_RADIUS && dist <= TOWN_RADIUS + WALL_THICKNESS) {
                    isWall = true;
                    // Check for Gates (Roads passing through)
                    // We check if it aligns with the main axis roads
                    if (Math.abs(x) <= MAIN_ROAD_WIDTH + 1 || Math.abs(z) <= MAIN_ROAD_WIDTH + 1) {
                        // Gate Opening
                        height = BASE_HEIGHT;
                        surface = GRAVEL;
                    } else {
                        // Solid Wall
                        height = BASE_HEIGHT + WALL_HEIGHT;
                        surface = STONE_BRICK;
                    }
                }

                // --- ZONE 3: WILDERNESS (Outside) ---
                else {
                    // Simplex noise for rolling hills
                    // Scale: divide x/z by larger number for wider hills
                    const n = this.noise2D(x / 100, z / 100); 
                    
                    // Height: map -1..1 to a height range (e.g. 8 to 28)
                    height = Math.floor((BASE_HEIGHT - 2) + (n + 1) * 10);
                }

                // ==============================================================
                // 3. FILL THE VERTICAL COLUMN
                // ==============================================================
                
                // A. Place the Surface Block
                setBlockCallback(x, height, z, surface);

                // B. Fill underneath (Dirt/Stone)
                // If it's a wall, fill completely with stone down to base
                // If it's terrain, fill dirt for a few layers, then stone
                const filler = (isTown || isWall) ? STONE_BRICK : DIRT;

                for (let y = height - 1; y > 0; y--) {
                    // Optimization: Only fill top 5 layers for dirt, or all for walls
                    if (isWall) {
                        setBlockCallback(x, y, z, STONE_BRICK);
                    } else if (height - y < 5) {
                        setBlockCallback(x, y, z, filler);
                    } else {
                         // Don't render deep underground to save memory (hollow earth)
                         // OR fill with stone if you want mining
                         // setBlockCallback(x, y, z, STONE_BRICK); 
                         break; 
                    }
                }
                
                // C. Bedrock at the very bottom (y=0)
                setBlockCallback(x, 0, z, STONE_BRICK);
            }
        }
        
        console.log("✅ 'Town of Beginning' Generation Complete.");
    }
}