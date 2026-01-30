import { BLOCKS } from "../blocks";

// --- TYPES ---
export type RecipeResult = { id: number; count: number };

export type ShapedRecipe = {
    type: "shaped";
    // 2D grid: null means empty space
    pattern: (number | null)[][];
    result: RecipeResult;
};

export type ShapelessRecipe = {
    type: "shapeless";
    ingredients: number[]; // List of required IDs
    result: RecipeResult;
};

export type Recipe = ShapedRecipe | ShapelessRecipe;

// --- RECIPE DATABASE ---
export const RECIPES: Recipe[] = [
    // 1. Log -> 4 Planks (Shapeless)
    {
        type: "shapeless",
        ingredients: [BLOCKS.WOOD_LOG],
        result: { id: BLOCKS.WOOD_PLANKS, count: 4 }
    },
    // 2. 4 Planks -> Crafting Table (Shaped 2x2)
    {
        type: "shaped",
        pattern: [
            [BLOCKS.WOOD_PLANKS, BLOCKS.WOOD_PLANKS],
            [BLOCKS.WOOD_PLANKS, BLOCKS.WOOD_PLANKS]
        ],
        result: { id: BLOCKS.STONE_BRICK, count: 1 } // Placeholder: We don't have a table block yet, using Stone
    },
    // 3. 2 Planks (Vertical) -> Sticks (Shaped 2x1) - Example
    {
        type: "shaped",
        pattern: [
            [BLOCKS.WOOD_PLANKS],
            [BLOCKS.WOOD_PLANKS]
        ],
        result: { id: BLOCKS.BEACON_RAY, count: 4 } // Placeholder for Sticks
    }
];