import { SkinViewer, WalkingAnimation } from "skinview3d";
import { inventoryStore } from "../store/inventory";
import { BLOCKS } from "../blocks";
import { ARMOR_SLOTS } from "../items/ItemRegistry";

export class InventoryUI {
    private backdrop: HTMLDivElement;
    private window: HTMLDivElement;
    private cursorItem: HTMLDivElement;
    
    // 3D Paper Doll Components
    private skinCanvas: HTMLCanvasElement;
    private skinViewer: SkinViewer | null = null;
    private isRendering: boolean = false;
    
    // We store references to every slot DOM element by index
    private slots: HTMLDivElement[] = [];

    constructor() {
        // 1. Create Backdrop (Dark background overlay)
        this.backdrop = document.createElement("div");
        Object.assign(this.backdrop.style, {
            position: "fixed", 
            top: "0", 
            left: "0", 
            width: "100vw", 
            height: "100vh",
            backgroundColor: "rgba(0, 0, 0, 0.75)", 
            display: "none", 
            zIndex: "2000"
        });

        // 2. Create Main Window (The grey box)
        this.window = document.createElement("div");
        Object.assign(this.window.style, {
            position: "absolute", 
            top: "50%", 
            left: "50%",
            transform: "translate(-50%, -50%)", 
            width: "400px", // Widened slightly for the 3D model
            minHeight: "350px",
            backgroundColor: "#c6c6c6", 
            border: "4px solid #555",
            boxShadow: "inset 4px 4px #fff, inset -4px -4px #555",
            display: "flex", 
            flexDirection: "column", 
            padding: "16px", 
            gap: "10px",
            fontFamily: "monospace",
            color: "#404040"
        });
        this.backdrop.appendChild(this.window);

        // 3. Initialize 3D Canvas
        this.skinCanvas = document.createElement("canvas");
        Object.assign(this.skinCanvas.style, {
            width: "100px",
            height: "120px",
            backgroundColor: "#8b8b8b",
            border: "2px solid #373737",
            borderRightColor: "#fff", 
            borderBottomColor: "#fff",
            boxShadow: "inset 2px 2px 4px rgba(0,0,0,0.5)"
        });

        // 4. Build Layout Sections
        this.createTopSection(); // Armor + Character + Crafting
        this.createMainSection(); // 9x3 Grid
        this.createHotbarSection(); // 1x9 Grid

        // 5. Create Floating Cursor Item (Follows Mouse)
        this.cursorItem = document.createElement("div");
        Object.assign(this.cursorItem.style, {
            position: "fixed", 
            width: "32px", 
            height: "32px", 
            pointerEvents: "none", // Click-through
            zIndex: "3000", 
            display: "none", 
            fontSize: "12px", 
            fontWeight: "bold"
        });
        document.body.appendChild(this.cursorItem);
        document.body.appendChild(this.backdrop);

        // 6. Initialize SkinViewer (The 3D Model)
        this.initSkinViewer();

        // 7. Event Listeners
        
        // Track Mouse for Cursor Item
        document.addEventListener("mousemove", (e) => {
            // Offset slightly so mouse pointer isn't covered
            this.cursorItem.style.left = `${e.clientX + 12}px`;
            this.cursorItem.style.top = `${e.clientY + 12}px`;
        });

        // Subscribe to Store Changes (Re-render on any update)
        inventoryStore.subscribe((state) => {
            this.render(state);
        });
    }

    /**
     * Sets up the 3D Character Preview
     */
    private initSkinViewer() {
        const SKIN_URL = "https://heads.playcdu.co/skin/c06f89064c8a49119c29ea1dbd1aab82"; 

        this.skinViewer = new SkinViewer({
            canvas: this.skinCanvas,
            width: 100,
            height: 120,
            skin: SKIN_URL
        });

        // Settings for "Paper Doll" look
        this.skinViewer.fov = 70;
        this.skinViewer.zoom = 0.8;
        this.skinViewer.autoRotate = true; // Spin slowly
        this.skinViewer.autoRotateSpeed = 0.5;
        this.skinViewer.animation = new WalkingAnimation(); // Idle walk
        
        // Position camera to look at body center
        this.skinViewer.camera.position.set(0, 15, 40);
        this.skinViewer.controls.enableZoom = false;
        this.skinViewer.controls.enablePan = false;
    }

