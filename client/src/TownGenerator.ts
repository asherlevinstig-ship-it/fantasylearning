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

    // Optimization: Store only 2D layout data
    private houseMap = new Set<string>();
    
    // ==================================================================
    // CONFIGURATION: MASSIVE TOWN
    // ==================================================================
    private townRadius = 400;     // Radius 400 = 800 blocks wide town!
    private wallThickness = 5;    // Thicker walls (Imposing)
    private wallHeight = 10;      // Taller walls (Hard to jump over)
    private baseHeight = 10;      // Universal flat ground level
    private mainRoadWidth = 5;    // Wider main roads (11 blocks wide)

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;

        ROT.RNG.setSeed(seed);
        this.noise2D = createNoise2D(() => ROT.RNG.getUniform());

        this.initLayout();
    }

    // --------------------------------------------------------------------------
    // 1. LAYOUT PRE-CALCULATION
    // --------------------------------------------------------------------------
    private initLayout() {
        console.log("📐 Calculating Massive Town Layout...");
        
        // Scale up attempts to fill the huge area
        const houseAttempts = 3000; 
        const PLAZA_RADIUS = 30;

        for (let i = 0; i < houseAttempts; i++) {
            // Pick random spot inside town
            const r = (ROT.RNG.getUniform() * (this.townRadius - 20)); 
            const theta = ROT.RNG.getUniform() * 2 * Math.PI;
            
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            // CHECKS:
            if (this.isRoad(hx, hz)) continue;
            if (Math.sqrt(hx*hx + hz*hz) < PLAZA_RADIUS + 5) continue;

            // Check if 9x9 plot is safe (bigger houses for bigger town)
            let safe = true;
            for (let px = hx - 4; px <= hx + 4; px++) {
                for (let pz = hz - 4; pz <= hz + 4; pz++) {
                    if (this.isRoad(px, pz)) safe = false;
                }
            }

            if (safe) {
                // Mark foundation (7x7 house on 9x9 plot)
                for (let px = hx - 3; px <= hx + 3; px++) {
                    for (let pz = hz - 3; pz <= hz + 3; pz++) {
                        this.houseMap.add(`${px},${pz}`);
                    }
                }
            }
        }
    }

    // Helper: Defines where roads are located
    private isRoad(x: number, z: number): boolean {
        // 1. Main Cross Roads (North/South/East/West)
        if (Math.abs(x) <= this.mainRoadWidth || Math.abs(z) <= this.mainRoadWidth) return true;
        
        const dist = Math.sqrt(x*x + z*z);

        // 2. Inner Ring Road (Radius ~150)
        if (dist > 145 && dist < 160) return true;

        // 3. Outer Ring Road (Radius ~300)
        if (dist > 295 && dist < 310) return true;

        return false;
    }

    // --------------------------------------------------------------------------
    // 2. LAZY BLOCK GENERATION
    // --------------------------------------------------------------------------
    public getBlockID(x: number, y: number, z: number): number {
        
        const dist = Math.sqrt(x*x + z*z);
        let height = 0;
        let surface = GRASS;
        let isWall = false;

        // --- ZONE 1: INSIDE THE TOWN (FLAT) ---
        if (dist <= this.townRadius) {
            height = this.baseHeight; 
            
            if (dist <= 30) {
                surface = STONE_BRICK; // Huge Plaza
            } else if (this.isRoad(x, z)) {
                surface = GRAVEL; 
            } else if (this.houseMap.has(`${x},${z}`)) {
                surface = STONE_BRICK; // Foundations
            } else {
                surface = GRASS; // Lawns
            }
        }
        
        // --- ZONE 2: MASSIVE CITY WALLS ---
        else if (dist <= this.townRadius + this.wallThickness) {
            isWall = true;
            // Massive Gates (Main Roads only)
            if (Math.abs(x) <= this.mainRoadWidth + 2 || Math.abs(z) <= this.mainRoadWidth + 2) {
                height = this.baseHeight; // Gate floor
                surface = GRAVEL;
            } else {
                // Solid Wall
                height = this.baseHeight + this.wallHeight;
                surface = STONE_BRICK;
            }
        }

        // --- ZONE 3: WILDERNESS ---
        else {
            const n = this.noise2D(x / 150, z / 150); // Larger rolling hills
            height = Math.floor((this.baseHeight - 2) + (n + 1) * 12);
        }

        // ----------------------------------------
        // RETURN BLOCK ID
        // ----------------------------------------
        if (y > height) return AIR;
        if (y === height) return surface;
        if (y === 0) return STONE_BRICK;

        // Fill Logic
        if (isWall) return STONE_BRICK;
        
        if (height - y < 5) return DIRT;
        return STONE_BRICK; 
    }
}