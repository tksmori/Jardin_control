import type {
  ImportRow,
  InventoryRepository,
  InventoryState,
  Material,
  MovementInput,
} from "../types/inventory";
import { demoData } from "../data/demo";
import { applyMovement, validateMaterial } from "../lib/engine";
const KEY = "jardincontrol.demo.v1";
export class DemoRepository implements InventoryRepository {
  async load(): Promise<InventoryState> {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
    const s = demoData();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
  private save(s: InventoryState) {
    localStorage.setItem(KEY, JSON.stringify(s));
  }
  private async locked(action: () => Promise<void>) {
    if (navigator.locks) await navigator.locks.request(KEY, action);
    else await action();
  }
  async addMaterial(m: Omit<Material, "id">) {
    await this.locked(async () => {
      validateMaterial(m);
      const s = await this.load();
      if (
        s.materials.some(
          (x) =>
            x.name.trim().toLocaleLowerCase("es") ===
            m.name.trim().toLocaleLowerCase("es"),
        )
      )
        throw new Error("Ya existe un material con ese nombre.");
      s.materials.push({ ...m, name: m.name.trim(), id: crypto.randomUUID() });
      this.save(s);
    });
  }
  async move(input: MovementInput) {
    await this.locked(async () =>
      this.save(applyMovement(await this.load(), input)),
    );
  }
  async importInitial(rows: ImportRow[]) {
    await this.locked(async () => {
      let s = await this.load();
      for (const r of rows) {
        validateMaterial(r);
        if (
          s.materials.some(
            (m) =>
              m.name.toLocaleLowerCase("es") === r.name.toLocaleLowerCase("es"),
          )
        )
          throw new Error("Material duplicado.");
        const id = crypto.randomUUID();
        s.materials.push({
          id,
          name: r.name,
          categoryId: r.categoryId,
          unit: r.unit,
          minimum: r.minimum,
          junji: r.junji,
          consumable: r.consumable,
          notes: r.notes,
        });
        if (r.quantity > 0)
          s = applyMovement(s, {
            materialId: id,
            type: "ingreso",
            quantity: r.quantity,
            sourceId: null,
            destinationId: r.locationId,
            occurredAt: new Date().toISOString(),
            notes: "Importación de inventario inicial",
          });
      }
      this.save(s);
    });
  }
  async reset() {
    await this.locked(async () => this.save(demoData()));
  }
}
