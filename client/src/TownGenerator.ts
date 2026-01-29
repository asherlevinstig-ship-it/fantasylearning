import { makeNoise2D } from "open-simplex-noise";
import { BLOCKS } from "./blocks"; // The Single Source of Truth

// --------------------------------------------------------------------------
// INTERFACES
// --------------------------------------------------------------------------

// Data calculated once per (X,Z) coordinate to optimize the Y-loop.
export interface ColumnData {
    height: number;
    surface: number;
    isHouse: boolean;
    isWall: boolean;
    isRoad: boolean;
    isBeacon: boolean;
    houseHash: number; // Deterministic random number for window placement
}

// --------------------------------------------------------------------------
// TOWN GENERATOR CLASS
// --------------------------------------------------------------------------
export class TownGenerator {
    width: number;
    depth: number;
    seed: number;
    noise2D: (x: number, y: number) => number;

    // Stores house foundation locations using packed coordinates
    // Key format: (x & 0xFFFF) << 16 | (z & 0xFFFF)
    private houseMap = new Set<number>();

    // ==================================================================
    // CONFIGURATION
    // ==================================================================
    public readonly townRadius = 800;
    public readonly wallThickness = 15;
    public readonly worldBottom = -16;
    
    private baseHeight = 30; 
    private wallHeight = 40; // Height of the city walls

    // Pre-calculated Squared Values (Optimization)
    private readonly townRadiusSq: number;
    private readonly wallOuterRadiusSq: number;
    private readonly plazaRadiusSq: number;

    // Ring Road Thresholds (Squared)
    private readonly ring1MinSq: number; private readonly ring1MaxSq: number;
    private readonly ring2MinSq: number; private readonly ring2MaxSq: number;
    private readonly ring3MinSq: number; private readonly ring3MaxSq: number;

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;
        this.seed = seed;
        
        // 1. Pre-calculate Squares to avoid Math.sqrt in loops
        this.townRadiusSq = this.townRadius ** 2;
        this.wallOuterRadiusSq = (this.townRadius + this.wallThickness) ** 2;
        this.plazaRadiusSq = 45 ** 2;

        // 2. Define Ring Road Radii (Squared)
        this.ring1MinSq = 190 ** 2; this.ring1MaxSq = 210 ** 2;
        this.ring2MinSq = 440 ** 2; this.ring2MaxSq = 460 ** 2;
        this.ring3MinSq = 690 ** 2; this.ring3MaxSq = 710 ** 2;

        // 3. Initialize Noise
        this.noise2D = makeNoise2D(seed);

