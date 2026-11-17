import { useState } from "react";
import { Download } from "lucide-react";
import {
  UNITS,
  type InventoryState,
  type ImportRow,
} from "../../types/inventory";
import { fmt, message } from "../../lib/format";
import { parseImport, downloadCSV } from "../../lib/import";
import { Modal } from "../../components/Modal";

export function ImportForm({
  state,
  serverError,
  busy,
  close,
  save,
}: {
  state: InventoryState;
  serverError: string;
  busy: boolean;
  close: () => void;
  save: (rows: ImportRow[]) => void;
}) {
  const [preview, setPreview] = useState<{
      rows: ImportRow[];
      errors: string[];
    } | null>(null),
    [error, setError] = useState(""),
    [reading, setReading] = useState(false),
    [confirmed, setConfirmed] = useState(false);
  async function read(file?: File) {
    if (!file) return;
    setReading(true);
    setPreview(null);
    setError("");
    setConfirmed(false);
    try {
      setPreview(await parseImport(file, state));
    } catch (e) {
      setError(message(e));
    } finally {
      setReading(false);
    }
  }
  return (
    <Modal title="Importar inventario inicial" onClose={close}>
      {serverError && (
        <p role="alert" className="error-text">
          {serverError}
        </p>
      )}
      <p>
        Agrega materiales nuevos y sus ingresos iniciales. No reemplaza
        existencias. Los duplicados se rechazan.
      </p>
      <button
        onClick={() =>
          downloadCSV("plantilla-jardincontrol.csv", [
            {
              material: "Material nuevo",
              categoria: "Aseo e higiene",
              unidad: "rollo",
              ubicacion: "Bodega",
              cantidad: 10,
              minimo: 2,
              junji: "no",
              consumible: "sí",
              observaciones: "Ejemplo: reemplaza esta fila",
            },
          ])
        }
      >
        <Download size={16} />
        Descargar plantilla CSV
      </button>
      <label>
        Archivo CSV o XLSX (hasta 5 MB)
        <input
          type="file"
          accept=".csv,.xlsx"
          disabled={reading}
          onChange={(e) => void read(e.target.files?.[0])}
        />
      </label>
      <p className="hint">
        Una fila por material nuevo. Unidades: {UNITS.join(", ")}. Encabezados
        XLSX iguales a la plantilla, en minúsculas.
      </p>
      {reading && <p>Validando archivo…</p>}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}
      {preview && (
        <>
          <h3>Previsualización · {preview.rows.length} filas válidas</h3>
          <div className="import-preview">
            <table>
              <thead>
                <tr>
                  <th>Material</th>
                  <th>Ubicación</th>
                  <th>Cantidad</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((r, i) => (
                  <tr key={i}>
                    <td>{r.name}</td>
                    <td>
                      {state.locations.find((l) => l.id === r.locationId)?.name}
                    </td>
                    <td>
                      {fmt(r.quantity)} {r.unit}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.errors.map((e, i) => (
            <p className="error-text" key={i}>
              {e}
            </p>
          ))}
          {!preview.errors.length && (
            <label className="checkbox">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
              />
              Confirmo agregar estos materiales y registrar sus ingresos.
            </label>
          )}
        </>
      )}
      <div className="form-actions">
        <button onClick={close}>Cancelar</button>
        <button
          className="primary"
          disabled={
            busy ||
            reading ||
            !confirmed ||
            !preview?.rows.length ||
            !!preview.errors.length
          }
          onClick={() => preview && save(preview.rows)}
        >
          Importar y registrar
        </button>
      </div>
    </Modal>
  );
}
