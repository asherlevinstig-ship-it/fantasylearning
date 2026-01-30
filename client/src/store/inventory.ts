import { createStore } from 'zustand/vanilla';
import { BLOCKS } from '../blocks';
import { ItemRegistry } from '../items/ItemRegistry';
import { CraftingEngine } from '../crafting/CraftingEngine';

// --------------------------------------------------------------------------
// TYPES
// --------------------------------------------------------------------------
export type InventoryItem = {
    id: number;
    count: number;
};

interface InventoryState {
    // 0-8: Hotbar
    // 9-35: Main Inventory
    // 100-103: Armor
    // 200-203: Crafting Inputs (2x2)
    // 204: Crafting Result
    slots: (InventoryItem | null)[]; 
    selectedSlot: number; 
    isOpen: boolean;
    
    // The item currently sticking to the mouse cursor
    cursorItem: InventoryItem | null; 

    // Actions
    toggleOpen: () => void;
    selectSlot: (index: number) => void;
    
    // Low-level setter that handles validation & crafting triggers
    setSlot: (index: number, itemId: number, count: number) => void;
    
    // High-level "Give Item" (Auto-stacking)
    addItem: (itemId: number, count: number) => boolean;
    
    // Get item in hand
    getSelectedItem: () => InventoryItem | null;
    
    // Handle UI Clicks (The complex logic)
    clickSlot: (index: number, isRightClick?: boolean) => void;
}

