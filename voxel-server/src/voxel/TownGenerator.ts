import { makeNoise2D } from "open-simplex-noise";

// --------------------------------------------------------------------------
// INTERFACES
// --------------------------------------------------------------------------

// The generator now expects these IDs to be passed in from main.ts.
// This prevents "Grey World" bugs where the engine assigns different IDs than we expect.
export interface BlockIDs {
    AIR: number;
    GRASS: number;
    DIRT: number;
    STONE_BRICK: number;
    GRAVEL: number;
    BEACON_RAY: number;
    BEDROCK: number;
    WOOD_PLANKS: number;
    WOOD_LOG: number;
    GLASS: number;
    ROOF_STONE: number;
}

// Data calculated once per (X,Z) coordinate to optimize Y-loop generation
export interface ColumnData {
    height: number;
    surface: number;
    isHouse: boolean;
    isWall: boolean;
    isRoad: boolean;
    isBeacon: boolean;
    houseHash: number; // Used to randomize window placement for each house
}

// --------------------------------------------------------------------------
// TOWN GENERATOR CLASS
// --------------------------------------------------------------------------
export class TownGenerator {
    // Dimensions & Seed
    width: number;
    depth: number;
    seed: number;
    
    // The Dynamic Block ID Map
    ids: BlockIDs;

    // Noise Function
    noise2D: (x: number, y: number) => number;

    // Layout Storage (Packed Coordinates for Memory Optimization)
    // Key format: (x & 0xFFFF) << 16 | (z & 0xFFFF)
    private houseMap = new Set<number>();

    // --------------------------------------------------------------------------
    // CONFIGURATION CONSTANTS
    // --------------------------------------------------------------------------
    public readonly townRadius = 800;
    public readonly wallThickness = 15;
    public readonly worldBottom = -16;
    
    private baseHeight = 30; 
    private wallHeight = 40; // Height of the massive city walls

    // Pre-calculated Squared Values for distance checks (CPU Optimization)
    private readonly townRadiusSq: number;
    private readonly wallOuterRadiusSq: number;
    private readonly plazaRadiusSq: number;

    // Road Ring Thresholds (Squared)
    private readonly ring1MinSq: number;
    private readonly ring1MaxSq: number;
    private readonly ring2MinSq: number;
    private readonly ring2MaxSq: number;
    private readonly ring3MinSq: number;
    private readonly ring3MaxSq: number;

    // --------------------------------------------------------------------------
    // CONSTRUCTOR
    // --------------------------------------------------------------------------
    constructor(width: number, depth: number, seed: number, ids: BlockIDs) {
        this.width = width;
        this.depth = depth;
        this.seed = seed;
        this.ids = ids;
        
        // 1. Pre-calculate Squares
        this.townRadiusSq = this.townRadius ** 2;
        this.wallOuterRadiusSq = (this.townRadius + this.wallThickness) ** 2;
        this.plazaRadiusSq = 45 ** 2; // Central plaza radius

        // 2. Pre-calculate Ring Road Distances
        this.ring1MinSq = 190 ** 2; this.ring1MaxSq = 210 ** 2;
        this.ring2MinSq = 440 ** 2; this.ring2MaxSq = 460 ** 2;
        this.ring3MinSq = 690 ** 2; this.ring3MaxSq = 710 ** 2;

        // 3. Initialize Noise
        this.noise2D = makeNoise2D(seed);

        // 4. Generate the City Layout
        this.initLayout();
    }

