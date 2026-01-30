// ==========================================================================
// main.ts - Voxel Game Client (Schema Reflection Mode)
// ==========================================================================

import { Client } from "colyseus.js";
import { Engine } from "noa-engine";
import { SkinViewer } from "skinview3d";
import { TownGenerator } from "./TownGenerator";
import { BLOCKS } from "./blocks";
import { inventoryStore } from "./store/inventory";
import { HotbarUI } from "./ui/HotbarUI";
import { InventoryUI } from "./ui/inventoryUI";

// ==========================================================================
// HUD HELPER
// ==========================================================================
const hudEl = document.getElementById("hud") as HTMLDivElement | null;

function setHud(lines: string[]): void {
    if (hudEl) {
        hudEl.innerHTML = lines.join("<br>");
        Object.assign(hudEl.style, {
            whiteSpace: "pre-wrap",
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            padding: "10px",
            color: "white",
            fontFamily: "monospace",
            display: hudEl.style.display === "none" ? "none" : "block",
            borderRadius: "8px"
        });
    }
}

// ==========================================================================
// BIOME UI
// ==========================================================================
let biomeEl: HTMLDivElement | null = null;
let biomeTitleEl: HTMLDivElement | null = null;
let biomeSubEl: HTMLDivElement | null = null;
let biomeHideTimer: number | null = null;
let biomeCooldownUntil = 0;

function createBiomeUI(): void {
    biomeEl = document.createElement("div");
    biomeTitleEl = document.createElement("div");
    biomeSubEl = document.createElement("div");
    biomeEl.appendChild(biomeTitleEl);
    biomeEl.appendChild(biomeSubEl);

    Object.assign(biomeEl.style, {
        position: "fixed",
        top: "18%",
        left: "50%",
        transform: "translateX(-50%) translateY(-10px)",
        textAlign: "center",
        fontFamily: "Impact, system-ui, sans-serif",
        pointerEvents: "none",
        opacity: "0",
        transition: "opacity 300ms ease, transform 300ms ease",
        zIndex: "9999",
        userSelect: "none",
        whiteSpace: "nowrap",
    });
    Object.assign(biomeTitleEl.style, {
        fontSize: "48px",
        color: "#FFD700",
        textShadow: "4px 4px 0px #000",
        lineHeight: "1"
    });
    Object.assign(biomeSubEl.style, {
        marginTop: "6px",
        fontSize: "22px",
        color: "#ffffff",
        textShadow: "3px 3px 0px #000",
        opacity: "0.95"
    });
    document.body.appendChild(biomeEl);
}

function showBiomeNotification(title: string, subtext: string = ""): void {
    if (!biomeEl || !biomeTitleEl || !biomeSubEl) return;
    const t = performance.now();
    if (t < biomeCooldownUntil) return;
    biomeCooldownUntil = t + 1200;

    biomeTitleEl.textContent = title;
    biomeSubEl.textContent = subtext;
    if (biomeHideTimer !== null) window.clearTimeout(biomeHideTimer);
    biomeEl.style.opacity = "1";
    biomeEl.style.transform = "translateX(-50%) translateY(0px)";

    biomeHideTimer = window.setTimeout(() => {
        if (!biomeEl) return;
        biomeEl.style.opacity = "0";
        biomeEl.style.transform = "translateX(-50%) translateY(-10px)";
    }, 2500);
}

// ==========================================================================
// OVERLAY CANVAS HELPER
// ==========================================================================
function createOverlayCanvas(opts: {
    id: string;
    width: number;
    height: number;
    style: Partial<CSSStyleDeclaration>;
}): HTMLCanvasElement {
    const c = document.createElement("canvas");
    c.id = opts.id;
    c.width = opts.width;
    c.height = opts.height;
    Object.assign(c.style, {
        position: "fixed",
        pointerEvents: "none",
        imageRendering: "pixelated",
        zIndex: "100",
        ...opts.style
    });
    document.body.appendChild(c);
    return c;
}

