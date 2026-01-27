import * as ROT from "rot-js";
import { createNoise2D } from "simplex-noise";

// BLOCK REGISTRY (Must match main.ts IDs)
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3;
const GRAVEL = 4;

export class TownGenerator {
    width: number;
    depth: number;
    noise2D: any;

    private houseMap = new Set<string>();
    
    // ==================================================================
    // CONFIGURATION
    // ==================================================================
    private townRadius = 400;
    private wallThickness = 5;
    private wallHeight = 10;
    private baseHeight = 10;
    private mainRoadWidth = 5;

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;

        ROT.RNG.setSeed(seed);
        this.noise2D = createNoise2D(() => ROT.RNG.getUniform());

        this.initLayout();
        
        // DEBUG: Test the generator at spawn point
        console.log("🧪 DEBUG: Testing getBlockID at spawn [0, y, 0]:");
        for (let y = 0; y <= 15; y++) {
            const id = this.getBlockID(0, y, 0);
            const name = ["AIR", "GRASS", "DIRT", "STONE", "GRAVEL"][id] || "?";
            console.log(`   y=${y.toString().padStart(2)}: ${name} (${id})`);
        }
    }

    private initLayout() {
        console.log("📐 Calculating Town Layout...");
        
        const houseAttempts = 3000; 
        const PLAZA_RADIUS = 30;

        for (let i = 0; i < houseAttempts; i++) {
            const r = (ROT.RNG.getUniform() * (this.townRadius - 20)); 
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
        console.log(`✅ Layout Ready. House plots marked.`);
    }

    private isRoad(x: number, z: number): boolean {
        if (Math.abs(x) <= this.mainRoadWidth || Math.abs(z) <= this.mainRoadWidth) return true;
        
        const dist = Math.sqrt(x*x + z*z);
        if (dist > 145 && dist < 160) return true;
        if (dist > 295 && dist < 310) return true;

        return false;
    }

    public getBlockID(x: number, y: number, z: number): number {
        const dist = Math.sqrt(x*x + z*z);
        let height = 0;
        let surface = GRASS;
        let isWall = false;

        // --- ZONE 1: INSIDE THE TOWN ---
        if (dist <= this.townRadius) {
            height = this.baseHeight;
            
            if (dist <= 30) {
                surface = STONE_BRICK;
            } else if (this.isRoad(x, z)) {
                surface = GRAVEL;
            } else if (this.houseMap.has(`${x},${z}`)) {
                surface = STONE_BRICK;
            } else {
                surface = GRASS;
            }
        }
        // --- ZONE 2: CITY WALLS ---
        else if (dist <= this.townRadius + this.wallThickness) {
            isWall = true;
            if (Math.abs(x) <= this.mainRoadWidth + 2 || Math.abs(z) <= this.mainRoadWidth + 2) {
                height = this.baseHeight;
                surface = GRAVEL;
            } else {
                height = this.baseHeight + this.wallHeight;
                surface = STONE_BRICK;
            }
        }
        // --- ZONE 3: WILDERNESS ---
        else {
            const n = this.noise2D(x / 150, z / 150);
            height = Math.floor((this.baseHeight - 2) + (n + 1) * 12);
            surface = GRASS;
        }

        // RETURN BLOCK ID
        if (y > height) return AIR;
        if (y === height) return surface;
        if (y === 0) return STONE_BRICK;

        if (isWall) return STONE_BRICK;
        if (height - y < 5) return DIRT;
        return STONE_BRICK;
    }
}