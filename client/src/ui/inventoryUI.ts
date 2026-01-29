import { inventoryStore, type EquipSlot } from "../state/inventoryStore";

// Simple label for items (replace later with icons)
function itemLabel(id: number) {
  return `#${id}`;
}

function makeSlotEl() {
  const el = document.createElement("div");
  Object.assign(el.style, {
    width: "52px",
    height: "52px",
    border: "2px solid rgba(255,255,255,0.25)",
    background: "rgba(0,0,0,0.35)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "system-ui, sans-serif",
    fontSize: "12px",
    position: "relative",
    userSelect: "none",
  });
  return el;
}

export function mountInventoryUI() {
  let held:
    | null
    | { area: "hotbar" | "inventory" | "equipment"; index?: number; slot?: EquipSlot } = null;

  const root = document.createElement("div");
  root.id = "inventory-root";
  Object.assign(root.style, {
    position: "fixed",
    inset: "0",
    display: "none",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(0,0,0,0.35)",
    zIndex: "9998",
  });

  const panel = document.createElement("div");
  Object.assign(panel.style, {
    width: "820px",
    maxWidth: "95vw",
    padding: "18px",
    borderRadius: "14px",
    background: "rgba(20,20,20,0.9)",
    border: "1px solid rgba(255,255,255,0.15)",
    display: "grid",
    gridTemplateColumns: "220px 1fr",
    gap: "18px",
    color: "white",
  });

  // Equipment column
  const left = document.createElement("div");
  left.innerHTML = `<div style="font-size:18px;margin-bottom:10px;">Equipment</div>`;
  const equipGrid = document.createElement("div");
  Object.assign(equipGrid.style, {
    display: "grid",
    gridTemplateColumns: "repeat(2, 52px)",
    gap: "10px",
    alignContent: "start",
  });

  const equipSlots: EquipSlot[] = ["head", "chest", "legs", "feet", "offhand"];
  const equipEls = new Map<EquipSlot, HTMLDivElement>();

  for (const slotName of equipSlots) {
    const slotEl = makeSlotEl();
    slotEl.title = slotName;
    slotEl.style.outline = "2px solid rgba(255,215,0,0.15)";

    slotEl.addEventListener("click", () => {
      const st = inventoryStore.getState();
      if (!held) {
        // pick up from equipment if exists
        if (st.equipment[slotName]) held = { area: "equipment", slot: slotName };
      } else {
        // place/swap into equipment
        inventoryStore.getState().moveItem(held, { area: "equipment", slot: slotName });
        held = null;
      }
      render();
    });

    equipGrid.appendChild(slotEl);
    equipEls.set(slotName, slotEl);
  }

  left.appendChild(equipGrid);

  // Inventory column
  const right = document.createElement("div");
  right.innerHTML = `<div style="font-size:18px;margin-bottom:10px;">Inventory</div>`;

  const invGrid = document.createElement("div");
  Object.assign(invGrid.style, {
    display: "grid",
    gridTemplateColumns: "repeat(9, 52px)",
    gap: "8px",
  });

  const invEls: HTMLDivElement[] = [];
  for (let i = 0; i < 27; i++) {
    const slotEl = makeSlotEl();
    slotEl.addEventListener("click", () => {
      const st = inventoryStore.getState();
      if (!held) {
        if (st.inventory[i]) held = { area: "inventory", index: i };
      } else {
        inventoryStore.getState().moveItem(held, { area: "inventory", index: i });
        held = null;
      }
      render();
    });
    invEls.push(slotEl);
    invGrid.appendChild(slotEl);
  }

  // Hotbar row inside the panel
  const hotbarRow = document.createElement("div");
  hotbarRow.style.marginTop = "14px";
  hotbarRow.innerHTML = `<div style="font-size:18px;margin:10px 0;">Hotbar</div>`;

  const hotbarGrid = document.createElement("div");
  Object.assign(hotbarGrid.style, {
    display: "grid",
    gridTemplateColumns: "repeat(9, 52px)",
    gap: "8px",
  });

  const hotEls: HTMLDivElement[] = [];
  for (let i = 0; i < 9; i++) {
    const slotEl = makeSlotEl();
    slotEl.addEventListener("click", () => {
      const st = inventoryStore.getState();
      if (!held) {
        if (st.hotbar[i]) held = { area: "hotbar", index: i };
      } else {
        inventoryStore.getState().moveItem(held, { area: "hotbar", index: i });
        held = null;
      }
      render();
    });
    hotEls.push(slotEl);
    hotbarGrid.appendChild(slotEl);
  }

  hotbarRow.appendChild(hotbarGrid);

  right.appendChild(invGrid);
  right.appendChild(hotbarRow);

  panel.appendChild(left);
  panel.appendChild(right);
  root.appendChild(panel);
  document.body.appendChild(root);

  // Close when clicking backdrop
  root.addEventListener("click", (e) => {
    if (e.target === root) inventoryStore.getState().toggleOpen();
  });

  const renderSlot = (el: HTMLDivElement, item: any, selected = false) => {
    el.innerHTML = "";
    el.style.borderColor = selected ? "rgba(255,215,0,0.9)" : "rgba(255,255,255,0.25)";

    if (!item) return;

    const label = document.createElement("div");
    label.textContent = itemLabel(item.id);
    el.appendChild(label);

    const count = document.createElement("div");
    count.textContent = String(item.count);
    Object.assign(count.style, {
      position: "absolute",
      right: "6px",
      bottom: "4px",
      fontSize: "12px",
      opacity: "0.9",
    });
    el.appendChild(count);
  };

  const render = () => {
    const st = inventoryStore.getState();
    root.style.display = st.isOpen ? "flex" : "none";

    // equipment
    for (const slot of equipSlots) {
      renderSlot(equipEls.get(slot)!, st.equipment[slot]);
    }

    // inventory
    for (let i = 0; i < st.inventory.length; i++) {
      renderSlot(invEls[i], st.inventory[i]);
    }

    // hotbar
    for (let i = 0; i < st.hotbar.length; i++) {
      renderSlot(hotEls[i], st.hotbar[i], i === st.selectedSlot);
    }

    // show what you're holding in the title bar (simple feedback)
    panel.dataset.held = held ? JSON.stringify(held) : "";
  };

  // subscribe to store updates
  inventoryStore.subscribe(() => render());
  render();

  return { render };
}
