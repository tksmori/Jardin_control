import { useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, Search } from "lucide-react";
import type { InventoryState, Movement } from "../types/inventory";
import { labels } from "../lib/format";
import { downloadCSV } from "../lib/import";
import { Heading } from "../components/Heading";
import { MovementTable } from "../components/MovementTable";

export function HistoryPage({
  state,
  onCorrect,
}: {
  state: InventoryState;
  onCorrect: (m: Movement) => void;
}) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const [query, setQuery] = useState(""),
    [type, setType] = useState(""),
    [loc, setLoc] = useState(params.get("ubicacion") ?? "");
  const list = state.movements.filter(
    (m) =>
      (!query ||
        state.materials
          .find((x) => x.id === m.materialId)
          ?.name.toLowerCase()
          .includes(query.toLowerCase())) &&
      (!type || m.type === type) &&
      (!params.has("junji") ||
        state.materials.find((x) => x.id === m.materialId)?.junji) &&
      (!params.has("salas") ||
        [
          m.sourceId,
          m.destinationId,
          ...(m.deliveries ?? []).map((d) => d.locationId),
        ].some((id) =>
          state.locations.some((l) => l.id === id && l.kind === "sala"),
        )) &&
      (!loc ||
        m.sourceId === loc ||
        m.destinationId === loc ||
        m.deliveries?.some((d) => d.locationId === loc)),
  );
  return (
    <>
      <Heading
        eyebrow="TRAZABILIDAD"
        title="Historial de movimientos"
        text="Cada ingreso, consumo, traslado y reposición queda registrado."
      >
        <button
          onClick={() =>
            downloadCSV(
              "jardincontrol-movimientos.csv",
              list.flatMap((m) =>
                (m.deliveries?.length
                  ? m.deliveries
                  : [{ locationId: m.destinationId, quantity: m.quantity }]
                ).map((d) => ({
                  id: m.id,
                  material: state.materials.find((x) => x.id === m.materialId)
                    ?.name,
                  unidad: state.materials.find((x) => x.id === m.materialId)
                    ?.unit,
                  tipo: labels[m.type],
                  cantidad: d.quantity,
                  origen:
                    state.locations.find((l) => l.id === m.sourceId)?.name ??
                    "",
                  destino:
                    state.locations.find((l) => l.id === d.locationId)?.name ??
                    "",
                  fecha: m.occurredAt,
                  registrado: m.recordedAt,
                  usuario: m.user,
                  observacion: m.notes,
                  compensa: m.compensatesId ?? "",
                })),
              ),
            )
          }
        >
          <Download size={17} />
          Exportar historial
        </button>
      </Heading>
      <section className="panel">
        <div className="inventory-tools">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Buscar en historial"
              placeholder="Buscar material…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <select
            aria-label="Tipo de movimiento"
            value={type}
            onChange={(e) => setType(e.target.value)}
          >
            <option value="">Todos los movimientos</option>
            {Object.entries(labels).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
          <select
            aria-label="Ubicación del historial"
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
          >
            <option value="">Todas las ubicaciones</option>
            {state.locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <MovementTable state={state} movements={list} onCorrect={onCorrect} />
      </section>
      <p className="hint">
        Para corregir, registra un movimiento compensatorio con una observación.
        El original se conserva. Verifica material, cantidad, origen y destino
        antes de confirmar.
      </p>
    </>
  );
}
