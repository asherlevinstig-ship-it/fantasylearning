import { createStore } from 'zustand/vanilla';
import { BLOCKS } from '../blocks';

// Define what an Item looks like
export type InventoryItem = {
    id: number;
    count: number;
};

// Define the State and Actions
interface InventoryState {
    slots: (InventoryItem | null)[]; // 9 slots for hotbar
    selectedSlot: number;
    isOpen: boolean;

    // Actions
    selectSlot: (index: number) => void;
    setSlot: (index: number, itemId: number, count: number) => void;
    addItem: (itemId: number, count: number) => boolean;
    getSelectedItem: () => InventoryItem | null;
}

// Create the Store
export const inventoryStore = createStore<InventoryState>((set, get) => ({
    // Initialize with 9 empty slots (Hotbar)
    slots: Array(9).fill(null),
    selectedSlot: 0,
    isOpen: false,

    selectSlot: (index) => {
        if (index >= 0 && index < 9) {
            set({ selectedSlot: index });
        }
    },

    setSlot: (index, itemId, count) => {
        const newSlots = [...get().slots];
        newSlots[index] = count > 0 ? { id: itemId, count } : null;
        set({ slots: newSlots });
    },

    addItem: (itemId, count) => {
        const { slots, setSlot } = get();
        // 1. Try to stack
        for (let i = 0; i < slots.length; i++) {
            if (slots[i]?.id === itemId) {
                setSlot(i, itemId, slots[i]!.count + count);
                return true;
            }
        }
        // 2. Try to find empty slot
        for (let i = 0; i < slots.length; i++) {
            if (slots[i] === null) {
                setSlot(i, itemId, count);
                return true;
            }
        }
        return false; // Full
    },

    getSelectedItem: () => {
        const { slots, selectedSlot } = get();
        return slots[selectedSlot];
    }
}));

// --- INITIALIZE DEFAULT ITEMS (FOR TESTING) ---
// Let's give the player some blocks to start with
inventoryStore.getState().setSlot(0, BLOCKS.GRASS, 64);
inventoryStore.getState().setSlot(1, BLOCKS.STONE_BRICK, 64);
inventoryStore.getState().setSlot(2, BLOCKS.WOOD_PLANKS, 64);
inventoryStore.getState().setSlot(3, BLOCKS.GLASS, 64);
inventoryStore.getState().setSlot(4, BLOCKS.BEACON_RAY, 1);