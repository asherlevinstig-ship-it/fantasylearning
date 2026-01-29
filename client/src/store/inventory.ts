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
    slots: (InventoryItem | null)[]; 
    selectedSlot: number; 
    isOpen: boolean;
    
    // NEW: The item currently stuck to the mouse cursor
    cursorItem: InventoryItem | null; 

    // Actions
    toggleOpen: () => void;
    selectSlot: (index: number) => void;
    setSlot: (index: number, itemId: number, count: number) => void;
    addItem: (itemId: number, count: number) => boolean;
    getSelectedItem: () => InventoryItem | null;
    
    // NEW: Handle clicking a slot in the UI
    clickSlot: (index: number, isRightClick?: boolean) => void;
}

// --------------------------------------------------------------------------
// STORE DEFINITION
// --------------------------------------------------------------------------
export const inventoryStore = createStore<InventoryState>((set, get) => ({
    // 0-8: Hotbar, 9-35: Main Inv, 100-103: Armor
    slots: Array(110).fill(null), 
    selectedSlot: 0,
    isOpen: false,
    cursorItem: null,

    toggleOpen: () => {
        const { isOpen, cursorItem, addItem } = get();
        
        // If closing with an item on cursor, try to put it back
        if (isOpen && cursorItem) {
            const success = addItem(cursorItem.id, cursorItem.count);
            if (!success) {
                console.log("⚠️ Inventory full, dropped cursor item (logic not implemented)");
                // In a real game, you would spawn a 'drop' entity here
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
        // Validation handled by ItemRegistry inside main logic usually, 
        // but simple setSlot trusts the caller or checks basic bounds.
        const newSlots = [...get().slots];
        if (count <= 0) newSlots[index] = null;
        else newSlots[index] = { id: itemId, count };
        set({ slots: newSlots });
    },

    addItem: (itemId, count) => {
        const { slots, setSlot } = get();
        const INVENTORY_SIZE = 36; 

        // 1. Stack
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            if (slots[i]?.id === itemId && slots[i]!.count < 64) {
                const space = 64 - slots[i]!.count;
                const toAdd = Math.min(space, count);
                setSlot(i, itemId, slots[i]!.count + toAdd);
                count -= toAdd;
                if (count <= 0) return true;
            }
        }
        // 2. Empty Slot
        for (let i = 0; i < INVENTORY_SIZE; i++) {
            if (!slots[i]) {
                setSlot(i, itemId, count);
                return true;
            }
        }
        return false;
    },

    getSelectedItem: () => {
        const { slots, selectedSlot } = get();
        return slots[selectedSlot] || null;
    },

    // --- CORE INVENTORY INTERACTION LOGIC ---
    clickSlot: (index, isRightClick = false) => {
        const { slots, cursorItem, setSlot } = get();
        const clickedItem = slots[index];

        // 1. Check Permissions (e.g. Armor Slots)
        if (cursorItem && !ItemRegistry.canEquip(index, cursorItem.id)) {
            // Cannot place this item here (e.g. Dirt in Head slot)
            return;
        }

        // 2. LOGIC: Cursor Empty + Slot Empty -> Do nothing
        if (!cursorItem && !clickedItem) return;

        // 3. LOGIC: Cursor Empty + Slot Has Item -> PICK UP
        if (!cursorItem && clickedItem) {
            if (isRightClick) {
                // Take half (Split)
                const half = Math.ceil(clickedItem.count / 2);
                set({ cursorItem: { id: clickedItem.id, count: half } });
                setSlot(index, clickedItem.id, clickedItem.count - half);
            } else {
                // Pick up all
                set({ cursorItem: clickedItem });
                setSlot(index, 0, 0); // Clear slot
            }
            return;
        }

        // 4. LOGIC: Cursor Has Item + Slot Empty -> PLACE
        if (cursorItem && !clickedItem) {
            if (isRightClick) {
                // Place one
                setSlot(index, cursorItem.id, 1);
                if (cursorItem.count > 1) {
                    set({ cursorItem: { ...cursorItem, count: cursorItem.count - 1 } });
                } else {
                    set({ cursorItem: null });
                }
            } else {
                // Place all
                setSlot(index, cursorItem.id, cursorItem.count);
                set({ cursorItem: null });
            }
            return;
        }

        // 5. LOGIC: Cursor Has Item + Slot Has Item -> STACK or SWAP
        if (cursorItem && clickedItem) {
            // A. Same ID -> Stack
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

            // B. Different ID -> Swap
            // (Only if not right clicking, and assuming target slot accepts the item)
            if (!isRightClick) {
                 // Check if the item currently in the slot can go to cursor? (Always yes)
                 // Check if cursor item can go to slot? (Already checked at step 1)
                 setSlot(index, cursorItem.id, cursorItem.count);
                 set({ cursorItem: clickedItem });
            }
        }
    }
}));

// --- INITIALIZE DEFAULT ITEMS ---
const { setSlot } = inventoryStore.getState();
setSlot(0, BLOCKS.GRASS, 64);
setSlot(1, BLOCKS.STONE_BRICK, 64);
setSlot(2, BLOCKS.WOOD_PLANKS, 64);
setSlot(3, BLOCKS.GLASS, 64);
setSlot(4, BLOCKS.BEACON_RAY, 1);
setSlot(100, BLOCKS.GLASS, 1); // Helmet slot example