import * as ROT from "rot-js";
import { createNoise2D } from "simplex-noise";

// BLOCK REGISTRY
const AIR = 0;
const GRASS = 1;
const DIRT = 2;
const STONE_BRICK = 3;
const GRAVEL = 4;
const BEACON_RED = 5; // <--- NEW DEBUG BLOCK

export class TownGenerator {
    width: number;
    depth: number;
    noise2D: any;
    private houseMap = new Set<string>();
    
    // Configuration
    private townRadius = 400;     
    private wallThickness = 5;
    private wallHeight = 15;      // Taller walls
    private baseHeight = 10;
    private mainRoadWidth = 6;

    constructor(width: number, depth: number, seed: number) {
        this.width = width;
        this.depth = depth;
        ROT.RNG.setSeed(seed);
        this.noise2D = createNoise2D(() => ROT.RNG.getUniform());
        this.initLayout();
    }

    private initLayout() {
        console.log("📐 Layout Init...");
        const houseAttempts = 3000; 
        const PLAZA_RADIUS = 30;

        for (let i = 0; i < houseAttempts; i++) {
            const r = (ROT.RNG.getUniform() * (this.townRadius - 20)); 
            const theta = ROT.RNG.getUniform() * 2 * Math.PI;
            const hx = Math.floor(r * Math.cos(theta));
            const hz = Math.floor(r * Math.sin(theta));

            if (this.isRoad(hx, hz) || Math.sqrt(hx*hx + hz*hz) < PLAZA_RADIUS + 5) continue;

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
        if (dist > 145 && dist < 160) return true;
        if (dist > 295 && dist < 310) return true;
        return false;
    }

    public getBlockID(x: number, y: number, z: number): number {
        const dist = Math.sqrt(x*x + z*z);
        
        // --- 1. DEBUG BEACON (Center of World) ---
        // A massive red pillar at 0,0 to prove generation works
        if (Math.abs(x) < 3 && Math.abs(z) < 3) {
            if (y <= 50) return BEACON_RED; // 50 blocks high!
            return AIR;
        }

        let height = 0;
        let surface = GRASS;
        let isWall = false;

        // --- ZONE 1: TOWN ---
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
        // --- ZONE 2: WALLS ---
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
        }

        if (y > height) return AIR;
        if (y === height) return surface;
        if (y === 0) return STONE_BRICK;

        if (isWall) return STONE_BRICK;
        if (height - y < 5) return DIRT;
        return STONE_BRICK; 
    }
}