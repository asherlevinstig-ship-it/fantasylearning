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
    // List of required IDs (order doesn't matter)
    ingredients: number[]; 
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
        // Placeholder: Using Stone until you make a Table block
        result: { id: BLOCKS.STONE_BRICK, count: 1 } 
    },

    // 3. 2 Planks (Vertical) -> Sticks (Shaped 2x1)
    // Note: Because our Engine scans offsets, this will work in 
    // either the LEFT column (slots 0,2) or RIGHT column (slots 1,3)
    {
        type: "shaped",
        pattern: [
            [BLOCKS.WOOD_PLANKS],
            [BLOCKS.WOOD_PLANKS]
        ],
        // Placeholder: Using Beacon Ray for sticks
        result: { id: BLOCKS.BEACON_RAY, count: 4 } 
    }
];