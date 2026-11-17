import type { InventoryState, Movement } from "../types/inventory";
import { fmt, date, labels } from "../lib/format";

export function MovementTable({
  state,
  movements,
  compact = false,
  onCorrect,
}: {
  state: InventoryState;
  movements: Movement[];
  compact?: boolean;
  onCorrect?: (m: Movement) => void;
}) {
  const name = (id: string | null) =>
    state.locations.find((l) => l.id === id)?.name ?? "—";
  return (
    <div className="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Material</th>
            <th>Movimiento</th>
            <th className="numeric">Cantidad</th>
            {!compact && (
              <>
                <th>Origen → destino</th>
                <th>Responsable / observación</th>
              </>
            )}
            <th>Fecha (Chile)</th>
            {onCorrect && <th>Corrección</th>}
          </tr>
        </thead>
        <tbody>
          {movements.map((m) => (
            <tr key={m.id}>
              <td>
                <strong>
                  {state.materials.find((x) => x.id === m.materialId)?.name ??
                    "Material"}
                </strong>
                {!compact && (
                  <small title={m.id}>
                    {m.id.slice(0, 8)}
                    {m.compensatesId
                      ? ` · Corrige ${m.compensatesId.slice(0, 8)}`
                      : ""}
                  </small>
                )}
              </td>
              <td>
                <span className={`movement-badge ${m.type}`}>
                  {labels[m.type]}
                </span>
              </td>
              <td className="numeric">
                {fmt(m.quantity)}{" "}
                <small>
                  {state.materials.find((x) => x.id === m.materialId)?.unit}
                </small>
              </td>
              {!compact && (
                <>
                  <td>
                    {name(m.sourceId)} →{" "}
                    {m.type === "reposicion" ? (
                      <div>
                        {m.deliveries?.map((d) => (
                          <small key={d.locationId}>
                            {name(d.locationId)}: {fmt(d.quantity)}
                          </small>
                        ))}
                      </div>
                    ) : (
                      name(m.destinationId)
                    )}
                  </td>
                  <td>
                    {m.user}
                    <small>{m.notes}</small>
                    <small>Registro: {date(m.recordedAt)}</small>
                  </td>
                </>
              )}
              <td className="nowrap">{date(m.occurredAt)}</td>
              {onCorrect && (
                <td>
                  <button onClick={() => onCorrect(m)}>Compensar</button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      {!movements.length && (
        <p className="empty">Sin movimientos registrados para este filtro.</p>
      )}
    </div>
  );
}
