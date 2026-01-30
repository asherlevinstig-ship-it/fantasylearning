import { Recipe, ShapedRecipe, ShapelessRecipe, RECIPES } from "./recipes";
import { InventoryItem } from "../store/inventory";

export class CraftingEngine {
    
    /**
     * Main entry point: Checks a 1D array of items against all recipes
     * @param inputSlots Array of 4 items (for 2x2 grid)
     */
    public static checkRecipes(inputSlots: (InventoryItem | null)[]): Recipe | null {
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

    private static matchShapeless(inputIds: number[], recipe: ShapelessRecipe): boolean {
        // Optimization: Count check
        if (inputIds.length !== recipe.ingredients.length) return false;

        const pool = [...inputIds];
        for (const ing of recipe.ingredients) {
            const idx = pool.indexOf(ing);
            if (idx === -1) return false;
            pool.splice(idx, 1);
        }
        return true;
    }

    private static matchShaped(grid: (number | null)[][], recipe: ShapedRecipe): boolean {
        const recipeH = recipe.pattern.length;
        const recipeW = recipe.pattern[0].length;
        const gridH = grid.length;     // 2
        const gridW = grid[0].length;  // 2

        // Optimization: If recipe is bigger than our grid (e.g. 3x3 recipe in 2x2 grid)
        if (recipeH > gridH || recipeW > gridW) return false;

        // Iterate over every possible starting position in the grid
        for (let y = 0; y <= gridH - recipeH; y++) {
            for (let x = 0; x <= gridW - recipeW; x++) {
                if (this.checkPatternAt(grid, recipe.pattern, x, y)) {
                    // One final check: Ensure no leftover items outside the matched pattern
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
                // If this coordinate is INSIDE the pattern box, ignore it
                if (y >= startY && y < startY + pattern.length && 
                    x >= startX && x < startX + pattern[0].length) {
                    continue;
                }
                // If coordinate is OUTSIDE, it must be null
                if (grid[y][x] !== null) return false;
            }
        }
        return true;
    }
}