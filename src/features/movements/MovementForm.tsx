import { useState, type FormEvent } from "react";
import { Check } from "lucide-react";
import type {
  InventoryState,
  MovementType,
  MovementInput,
} from "../../types/inventory";
import { stock, round, validateQuantity } from "../../lib/engine";
import { fmt, nowLocal, message, labels } from "../../lib/format";
import { Modal } from "../../components/Modal";

export function MovementForm({
  state,
  serverError,
  initialType,
  selectedId,
  compensatesId,
  busy,
  close,
  save,
}: {
  state: InventoryState;
  serverError: string;
  initialType: MovementType;
  selectedId: string;
  compensatesId: string | null;
  busy: boolean;
  close: () => void;
  save: (i: MovementInput) => void;
}) {
  const original = state.movements.find((m) => m.id === compensatesId);
  const [type, setType] = useState(initialType),
    [id, setId] = useState(selectedId),
    [source, setSource] = useState(
      original?.type === "traslado"
        ? (original.destinationId ?? "bodega")
        : (original?.destinationId ?? "bodega"),
    ),
    [dest, setDest] = useState(original?.sourceId ?? "sala-1"),
    [qty, setQty] = useState(original ? String(original.quantity) : ""),
    [deliveries, setDeliveries] = useState<Record<string, string>>({}),
    [error, setError] = useState(""),
    [pending, setPending] = useState<MovementInput | null>(null);
  const material = state.materials.find((m) => m.id === id);
  const inventoryLocations = state.locations.filter(
      (l) => l.kind !== "consumo",
    ),
    targets = state.locations.filter(
      (l) => l.kind === "sala" || l.kind === "consumo",
    );
  const sum = round(
    Object.values(deliveries).reduce((s, v) => s + Number(v), 0),
  );
  const available = stock(state, id, type === "reposicion" ? "bodega" : source);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    const input: MovementInput = {
      materialId: id,
      type,
      quantity: type === "reposicion" ? sum : Number(qty),
      sourceId:
        type === "ingreso" ? null : type === "reposicion" ? "bodega" : source,
      destinationId: type === "ingreso" || type === "traslado" ? dest : null,
      occurredAt: new Date(String(d.get("date"))).toISOString(),
      notes: String(d.get("notes")),
      compensatesId,
      deliveries:
        type === "reposicion"
          ? targets
              .map((l) => ({
                locationId: l.id,
                quantity: Number(deliveries[l.id] ?? 0),
              }))
              .filter((d) => d.quantity > 0)
          : undefined,
    };
    try {
      if (!material) throw new Error("Selecciona un material.");
      validateQuantity(material, input.quantity);
      if (type !== "ingreso" && input.quantity > available)
        throw new Error("La cantidad supera el stock disponible.");
      if (type === "traslado" && source === dest)
        throw new Error("Selecciona un destino diferente del origen.");
      setError("");
      setPending(input);
    } catch (e) {
      setError(message(e));
    }
  }
  return (
    <Modal
      title={
        pending
          ? "Confirmar movimiento"
          : type === "reposicion"
            ? "Registrar reposición"
            : compensatesId
              ? "Movimiento compensatorio"
              : "Registrar movimiento"
      }
      onClose={close}
    >
      {serverError && (
        <p role="alert" className="error-text">
          {serverError}
        </p>
      )}
      {pending ? (
        <>
          <div className="confirmation">
            <Check size={28} />
            <h3>
              {labels[pending.type]} de {fmt(pending.quantity)} {material?.unit}
            </h3>
            <p>{material?.name}</p>
            <p>
              {state.locations.find((l) => l.id === pending.sourceId)?.name ??
                "Ingreso externo"}{" "}
              →{" "}
              {state.locations.find((l) => l.id === pending.destinationId)
                ?.name ??
                (type === "reposicion" ? "Consumo en destinos" : "Consumo")}
            </p>
            {pending.deliveries?.map((d) => (
              <p key={d.locationId}>
                {state.locations.find((l) => l.id === d.locationId)?.name}:{" "}
                <b>{fmt(d.quantity)}</b>
              </p>
            ))}
            <p className="hint">{pending.notes}</p>
          </div>
          <div className="form-actions">
            <button disabled={busy} onClick={() => setPending(null)}>
              Volver
            </button>
            <button
              className="primary"
              disabled={busy}
              onClick={() => save(pending)}
            >
              {busy ? "Guardando…" : "Confirmar y guardar"}
            </button>
          </div>
        </>
      ) : (
        <form onSubmit={submit}>
          {compensatesId && (
            <p className="info-banner">
              Corrige el movimiento {compensatesId.slice(0, 8)}. Revisa la
              operación inversa; no se borrará el original.
            </p>
          )}
          <div className="form-grid">
            <label>
              Tipo
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as MovementType);
                  if (e.target.value === "reposicion" && !material?.consumable)
                    setId(state.materials.find((m) => m.consumable)?.id ?? "");
                  setPending(null);
                }}
              >
                {Object.entries(labels).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Fecha y hora
              <input
                name="date"
                type="datetime-local"
                defaultValue={nowLocal()}
                max={nowLocal()}
                required
              />
            </label>
          </div>
          <label>
            Material
            <select
              value={id}
              onChange={(e) => {
                setId(e.target.value);
                setDeliveries({});
              }}
              required
            >
              <option value="">Selecciona un material</option>
              {state.materials
                .filter((m) => type !== "reposicion" || m.consumable)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} ({m.unit})
                  </option>
                ))}
            </select>
          </label>
          {type !== "ingreso" && type !== "reposicion" && (
            <label>
              Origen
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {inventoryLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {(type === "ingreso" || type === "traslado") && (
            <label>
              Destino
              <select value={dest} onChange={(e) => setDest(e.target.value)}>
                {inventoryLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {type !== "ingreso" && (
            <div className="stock-summary">
              <span>
                Stock {type === "reposicion" ? "en bodega" : "disponible"}
              </span>
              <b>
                {fmt(available)} {material?.unit}
              </b>
            </div>
          )}
          {type === "reposicion" ? (
            <>
              <p className="hint">
                Entrega de consumibles para uso: se descuenta de bodega y no se
                suma al inventario de destino. Para redistribuir existencias
                utiliza Traslado.
              </p>
              <div className="destinations">
                {targets.map((l) => (
                  <label key={l.id}>
                    {l.name}
                    <input
                      aria-label={`Cantidad para ${l.name}`}
                      type="number"
                      min="0"
                      step={
                        material &&
                        ["unidad", "rollo", "paquete"].includes(material.unit)
                          ? "1"
                          : "0.001"
                      }
                      placeholder="0"
                      value={deliveries[l.id] ?? ""}
                      onChange={(e) =>
                        setDeliveries({ ...deliveries, [l.id]: e.target.value })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="stock-summary">
                <span>
                  Total entregado <b>{fmt(sum)}</b>
                </span>
                <span>
                  Stock restante{" "}
                  <b className={available - sum < 0 ? "error-text" : ""}>
                    {fmt(round(available - sum))}
                  </b>
                </span>
              </div>
            </>
          ) : (
            <label>
              Cantidad ({material?.unit ?? "selecciona material"})
              <input
                type="number"
                min={
                  material &&
                  ["unidad", "rollo", "paquete"].includes(material.unit)
                    ? "1"
                    : "0.001"
                }
                step={
                  material &&
                  ["unidad", "rollo", "paquete"].includes(material.unit)
                    ? "1"
                    : "0.001"
                }
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
              />
            </label>
          )}
          <label>
            Observación{compensatesId ? " (obligatoria)" : ""}
            <textarea
              name="notes"
              maxLength={1000}
              required={!!compensatesId}
            />
          </label>
          {error && (
            <p className="error-text" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <button type="button" onClick={close}>
              Cancelar
            </button>
            <button className="primary" disabled={busy || !material}>
              Revisar movimiento
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}
