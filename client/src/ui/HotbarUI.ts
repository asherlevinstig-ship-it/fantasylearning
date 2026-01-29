import { inventoryStore } from "../store/inventory";
import { BLOCKS } from "../blocks";

export class HotbarUI {
    private container: HTMLDivElement;
    private slots: HTMLDivElement[] = [];

    constructor() {
        this.container = document.createElement("div");
        this.setupStyles();
        this.createSlots();
        document.body.appendChild(this.container);

        // SUBSCRIBE TO ZUSTAND
        // This automatically runs whenever the inventory changes
        inventoryStore.subscribe((state) => {
            this.render(state);
        });

        // Initial render
        this.render(inventoryStore.getState());
    }

    private setupStyles() {
        Object.assign(this.container.style, {
            position: "fixed",
            bottom: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            display: "flex",
            gap: "4px",
            padding: "4px",
            background: "rgba(0, 0, 0, 0.5)",
            borderRadius: "8px",
            pointerEvents: "none", // Let clicks pass through to game
            zIndex: "1000"
        });
    }

    private createSlots() {
        for (let i = 0; i < 9; i++) {
            const slot = document.createElement("div");
            Object.assign(slot.style, {
                width: "40px",
                height: "40px",
                border: "2px solid rgba(255,255,255,0.3)",
                backgroundColor: "rgba(0,0,0,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "white",
                fontSize: "12px",
                fontFamily: "monospace",
                position: "relative"
            });
            
            // Number label (1-9)
            const num = document.createElement("span");
            num.textContent = (i + 1).toString();
            Object.assign(num.style, {
                position: "absolute",
                top: "2px",
                left: "2px",
                fontSize: "8px",
                opacity: "0.7"
            });
            slot.appendChild(num);

            this.container.appendChild(slot);
            this.slots.push(slot);
        }
    }

    private render(state: ReturnType<typeof inventoryStore.getState>) {
        this.slots.forEach((slot, index) => {
            const item = state.slots[index];
            const isSelected = index === state.selectedSlot;

            // Highlight selected slot
            slot.style.borderColor = isSelected ? "white" : "rgba(255,255,255,0.3)";
            slot.style.transform = isSelected ? "scale(1.1)" : "scale(1)";

            // Update Content
            // Clear old content (keep the number label)
            while (slot.childNodes.length > 1) {
                slot.removeChild(slot.lastChild!);
            }

            if (item) {
                // Determine Block Color based on ID (Simple visual mapping)
                // You can expand this later with textures
                let color = "#888";
                if (item.id === BLOCKS.GRASS) color = "#2d8";
                if (item.id === BLOCKS.DIRT) color = "#854";
                if (item.id === BLOCKS.STONE_BRICK) color = "#777";
                if (item.id === BLOCKS.WOOD_PLANKS) color = "#a85";
                if (item.id === BLOCKS.GLASS) color = "#adf";
                if (item.id === BLOCKS.BEACON_RAY) color = "#0ff";

                const blockDiv = document.createElement("div");
                Object.assign(blockDiv.style, {
                    width: "20px",
                    height: "20px",
                    backgroundColor: color,
                    boxShadow: "inset -2px -2px rgba(0,0,0,0.2)"
                });
                slot.appendChild(blockDiv);

                const countDiv = document.createElement("span");
                countDiv.textContent = item.count.toString();
                Object.assign(countDiv.style, {
                    position: "absolute",
                    bottom: "2px",
                    right: "2px",
                    fontWeight: "bold"
                });
                slot.appendChild(countDiv);
            }
        });
    }
}