    /**
     * Rendering Loop for the 3D Model
     * Only runs when inventory is OPEN to save performance.
     */
    private startRenderLoop() {
        if (this.isRendering) return;
        this.isRendering = true;

        const loop = () => {
            if (!this.isRendering || !this.skinViewer) return;
            // Draw the 3D model
            this.skinViewer.render(); 
            requestAnimationFrame(loop);
        };
        loop();
    }

    private stopRenderLoop() {
        this.isRendering = false;
    }

    /**
     * Helper to create a single 32x32 slot div
     */
    private createSlot(slotIndex: number) {
        const slot = document.createElement("div");
        Object.assign(slot.style, {
            width: "32px", 
            height: "32px", 
            backgroundColor: "#8b8b8b",
            border: "2px solid #373737", 
            borderRightColor: "#fff", 
            borderBottomColor: "#fff",
            position: "relative", 
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
        });

        // Interaction Logic
        slot.addEventListener("mousedown", (e) => {
            e.preventDefault();
            // 0 = Left Click, 2 = Right Click
            inventoryStore.getState().clickSlot(slotIndex, e.button === 2);
        });

        // Disable Context Menu (Right-click menu)
        slot.addEventListener("contextmenu", (e) => e.preventDefault());

        this.slots[slotIndex] = slot;
        return slot;
    }

    /**
     * Creates the top area containing Armor (Left), Character (Center), Crafting (Right)
     */
    private createTopSection() {
        const container = document.createElement("div");
        Object.assign(container.style, {
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "10px",
            gap: "10px"
        });

        // --- LEFT: ARMOR ---
        const armorCol = document.createElement("div");
        armorCol.style.display = "flex";
        armorCol.style.flexDirection = "column";
        armorCol.style.gap = "4px";

        // Vertical Armor Slots
        armorCol.appendChild(this.createSlot(ARMOR_SLOTS.HEAD));
        armorCol.appendChild(this.createSlot(ARMOR_SLOTS.CHEST));
        armorCol.appendChild(this.createSlot(ARMOR_SLOTS.LEGS));
        armorCol.appendChild(this.createSlot(ARMOR_SLOTS.FEET));

        // --- CENTER: CHARACTER PREVIEW ---
        const charCol = document.createElement("div");
        charCol.style.display = "flex";
        charCol.style.flexDirection = "column";
        charCol.style.alignItems = "center";
        charCol.style.gap = "4px";
        
        // Add the 3D Canvas here
        charCol.appendChild(this.skinCanvas);

        // --- RIGHT: CRAFTING ---
        const craftingCol = document.createElement("div");
        craftingCol.style.display = "flex";
        craftingCol.style.flexDirection = "column";
        craftingCol.style.gap = "4px";
        
        const craftLabel = document.createElement("div");
        craftLabel.textContent = "Crafting";
        craftLabel.style.fontSize = "12px";

        const craftBody = document.createElement("div");
        craftBody.style.display = "flex";
        craftBody.style.alignItems = "center";
        craftBody.style.gap = "8px";

        // 2x2 Grid
        const grid2x2 = document.createElement("div");
        Object.assign(grid2x2.style, {
            display: "grid",
            gridTemplateColumns: "repeat(2, 36px)",
            gap: "2px"
        });
        grid2x2.appendChild(this.createSlot(200));
        grid2x2.appendChild(this.createSlot(201));
        grid2x2.appendChild(this.createSlot(202));
        grid2x2.appendChild(this.createSlot(203));

        // Arrow
        const arrow = document.createElement("div");
        arrow.textContent = "➔";
        arrow.style.fontSize = "20px";
        arrow.style.color = "#444";

        // Result Slot (Big)
        const resultSlot = this.createSlot(204);
        
        craftBody.appendChild(grid2x2);
        craftBody.appendChild(arrow);
        craftBody.appendChild(resultSlot);

        craftingCol.appendChild(craftLabel);
        craftingCol.appendChild(craftBody);

        // Add columns to container
        container.appendChild(armorCol);
        container.appendChild(charCol);
        container.appendChild(craftingCol);
        
        this.window.appendChild(container);
    }

