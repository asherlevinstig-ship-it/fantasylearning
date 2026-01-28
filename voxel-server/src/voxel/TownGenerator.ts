import * as ROT from "rot-js";
import { createNoise2D } from "simplex-noise";

// BLOCK REGISTRY (Must match main.ts IDs)
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3; // Foundations, Walls, Plaza, Deep Stone
const GRAVEL = 4;      // Roads
const BEACON_RED = 5;  // Debug Beacon
const BEDROCK = 6;     // Indestructible bottom layer

export class TownGenerator {
    width: number;
    depth: number;
    noise2D: any;

    // Optimization: Store only 2D layout data
    private houseMap = new Set<string>();
    
    // ==================================================================
    // CONFIGURATION: GIGA-CITY
    // ==================================================================
    public readonly townRadius = 800;    // Radius 800 = 1600 blocks wide!
    public readonly wallThickness = 15;  // Thick walls
    public readonly worldBottom = -16;   // The void limit (y-level)
    
    private wallHeight = 30;      // Massive walls
    private baseHeight = 10;      // Universal flat ground level
    private mainRoadWidth = 8;    // Very wide boulevards

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
        console.log("📐 Calculating Giga-City Layout...");
        
        // MASSIVE increase in attempts to fill the 800-radius circle
        const houseAttempts = 15000; 
        const PLAZA_RADIUS = 40;

        for (let i = 0; i < houseAttempts; i++) {
            // Pick random spot inside town (minus buffer for wall)
            const r = (ROT.RNG.getUniform() * (this.townRadius - 30)); 
            const theta = ROT.RNG.getUniform() * 2 * Math.PI;
            
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            // CHECKS:
            if (this.isRoad(hx, hz)) continue;
            if (Math.sqrt(hx*hx + hz*hz) < PLAZA_RADIUS + 5) continue;

            // Check if 9x9 plot is safe 
            let safe = true;
            for (let px = hx - 4; px <= hx + 4; px++) {
                for (let pz = hz - 4; pz <= hz + 4; pz++) {
                    if (this.isRoad(px, pz)) safe = false;
                }
            }

            if (safe) {
                // Mark foundation 
                for (let px = hx - 3; px <= hx + 3; px++) {
                    for (let pz = hz - 3; pz <= hz + 3; pz++) {
                        this.houseMap.add(`${px},${pz}`);
                    }
                }
            }
        }
        console.log("✅ Layout Complete.");
    }

    // Helper: Defines where roads are located
    private isRoad(x: number, z: number): boolean {
        // 1. Main Cross Roads (North/South/East/West)
        if (Math.abs(x) <= this.mainRoadWidth || Math.abs(z) <= this.mainRoadWidth) return true;
        
        const dist = Math.sqrt(x*x + z*z);

        // 2. Inner Ring Road (Radius ~200)
        if (dist > 190 && dist < 210) return true;

        // 3. Middle Ring Road (Radius ~450)
        if (dist > 440 && dist < 460) return true;

        // 4. Outer Ring Road (Radius ~700)
        if (dist > 690 && dist < 710) return true;

        return false;
    }

    // --------------------------------------------------------------------------
    // 2. ZONE LOGIC (For Biome Notification)
    // --------------------------------------------------------------------------
    public getZoneName(x: number, z: number): "Town of Beginnings" | "The Wilderness" {
        const dist = Math.sqrt(x * x + z * z);
        
        // Includes the Wall itself in the Town zone
        if (dist <= (this.townRadius + this.wallThickness)) {
            return "Town of Beginnings";
        }
        return "The Wilderness";
    }

    // --------------------------------------------------------------------------
    // 3. BLOCK GENERATION
    // --------------------------------------------------------------------------
    public getBlockID(x: number, y: number, z: number): number {
        
        // 0. VOID SAFETY CHECK
        if (y < this.worldBottom) return AIR;
        if (y === this.worldBottom) return BEDROCK;

        const dist = Math.sqrt(x*x + z*z);

        // --- 1. DEBUG BEACON (Center of World) ---
        if (Math.abs(x) < 3 && Math.abs(z) < 3) {
            // Beacon stops at y=0, does not go down to bedrock
            if (y <= 80 && y > 0) return BEACON_RED; 
            // Foundation below beacon (y <= 0) falls through to stone logic
        }

        let height = 0;
        let surface = GRASS;
        let isStructure = false; // "Man-made" verticality (Walls, Foundations)

        // --- ZONE 1: INSIDE THE TOWN (FLAT) ---
        if (dist <= this.townRadius) {
            height = this.baseHeight; 
            
            if (dist <= 40) {
                surface = STONE_BRICK; // Huge Plaza
                isStructure = true;    // Plaza goes all the way down
            } else if (this.isRoad(x, z)) {
                surface = GRAVEL; 
            } else if (this.houseMap.has(`${x},${z}`)) {
                surface = STONE_BRICK; 
                isStructure = true;    // House foundations are deep
            } else {
                surface = GRASS; 
            }
        }
        
        // --- ZONE 2: GIGA CITY WALLS ---
        // Radius 800 to 815
        else if (dist <= this.townRadius + this.wallThickness) {
            
            // Gates on axes - Treat as Road (Natural Terrain below)
            if (Math.abs(x) <= this.mainRoadWidth + 4 || Math.abs(z) <= this.mainRoadWidth + 4) {
                height = this.baseHeight; 
                surface = GRAVEL;
                isStructure = false; 
            } else {
                // The Wall itself
                height = this.baseHeight + this.wallHeight;
                surface = STONE_BRICK;
                isStructure = true; 
            }
        }

        // --- ZONE 3: WILDERNESS ---
        else {
            const n = this.noise2D(x / 200, z / 200); // Larger scale terrain
            height = Math.floor((this.baseHeight - 5) + (n + 1) * 20);
        }

        // ----------------------------------------
        // RETURN BLOCK ID
        // ----------------------------------------
        // A. Air above ground
        if (y > height) return AIR;
        
        // B. Surface Block
        if (y === height) return surface;

        // C. Structures (Walls, Plaza, Foundations)
        // These are solid stone from top to bottom (no dirt layer)
        if (isStructure) return STONE_BRICK;
        
        // D. Natural Terrain Layers
        // Top 4 layers below surface are Dirt
        if (height - y < 5) return DIRT;

        // E. Deep Underground
        // Everything else down to Bedrock is Stone
        return STONE_BRICK; 
    }
}