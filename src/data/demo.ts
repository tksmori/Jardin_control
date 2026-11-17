import { ROOM_NAMES, type InventoryState } from "../types/inventory";
import { applyMovement } from "../lib/engine";
export function demoData(): InventoryState {
  let s: InventoryState = {
    categories: [
      { id: "aseo", name: "Aseo e higiene" },
      { id: "didactico", name: "Material didáctico" },
      { id: "fungible", name: "Material fungible" },
      { id: "cocina", name: "Utensilios" },
      { id: "administrativo", name: "Administrativo" },
    ],
    locations: [
      ...ROOM_NAMES.map((name, i) => ({
        id: `sala-${i + 1}`,
        name,
        kind: "sala" as const,
      })),
      { id: "bodega", name: "Bodega", kind: "bodega" },
      { id: "comedor", name: "Comedor", kind: "comedor" },
      { id: "oficina", name: "Oficina", kind: "oficina" },
      ...[1, 2, 3].map((i) => ({
        id: `bano-${i}`,
        name: `Baño ${i}`,
        kind: "consumo" as const,
      })),
    ],
    materials: [
      {
        id: "confort",
        name: "Papel higiénico",
        categoryId: "aseo",
        unit: "rollo",
        minimum: 25,
        junji: false,
        consumable: true,
        notes: "Confort para reposiciones",
      },
      {
        id: "toalla",
        name: "Toalla de papel",
        categoryId: "aseo",
        unit: "rollo",
        minimum: 12,
        junji: false,
        consumable: true,
        notes: "",
      },
      {
        id: "jabon",
        name: "Jabón líquido",
        categoryId: "aseo",
        unit: "litro",
        minimum: 5,
        junji: false,
        consumable: true,
        notes: "",
      },
      {
        id: "lapices",
        name: "Lápices de colores",
        categoryId: "fungible",
        unit: "unidad",
        minimum: 15,
        junji: true,
        consumable: true,
        notes: "Entrega JUNJI",
      },
      {
        id: "bloques",
        name: "Bloques de construcción",
        categoryId: "didactico",
        unit: "unidad",
        minimum: 5,
        junji: true,
        consumable: false,
        notes: "",
      },
      {
        id: "platos",
        name: "Platos infantiles",
        categoryId: "cocina",
        unit: "unidad",
        minimum: 20,
        junji: false,
        consumable: false,
        notes: "",
      },
      {
        id: "resmas",
        name: "Papel para impresora",
        categoryId: "administrativo",
        unit: "paquete",
        minimum: 3,
        junji: false,
        consumable: true,
        notes: "",
      },
    ],
    balances: [],
    movements: [],
  };
  const add = (materialId: string, quantity: number, destinationId: string) => {
    s = applyMovement(s, {
      materialId,
      type: "ingreso",
      quantity,
      sourceId: null,
      destinationId,
      occurredAt: new Date().toISOString(),
      notes: "Inventario inicial de demostración",
    });
  };
  add("confort", 100, "bodega");
  add("toalla", 8, "bodega");
  add("jabon", 3.5, "bodega");
  add("platos", 60, "comedor");
  add("resmas", 2, "oficina");
  add("bloques", 30, "bodega");
  for (let i = 1; i <= 7; i++) {
    add("lapices", 10 + i, `sala-${i}`);
    add("bloques", 6 + i, `sala-${i}`);
  }
  return s;
}
