import { BLOCKS } from "../blocks";

export enum SlotType {
    GENERAL = 0,
    HEAD = 1,
    CHEST = 2,
    LEGS = 3,
    FEET = 4,
    OFFHAND = 5
}

const ITEM_TYPES: Record<number, SlotType> = {
    // Future item mappings go here
};

export const ARMOR_SLOTS = {
    HEAD: 100,
    CHEST: 101,
    LEGS: 102,
    FEET: 103,
    OFFHAND: 104
};

export const ItemRegistry = {
    canEquip: (slotIndex: number, itemId: number): boolean => {
        let requiredType = SlotType.GENERAL;

        if (slotIndex === ARMOR_SLOTS.HEAD) requiredType = SlotType.HEAD;
        else if (slotIndex === ARMOR_SLOTS.CHEST) requiredType = SlotType.CHEST;
        else if (slotIndex === ARMOR_SLOTS.LEGS) requiredType = SlotType.LEGS;
        else if (slotIndex === ARMOR_SLOTS.FEET) requiredType = SlotType.FEET;
        else if (slotIndex === ARMOR_SLOTS.OFFHAND) requiredType = SlotType.OFFHAND;

        if (requiredType === SlotType.GENERAL) return true;

        const itemType = ITEM_TYPES[itemId] || SlotType.GENERAL;
        return itemType === requiredType;
    },
    
    getItemName: (id: number) => {
        const entry = Object.entries(BLOCKS).find(([k, v]) => v === id);
        return entry ? entry[0] : "Unknown Item";
    }
};