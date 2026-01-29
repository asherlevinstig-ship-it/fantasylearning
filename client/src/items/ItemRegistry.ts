import { BLOCKS } from "../blocks";

export enum SlotType {
    GENERAL = 0, // Hotbar and Main Inventory
    HEAD = 1,
    CHEST = 2,
    LEGS = 3,
    FEET = 4,
    OFFHAND = 5
}

// Map specific IDs to Slot Types
// By default, everything is a BLOCK (General) unless specified here
const ITEM_TYPES: Record<number, SlotType> = {
    // Examples of future items:
    // 100: SlotType.HEAD,  // Diamond Helmet
    // 101: SlotType.CHEST, // Diamond Chest
    // 102: SlotType.OFFHAND // Shield
};

// Slots 0-8 are Hotbar. 
// Let's assume Slots 100-103 are Armor for this example system
export const ARMOR_SLOTS = {
    HEAD: 100,
    CHEST: 101,
    LEGS: 102,
    FEET: 103,
    OFFHAND: 104
};

export const ItemRegistry = {
    /**
     * Checks if an item is allowed in a specific slot.
     */
    canEquip: (slotIndex: number, itemId: number): boolean => {
        // 1. Get the required type for this slot
        let requiredType = SlotType.GENERAL;

        if (slotIndex === ARMOR_SLOTS.HEAD) requiredType = SlotType.HEAD;
        else if (slotIndex === ARMOR_SLOTS.CHEST) requiredType = SlotType.CHEST;
        else if (slotIndex === ARMOR_SLOTS.LEGS) requiredType = SlotType.LEGS;
        else if (slotIndex === ARMOR_SLOTS.FEET) requiredType = SlotType.FEET;
        else if (slotIndex === ARMOR_SLOTS.OFFHAND) requiredType = SlotType.OFFHAND;

        // 2. If it's a general slot (inventory/hotbar), anything goes
        if (requiredType === SlotType.GENERAL) return true;

        // 3. Check the item's definition
        const itemType = ITEM_TYPES[itemId] || SlotType.GENERAL; // Default to General (Block)

        return itemType === requiredType;
    },

    /**
     * Helper to get item name/data (optional expansion)
     */
    getItemName: (id: number) => {
        const entry = Object.entries(BLOCKS).find(([k, v]) => v === id);
        return entry ? entry[0] : "Unknown Item";
    }
};