function startThrottledRender(viewer: SkinViewer, fps = 30): void {
    const frameMs = 1000 / fps;
    let last = performance.now();
    const loop = (t: number) => {
        if (t - last >= frameMs) {
            viewer.render();
            last = t;
        }
        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
}

// ==========================================================================
// MAIN APPLICATION
// ==========================================================================
async function main(): Promise<void> {
    console.log("🚀 Starting Client (Schema Reflection Mode)...");

    setHud(["Initializing Engine..."]);
    createBiomeUI();

    // ======================================================================
    // 1. SETUP NOA ENGINE
    // ======================================================================
    const noa: any = new Engine({
        debug: true,
        chunkSize: 16,
        chunkAddDistance: 32,
        chunkRemoveDistance: 40,
        playerStart: [0, 50, 0],
        texturePath: ""
    });
    (window as any).noa = noa;

    // ======================================================================
    // 2. REGISTER BLOCKS & MATERIALS
    // ======================================================================
    noa.registry.registerMaterial("grass", { color: [0.2, 0.8, 0.2] });
    noa.registry.registerMaterial("dirt", { color: [0.55, 0.35, 0.17] });
    noa.registry.registerMaterial("stone_brick", { color: [0.5, 0.5, 0.5] });
    noa.registry.registerMaterial("gravel", { color: [0.7, 0.7, 0.7] });
    noa.registry.registerMaterial("bedrock", { color: [0.1, 0.1, 0.1] });
    noa.registry.registerMaterial("wood_plank", { color: [0.76, 0.60, 0.42] });
    noa.registry.registerMaterial("wood_log", { color: [0.4, 0.3, 0.2] });
    noa.registry.registerMaterial("roof", { color: [0.3, 0.3, 0.35] });
    noa.registry.registerMaterial("beacon", { color: [0.2, 1.0, 1.0], alpha: 0.6 });
    noa.registry.registerMaterial("glass", { color: [0.8, 0.9, 1.0], alpha: 0.4 });

    noa.registry.registerBlock(BLOCKS.GRASS, { material: "grass" });
    noa.registry.registerBlock(BLOCKS.DIRT, { material: "dirt" });
    noa.registry.registerBlock(BLOCKS.STONE_BRICK, { material: "stone_brick" });
    noa.registry.registerBlock(BLOCKS.GRAVEL, { material: "gravel" });
    noa.registry.registerBlock(BLOCKS.BEACON_RAY, { material: "beacon", opaque: false });
    noa.registry.registerBlock(BLOCKS.BEDROCK, { material: "bedrock" });
    noa.registry.registerBlock(BLOCKS.WOOD_PLANKS, { material: "wood_plank" });
    noa.registry.registerBlock(BLOCKS.WOOD_LOG, { material: "wood_log" });
    noa.registry.registerBlock(BLOCKS.GLASS, { material: "glass", opaque: false });
    noa.registry.registerBlock(BLOCKS.ROOF_STONE, { material: "roof" });

    console.log("✅ Blocks registered.");

    // ======================================================================
    // 3. INITIALIZE GENERATOR
    // ======================================================================
    console.time("GenInit");
    const townGen = new TownGenerator(4000, 4000, 12345);
    console.timeEnd("GenInit");

    const TOWN_RADIUS_LIMIT = townGen.townRadius + townGen.wallThickness;
    const WORLD_RADIUS = 2000;

    // ======================================================================
    // 4. UI & INPUTS
    // ======================================================================
    new HotbarUI();
    new InventoryUI();

    noa.inputs.bind('fire', 'KeyF');
    noa.inputs.bind('fire', 'f');
    noa.inputs.bind('alt-fire', 'KeyR');
    noa.inputs.bind('home', 'KeyG');
    noa.inputs.bind('wall', 'KeyH');
    noa.inputs.bind('wild', 'KeyJ');
    noa.inputs.bind('debug', 'F3');
    noa.inputs.bind('debug', 'KeyZ');
    noa.inputs.bind('debug', 'KeyP');
    noa.inputs.bind('scan', 'KeyX');
    noa.inputs.bind('fill_inv', 'KeyI');

    let showDebug = true;
    noa.inputs.down.on('debug', () => {
        showDebug = !showDebug;
        if (hudEl) hudEl.style.display = showDebug ? "block" : "none";
    });

    // Hotbar slots 1-9
    for (let i = 1; i <= 9; i++) {
        noa.inputs.bind(`slot${i}`, `Digit${i}`);
        noa.inputs.down.on(`slot${i}`, () => inventoryStore.getState().selectSlot(i - 1));
    }

    // Scroll wheel for hotbar
    window.addEventListener("wheel", (e) => {
        const current = inventoryStore.getState().selectedSlot;
        const dir = Math.sign(e.deltaY);
        let next = current + dir;
        if (next > 8) next = 0;
        if (next < 0) next = 8;
        inventoryStore.getState().selectSlot(next);
    });

    // Toggle inventory with E
    window.addEventListener("keydown", (e) => {
        if (document.activeElement?.tagName === "INPUT") return;
        if (e.code === "KeyE") {
            inventoryStore.getState().toggleOpen();
            e.preventDefault();
        }
    });

    // Fill inventory (debug)
    noa.inputs.down.on('fill_inv', () => {
        console.log("🎒 Refilling Inventory...");
        const { setSlot } = inventoryStore.getState();
        setSlot(0, BLOCKS.GRASS, 64);
        setSlot(1, BLOCKS.DIRT, 64);
        setSlot(2, BLOCKS.STONE_BRICK, 64);
        setSlot(3, BLOCKS.WOOD_PLANKS, 64);
        setSlot(4, BLOCKS.WOOD_LOG, 64);
        setSlot(5, BLOCKS.GRAVEL, 64);
        setSlot(6, BLOCKS.GLASS, 64);
        setSlot(7, BLOCKS.ROOF_STONE, 64);
        setSlot(8, BLOCKS.BEACON_RAY, 64);
    });

    // Inventory state subscription
    inventoryStore.subscribe((state) => {
        if (state.isOpen) {
            noa.inputs.state.forward = false;
            noa.inputs.state.backward = false;
            noa.inputs.state.left = false;
            noa.inputs.state.right = false;
            noa.inputs.state.jump = false;
            noa.inputs.state.fire = false;
            document.exitPointerLock();
        } else {
            noa.container.canvas.requestPointerLock();
        }
    });

    // ======================================================================
    // 5. TICK LOOP
    // ======================================================================
    noa.on('tick', () => {
        const pos = noa.entities.getPosition(noa.playerEntity);
        let modified = false;

        if (pos[0] > WORLD_RADIUS) { pos[0] = WORLD_RADIUS; modified = true; }
        else if (pos[0] < -WORLD_RADIUS) { pos[0] = -WORLD_RADIUS; modified = true; }
        if (pos[2] > WORLD_RADIUS) { pos[2] = WORLD_RADIUS; modified = true; }
        else if (pos[2] < -WORLD_RADIUS) { pos[2] = -WORLD_RADIUS; modified = true; }

        if (modified) noa.entities.setPosition(noa.playerEntity, pos);

        if (showDebug) {
            const x = Math.floor(pos[0]);
            const y = Math.floor(pos[1]);
            const z = Math.floor(pos[2]);
            const dist = Math.floor(Math.sqrt(pos[0] * pos[0] + pos[2] * pos[2]));
            const zoneName = townGen.getZoneName(pos[0], pos[2]);
            const boundaryMsg = zoneName === "Town of Beginnings"
                ? `Wall Boundary at: ${TOWN_RADIUS_LIMIT}m`
                : `Distance to Wall: ${dist - TOWN_RADIUS_LIMIT}m`;

            setHud([
                `📍 POS: [${x}, ${y}, ${z}]`,
                `📏 DIST: ${dist}m`,
                `🌍 ZONE: ${zoneName.toUpperCase()}`,
                `🚧 ${boundaryMsg}`
            ]);
        }
    });

    // ======================================================================
    // 6. CHUNK LOADING
    // ======================================================================
    const chunkSize = noa.world._chunkSize;

    noa.world.on("worldDataNeeded", (requestID: string, dataArr: any, cx: number, cy: number, cz: number) => {
        try {
            const chunkX = cx;
            const chunkY = cy;
            const chunkZ = cz;

            for (let x = 0; x < chunkSize; x++) {
                const globalX = chunkX + x;
                for (let z = 0; z < chunkSize; z++) {
                    const globalZ = chunkZ + z;
                    const colData = townGen.getColumnInfo(globalX, globalZ);

                    for (let y = 0; y < chunkSize; y++) {
                        const globalY = chunkY + y;
                        const id = townGen.resolveBlockID(globalY, colData);
                        const safeID = (typeof id === 'number' && isFinite(id)) ? id : BLOCKS.GRASS;
                        dataArr.set(x, y, z, safeID);
                    }
                }
            }
            noa.world.setChunkData(requestID, dataArr, null);

        } catch (e) {
            console.error("❌ Generator Crashed at", cx, cy, cz, e);
            for (let i = 0; i < dataArr.data.length; i++) dataArr.data[i] = BLOCKS.GRASS;
            noa.world.setChunkData(requestID, dataArr, null);
        }
    });

    // ======================================================================
    // 7. SKINS & HANDS
    // ======================================================================
    const SKIN_URL = "https://heads.playcdu.co/skin/c06f89064c8a49119c29ea1dbd1aab82";
    const handsCanvas = createOverlayCanvas({
        id: "hands-view",
        width: 400,
        height: 400,
        style: {
            left: "auto",
            right: "0px",
            bottom: "0px",
            top: "auto",
            width: "35vw",
            height: "45vh",
            background: "transparent"
        },
    });

    const handsViewer = new SkinViewer({ canvas: handsCanvas, width: 400, height: 400 });
    handsViewer.fov = 70;
    handsViewer.zoom = 1.0;
    await handsViewer.loadSkin(SKIN_URL);

    const po = handsViewer.playerObject;
    if (po && po.skin) {
        po.skin.head.visible = false;
        po.skin.body.visible = false;
        po.skin.leftLeg.visible = false;
        po.skin.rightLeg.visible = false;
        po.skin.leftArm.visible = false;
        po.skin.rightArm.visible = true;
        po.skin.rightArm.rotation.set(-0.4, 0.1, 0.2);
        po.skin.rightArm.position.set(-2, -6, 0);
    }
    handsViewer.camera.position.set(-4, 0, -8);
    handsViewer.camera.lookAt(-2, -8, 4);
    startThrottledRender(handsViewer, 30);

    const swingHand = (): void => {
        const skin = handsViewer.playerObject?.skin;
        if (!skin?.rightArm) return;
        const start = performance.now();
        const duration = 200;
        const baseX = -0.4;
        const baseZ = 0.2;
        const animate = (): void => {
            const t = performance.now() - start;
            const k = Math.min(1, t / duration);
            const swing = Math.sin(k * Math.PI);
            skin.rightArm.rotation.x = baseX - swing * 1.2;
            skin.rightArm.rotation.z = baseZ - swing * 0.3;
            if (k < 1) requestAnimationFrame(animate);
            else {
                skin.rightArm.rotation.x = baseX;
                skin.rightArm.rotation.z = baseZ;
            }
        };
        requestAnimationFrame(animate);
    };

    // ======================================================================
    // 8. TELEPORT ACTIONS
    // ======================================================================
    noa.inputs.down.on("home", () => {
        noa.entities.setPosition(noa.playerEntity, [0, 50, 0]);
    });
    noa.inputs.down.on("wall", () => {
        noa.entities.setPosition(noa.playerEntity, [800, 50, 40]);
    });
    noa.inputs.down.on("wild", () => {
        const h = townGen.getHeight(1200, 1200);
        noa.entities.setPosition(noa.playerEntity, [1200, h + 5, 1200]);
    });

    // ======================================================================
    // 9. COLYSEUS NETWORKING (Schema Reflection Mode)
    // ======================================================================
    setHud(["Connecting..."]);
    const client = new Client(window.location.origin);

    // Join WITHOUT passing schema class - server sends schema via reflection
    const room = await client.joinOrCreate("voxel", {});
    (window as any).room = room;

    console.log(`🟢 Connected: ${room.sessionId}`);

    const otherPlayers: Record<string, number> = {};

    // Wait for state to initialize, then register listeners
    room.onStateChange.once((state: any) => {
        console.log("📡 State received via reflection:", state);
        console.log("   State keys:", Object.keys(state));

        if (!state.players) {
            console.error("❌ No 'players' collection in state!");
            return;
        }

        console.log("   players type:", state.players.constructor.name);
        console.log("   players size:", state.players.size);

        // Verify onAdd exists (it should with reflection)
        if (typeof state.players.onAdd !== "function") {
            console.error("❌ state.players.onAdd is not a function!");
            console.error("   Available methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(state.players)));
            return;
        }

        console.log("✅ Registering player listeners...");

        // Handle new players joining
        state.players.onAdd((player: any, sessionId: string) => {
            console.log("👤 Player joined:", sessionId, { x: player.x, y: player.y, z: player.z });

            // Skip self
            if (sessionId === room.sessionId) {
                console.log("   (Skipping self)");
                return;
            }

            // Create player mesh
            const scene = noa.rendering.getScene();
            const mesh = noa.rendering.makeMesh("box", 0.8, 1.8, 0.8);
            const mat = noa.rendering.makeStandardMaterial("player_mat_" + sessionId);
            mat.diffuseColor = new (scene.getEngine()._workingContext.BABYLON).Color3(1, 0, 0);
            mesh.material = mat;

            const eid = noa.entities.add(
                [player.x, player.y, player.z],
                0.8, 1.8, mesh, [0, 0.9, 0], false, false
            );
            otherPlayers[sessionId] = eid;

            // Listen for position updates
            player.onChange(() => {
                const targetEid = otherPlayers[sessionId];
                if (targetEid !== undefined) {
                    noa.entities.setPosition(targetEid, [player.x, player.y, player.z]);
                }
            });
        });

        // Handle players leaving
        state.players.onRemove((_player: any, sessionId: string) => {
            console.log("✌️ Player left:", sessionId);
            const eid = otherPlayers[sessionId];
            if (eid !== undefined) {
                noa.entities.deleteEntity(eid);
                delete otherPlayers[sessionId];
            }
        });

        // Check for any players already in the room
        state.players.forEach((player: any, sessionId: string) => {
            if (sessionId !== room.sessionId) {
                console.log("👥 Existing player found:", sessionId);
            }
        });
    });

    // Message handlers
    room.onMessage("worldInfo", (msg) => {
        console.log("WorldInfo:", msg);
    });

    room.onMessage("blockUpdate", (msg) => {
        noa.setBlock(msg.id, msg.x, msg.y, msg.z);
    });

    // Error handling
    room.onError((code, message) => {
        console.error("❌ Room error:", code, message);
    });

    room.onLeave((code) => {
        console.log("👋 Left room:", code);
    });

    // Break block action (fire)
    noa.inputs.down.on("fire", () => {
        if (inventoryStore.getState().isOpen) return;

        swingHand();
        if (noa.targetedBlock) {
            const pos = noa.targetedBlock.position;
            const id = noa.getBlock(pos[0], pos[1], pos[2]);

            if (id === BLOCKS.BEDROCK || id === BLOCKS.AIR) return;

            const added = inventoryStore.getState().addItem(id, 1);

            if (added) {
                if (room.connection?.isOpen) {
                    room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: BLOCKS.AIR });
                }
                noa.setBlock(BLOCKS.AIR, pos[0], pos[1], pos[2]);
            }
        }
    });

    // Place block action (alt-fire)
    noa.inputs.down.on("alt-fire", () => {
        if (inventoryStore.getState().isOpen) return;

        swingHand();
        if (noa.targetedBlock) {
            const pos = noa.targetedBlock.adjacent;
            const item = inventoryStore.getState().getSelectedItem();

            if (!item || item.count <= 0) return;

            if (room.connection?.isOpen) {
                room.send("setBlock", { x: pos[0], y: pos[1], z: pos[2], id: item.id });
            }
            noa.setBlock(item.id, pos[0], pos[1], pos[2]);
        }
    });

    // Position sync loop (send position to server)
    setInterval(() => {
        if (room?.connection?.isOpen) {
            const p = noa.entities.getPosition(noa.playerEntity);
            room.send("move", { x: p[0], y: p[1], z: p[2] });
        }
    }, 100);

    // ======================================================================
    // 10. CHUNK SUBSCRIPTION & ZONE LOGIC
    // ======================================================================
    const SERVER_CHUNK_SIZE = 16;
    let currentZone = "Unknown";
    let pendingZone = "Unknown";
    let pendingSince = 0;

    setInterval(() => {
        if (!room?.connection?.isOpen) return;
        const p = noa.entities.getPosition(noa.playerEntity);
        const cx = Math.floor(p[0] / SERVER_CHUNK_SIZE);
        const cy = Math.floor(p[1] / SERVER_CHUNK_SIZE);
        const cz = Math.floor(p[2] / SERVER_CHUNK_SIZE);
        room.send("subscribeChunks", { cx, cy, cz, r: 8 });

        const newZone = townGen.getZoneName(p[0], p[2]);
        const t = performance.now();
        if (newZone !== pendingZone) {
            pendingZone = newZone;
            pendingSince = t;
        }

        if (pendingZone !== currentZone && (t - pendingSince) > 350) {
            if (pendingZone === "Town of Beginnings") {
                showBiomeNotification(pendingZone, "Safe Zone");
            } else {
                showBiomeNotification(pendingZone, "PvP Enabled");
            }
            currentZone = pendingZone;
        }
    }, 250);

    // Zone debug logging
    setInterval(() => {
        if (!noa.playerEntity) return;
        const p = noa.entities.getPosition(noa.playerEntity);
        const zone = townGen.getZoneName(p[0], p[2]);
        console.log(`[ZONE DEBUG] x=${p[0].toFixed(1)} z=${p[2].toFixed(1)} => ${zone}`);
    }, 1000);

    // ======================================================================
    // 11. DEBUG SCANNER (Press 'X')
    // ======================================================================
    noa.inputs.down.on('scan', () => {
        const p = noa.entities.getPosition(noa.playerEntity);
        const px = Math.floor(p[0]);
        const py = Math.floor(p[1]);
        const pz = Math.floor(p[2]);

        console.group(`🔍 SCANNING AREA AROUND [${px}, ${py}, ${pz}]`);
        console.log(`Zone Logic Says: ${townGen.getZoneName(px, pz)}`);

        const radius = 5;
        const groundY = py - 1;

        console.log(`\n--- GROUND MAP (Y=${groundY}) ---`);
        let visualMap = "";

        for (let z = pz - radius; z <= pz + radius; z++) {
            let rowStr = "";
            for (let x = px - radius; x <= px + radius; x++) {
                const engineID = noa.getBlock(x, groundY, z);
                const genID = townGen.getBlockID(x, groundY, z);

                let char = " ";
                if (engineID === BLOCKS.AIR) char = ".";
                else if (engineID === BLOCKS.GRASS) char = "G";
                else if (engineID === BLOCKS.STONE_BRICK) char = "S";
                else if (engineID === BLOCKS.GRAVEL) char = ":";
                else char = "#";

                if (engineID !== genID) char = "!";
                if (x === px && z === pz) char = "@";

                rowStr += ` ${char} `;
            }
            visualMap += rowStr + `  (z=${z})\n`;
        }
        console.log(visualMap);
        console.groupEnd();
    });

    // ======================================================================
    // 12. RESIZE HANDLER
    // ======================================================================
    const resizeHands = (): void => {
        const rawSize = Math.min(window.innerWidth * 0.35, 400);
        const size = Math.floor(rawSize * Math.min(1.25, window.devicePixelRatio || 1));
        handsCanvas.width = size;
        handsCanvas.height = size;
        handsViewer.setSize(size, size);
    };
    window.addEventListener("resize", resizeHands);
    resizeHands();

    setHud(["Ready!"]);
    console.log("✅ Client initialization complete!");
}

// ==========================================================================
// ENTRY POINT
// ==========================================================================
main().catch((e) => {
    console.error("❌ FATAL:", e);
    setHud(["Error (check console)"]);
});