// --------------------------------------------------------------------------
// STORE DEFINITION
// --------------------------------------------------------------------------
export const inventoryStore = createStore<InventoryState>((set, get) => ({
    // Initialize enough space for all slot types (up to ~300)
    slots: Array(300).fill(null), 
    selectedSlot: 0,
    isOpen: false,
    cursorItem: null,

    toggleOpen: () => {
        const { isOpen, cursorItem, addItem } = get();
        
        // If closing with an item on cursor, try to put it back into inventory
        if (isOpen && cursorItem) {
            const success = addItem(cursorItem.id, cursorItem.count);
            if (!success) {
                console.log("⚠️ Inventory full, cursor item lost (Logic for dropping not implemented)");
            }
            set({ cursorItem: null });
        }
        
        set({ isOpen: !isOpen });
    },

    selectSlot: (index) => {
        if (index >= 0 && index < 9) {
            set({ selectedSlot: index });
        }
    },

    setSlot: (index, itemId, count) => {
        // 1. REGISTRY VALIDATION
        // Prevent equipping invalid items (e.g., Block in Helmet slot)
        if (!ItemRegistry.canEquip(index, itemId)) {
            return; 
        }

        // 2. STATE UPDATE
        const newSlots = [...get().slots];
        
        if (count <= 0) {
            newSlots[index] = null;
        } else {
            newSlots[index] = { id: itemId, count };
        }

        // 3. CRAFTING TRIGGER
        // If we modified a crafting input slot (200-203), check for recipes
        if (index >= 200 && index <= 203) {
            const inputs = [newSlots[200], newSlots[201], newSlots[202], newSlots[203]];
            const match = CraftingEngine.checkRecipes(inputs);
            
            if (match) {
                newSlots[204] = { id: match.result.id, count: match.result.count };
            } else {
                newSlots[204] = null;
            }
        }

        set({ slots: newSlots });
    },

    addItem: (itemId, count) => {
        const { slots, setSlot } = get();
        // Only scan main storage (0-35) for auto-pickup
        const INVENTORY_END = 36; 

        // 1. Try to STACK
        for (let i = 0; i < INVENTORY_END; i++) {
            if (slots[i]?.id === itemId && slots[i]!.count < 64) {
                const space = 64 - slots[i]!.count;
                const toAdd = Math.min(space, count);
                
                // We call setSlot to ensure any side-effects run (though unlikely for main inv)
                setSlot(i, itemId, slots[i]!.count + toAdd);
                
                count -= toAdd;
                if (count <= 0) return true;
            }
        }

        // 2. Try to Fill EMPTY Slot
        for (let i = 0; i < INVENTORY_END; i++) {
            if (!slots[i]) {
                setSlot(i, itemId, count);
                return true;
            }
        }

        return false; // Full
    },

    getSelectedItem: () => {
        const { slots, selectedSlot } = get();
        return slots[selectedSlot] || null;
    },

    // --- CORE INTERACTION LOGIC ---
    clickSlot: (index, isRightClick = false) => {
        const { slots, cursorItem, setSlot } = get();
        
        // ==========================================================
        // SPECIAL CASE: CRAFTING RESULT SLOT (204)
        // ==========================================================
        if (index === 204) {
            const resultItem = slots[204];
            if (!resultItem) return; // Nothing to craft

            // Check if cursor can accept the item
            if (cursorItem) {
                if (cursorItem.id !== resultItem.id) return; // Wrong type
                if (cursorItem.count + resultItem.count > 64) return; // Full
            }

            // 1. Update Cursor (Take the product)
            const newCursorCount = (cursorItem?.count || 0) + resultItem.count;
            
            // 2. Consume Ingredients (Decrement 200-203)
            const newSlots = [...slots];
            for (let i = 200; i <= 203; i++) {
                if (newSlots[i]) {
                    newSlots[i]!.count--;
                    if (newSlots[i]!.count <= 0) newSlots[i] = null;
                }
            }

            // 3. Re-Check Recipe (for the NEXT craft)
            const inputs = [newSlots[200], newSlots[201], newSlots[202], newSlots[203]];
            const match = CraftingEngine.checkRecipes(inputs);
            
            newSlots[204] = match ? { id: match.result.id, count: match.result.count } : null;

            // Atomic Update
            set({ 
                slots: newSlots, 
                cursorItem: { id: resultItem.id, count: newCursorCount } 
            });
            return;
        }

        // ==========================================================
        // STANDARD SLOT INTERACTION (0-104, 200-203)
        // ==========================================================
        const clickedItem = slots[index];

        // 1. Security Check: Can cursor item go here?
        if (cursorItem && !ItemRegistry.canEquip(index, cursorItem.id)) {
            return; // Blocked (e.g. Dirt in Helmet slot)
        }

        // 2. Logic: Cursor Empty + Slot Empty -> Nothing
        if (!cursorItem && !clickedItem) return;

        // 3. Logic: Cursor Empty + Slot Has Item -> PICK UP
        if (!cursorItem && clickedItem) {
            if (isRightClick) {
                // Take Half
                const half = Math.ceil(clickedItem.count / 2);
                const remain = clickedItem.count - half;
                
                set({ cursorItem: { id: clickedItem.id, count: half } });
                setSlot(index, clickedItem.id, remain);
            } else {
                // Take All
                set({ cursorItem: clickedItem });
                setSlot(index, 0, 0); // Clear slot
            }
            return;
        }

        // 4. Logic: Cursor Has Item + Slot Empty -> PLACE
        if (cursorItem && !clickedItem) {
            if (isRightClick) {
                // Place One
                setSlot(index, cursorItem.id, 1);
                
                if (cursorItem.count > 1) {
                    set({ cursorItem: { ...cursorItem, count: cursorItem.count - 1 } });
                } else {
                    set({ cursorItem: null });
                }
            } else {
                // Place All
                setSlot(index, cursorItem.id, cursorItem.count);
                set({ cursorItem: null });
            }
            return;
        }

        // 5. Logic: Cursor Has Item + Slot Has Item -> STACK or SWAP
        if (cursorItem && clickedItem) {
            // A. Same Item -> Stack
            if (cursorItem.id === clickedItem.id) {
                const space = 64 - clickedItem.count;
                if (space > 0) {
                    const toAdd = isRightClick ? 1 : Math.min(space, cursorItem.count);
                    
                    setSlot(index, clickedItem.id, clickedItem.count + toAdd);
                    
                    const remain = cursorItem.count - toAdd;
                    set({ cursorItem: remain > 0 ? { ...cursorItem, count: remain } : null });
                }
                return;
            }

            // B. Different Item -> Swap
            if (!isRightClick) {
                // Ensure the item we are swapping OUT can actally go onto the cursor (always yes)
                // Ensure the cursor item can go INTO the slot (checked at step 1)
                
                // Swap values
                setSlot(index, cursorItem.id, cursorItem.count);
                set({ cursorItem: clickedItem });
            }
        }
    }
}));

// --------------------------------------------------------------------------
// INITIAL STARTER KIT
// --------------------------------------------------------------------------
const { setSlot } = inventoryStore.getState();

// Hotbar
setSlot(0, BLOCKS.GRASS, 64);
setSlot(1, BLOCKS.STONE_BRICK, 64);
setSlot(2, BLOCKS.WOOD_PLANKS, 64);
setSlot(3, BLOCKS.GLASS, 64);
setSlot(4, BLOCKS.BEACON_RAY, 1);
setSlot(5, BLOCKS.WOOD_LOG, 32);
setSlot(6, BLOCKS.GRAVEL, 32);
setSlot(7, BLOCKS.ROOF_STONE, 32);
setSlot(8, BLOCKS.BEDROCK, 1);