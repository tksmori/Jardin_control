export const ROOM_NAMES = [
  "Sala cuna menor",
  "Sala cuna mayor A",
  "Sala cuna mayor B",
  "Medio menor A",
  "Medio menor B",
  "Medio mayor A",
  "Medio mayor B",
] as const;
export const UNITS = [
  "unidad",
  "rollo",
  "paquete",
  "litro",
  "kg",
  "metro",
] as const;
export type Unit = (typeof UNITS)[number];
export interface Location {
  id: string;
  name: string;
  kind: "sala" | "bodega" | "comedor" | "oficina" | "consumo";
}
export interface Category {
  id: string;
  name: string;
}
export interface Material {
  id: string;
  name: string;
  categoryId: string;
  unit: Unit;
  minimum: number;
  junji: boolean;
  consumable: boolean;
  notes: string;
}
export interface Balance {
  materialId: string;
  locationId: string;
  quantity: number;
}
export type MovementType = "ingreso" | "consumo" | "traslado" | "reposicion";
export interface MovementInput {
  materialId: string;
  type: MovementType;
  quantity: number;
  sourceId: string | null;
  destinationId: string | null;
  occurredAt: string;
  notes: string;
  deliveries?: { locationId: string; quantity: number }[];
  compensatesId?: string | null;
}
export interface Movement extends MovementInput {
  id: string;
  user: string;
  recordedAt: string;
}
export interface InventoryState {
  materials: Material[];
  categories: Category[];
  locations: Location[];
  balances: Balance[];
  movements: Movement[];
}
export interface ImportRow {
  name: string;
  categoryId: string;
  unit: Unit;
  locationId: string;
  quantity: number;
  minimum: number;
  junji: boolean;
  consumable: boolean;
  notes: string;
}
export interface InventoryRepository {
  load(): Promise<InventoryState>;
  addMaterial(material: Omit<Material, "id">): Promise<void>;
  move(input: MovementInput): Promise<void>;
  importInitial(rows: ImportRow[]): Promise<void>;
  reset?(): Promise<void>;
}
