import { makeNoise2D } from "open-simplex-noise";

// BLOCK REGISTRY (Must match main.ts IDs)
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3; 
const GRAVEL = 4;      
const BEACON_RED = 5;  
const BEDROCK = 6;     

export interface ColumnData {
    height: number;
    surface: number;
    isStructure: boolean;
    isBeacon: boolean;
}

export class TownGenerator {
    width: number;
    depth: number;
    seed: number;
    noise2D: (x: number, y: number) => number;

    // OPTIMIZATION: Store packed integer coordinates (No Strings = No GC)
    // Key format: (x & 0xFFFF) << 16 | (z & 0xFFFF)
    private houseMap = new Set<number>();
    
    // ==================================================================
    // CONFIGURATION: GIGA-CITY
    // ==================================================================
    public readonly townRadius = 800;    
    public readonly wallThickness = 15;  
    public readonly worldBottom = -16;   
    
    private wallHeight = 30;      
    private baseHeight = 30; // Raised base height so we don't hit bedrock
    private mainRoadWidth = 8;    

    // OPTIMIZATION: Precomputed Squared Values
    private readonly townRadiusSq: number;
    private readonly wallOuterRadiusSq: number; 
    private readonly plazaRadiusSq: number;     
    
    // Road Ring Squared Thresholds
    private readonly ring1MinSq: number; private readonly ring1MaxSq: number; 
    private readonly ring2MinSq: number; private readonly ring2MaxSq: number; 
    private readonly ring3MinSq: number; private readonly ring3MaxSq: number; 

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;
        this.seed = seed;

        // Precompute squared math once (CPU Saver)
        this.townRadiusSq = this.townRadius * this.townRadius;
        this.wallOuterRadiusSq = (this.townRadius + this.wallThickness) ** 2;
        this.plazaRadiusSq = 40 * 40;

        // Road Rings (Squared)
        this.ring1MinSq = 190 ** 2; this.ring1MaxSq = 210 ** 2;
        this.ring2MinSq = 440 ** 2; this.ring2MaxSq = 460 ** 2;
        this.ring3MinSq = 690 ** 2; this.ring3MaxSq = 710 ** 2;

        this.noise2D = makeNoise2D(seed);

        this.initLayout();
    }

    // --------------------------------------------------------------------------
    // 1. LAYOUT PRE-CALCULATION (Optimized)
    // --------------------------------------------------------------------------
    private initLayout() {
        console.log("📐 Calculating Giga-City Layout (Optimized)...");
        
        // Simple seeded RNG to replace ROT.js dependency
        let localSeed = this.seed;
        const random = () => {
            localSeed = (localSeed * 9301 + 49297) % 233280;
            return localSeed / 233280;
        };

        const houseAttempts = 25000; 
        const PLAZA_LIMIT_SQ = (45) ** 2; 

        for (let i = 0; i < houseAttempts; i++) {
            const r = (random() * (this.townRadius - 30)); 
            const theta = random() * 2 * Math.PI;
            
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            // Fast Checks
            if (this.isRoad(hx, hz)) continue;
            if ((hx*hx + hz*hz) < PLAZA_LIMIT_SQ) continue;

            // Check if 9x9 plot is safe 
            let safe = true;
            for (let px = hx - 4; px <= hx + 4; px++) {
                for (let pz = hz - 4; pz <= hz + 4; pz++) {
                    if (this.isRoad(px, pz)) {
                        safe = false;
                        break; 
                    }
                }
                if (!safe) break;
            }

            if (safe) {
                // Mark foundation (7x7 house footprint)
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
        // 1. Main Cross Roads
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
    public getZoneName(x: number, z: number): string {
        const d2 = x * x + z * z;
        if (d2 <= this.wallOuterRadiusSq) {
            return "Town of Beginnings";
        }
        return "The Wilderness";
    }

    public getHeight(x: number, z: number): number {
        // Simple height check for teleporting safety
        const col = this.getColumnInfo(x, z);
        return col.height;
    }

    // --------------------------------------------------------------------------
    // 3. COLUMN CALCULATION (Call this ONCE per X/Z)
    // --------------------------------------------------------------------------
    // This is where the heavy math (Noise, Sqrt, Map Lookups) happens.
    public getColumnInfo(x: number, z: number): ColumnData {
        const distSq = x*x + z*z;

        // 1. BEACON CHECK
        let isBeacon = false;
        if (x > -2 && x < 2 && z > -2 && z < 2) {
            isBeacon = true;
        }

        let height = 0;
        let surface = GRASS;
        let isStructure = false; 

        // 2. ZONE LOGIC
        // --- ZONE 1: INSIDE THE TOWN ---
        if (distSq <= this.townRadiusSq) {
            height = this.baseHeight; 
            
            if (distSq <= this.plazaRadiusSq) {
                surface = STONE_BRICK; 
                isStructure = true;    
            } else if (this.isRoad(x, z)) {
                surface = GRAVEL; 
            } else {
                // Bitwise lookup
                const key = (x & 0xFFFF) << 16 | (z & 0xFFFF);
                if (this.houseMap.has(key)) {
                    surface = STONE_BRICK; 
                    isStructure = true;    
                }
            }
        }
        
        // --- ZONE 2: GIGA CITY WALLS ---
        else if (distSq <= this.wallOuterRadiusSq) {
            
            // Gates on axes - Treat as Road
            if (Math.abs(x) <= this.mainRoadWidth + 4 || Math.abs(z) <= this.mainRoadWidth + 4) {
                height = this.baseHeight; 
                surface = GRAVEL;
            } else {
                // The Wall itself
                height = this.baseHeight + this.wallHeight;
                surface = STONE_BRICK;
                isStructure = true; 
            }
        }

        // --- ZONE 3: WILDERNESS ---
        else {
            const scale = 0.005;
            const n = this.noise2D(x * scale, z * scale); 
            height = Math.floor(this.baseHeight + (n * 15));
        }

        return { height, surface, isStructure, isBeacon };
    }

    // --------------------------------------------------------------------------
    // 4. BLOCK RESOLVER (Call this per Y)
    // --------------------------------------------------------------------------
    public resolveBlockID(y: number, col: ColumnData): number {
        
        // A. VOID SAFETY
        if (y < this.worldBottom) return AIR;
        if (y === 0) return BEDROCK; // Bottom is always bedrock

        // B. BEACON (Special Case)
        // Beacon beam is valid between y=base and y=200
        if (col.isBeacon && y > this.baseHeight && y < 200) return BEACON_RED;

        // C. SKY
        if (y > col.height) return AIR;
        
        // D. SURFACE
        if (y === col.height) return col.surface;

        // E. STRUCTURES (Walls, Plaza, Foundations)
        // Solid stone from surface down to bedrock
        if (col.isStructure) return STONE_BRICK;
        
        // F. NATURAL TERRAIN (Dirt Layer)
        // Top 4 blocks below surface are dirt
        if (col.height - y < 4) return DIRT;

        // G. DEEP UNDERGROUND
        return STONE_BRICK; 
    }
}