import { inventoryStore } from "../store/inventory";
import { BLOCKS } from "../blocks";
import { ARMOR_SLOTS } from "../items/ItemRegistry";

export class InventoryUI {
    private backdrop: HTMLDivElement;
    private window: HTMLDivElement;
    private cursorItem: HTMLDivElement;
    private slots: HTMLDivElement[] = [];

    constructor() {
        this.backdrop = document.createElement("div");
        Object.assign(this.backdrop.style, {
            position: "fixed", top: "0", left: "0", width: "100vw", height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.75)", display: "none", zIndex: "2000"
        });

        this.window = document.createElement("div");
        Object.assign(this.window.style, {
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)", width: "352px", height: "332px",
            backgroundColor: "#c6c6c6", border: "4px solid #555",
            boxShadow: "inset 4px 4px #fff, inset -4px -4px #555",
            display: "flex", flexDirection: "column", padding: "16px", gap: "16px"
        });
        this.backdrop.appendChild(this.window);

        this.createArmorSection();
        this.createMainSection();
        this.createHotbarSection();

        this.cursorItem = document.createElement("div");
        Object.assign(this.cursorItem.style, {
            position: "fixed", width: "32px", height: "32px", pointerEvents: "none",
            zIndex: "3000", display: "none", fontSize: "12px", fontWeight: "bold"
        });
        document.body.appendChild(this.cursorItem);
        document.body.appendChild(this.backdrop);

        document.addEventListener("mousemove", (e) => {
            this.cursorItem.style.left = `${e.clientX + 10}px`;
            this.cursorItem.style.top = `${e.clientY + 10}px`;
        });

        inventoryStore.subscribe((state) => {
            this.render(state);
        });
    }

    private createSlot(slotIndex: number) {
        const slot = document.createElement("div");
        Object.assign(slot.style, {
            width: "32px", height: "32px", backgroundColor: "#8b8b8b",
            border: "2px solid #373737", borderRightColor: "#fff", borderBottomColor: "#fff",
            position: "relative", cursor: "pointer"
        });

        slot.addEventListener("mousedown", (e) => {
            e.preventDefault();
            inventoryStore.getState().clickSlot(slotIndex, e.button === 2);
        });

        slot.addEventListener("contextmenu", (e) => e.preventDefault());

        this.slots[slotIndex] = slot;
        return slot;
    }

    private createArmorSection() {
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.gap = "4px";
        container.style.marginBottom = "10px";
        
        container.appendChild(this.createSlot(ARMOR_SLOTS.HEAD));
        container.appendChild(this.createSlot(ARMOR_SLOTS.CHEST));
        container.appendChild(this.createSlot(ARMOR_SLOTS.LEGS));
        container.appendChild(this.createSlot(ARMOR_SLOTS.FEET));
        
        const label = document.createElement("div");
        label.textContent = "Armor";
        label.style.fontFamily = "monospace";
        label.style.marginLeft = "10px";
        container.appendChild(label);

        this.window.appendChild(container);
    }

    private createMainSection() {
        const grid = document.createElement("div");
        Object.assign(grid.style, {
            display: "grid", gridTemplateColumns: "repeat(9, 36px)", gap: "4px"
        });

        for (let i = 9; i < 36; i++) {
            grid.appendChild(this.createSlot(i));
        }
        this.window.appendChild(grid);
    }

    private createHotbarSection() {
        const label = document.createElement("div");
        label.textContent = "Hotbar";
        label.style.fontFamily = "monospace";
        label.style.marginTop = "10px";
        this.window.appendChild(label);

        const grid = document.createElement("div");
        Object.assign(grid.style, {
            display: "grid", gridTemplateColumns: "repeat(9, 36px)", gap: "4px"
        });

        for (let i = 0; i < 9; i++) {
            grid.appendChild(this.createSlot(i));
        }
        this.window.appendChild(grid);
    }

    private render(state: ReturnType<typeof inventoryStore.getState>) {
        this.backdrop.style.display = state.isOpen ? "block" : "none";

        if (!state.isOpen) {
            this.cursorItem.style.display = "none";
            return;
        }

        if (state.cursorItem) {
            this.cursorItem.style.display = "flex";
            this.renderItemBlock(this.cursorItem, state.cursorItem.id, state.cursorItem.count);
        } else {
            this.cursorItem.style.display = "none";
        }

        state.slots.forEach((item, index) => {
            const slotDiv = this.slots[index];
            if (!slotDiv) return;

            slotDiv.innerHTML = "";

            if (item) {
                const itemDiv = document.createElement("div");
                Object.assign(itemDiv.style, {
                    width: "24px", height: "24px", margin: "2px"
                });
                this.renderItemBlock(itemDiv, item.id, item.count);
                slotDiv.appendChild(itemDiv);
            }
        });
    }

    private renderItemBlock(el: HTMLElement, id: number, count: number) {
        let color = "#ff00ff";
        if (id === BLOCKS.GRASS) color = "#2d8";
        if (id === BLOCKS.DIRT) color = "#854";
        if (id === BLOCKS.STONE_BRICK) color = "#777";
        if (id === BLOCKS.WOOD_PLANKS) color = "#a85";
        if (id === BLOCKS.GLASS) color = "#adf";
        if (id === BLOCKS.BEACON_RAY) color = "#0ff";
        if (id === BLOCKS.BEDROCK) color = "#222";
        if (id === BLOCKS.GRAVEL) color = "#aaa";
        if (id === BLOCKS.WOOD_LOG) color = "#532";
        if (id === BLOCKS.ROOF_STONE) color = "#445";

        el.style.backgroundColor = color;
        el.style.boxShadow = "inset -2px -2px rgba(0,0,0,0.3)";
        el.style.display = "flex";
        el.style.alignItems = "flex-end";
        el.style.justifyContent = "flex-end";
        
        if (count > 1) {
            const txt = document.createElement("span");
            txt.textContent = count.toString();
            txt.style.color = "white";
            txt.style.textShadow = "1px 1px 0 #000";
            txt.style.fontSize = "10px";
            el.appendChild(txt);
        }
    }
}