        // 4. Run Layout Generation
        this.initLayout();
    }

    // --------------------------------------------------------------------------
    // 1. LAYOUT GENERATION (Runs Once)
    // --------------------------------------------------------------------------
    private initLayout() {
        console.log("📐 Generating Giga-City Layout...");
        
        // Deterministic RNG (Linear Congruential Generator)
        let localSeed = this.seed;
        const random = () => { 
            localSeed = (localSeed * 9301 + 49297) % 233280; 
            return localSeed / 233280; 
        };

        const houseAttempts = 20000;
        
        for (let i = 0; i < houseAttempts; i++) {
            // Pick a random spot inside the town
            const r = (random() * (this.townRadius - 30));
            const theta = random() * 2 * Math.PI;
            
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            // Constraint: Don't build on roads
            if (this.isRoad(hx, hz)) continue;
            
            // Constraint: Don't build in the central plaza
            if ((hx*hx + hz*hz) < this.plazaRadiusSq) continue;

            // Constraint: Check neighbors (9x9 area) to prevent overlap
            let safe = true;
            for (let px = hx - 4; px <= hx + 4; px++) {
                for (let pz = hz - 4; pz <= hz + 4; pz++) {
                    if (this.isRoad(px, pz) || this.houseMap.has(this.pack(px, pz))) {
                        safe = false; 
                        break;
                    }
                }
                if (!safe) break;
            }

            // Place House (5x5 footprint)
            if (safe) {
                for (let px = hx - 2; px <= hx + 2; px++) {
                    for (let pz = hz - 2; pz <= hz + 2; pz++) {
                        this.houseMap.add(this.pack(px, pz));
                    }
                }
            }
        }
        console.log(`✅ City Built: ${this.houseMap.size} foundation blocks.`);
    }

    // Helper: Bit-packing coordinates for Set performance
    private pack(x: number, z: number) { 
        return (x & 0xFFFF) << 16 | (z & 0xFFFF); 
    }

    // Helper: Checks if a coordinate is on a road
    private isRoad(x: number, z: number): boolean {
        // Main Axes
        if (Math.abs(x) <= 6 || Math.abs(z) <= 6) return true;
        
        // Ring Roads
        const d2 = x*x + z*z;
        if ((d2 > this.ring1MinSq && d2 < this.ring1MaxSq) || 
            (d2 > this.ring2MinSq && d2 < this.ring2MaxSq) || 
            (d2 > this.ring3MinSq && d2 < this.ring3MaxSq)) return true;

        return false;
    }

    // --------------------------------------------------------------------------
    // 2. COLUMN ANALYSIS (Called once per X,Z)
    // --------------------------------------------------------------------------
    public getColumnInfo(x: number, z: number): ColumnData {
        const distSq = x*x + z*z;
        
        let height = this.baseHeight;
        let surface = BLOCKS.GRASS;
        let isHouse = false;
        let isWall = false;
        let isRoad = false;
        let isBeacon = false;
        let houseHash = 0;

        // A. Beacon Check
        if (Math.abs(x) < 3 && Math.abs(z) < 3) isBeacon = true;

        // B. Town Interior
        if (distSq <= this.townRadiusSq) {
            if (distSq <= this.plazaRadiusSq) {
                surface = BLOCKS.STONE_BRICK; // Plaza
            } else if (this.isRoad(x, z)) {
                surface = BLOCKS.GRAVEL; // Roads
                isRoad = true;
            } else if (this.houseMap.has(this.pack(x, z))) {
                isHouse = true; 
                surface = BLOCKS.WOOD_PLANKS; // House Floor
                // Calculate deterministic hash for window placement
                houseHash = Math.abs((x * 73856093) ^ (z * 19349663));
            }
        }
        
        // C. City Walls
        else if (distSq <= this.wallOuterRadiusSq) {
            // Gates on main axes
            if (Math.abs(x) <= 12 || Math.abs(z) <= 12) {
                surface = BLOCKS.GRAVEL;
            } else {
                isWall = true;
                height = this.baseHeight + this.wallHeight;
                surface = BLOCKS.STONE_BRICK;
            }
        }
        
        // D. Wilderness
        else {
            const n = this.noise2D(x * 0.005, z * 0.005);
            height = Math.floor(this.baseHeight + (n * 15));
        }

        return { height, surface, isHouse, isWall, isRoad, isBeacon, houseHash };
    }

    // --------------------------------------------------------------------------
    // 3. BLOCK RESOLUTION (Called for every Y block)
    // --------------------------------------------------------------------------
    public resolveBlockID(y: number, col: ColumnData): number {
        
        // 1. Bedrock & Void
        if (y === 0) return BLOCKS.BEDROCK;
        if (y < 0) return BLOCKS.AIR;

        // 2. Beacon Beam
        if (col.isBeacon && y > this.baseHeight && y < 200) return BLOCKS.BEACON_RAY;

        // 3. 3D House Generation
        if (col.isHouse && y > col.height) {
            const h = (y - col.height); // Height relative to floor
            
            // Walls (Blocks 1-4)
            if (h <= 4) {
                // Window Logic: Eye level (h=2) + Hash Check
                if (h === 2 && col.houseHash % 3 === 0) return BLOCKS.GLASS;
                return BLOCKS.WOOD_PLANKS;
            }
            // Roof (Block 5)
            if (h === 5) return BLOCKS.ROOF_STONE;
            
            return BLOCKS.AIR;
        }

        // 4. Sky
        if (y > col.height) return BLOCKS.AIR;

        // 5. Surface
        if (y === col.height) return col.surface;

        // 6. Wall Interiors
        if (col.isWall) return BLOCKS.STONE_BRICK;

        // 7. Underground (Dirt then Stone)
        if (col.height - y < 4) return BLOCKS.DIRT;
        return BLOCKS.STONE_BRICK;
    }

    // --------------------------------------------------------------------------
    // 4. HELPERS (Server & Utils)
    // --------------------------------------------------------------------------
    
    // Server wrapper for single block access
    public getBlockID(x: number, y: number, z: number) {
        return this.resolveBlockID(y, this.getColumnInfo(x, z));
    }
    
    // Zone detection for HUD/PvP
    public getZoneName(x: number, z: number) {
        const d2 = x*x + z*z;
        return d2 <= this.wallOuterRadiusSq ? "Town of Beginnings" : "The Wilderness";
    }
    
    // Heightmap access for Teleporting
    public getHeight(x: number, z: number) {
        return this.getColumnInfo(x, z).height;
    }
}