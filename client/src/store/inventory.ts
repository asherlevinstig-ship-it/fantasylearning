import { createStore } from 'zustand/vanilla';
import { BLOCKS } from '../blocks';
import { ItemRegistry } from '../items/ItemRegistry';

// --------------------------------------------------------------------------
// TYPES
// --------------------------------------------------------------------------
export type InventoryItem = {
    id: number;
    count: number;
};

interface InventoryState {
    // We use a sparse array to support high slot IDs (e.g., Armor at 100+)
    slots: (InventoryItem | null)[]; 
    selectedSlot: number; // 0-8 (Hotbar)
    isOpen: boolean;

    // Actions
    toggleOpen: () => void;
    selectSlot: (index: number) => void;
    setSlot: (index: number, itemId: number, count: number) => void;
    addItem: (itemId: number, count: number) => boolean;
    getSelectedItem: () => InventoryItem | null;
}

// --------------------------------------------------------------------------
// STORE DEFINITION
// --------------------------------------------------------------------------
export const inventoryStore = createStore<InventoryState>((set, get) => ({
    // Initialize with enough space for Hotbar (0-8) + Inventory (9-35)
    // Armor slots (100+) will be auto-expanded by JS arrays if set
    slots: Array(36).fill(null), 
    selectedSlot: 0,
    isOpen: false,

    /**
     * Toggles the Inventory UI open/closed
     */
    toggleOpen: () => {
        set((state) => ({ isOpen: !state.isOpen }));
    },

    /**
     * Changes the active hotbar slot (0-8)
     */
    selectSlot: (index) => {
        if (index >= 0 && index < 9) {
            set({ selectedSlot: index });
        }
    },

    /**
     * Sets a specific slot to an item, enforcing Registry rules.
     * Used for moving items, equipping armor, or admin commands.
     */
    setSlot: (index, itemId, count) => {
        // 1. REGISTRY VALIDATION
        // Check if this item is allowed in this specific slot (e.g. Helmet -> Head Slot)
        if (!ItemRegistry.canEquip(index, itemId)) {
            console.warn(`⚠️ Blocked: Cannot equip item ${itemId} into slot ${index}`);
            return; 
        }

        // 2. STATE UPDATE
        const newSlots = [...get().slots];
        
        if (count <= 0) {
            newSlots[index] = null; // Remove item if count is 0
        } else {
            newSlots[index] = { id: itemId, count };
        }

        set({ slots: newSlots });
    },

    /**
     * Auto-stacks items into the inventory.
     * Returns true if successful, false if inventory is full.
     */
    addItem: (itemId, count) => {
        const { slots, setSlot } = get();
        
        // LIMITATION: Only scan main inventory (0-35) for pickup
        // We don't want to auto-equip armor or put items in the offhand automatically
        const INVENTORY_SIZE = 36; 

        // 1. Try to STACK with existing items
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            if (slots[i]?.id === itemId) {
                // Determine max stack size (usually 64)
                const currentCount = slots[i]!.count;
                if (currentCount < 64) {
                    const space = 64 - currentCount;
                    const toAdd = Math.min(space, count);
                    
                    setSlot(i, itemId, currentCount + toAdd);
                    
                    count -= toAdd;
                    if (count <= 0) return true; // All items added
                }
            }
        }

        // 2. Try to find an EMPTY slot
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            if (slots[i] === null || slots[i] === undefined) {
                setSlot(i, itemId, count);
                return true;
            }
        }

        return false; // Inventory is full
    },

    /**
     * Helper to get the item currently held in hand
     */
    getSelectedItem: () => {
        const { slots, selectedSlot } = get();
        return slots[selectedSlot] || null;
    }
}));

// --------------------------------------------------------------------------
// INITIAL STARTER KIT (Default Loadout)
// --------------------------------------------------------------------------
// We access the store directly to pre-fill it on load.
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
setSlot(8, BLOCKS.BEDROCK, 1); // Admin tool