    private createMainSection() {
        const label = document.createElement("div");
        label.textContent = "Inventory";
        label.style.fontSize = "12px";
        this.window.appendChild(label);

        const grid = document.createElement("div");
        Object.assign(grid.style, {
            display: "grid", 
            gridTemplateColumns: "repeat(9, 36px)", 
            gap: "4px"
        });

        // Slots 9 to 35 (27 slots)
        for (let i = 9; i < 36; i++) {
            grid.appendChild(this.createSlot(i));
        }
        this.window.appendChild(grid);
    }

    private createHotbarSection() {
        // Spacer
        const spacer = document.createElement("div");
        spacer.style.height = "4px";
        this.window.appendChild(spacer);

        const grid = document.createElement("div");
        Object.assign(grid.style, {
            display: "grid", 
            gridTemplateColumns: "repeat(9, 36px)", 
            gap: "4px"
        });

        // Slots 0 to 8 (9 slots)
        for (let i = 0; i < 9; i++) {
            grid.appendChild(this.createSlot(i));
        }
        this.window.appendChild(grid);
    }

    /**
     * Main Render Loop: Syncs DOM with Zustand State
     */
    private render(state: ReturnType<typeof inventoryStore.getState>) {
        // 1. Toggle Visibility & Render Loop
        if (state.isOpen) {
            this.backdrop.style.display = "block";
            this.startRenderLoop(); // Start 3D animation
        } else {
            this.backdrop.style.display = "none";
            this.stopRenderLoop(); // Stop 3D animation (Save GPU)
            this.cursorItem.style.display = "none";
            return;
        }

        // 2. Render Cursor (Floating Item)
        if (state.cursorItem) {
            this.cursorItem.style.display = "flex";
            this.renderItemBlock(this.cursorItem, state.cursorItem.id, state.cursorItem.count);
        } else {
            this.cursorItem.style.display = "none";
        }

        // 3. Render All Slots
        state.slots.forEach((item, index) => {
            const slotDiv = this.slots[index];
            if (!slotDiv) return;

            // Clear previous content
            slotDiv.innerHTML = "";

            if (item) {
                // Create item representation
                const itemDiv = document.createElement("div");
                Object.assign(itemDiv.style, {
                    width: "24px", 
                    height: "24px", 
                    pointerEvents: "none" // Let clicks pass to the slot container
                });
                
                this.renderItemBlock(itemDiv, item.id, item.count);
                slotDiv.appendChild(itemDiv);
            }
        });
    }

    /**
     * Renders a colored square representing a block + count number
     */
    private renderItemBlock(el: HTMLElement, id: number, count: number) {
        let color = "#ff00ff"; // Fallback "Error Pink"
        
        // --- Color Mapping ---
        if (id === BLOCKS.GRASS) color = "#4b8529";
        else if (id === BLOCKS.DIRT) color = "#79553a";
        else if (id === BLOCKS.STONE_BRICK) color = "#787878";
        else if (id === BLOCKS.WOOD_PLANKS) color = "#a0753b";
        else if (id === BLOCKS.GLASS) color = "#a6d5df";
        else if (id === BLOCKS.BEACON_RAY) color = "#90ffff";
        else if (id === BLOCKS.BEDROCK) color = "#222";
        else if (id === BLOCKS.GRAVEL) color = "#8f8f8f";
        else if (id === BLOCKS.WOOD_LOG) color = "#4a3523";
        else if (id === BLOCKS.ROOF_STONE) color = "#4a4a55";

        el.style.backgroundColor = color;
        // Faux 3D effect
        el.style.boxShadow = "inset -2px -2px rgba(0,0,0,0.3), inset 2px 2px rgba(255,255,255,0.2)";
        el.style.display = "flex";
        el.style.alignItems = "flex-end";
        el.style.justifyContent = "flex-end";
        
        // Render Count
        if (count > 1) {
            const txt = document.createElement("span");
            txt.textContent = count.toString();
            Object.assign(txt.style, {
                color: "white",
                textShadow: "1px 1px 0 #000",
                fontSize: "11px",
                fontWeight: "bold",
                lineHeight: "1",
                marginBottom: "-2px",
                marginRight: "-2px"
            });
            el.appendChild(txt);
        }
    }
}