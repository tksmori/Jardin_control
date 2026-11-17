import { describe, expect, it } from "vitest";
import { parseImport } from "../lib/import";
import { demoData } from "../data/demo";
const file = (body: string) =>
  new File([body], "inventario.csv", { type: "text/csv" });
const header =
  "material;categoria;unidad;ubicacion;cantidad;minimo;junji;consumible\n";
describe("Importación CSV", () => {
  it("valida una fila con cantidad decimal y clasifica JUNJI", async () => {
    const p = await parseImport(
      file(header + "Detergente;aseo;litro;bodega;2,5;1;sí;sí"),
      demoData(),
    );
    expect(p.errors).toEqual([]);
    expect(p.rows[0]).toMatchObject({ quantity: 2.5, junji: true });
  });
  it("rechaza duplicados existentes y dentro del archivo", async () => {
    const p = await parseImport(
      file(
        header +
          "Papel higiénico;aseo;rollo;bodega;1;0;no;sí\nNuevo;aseo;rollo;bodega;2;0;no;sí\nNuevo;aseo;rollo;bodega;2;0;no;sí",
      ),
      demoData(),
    );
    expect(p.errors).toHaveLength(2);
  });
  it("rechaza unidad inválida, decimal por pieza, negativo, cantidad vacía y baño", async () => {
    for (const row of [
      "Nuevo;aseo;caja;bodega;1;0;no;sí",
      "Nuevo;aseo;unidad;bodega;1,5;0;no;sí",
      "Nuevo;aseo;litro;bodega;-1;0;no;sí",
      "Nuevo;aseo;litro;bodega;;0;no;sí",
      "Nuevo;aseo;litro;bano-1;1;0;no;sí",
    ]) {
      const p = await parseImport(file(header + row), demoData());
      expect(p.errors).toHaveLength(1);
    }
  });
});
