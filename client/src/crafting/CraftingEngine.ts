// ✅ FIX: Use 'import type' for types, and regular import for values (RECIPES)
import { RECIPES, type Recipe, type ShapedRecipe, type ShapelessRecipe } from "./recipes";
import type { InventoryItem } from "../store/inventory";

export class CraftingEngine {
    
    /**
     * Main entry point: Checks a 1D array of items against all recipes
     * @param inputSlots Array of 4 items (for 2x2 grid)
     */
    public static checkRecipes(inputSlots: (InventoryItem | null)[]): Recipe | null {
        // Validation: Expect 4 slots
        if (inputSlots.length !== 4) {
            console.warn(`CraftingEngine: Expected 4 input slots, got ${inputSlots.length}`);
            return null;
        }

        // 1. Convert 1D slots to flat ID array for shapeless
        const flatIds = inputSlots.map(i => i ? i.id : null).filter(id => id !== null) as number[];
        
        // 2. Convert 1D slots to 2D grid for shaped (Assuming 2x2 grid)
        // Index 0,1 = Row 1; Index 2,3 = Row 2
        const grid: (number | null)[][] = [
            [inputSlots[0]?.id || null, inputSlots[1]?.id || null],
            [inputSlots[2]?.id || null, inputSlots[3]?.id || null]
        ];

        for (const recipe of RECIPES) {
            if (recipe.type === "shapeless") {
                if (this.matchShapeless(flatIds, recipe)) return recipe;
            } else {
                if (this.matchShaped(grid, recipe)) return recipe;
            }
        }

        return null;
    }

    /**
     * O(n) Matching using Frequency Map
     */
    private static matchShapeless(inputIds: number[], recipe: ShapelessRecipe): boolean {
        if (inputIds.length !== recipe.ingredients.length) return false;

        const counts = new Map<number, number>();
        for (const id of inputIds) {
            counts.set(id, (counts.get(id) ?? 0) + 1);
        }

        for (const ing of recipe.ingredients) {
            const currentCount = counts.get(ing) ?? 0;
            if (currentCount === 0) return false;
            counts.set(ing, currentCount - 1);
        }

        return true;
    }

    private static matchShaped(grid: (number | null)[][], recipe: ShapedRecipe): boolean {
        const recipeH = recipe.pattern.length;
        const recipeW = recipe.pattern[0].length;
        const gridH = grid.length;     // 2
        const gridW = grid[0].length;  // 2

        if (recipeH > gridH || recipeW > gridW) return false;

        for (let y = 0; y <= gridH - recipeH; y++) {
            for (let x = 0; x <= gridW - recipeW; x++) {
                if (this.checkPatternAt(grid, recipe.pattern, x, y)) {
                    if (this.isEmptyElsewhere(grid, recipe.pattern, x, y)) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    private static checkPatternAt(grid: (number | null)[][], pattern: (number|null)[][], startX: number, startY: number): boolean {
        for (let py = 0; py < pattern.length; py++) {
            for (let px = 0; px < pattern[0].length; px++) {
                const required = pattern[py][px];
                const actual = grid[startY + py][startX + px];
                if (required !== actual) return false;
            }
        }
        return true;
    }

    private static isEmptyElsewhere(grid: (number | null)[][], pattern: (number|null)[][], startX: number, startY: number): boolean {
        for (let y = 0; y < grid.length; y++) {
            for (let x = 0; x < grid[0].length; x++) {
                // If inside pattern box, skip
                if (y >= startY && y < startY + pattern.length && 
                    x >= startX && x < startX + pattern[0].length) {
                    continue;
                }
                // If outside, must be null
                if (grid[y][x] !== null) return false;
            }
        }
        return true;
    }
}