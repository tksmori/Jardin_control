import { createClient } from "@supabase/supabase-js";
import type {
  ImportRow,
  InventoryRepository,
  InventoryState,
  Material,
  MovementInput,
} from "../types/inventory";
export const hasConfig = Boolean(
  import.meta.env.VITE_SUPABASE_URL &&
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const isDemo =
  import.meta.env.VITE_DEMO_MODE === "true" ||
  (import.meta.env.DEV && !hasConfig);
export const supabase = hasConfig
  ? createClient(
      import.meta.env.VITE_SUPABASE_URL,
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    )
  : null;
export class SupabaseRepository implements InventoryRepository {
  async load(): Promise<InventoryState> {
    const { data, error } = await supabase!.rpc("inventory_snapshot");
    if (error) throw error;
    return data as InventoryState;
  }
  async addMaterial(material: Omit<Material, "id">) {
    const { error } = await supabase!.rpc("create_material", {
      p_material: material,
    });
    if (error) throw error;
  }
  async move(input: MovementInput) {
    const { error } = await supabase!.rpc("record_movement", {
      p_input: input,
    });
    if (error) throw error;
  }
  async importInitial(rows: ImportRow[]) {
    const { error } = await supabase!.rpc("import_initial", { p_rows: rows });
    if (error) throw error;
  }
}
