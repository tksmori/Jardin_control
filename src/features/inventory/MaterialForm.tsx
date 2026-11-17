import { useState, type FormEvent } from "react";
import {
  UNITS,
  type InventoryState,
  type Material,
} from "../../types/inventory";
import { validateQuantity } from "../../lib/engine";
import { message } from "../../lib/format";
import { Modal } from "../../components/Modal";

export function MaterialForm({
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
  save: (m: Omit<Material, "id">) => void;
}) {
  const [error, setError] = useState("");
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const m: Omit<Material, "id"> = {
      name: String(d.get("name")).trim(),
      unit: d.get("unit") as Material["unit"],
      categoryId: String(d.get("category")),
      minimum: Number(d.get("minimum")),
      junji: d.has("junji"),
      consumable: d.has("consumable"),
      notes: String(d.get("notes")),
    };
    try {
      validateQuantity({ ...m, id: "" }, m.minimum, true);
      save(m);
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <Modal title="Agregar material" onClose={close}>
      {serverError && (
        <p role="alert" className="error-text">
          {serverError}
        </p>
      )}
      <form onSubmit={submit}>
        <p className="hint">
          Se agrega al catálogo con stock cero. Después registra su ingreso en
          la ubicación correspondiente.
        </p>
        <label>
          Nombre del material
          <input name="name" required maxLength={120} autoFocus />
        </label>
        <div className="form-grid">
          <label>
            Categoría
            <select name="category">
              {state.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            Unidad de medida
            <select name="unit">
              {UNITS.map((u) => (
                <option key={u}>{u}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Stock mínimo (total del material)
          <input
            type="number"
            name="minimum"
            min="0"
            step="0.001"
            defaultValue="0"
            required
          />
        </label>
        <label className="checkbox">
          <input type="checkbox" name="junji" />
          Origen JUNJI
        </label>
        <label className="checkbox">
          <input type="checkbox" name="consumable" defaultChecked />
          Consumible para uso o reposiciones
        </label>
        <label>
          Observaciones
          <textarea name="notes" maxLength={1000} />
        </label>
        {error && (
          <p role="alert" className="error-text">
            {error}
          </p>
        )}
        <div className="form-actions">
          <button type="button" onClick={close}>
            Cancelar
          </button>
          <button className="primary" disabled={busy}>
            Guardar material
          </button>
        </div>
      </form>
    </Modal>
  );
}