    // --------------------------------------------------------------------------
    // 1. LAYOUT GENERATION ALGORITHM
    // --------------------------------------------------------------------------
    // Runs once at startup to determine where every house in the city lives.
    private initLayout() {
        console.log("📐 Generating Giga-City Layout...");
        
        // Use a local seeded random generator to ensure every player sees the same city
        let localSeed = this.seed;
        const random = () => { 
            localSeed = (localSeed * 9301 + 49297) % 233280; 
            return localSeed / 233280; 
        };

        // Attempt to place 20,000 houses within the walls
        const houseAttempts = 20000;
        
        for (let i = 0; i < houseAttempts; i++) {
            // Pick a random spot inside the town radius
            const r = (random() * (this.townRadius - 30));
            const theta = random() * 2 * Math.PI;
            
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            // CONSTRAINT 1: Do not build on existing roads
            if (this.isRoad(hx, hz)) continue;
            
            // CONSTRAINT 2: Do not build inside the central plaza
            if ((hx*hx + hz*hz) < this.plazaRadiusSq) continue;

            // CONSTRAINT 3: Check neighbors (9x9 area) for overlap or roads
            // We want space between houses
            let safe = true;
            for (let px = hx - 4; px <= hx + 4; px++) {
                for (let pz = hz - 4; pz <= hz + 4; pz++) {
                    // Check if this neighbor pixel is a road or already a house
                    if (this.isRoad(px, pz) || this.houseMap.has(this.pack(px, pz))) {
                        safe = false; 
                        break;
                    }
                }
                if (!safe) break;
            }

            // If the spot is valid, register the house footprint (5x5)
            if (safe) {
                for (let px = hx - 2; px <= hx + 2; px++) {
                    for (let pz = hz - 2; pz <= hz + 2; pz++) {
                        this.houseMap.add(this.pack(px, pz));
                    }
                }
            }
        }
        console.log(`✅ City Built: ${this.houseMap.size} foundation blocks registered.`);
    }

    // Helper: Bit-packing coordinates into a single integer for Map/Set performance
    // Shifts X left 16 bits and ORs with Z. 
    private pack(x: number, z: number) { 
        return (x & 0xFFFF) << 16 | (z & 0xFFFF); 
    }

    // Helper: Determines if a coordinate is part of a Main Road or Ring Road
    private isRoad(x: number, z: number): boolean {
        // 1. Main Cross Roads (North/South and East/West axis)
        if (Math.abs(x) <= 6 || Math.abs(z) <= 6) return true;
        
        // 2. Ring Roads (Concentric circles)
        const d2 = x*x + z*z;
        
        // Ring 1
        if (d2 > this.ring1MinSq && d2 < this.ring1MaxSq) return true;
        // Ring 2
        if (d2 > this.ring2MinSq && d2 < this.ring2MaxSq) return true;
        // Ring 3
        if (d2 > this.ring3MinSq && d2 < this.ring3MaxSq) return true;

        return false;
    }

    // --------------------------------------------------------------------------
    // 2. COLUMN ANALYSIS (HOISTED LOGIC)
    // --------------------------------------------------------------------------
    // This function is called ONCE per (x,z) coordinate. 
    // It calculates everything we need to know about that vertical column.
    public getColumnInfo(x: number, z: number): ColumnData {
        const distSq = x*x + z*z;
        
        // Default Wilderness State
        let height = this.baseHeight;
        let surface = this.ids.GRASS;
        let isHouse = false;
        let isWall = false;
        let isRoad = false;
        let isBeacon = false;
        let houseHash = 0;

        // --- 1. BEACON CHECK (Center of world) ---
        if (Math.abs(x) < 3 && Math.abs(z) < 3) {
            isBeacon = true;
        }

        // --- 2. TOWN INTERIOR (Radius 0 to 800) ---
        if (distSq <= this.townRadiusSq) {
            
            if (distSq <= this.plazaRadiusSq) {
                // Central Plaza
                surface = this.ids.STONE_BRICK; 
            } else if (this.isRoad(x, z)) {
                // Roads
                surface = this.ids.GRAVEL;
                isRoad = true;
            } else if (this.houseMap.has(this.pack(x, z))) {
                // House Foundations
                isHouse = true;
                surface = this.ids.WOOD_PLANKS; // The floor of the house
                
                // Calculate a deterministic random hash for this specific coordinate
                // Used later to decide where windows go
                houseHash = Math.abs((x * 73856093) ^ (z * 19349663));
            }
        }
        
        // --- 3. CITY WALLS (Radius 800 to 815) ---
        else if (distSq <= this.wallOuterRadiusSq) {
            // Gates: Allow passage through walls on the main axes
            if (Math.abs(x) <= 12 || Math.abs(z) <= 12) {
                surface = this.ids.GRAVEL; // Gate floor
            } else {
                // The Wall Structure
                isWall = true;
                height = this.baseHeight + this.wallHeight;
                surface = this.ids.STONE_BRICK; // Top of the wall
            }
        }
        
        // --- 4. THE WILDERNESS (Radius > 815) ---
        else {
            // Perlin Noise Terrain
            // Scale: 0.005 makes for smooth, rolling hills
            // Amplitude: 15 blocks variation
            const n = this.noise2D(x * 0.005, z * 0.005);
            height = Math.floor(this.baseHeight + (n * 15));
        }

        return { height, surface, isHouse, isWall, isRoad, isBeacon, houseHash };
    }

