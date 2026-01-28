import * as ROT from "rot-js";
import { createNoise2D } from "simplex-noise";

// BLOCK REGISTRY (Must match main.ts IDs)
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3; 
const GRAVEL = 4;      
const BEACON_RED = 5;  
const BEDROCK = 6;     

export class TownGenerator {
    width: number;
    depth: number;
    noise2D: any;

    // OPTIMIZATION: Use number Set instead of string Set to avoid GC thrashing
    // Key format: (x & 0xFFFF) << 16 | (z & 0xFFFF)
    private houseMap = new Set<number>();
    
    // ==================================================================
    // CONFIGURATION: GIGA-CITY
    // ==================================================================
    public readonly townRadius = 800;    
    public readonly wallThickness = 15;  
    public readonly worldBottom = -16;   
    
    private wallHeight = 30;      
    private baseHeight = 10;      
    private mainRoadWidth = 8;    

    // OPTIMIZATION: Precomputed Squared Values
    private readonly townRadiusSq: number;
    private readonly wallOuterRadiusSq: number; // (800 + 15)^2
    private readonly plazaRadiusSq: number;     // 40^2
    
    // Road Ring Squared Thresholds
    private readonly ring1MinSq: number; // 190^2
    private readonly ring1MaxSq: number; // 210^2
    private readonly ring2MinSq: number; // 440^2
    private readonly ring2MaxSq: number; // 460^2
    private readonly ring3MinSq: number; // 690^2
    private readonly ring3MaxSq: number; // 710^2

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;

        // Precompute squared values once
        this.townRadiusSq = this.townRadius * this.townRadius;
        this.wallOuterRadiusSq = (this.townRadius + this.wallThickness) ** 2;
        this.plazaRadiusSq = 40 * 40;

        // Road Rings
        this.ring1MinSq = 190 * 190; this.ring1MaxSq = 210 * 210;
        this.ring2MinSq = 440 * 440; this.ring2MaxSq = 460 * 460;
        this.ring3MinSq = 690 * 690; this.ring3MaxSq = 710 * 710;

        ROT.RNG.setSeed(seed);
        this.noise2D = createNoise2D(() => ROT.RNG.getUniform());

        this.initLayout();
    }

    // --------------------------------------------------------------------------
    // 1. LAYOUT PRE-CALCULATION
    // --------------------------------------------------------------------------
    private initLayout() {
        console.log("📐 Calculating Giga-City Layout (Optimized)...");
        
        const houseAttempts = 15000; 
        const PLAZA_LIMIT_SQ = (40 + 5) ** 2; // Plaza radius + buffer, squared

        for (let i = 0; i < houseAttempts; i++) {
            const r = (ROT.RNG.getUniform() * (this.townRadius - 30)); 
            const theta = ROT.RNG.getUniform() * 2 * Math.PI;
            
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            // Optimizations applied here too
            if (this.isRoad(hx, hz)) continue; // Note: isRoad handles its own sq checks
            if ((hx*hx + hz*hz) < PLAZA_LIMIT_SQ) continue;

            // Check if 9x9 plot is safe 
            let safe = true;
            for (let px = hx - 4; px <= hx + 4; px++) {
                for (let pz = hz - 4; pz <= hz + 4; pz++) {
                    if (this.isRoad(px, pz)) {
                        safe = false;
                        break; // Fail fast
                    }
                }
                if (!safe) break;
            }

            if (safe) {
                // Mark foundation 
                for (let px = hx - 3; px <= hx + 3; px++) {
                    for (let pz = hz - 3; pz <= hz + 3; pz++) {
                        // Bitwise Hash Key
                        this.houseMap.add((px & 0xFFFF) << 16 | (pz & 0xFFFF));
                    }
                }
            }
        }
        console.log(`✅ Layout Complete. Houses: ${this.houseMap.size} blocks.`);
    }

    // Helper: Defines where roads are located using Squared Math
    private isRoad(x: number, z: number): boolean {
        // 1. Main Cross Roads (North/South/East/West)
        // Simple Abs check is faster than multiplication, keep it.
        if (Math.abs(x) <= this.mainRoadWidth || Math.abs(z) <= this.mainRoadWidth) return true;
        
        // 2. Ring Roads (Squared Distance Check)
        const d2 = x*x + z*z;

        if (d2 > this.ring1MinSq && d2 < this.ring1MaxSq) return true;
        if (d2 > this.ring2MinSq && d2 < this.ring2MaxSq) return true;
        if (d2 > this.ring3MinSq && d2 < this.ring3MaxSq) return true;

        return false;
    }

    // --------------------------------------------------------------------------
    // 2. ZONE LOGIC
    // --------------------------------------------------------------------------
    public getZoneName(x: number, z: number): "Town of Beginnings" | "The Wilderness" {
        // Use squared check here too
        const d2 = x * x + z * z;
        if (d2 <= this.wallOuterRadiusSq) {
            return "Town of Beginnings";
        }
        return "The Wilderness";
    }

    // --------------------------------------------------------------------------
    // 3. BLOCK GENERATION (HOT PATH)
    // --------------------------------------------------------------------------
    public getBlockID(x: number, y: number, z: number): number {
        
        // 0. VOID SAFETY CHECK
        if (y < this.worldBottom) return AIR;
        if (y === this.worldBottom) return BEDROCK;

        // OPTIMIZATION: Calculate squared distance once
        const distSq = x*x + z*z;

        // --- 1. DEBUG BEACON ---
        // Fast bounds check first
        if (x > -3 && x < 3 && z > -3 && z < 3) {
            if (y <= 80 && y > 0) return BEACON_RED; 
        }

        let height = 0;
        let surface = GRASS;
        let isStructure = false; 

        // --- ZONE 1: INSIDE THE TOWN ---
        if (distSq <= this.townRadiusSq) {
            height = this.baseHeight; 
            
            if (distSq <= this.plazaRadiusSq) {
                surface = STONE_BRICK; 
                isStructure = true;    
            } else if (this.isRoad(x, z)) {
                surface = GRAVEL; 
            } else {
                // OPTIMIZATION: Bitwise lookup (No string creation)
                const key = (x & 0xFFFF) << 16 | (z & 0xFFFF);
                
                if (this.houseMap.has(key)) {
                    surface = STONE_BRICK; 
                    isStructure = true;    
                } else {
                    surface = GRASS; 
                }
            }
        }
        
        // --- ZONE 2: GIGA CITY WALLS ---
        else if (distSq <= this.wallOuterRadiusSq) {
            
            // Gates on axes - Treat as Road
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
            const n = this.noise2D(x / 200, z / 200); 
            height = Math.floor((this.baseHeight - 5) + (n + 1) * 20);
        }

        // ----------------------------------------
        // RETURN BLOCK ID
        // ----------------------------------------
        if (y > height) return AIR;
        if (y === height) return surface;

        // Structures (Walls, Plaza, Foundations) are solid stone
        if (isStructure) return STONE_BRICK;
        
        // Natural Terrain Layers
        if (height - y < 5) return DIRT;

        // Deep Underground
        return STONE_BRICK; 
    }
}