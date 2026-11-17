import { describe, expect, it } from "vitest";
import { demoData } from "../data/demo";
import { applyMovement, stock } from "../lib/engine";
import type { InventoryState, MovementInput } from "../types/inventory";
function move(s: InventoryState, input: Partial<MovementInput>) {
  return applyMovement(s, {
    materialId: "confort",
    type: "ingreso",
    quantity: 5,
    sourceId: null,
    destinationId: "bodega",
    occurredAt: new Date().toISOString(),
    notes: "Prueba",
    ...input,
  });
}
describe("Motor de inventario", () => {
  it("los ingresos aumentan stock y registran responsable", () => {
    const s = move(demoData(), {});
    expect(stock(s, "confort", "bodega")).toBe(105);
    expect(s.movements[0].user).toBe("Marité · Demo");
  });
  it("los consumos disminuyen stock sin mutar el original", () => {
    const original = demoData();
    const s = move(original, {
      type: "consumo",
      sourceId: "bodega",
      destinationId: null,
    });
    expect(stock(s, "confort")).toBe(95);
    expect(stock(original, "confort")).toBe(100);
  });
  it("los traslados conservan stock total", () => {
    const s = move(demoData(), {
      type: "traslado",
      sourceId: "bodega",
      destinationId: "sala-1",
    });
    expect(stock(s, "confort")).toBe(100);
    expect(stock(s, "confort", "sala-1")).toBe(5);
    expect(stock(s, "confort", "bodega")).toBe(95);
  });
  it("repone exactamente diez destinos: 14 + 12 = 26", () => {
    const initial = demoData();
    const deliveries = initial.locations
      .filter((l) => l.kind === "sala" || l.kind === "consumo")
      .map((l) => ({ locationId: l.id, quantity: l.kind === "sala" ? 2 : 4 }));
    const s = move(initial, {
      type: "reposicion",
      sourceId: "bodega",
      destinationId: null,
      quantity: 26,
      deliveries,
    });
    expect(deliveries).toHaveLength(10);
    expect(new Set(deliveries.map((d) => d.locationId)).size).toBe(10);
    expect(stock(s, "confort", "bodega")).toBe(74);
    expect(stock(s, "confort", "sala-1")).toBe(0);
    expect(s.movements[0].deliveries).toEqual(deliveries);
  });
  it("rechaza retiros por encima del stock y permite retirar todo", () => {
    expect(() =>
      move(demoData(), {
        type: "consumo",
        sourceId: "bodega",
        destinationId: null,
        quantity: 101,
      }),
    ).toThrow(/supera/);
    expect(
      stock(
        move(demoData(), {
          type: "consumo",
          sourceId: "bodega",
          destinationId: null,
          quantity: 100,
        }),
        "confort",
      ),
    ).toBe(0);
  });
  it("mantiene separadas las existencias de las salas", () => {
    const s = move(demoData(), { destinationId: "sala-1" });
    expect(stock(s, "confort", "sala-1")).toBe(5);
    expect(stock(s, "confort", "sala-2")).toBe(0);
  });
  it("rechaza decimales en rollos y admite litros", () => {
    expect(() => move(demoData(), { quantity: 0.5 })).toThrow(/enteras/);
    expect(
      stock(
        move(demoData(), { materialId: "jabon", quantity: 0.125 }),
        "jabon",
      ),
    ).toBe(3.625);
  });
  it("rechaza cantidades no finitas, cero, negativas y más de tres decimales", () => {
    for (const quantity of [NaN, Infinity, 0, -1, 0.0001])
      expect(() => move(demoData(), { quantity })).toThrow();
  });
  it("rechaza destinos repetidos, totales incorrectos y baños como inventario", () => {
    expect(() => move(demoData(), { destinationId: "bano-1" })).toThrow();
    expect(() =>
      move(demoData(), {
        type: "reposicion",
        sourceId: "bodega",
        destinationId: null,
        quantity: 5,
        deliveries: [{ locationId: "sala-1", quantity: 2 }],
      }),
    ).toThrow(/total/i);
    expect(() =>
      move(demoData(), {
        type: "reposicion",
        sourceId: "bodega",
        destinationId: null,
        quantity: 4,
        deliveries: [
          { locationId: "sala-1", quantity: 2 },
          { locationId: "sala-1", quantity: 2 },
        ],
      }),
    ).toThrow(/duplicados/);
  });
  it("JUNJI conserva una única existencia entre módulos", () => {
    const initial = demoData();
    const total = stock(initial, "bloques");
    const s = move(initial, {
      materialId: "bloques",
      type: "traslado",
      sourceId: "bodega",
      destinationId: "sala-2",
    });
    expect(stock(s, "bloques")).toBe(total);
    expect(s.materials.filter((m) => m.id === "bloques")).toHaveLength(1);
  });
  it("rechaza traslados al mismo lugar y fechas futuras", () => {
    expect(() =>
      move(demoData(), {
        type: "traslado",
        sourceId: "bodega",
        destinationId: "bodega",
      }),
    ).toThrow();
    expect(() =>
      move(demoData(), { occurredAt: "2099-01-01T00:00:00Z" }),
    ).toThrow(/Fecha/);
  });
  it("mantiene siete salas y tres baños sin mezclarlos", () => {
    const s = demoData();
    expect(s.locations.filter((l) => l.kind === "sala")).toHaveLength(7);
    expect(s.locations.filter((l) => l.kind === "consumo")).toHaveLength(3);
  });
  it("conserva el movimiento original al compensar", () => {
    const initial = demoData();
    const original = initial.movements.find((m) => m.materialId === "confort")!;
    const s = move(initial, {
      type: "consumo",
      sourceId: "bodega",
      destinationId: null,
      quantity: 1,
      compensatesId: original.id,
    });
    expect(s.movements).toContainEqual(original);
    expect(s.movements[0].compensatesId).toBe(original.id);
  });
});
