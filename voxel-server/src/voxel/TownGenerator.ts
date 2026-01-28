import * as ROT from "rot-js";
import { createNoise2D } from "simplex-noise";

// BLOCK REGISTRY
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3; 
const GRAVEL = 4;      
const BEACON_RED = 5;  

export class TownGenerator {
    width: number;
    depth: number;
    noise2D: any;

    private houseMap = new Set<string>();
    
    // CONFIGURATION
    public readonly townRadius = 800;    
    public readonly wallThickness = 15;  
    
    private wallHeight = 30;      
    private baseHeight = 10;      
    private mainRoadWidth = 8;    

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;

        ROT.RNG.setSeed(seed);
        this.noise2D = createNoise2D(() => ROT.RNG.getUniform());

        this.initLayout();
    }

    private initLayout() {
        // ... (Same layout logic as before) ...
        // Keeping it brief for the diff, assume this is unchanged
        const houseAttempts = 15000; 
        const PLAZA_RADIUS = 40;

        for (let i = 0; i < houseAttempts; i++) {
            const r = (ROT.RNG.getUniform() * (this.townRadius - 30)); 
            const theta = ROT.RNG.getUniform() * 2 * Math.PI;
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            if (this.isRoad(hx, hz)) continue;
            if (Math.sqrt(hx*hx + hz*hz) < PLAZA_RADIUS + 5) continue;

            let safe = true;
            for (let px = hx - 4; px <= hx + 4; px++) {
                for (let pz = hz - 4; pz <= hz + 4; pz++) {
                    if (this.isRoad(px, pz)) safe = false;
                }
            }

            if (safe) {
                for (let px = hx - 3; px <= hx + 3; px++) {
                    for (let pz = hz - 3; pz <= hz + 3; pz++) {
                        this.houseMap.add(`${px},${pz}`);
                    }
                }
            }
        }
    }

    private isRoad(x: number, z: number): boolean {
        if (Math.abs(x) <= this.mainRoadWidth || Math.abs(z) <= this.mainRoadWidth) return true;
        const dist = Math.sqrt(x*x + z*z);
        if (dist > 190 && dist < 210) return true;
        if (dist > 440 && dist < 460) return true;
        if (dist > 690 && dist < 710) return true;
        return false;
    }

    public getZoneName(x: number, z: number): "Town of Beginnings" | "The Wilderness" {
        const dist = Math.sqrt(x * x + z * z);
        if (dist <= (this.townRadius + this.wallThickness)) {
            return "Town of Beginnings";
        }
        return "The Wilderness";
    }

    // --------------------------------------------------------------------------
    // FIXED BLOCK GENERATION
    // --------------------------------------------------------------------------
    public getBlockID(x: number, y: number, z: number): number {
        
        const dist = Math.sqrt(x*x + z*z);

        // --- 0. DEBUG BEACON ---
        if (Math.abs(x) < 3 && Math.abs(z) < 3) {
            if (y <= 80) return BEACON_RED; 
            return AIR;
        }

        let height = 0;
        let surface = GRASS;
        let isStructure = false; // Renamed from 'isWall' to be more accurate

        // --- ZONE 1: INSIDE THE TOWN ---
        if (dist <= this.townRadius) {
            height = this.baseHeight; 
            
            if (dist <= 40) {
                surface = STONE_BRICK; // Plaza
                isStructure = true;    // Plaza has no dirt underneath
            } else if (this.isRoad(x, z)) {
                surface = GRAVEL; 
            } else if (this.houseMap.has(`${x},${z}`)) {
                surface = STONE_BRICK; 
                isStructure = true;    // Foundations are solid
            } else {
                surface = GRASS; 
            }
        }
        
        // --- ZONE 2: GIGA CITY WALLS ---
        else if (dist <= this.townRadius + this.wallThickness) {
            
            // Gates on axes - Treat as Normal Road (Not Structure)
            if (Math.abs(x) <= this.mainRoadWidth + 4 || Math.abs(z) <= this.mainRoadWidth + 4) {
                height = this.baseHeight; 
                surface = GRAVEL;
                isStructure = false; // Key Change: Gates get dirt foundations now
            } else {
                height = this.baseHeight + this.wallHeight;
                surface = STONE_BRICK;
                isStructure = true; // Only the physical wall is a structure
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
        if (y === 0) return STONE_BRICK; // Bedrock

        // 1. Structure Check: Bypasses the "Dirt Layer" logic
        // This ensures Walls/Foundations are solid stone from top to bottom
        if (isStructure) return STONE_BRICK;
        
        // 2. Standard Terrain: Grass/Gravel on top, Dirt below
        if (height - y < 5) return DIRT;

        // 3. Deep Underground
        return STONE_BRICK; 
    }
}