    // --------------------------------------------------------------------------
    // 3. BLOCK RESOLUTION (3D BUILDING)
    // --------------------------------------------------------------------------
    // Called for every block in the chunk (Y-loop).
    // Uses the pre-calculated ColumnData to decide the block ID.
    public resolveBlockID(y: number, col: ColumnData): number {
        
        // 1. Bedrock Layer (Unbreakable bottom)
        if (y === 0) return this.ids.BEDROCK;
        
        // 2. Void Safety
        if (y < 0) return this.ids.AIR;

        // 3. Beacon Beam
        if (col.isBeacon && y > this.baseHeight && y < 200) {
            return this.ids.BEACON_RAY;
        }

        // 4. HOUSE GENERATION (The 3D Logic)
        // If this column is part of a house, we build UP from the ground
        if (col.isHouse && y > col.height) {
            const h = (y - col.height); // Height relative to the floor
            
            // Houses are 5 blocks tall
            if (h <= 4) {
                // Window Logic:
                // Use the houseHash to deterministically place windows
                // "h === 2" means windows are at eye level
                // "col.houseHash % 3 === 0" gives a 33% chance of a window per block
                if (h === 2 && col.houseHash % 3 === 0) {
                    return this.ids.GLASS;
                }
                // Otherwise, solid wood walls
                return this.ids.WOOD_PLANKS;
            }
            
            // Roof Logic:
            // The 5th block up is the roof
            if (h === 5) {
                return this.ids.ROOF_STONE;
            }
            
            // Above the roof is air
            return this.ids.AIR;
        }

        // 5. Sky (Above terrain)
        if (y > col.height) return this.ids.AIR;

        // 6. Surface (The block you walk on)
        if (y === col.height) return col.surface;

        // 7. Wall Interiors (Solid stone)
        if (col.isWall) return this.ids.STONE_BRICK;

        // 8. Underground (Dirt layer, then stone)
        if (col.height - y < 4) return this.ids.DIRT;
        return this.ids.STONE_BRICK;
    }

    // --------------------------------------------------------------------------
    // 4. PUBLIC HELPERS
    // --------------------------------------------------------------------------

    // Helper for Server Validation (VoxelRoom.ts uses this)
    public getBlockID(x: number, y: number, z: number) {
        return this.resolveBlockID(y, this.getColumnInfo(x, z));
    }
    
    // Helper for Zone Detection (HUD / PvP Logic)
    public getZoneName(x: number, z: number) {
        const d2 = x*x + z*z;
        // If inside the wall outer radius, it's the Town
        if (d2 <= this.wallOuterRadiusSq) {
            return "Town of Beginnings";
        }
        return "The Wilderness";
    }
    
    // Helper for Teleportation (Find safe Y coordinate)
    public getHeight(x: number, z: number) {
        return this.getColumnInfo(x, z).height;
    }
}