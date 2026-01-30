import { makeNoise2D } from "open-simplex-noise";
import { BLOCKS } from "./blocks";

// --------------------------------------------------------------------------
// INTERFACES
// --------------------------------------------------------------------------
export interface ColumnData {
    height: number;
    surface: number;
    isHouse: boolean;
    isWall: boolean;
    isRoad: boolean;
    isBeacon: boolean;
    houseHash: number;
}

// --------------------------------------------------------------------------
// TOWN GENERATOR CLASS
// --------------------------------------------------------------------------
export class TownGenerator {
    width: number;
    depth: number;
    seed: number;
    noise2D: (x: number, y: number) => number;
    private houseMap = new Set<number>();

    // CONFIGURATION
    public readonly townRadius = 800;
    public readonly wallThickness = 15;
    public readonly worldBottom = -16;
    private baseHeight = 30; 
    private wallHeight = 40;

    private readonly townRadiusSq: number;
    private readonly wallOuterRadiusSq: number;
    private readonly plazaRadiusSq: number;

    private readonly ring1MinSq: number; private readonly ring1MaxSq: number;
    private readonly ring2MinSq: number; private readonly ring2MaxSq: number;
    private readonly ring3MinSq: number; private readonly ring3MaxSq: number;

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;
        this.seed = seed;
        
        this.townRadiusSq = this.townRadius ** 2;
        this.wallOuterRadiusSq = (this.townRadius + this.wallThickness) ** 2;
        this.plazaRadiusSq = 45 ** 2;

        this.ring1MinSq = 190 ** 2; this.ring1MaxSq = 210 ** 2;
        this.ring2MinSq = 440 ** 2; this.ring2MaxSq = 460 ** 2;
        this.ring3MinSq = 690 ** 2; this.ring3MaxSq = 710 ** 2;

        this.noise2D = makeNoise2D(seed);
        this.initLayout();
    }

    private initLayout() {
        console.log("📐 Generating Giga-City Layout...");
        let localSeed = this.seed;
        const random = () => { localSeed = (localSeed * 9301 + 49297) % 233280; return localSeed / 233280; };
        const houseAttempts = 20000;
        
        for (let i = 0; i < houseAttempts; i++) {
            const r = (random() * (this.townRadius - 30));
            const theta = random() * 2 * Math.PI;
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            if (this.isRoad(hx, hz) || (hx*hx + hz*hz) < this.plazaRadiusSq) continue;

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
        if (Math.abs(x) <= 6 || Math.abs(z) <= 6) return true;
        const d2 = x*x + z*z;
        if ((d2 > this.ring1MinSq && d2 < this.ring1MaxSq) || 
            (d2 > this.ring2MinSq && d2 < this.ring2MaxSq) || 
            (d2 > this.ring3MinSq && d2 < this.ring3MaxSq)) return true;
        return false;
    }

    public getColumnInfo(x: number, z: number): ColumnData {
        const distSq = x*x + z*z;
        let height = this.baseHeight;
        
        // FIX: Explicitly Type as nusmber to satisfy TypeScript inference
        let surface: number = BLOCKS.GRASS; 

        let isHouse = false, isWall = false, isRoad = false, isBeacon = false;
        let houseHash = 0;

        if (Math.abs(x) < 3 && Math.abs(z) < 3) isBeacon = true;

        if (distSq <= this.townRadiusSq) {
            if (distSq <= this.plazaRadiusSq) {
                surface = BLOCKS.STONE_BRICK; 
            } else if (this.isRoad(x, z)) {
                surface = BLOCKS.GRAVEL; isRoad = true;
            } else if (this.houseMap.has(this.pack(x, z))) {
                isHouse = true; surface = BLOCKS.WOOD_PLANKS;
                houseHash = Math.abs((x * 73856093) ^ (z * 19349663));
            }
        }
        else if (distSq <= this.wallOuterRadiusSq) {
            if (Math.abs(x) <= 12 || Math.abs(z) <= 12) surface = BLOCKS.GRAVEL;
            else { isWall = true; height = this.baseHeight + this.wallHeight; surface = BLOCKS.STONE_BRICK; }
        }
        else {
            const n = this.noise2D(x * 0.005, z * 0.005);
            height = Math.floor(this.baseHeight + (n * 15));
        }

        return { height, surface, isHouse, isWall, isRoad, isBeacon, houseHash };
    }

    public resolveBlockID(y: number, col: ColumnData): number {
        if (y === 0) return BLOCKS.BEDROCK;
        if (y < 0) return BLOCKS.AIR;
        if (col.isBeacon && y > this.baseHeight && y < 200) return BLOCKS.BEACON_RAY;

        if (col.isHouse && y > col.height) {
            const h = (y - col.height);
            if (h <= 4) return (h === 2 && col.houseHash % 3 === 0) ? BLOCKS.GLASS : BLOCKS.WOOD_PLANKS;
            if (h === 5) return BLOCKS.ROOF_STONE;
            return BLOCKS.AIR;
        }

        if (y > col.height) return BLOCKS.AIR;
        if (y === col.height) return col.surface;
        if (col.isWall) return BLOCKS.STONE_BRICK;
        if (col.height - y < 4) return BLOCKS.DIRT;
        return BLOCKS.STONE_BRICK;
    }

    public getBlockID(x: number, y: number, z: number) {
        return this.resolveBlockID(y, this.getColumnInfo(x, z));
    }
    
    public getZoneName(x: number, z: number) {
        const d2 = x*x + z*z;
        return d2 <= this.wallOuterRadiusSq ? "Town of Beginnings" : "The Wilderness";
    }
    
    public getHeight(x: number, z: number) {
        return this.getColumnInfo(x, z).height;
    }
}