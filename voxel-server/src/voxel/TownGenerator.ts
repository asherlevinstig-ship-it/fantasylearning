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
    
    // Configuration
    private townRadius = 150;     // Radius of the flat town area
    private wallThickness = 3;
    private wallHeight = 6;
    private baseHeight = 10;      // The universal ground level (y=10)
    private mainRoadWidth = 4;    // Half-width

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;

        // Initialize RNG
        ROT.RNG.setSeed(seed);
        this.noise2D = createNoise2D(() => ROT.RNG.getUniform());

        // Pre-calculate the town blueprint
        this.initLayout();
    }

    // --------------------------------------------------------------------------
    // 1. LAYOUT PRE-CALCULATION
    // --------------------------------------------------------------------------
    private initLayout() {
        console.log("📐 Calculating Flat Town Layout...");
        
        const houseAttempts = 400; 
        const PLAZA_RADIUS = 20;

        for (let i = 0; i < houseAttempts; i++) {
            // Pick random spot inside town
            const r = (ROT.RNG.getUniform() * (this.townRadius - 15)); 
            const theta = ROT.RNG.getUniform() * 2 * Math.PI;
            
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            // CHECKS:
            // 1. Don't build on roads
            if (this.isRoad(hx, hz)) continue;
            
            // 2. Don't build in the central plaza
            if (Math.sqrt(hx*hx + hz*hz) < PLAZA_RADIUS + 5) continue;

            // 3. Check if a 7x7 plot is safe (no roads intersecting)
            let safe = true;
            for (let px = hx - 3; px <= hx + 3; px++) {
                for (let pz = hz - 3; pz <= hz + 3; pz++) {
                    if (this.isRoad(px, pz)) safe = false;
                }
            }

            // 4. If safe, mark the foundation coordinates
            if (safe) {
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
        // Main Cross Roads
        if (Math.abs(x) <= this.mainRoadWidth || Math.abs(z) <= this.mainRoadWidth) return true;
        
        // The Great Ring Road (at radius ~100)
        const dist = Math.sqrt(x*x + z*z);
        if (dist > 95 && dist < 105) return true;

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

        // --- ZONE 1: INSIDE THE TOWN (ALL FLAT) ---
        if (dist <= this.townRadius) {
            height = this.baseHeight; // STRICTLY 10. No bumps.
            
            if (dist <= 20) {
                surface = STONE_BRICK; // Plaza
            } else if (this.isRoad(x, z)) {
                surface = GRAVEL; // Roads
            } else if (this.houseMap.has(`${x},${z}`)) {
                surface = STONE_BRICK; // House Foundation (Flat)
                // height is NOT increased here anymore
            } else {
                surface = GRASS; // Lawns
            }
        }
        
        // --- ZONE 2: CITY WALLS ---
        else if (dist <= this.townRadius + this.wallThickness) {
            isWall = true;
            // Gates (Roads passing through)
            if (Math.abs(x) <= this.mainRoadWidth + 1 || Math.abs(z) <= this.mainRoadWidth + 1) {
                height = this.baseHeight; // Gate floor is flat
                surface = GRAVEL;
            } else {
                // Solid Wall
                height = this.baseHeight + this.wallHeight;
                surface = STONE_BRICK;
            }
        }

        // --- ZONE 3: WILDERNESS ---
        else {
            // Simplex noise for hills outside the walls
            const n = this.noise2D(x / 100, z / 100); 
            height = Math.floor((this.baseHeight - 2) + (n + 1) * 10);
        }

        // ----------------------------------------
        // RETURN BLOCK ID
        // ----------------------------------------
        
        // 1. Above Ground -> Air
        if (y > height) return AIR;

        // 2. The Surface Block
        if (y === height) return surface;

        // 3. Bedrock (Bottom of world)
        if (y === 0) return STONE_BRICK;

        // 4. Fill Logic (Underground)
        if (isWall) {
            return STONE_BRICK; 
        } else {
            // Normal ground
            if (height - y < 5) return DIRT;
            return STONE_BRICK; 
        }
    }
}