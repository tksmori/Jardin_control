import type {
  InventoryState,
  Material,
  MovementInput,
} from "../types/inventory";
export const round = (n: number) => Math.round(n * 1000) / 1000;
export const stock = (
  state: InventoryState,
  materialId: string,
  locationId?: string,
) =>
  round(
    state.balances
      .filter(
        (b) =>
          b.materialId === materialId &&
          (!locationId || b.locationId === locationId),
      )
      .reduce((s, b) => s + b.quantity, 0),
  );
export function validateQuantity(
  material: Material,
  quantity: number,
  allowZero = false,
) {
  if (
    !Number.isFinite(quantity) ||
    (allowZero ? quantity < 0 : quantity <= 0) ||
    round(quantity) !== quantity
  )
    throw new Error(
      "La cantidad debe ser positiva y tener como máximo 3 decimales.",
    );
  if (
    ["unidad", "rollo", "paquete"].includes(material.unit) &&
    !Number.isInteger(quantity)
  )
    throw new Error("Esta unidad requiere cantidades enteras.");
}
export function validateMaterial(material: Omit<Material, "id">) {
  if (!material.name.trim() || material.name.length > 120)
    throw new Error("Ingresa un nombre de hasta 120 caracteres.");
  validateQuantity({ ...material, id: "" }, material.minimum, true);
}
export function applyMovement(
  current: InventoryState,
  input: MovementInput,
  user = "Marité · Demo",
): InventoryState {
  const state = structuredClone(current);
  const material = state.materials.find((m) => m.id === input.materialId);
  if (!material) throw new Error("Material inexistente.");
  validateQuantity(material, input.quantity);
  if (
    !Number.isFinite(Date.parse(input.occurredAt)) ||
    Date.parse(input.occurredAt) > Date.now() + 60000
  )
    throw new Error("Fecha inválida o futura.");
  if (!["ingreso", "consumo", "traslado", "reposicion"].includes(input.type))
    throw new Error("Tipo de movimiento inválido.");
  const location = (id: string | null, inventory = true) => {
    const l = state.locations.find((l) => l.id === id);
    if (!l || (inventory && l.kind === "consumo"))
      throw new Error("Ubicación de inventario inválida.");
    return l;
  };
  if (
    input.compensatesId &&
    !state.movements.some(
      (m) => m.id === input.compensatesId && m.materialId === input.materialId,
    )
  )
    throw new Error("Movimiento a corregir inexistente.");
  if (input.compensatesId && !input.notes.trim())
    throw new Error("Explica la corrección en la observación.");
  if (input.type === "ingreso") {
    if (input.sourceId) throw new Error("Un ingreso no tiene origen interno.");
    location(input.destinationId);
  } else location(input.sourceId);
  if (input.type === "traslado") {
    location(input.destinationId);
    if (input.sourceId === input.destinationId)
      throw new Error("El origen y destino deben ser distintos.");
  }
  if (input.type === "consumo" && input.destinationId)
    throw new Error("Un consumo no tiene destino de inventario.");
  if (input.type === "reposicion") {
    if (
      !material.consumable ||
      input.sourceId !== "bodega" ||
      input.destinationId
    )
      throw new Error("La reposición requiere un consumible de bodega.");
    const deliveries = input.deliveries ?? [];
    if (
      !deliveries.length ||
      new Set(deliveries.map((d) => d.locationId)).size !== deliveries.length
    )
      throw new Error("Destinos vacíos o duplicados.");
    for (const d of deliveries) {
      validateQuantity(material, d.quantity);
      if (!["sala", "consumo"].includes(location(d.locationId, false).kind))
        throw new Error("Destino de reposición inválido.");
    }
    if (
      round(deliveries.reduce((s, d) => s + d.quantity, 0)) !== input.quantity
    )
      throw new Error("El total no coincide con las entregas.");
  } else if (input.deliveries?.length)
    throw new Error("Solo una reposición tiene entregas.");
  if (
    input.type !== "ingreso" &&
    stock(state, input.materialId, input.sourceId!) < input.quantity
  )
    throw new Error("La cantidad supera el stock disponible.");
  const materialId = material.id;
  function change(id: string, delta: number) {
    let b = state.balances.find(
      (b) => b.materialId === materialId && b.locationId === id,
    );
    if (!b) {
      b = { materialId, locationId: id, quantity: 0 };
      state.balances.push(b);
    }
    b.quantity = round(b.quantity + delta);
  }
  if (input.type !== "ingreso") change(input.sourceId!, -input.quantity);
  if (input.type === "ingreso" || input.type === "traslado")
    change(input.destinationId!, input.quantity);
  state.movements.unshift({
    ...input,
    id: crypto.randomUUID(),
    user,
    recordedAt: new Date().toISOString(),
  });
  return state;
}
