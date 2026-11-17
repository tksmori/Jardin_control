import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import {
  UNITS,
  type ImportRow,
  type InventoryState,
  type Unit,
} from "../types/inventory";
import { validateMaterial, validateQuantity } from "./engine";
export async function parseImport(
  file: File,
  state: InventoryState,
): Promise<{ rows: ImportRow[]; errors: string[] }> {
  let records: Record<string, unknown>[];
  if (file.size > 5 * 1024 * 1024)
    throw new Error("El archivo no puede superar 5 MB.");
  if (file.name.toLowerCase().endsWith(".xlsx")) {
    const data = await readSheet(file);
    const headers = (data.shift() ?? []).map(String);
    records = data.map((row) =>
      Object.fromEntries(headers.map((h, i) => [h, row[i] ?? ""])),
    );
  } else if (file.name.toLowerCase().endsWith(".csv")) {
    const parsed = Papa.parse<Record<string, string>>(await file.text(), {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: (h) =>
        h
          .replace(/^\uFEFF/, "")
          .trim()
          .toLowerCase(),
    });
    if (parsed.errors.length)
      throw new Error("CSV inválido: " + parsed.errors[0].message);
    records = parsed.data;
  } else throw new Error("Selecciona un archivo CSV o XLSX.");
  if (!records.length || records.length > 1000)
    throw new Error("Se requieren entre 1 y 1.000 filas.");
  const errors: string[] = [];
  const rows: ImportRow[] = [];
  const names = new Set(
    state.materials.map((m) => m.name.trim().toLocaleLowerCase("es")),
  );
  records.forEach((r, index) => {
    try {
      const get = (key: string) => String(r[key] ?? "").trim();
      const boolean = (key: string) => {
        const v = get(key).toLowerCase();
        if (!["", "no", "false", "sí", "si", "true"].includes(v))
          throw new Error(`${key}: usa sí o no.`);
        return ["sí", "si", "true"].includes(v);
      };
      const numeric = (key: string, optional = false) => {
        const v = get(key);
        if (!v && !optional) throw new Error(`Falta ${key}.`);
        return v ? Number(v.replace(",", ".")) : 0;
      };
      const category = state.categories.find(
        (c) => c.name === get("categoria") || c.id === get("categoria"),
      );
      const location = state.locations.find(
        (l) =>
          (l.name === get("ubicacion") || l.id === get("ubicacion")) &&
          l.kind !== "consumo",
      );
      const row: ImportRow = {
        name: get("material"),
        categoryId: category?.id ?? "",
        unit: get("unidad") as Unit,
        locationId: location?.id ?? "",
        quantity: numeric("cantidad"),
        minimum: numeric("minimo", true),
        junji: boolean("junji"),
        consumable: boolean("consumible"),
        notes: get("observaciones"),
      };
      if (!category || !location || !UNITS.includes(row.unit))
        throw new Error("Categoría, ubicación o unidad desconocida.");
      validateMaterial(row);
      validateQuantity({ ...row, id: "" }, row.quantity, true);
      const key = row.name.toLocaleLowerCase("es");
      if (names.has(key))
        throw new Error(
          `Material duplicado: ${row.name}. Usa ingresos para materiales existentes.`,
        );
      names.add(key);
      rows.push(row);
    } catch (e) {
      errors.push(`Fila ${index + 2}: ${(e as Error).message}`);
    }
  });
  return { rows, errors };
}
export function downloadCSV(filename: string, rows: Record<string, unknown>[]) {
  const safe = rows.map((row) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === "string" && /^[\s]*[=+@-]/.test(value)
          ? `'${value}`
          : value,
      ]),
    ),
  );
  const blob = new Blob(
    ["\uFEFF" + Papa.unparse(safe, { delimiter: ";", newline: "\r\n" })],
    { type: "text/csv;charset=utf-8" },
  );
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
