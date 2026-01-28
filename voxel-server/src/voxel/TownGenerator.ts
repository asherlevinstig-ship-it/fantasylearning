import { makeNoise2D } from "open-simplex-noise";

// BLOCK PALETTE (Must match main.ts IDs)
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3;
const GRAVEL = 4;
const BEACON_RAY = 5;
const BEDROCK = 6;
const WOOD_PLANKS = 7;
const WOOD_LOG = 8;
const GLASS = 9;
const ROOF_STONE = 10;

export interface ColumnData {
    height: number;
    surface: number;
    isHouse: boolean; // Marks this column as part of a house footprint
    isWall: boolean;
    isRoad: boolean;
    isBeacon: boolean;
    houseHash: number; // Random number for this specific house (for variety)
}

export class TownGenerator {
    width: number;
    depth: number;
    seed: number;
    noise2D: (x: number, y: number) => number;

    // Stores house locations using packed coordinates
    private houseMap = new Set<number>();

    // CONFIGURATION
    public readonly townRadius = 800;
    public readonly wallThickness = 15;
    public readonly worldBottom = -16;
    
    private baseHeight = 30; 
    private wallHeight = 40; // Giant City Wall height

    // SQUARED MATH CACHE (Optimization)
    private readonly townRadiusSq: number;
    private readonly wallOuterRadiusSq: number;
    private readonly plazaRadiusSq: number;

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;
        this.seed = seed;
        
        this.townRadiusSq = this.townRadius ** 2;
        this.wallOuterRadiusSq = (this.townRadius + this.wallThickness) ** 2;
        this.plazaRadiusSq = 45 ** 2;

        this.noise2D = makeNoise2D(seed);
        this.initLayout();
    }

    // --------------------------------------------------------------------------
    // 1. LAYOUT PRE-CALCULATION
    // --------------------------------------------------------------------------
    private initLayout() {
        console.log("📐 Generating City Layout...");
        // Simple linear congruential generator for reproducible layouts
        let localSeed = this.seed;
        const random = () => { localSeed = (localSeed * 9301 + 49297) % 233280; return localSeed / 233280; };

        // Attempt to place 20,000 houses
        for (let i = 0; i < 20000; i++) {
            const r = (random() * (this.townRadius - 30));
            const theta = random() * 2 * Math.PI;
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            // Don't build on roads or plaza
            if (this.isRoad(hx, hz)) continue;
            if ((hx*hx + hz*hz) < this.plazaRadiusSq) continue;

            // Check neighbors for clearance (9x9 check)
            let safe = true;
            for (let px = hx - 4; px <= hx + 4; px++) {
                for (let pz = hz - 4; pz <= hz + 4; pz++) {
                    if (this.isRoad(px, pz) || this.houseMap.has(this.pack(px, pz))) {
                        safe = false; break;
                    }
                }
                if (!safe) break;
            }

            if (safe) {
                // Place a 5x5 house footprint
                for (let px = hx - 2; px <= hx + 2; px++) {
                    for (let pz = hz - 2; pz <= hz + 2; pz++) {
                        this.houseMap.add(this.pack(px, pz));
                    }
                }
            }
        }
        console.log(`✅ City Built: ${this.houseMap.size} foundation blocks.`);
    }

    private pack(x: number, z: number) { return (x & 0xFFFF) << 16 | (z & 0xFFFF); }

    private isRoad(x: number, z: number): boolean {
        // Main Axis Roads
        if (Math.abs(x) <= 6 || Math.abs(z) <= 6) return true;
        
        // Ring Roads
        const d2 = x*x + z*z;
        const rings = [[190, 210], [440, 460], [690, 710]];
        for (let r of rings) {
            if (d2 > r[0]**2 && d2 < r[1]**2) return true;
        }
        return false;
    }

    // --------------------------------------------------------------------------
    // 2. COLUMN INFO (The "Blueprint")
    // --------------------------------------------------------------------------
    public getColumnInfo(x: number, z: number): ColumnData {
        const distSq = x*x + z*z;
        let height = this.baseHeight;
        let surface = GRASS;
        let isHouse = false;
        let isWall = false;
        let isRoad = false;
        let isBeacon = false;
        let houseHash = 0;

        // 1. BEACON
        if (Math.abs(x) < 3 && Math.abs(z) < 3) isBeacon = true;

        // 2. TOWN INTERIOR
        if (distSq <= this.townRadiusSq) {
            if (distSq <= this.plazaRadiusSq) {
                surface = STONE_BRICK; // Central Plaza
            } else if (this.isRoad(x, z)) {
                surface = GRAVEL;
                isRoad = true;
            } else if (this.houseMap.has(this.pack(x, z))) {
                isHouse = true;
                surface = WOOD_PLANKS; // Floor of house
                // Simple hash for variety
                houseHash = Math.abs((x * 73856093) ^ (z * 19349663));
            }
        }
        // 3. CITY WALL
        else if (distSq <= this.wallOuterRadiusSq) {
            // Gates (Allow passing through at main axes)
            if (Math.abs(x) <= 12 || Math.abs(z) <= 12) {
                surface = GRAVEL;
            } else {
                isWall = true;
                height = this.baseHeight + this.wallHeight;
                surface = STONE_BRICK;
            }
        }
        // 4. WILDERNESS
        else {
            const n = this.noise2D(x * 0.005, z * 0.005);
            height = Math.floor(this.baseHeight + (n * 15));
        }

        return { height, surface, isHouse, isWall, isRoad, isBeacon, houseHash };
    }

    // --------------------------------------------------------------------------
    // 3. 3D BLOCK GENERATOR (The "Builder")
    // --------------------------------------------------------------------------
    public resolveBlockID(y: number, col: ColumnData): number {
        // Bedrock
        if (y === 0) return BEDROCK;
        if (y < 0) return AIR;

        // Beacon Beam
        if (col.isBeacon && y > this.baseHeight && y < 200) return BEACON_RAY;

        // HOUSE GENERATION (3D)
        if (col.isHouse && y > col.height) {
            const h = (y - col.height); // Height relative to floor
            
            // House is 5 blocks tall (1-4 walls, 5 roof)
            if (h <= 4) {
                // Windows? (Simple check: every few blocks, not on corners)
                if (h === 2 && col.houseHash % 3 === 0) return GLASS;
                // Walls
                return WOOD_PLANKS;
            }
            if (h === 5) return ROOF_STONE; // Flat Roof
            return AIR;
        }

        // Standard Ground
        if (y > col.height) return AIR;
        if (y === col.height) return col.surface;

        // Wall Interiors
        if (col.isWall) return STONE_BRICK;

        // Underground (Dirt layer then stone)
        if (col.height - y < 4) return DIRT;
        return STONE_BRICK;
    }

    // Server Helper (Required by VoxelRoom.ts)
    public getBlockID(x: number, y: number, z: number) {
        return this.resolveBlockID(y, this.getColumnInfo(x, z));
    }
    
    // Zone Helper
    public getZoneName(x: number, z: number) {
        const d2 = x*x + z*z;
        return d2 <= this.wallOuterRadiusSq ? "Town of Beginnings" : "The Wilderness";
    }
    
    // Teleport Helper (Used to find safe ground level)
    public getHeight(x: number, z: number) {
        return this.getColumnInfo(x, z).height;
    }
}