import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowDownToLine,
  ArrowRightLeft,
  ArrowUpFromLine,
  Building2,
  Download,
  History,
  LayoutDashboard,
  Plus,
  Search,
  Sparkles,
  Upload,
} from "lucide-react";
import {
  UNITS,
  type InventoryState,
  type MovementType,
} from "../types/inventory";
import { stock, round } from "../lib/engine";
import { fmt } from "../lib/format";
import { downloadCSV } from "../lib/import";
import { navigation } from "../data/navigation";
import { Heading } from "../components/Heading";

export function Inventory({
  section,
  state,
  onAdd,
  onMove,
  onImport,
}: {
  section: string;
  state: InventoryState;
  onAdd: () => void;
  onMove: (t: MovementType, id?: string) => void;
  onImport: () => void;
}) {
  const [room, setRoom] = useState("all"),
    [search, setSearch] = useState(""),
    [category, setCategory] = useState(""),
    [onlyLow, setOnlyLow] = useState(false);
  const navigate = useNavigate();
  const isRooms = section === "salas",
    isJunji = section === "junji";
  const loc = isRooms
    ? room === "all"
      ? undefined
      : room
    : isJunji
      ? undefined
      : section;
  const materials = state.materials.filter(
    (m) =>
      (!isJunji || m.junji) &&
      (!search ||
        m.name
          .toLocaleLowerCase("es")
          .includes(search.toLocaleLowerCase("es"))) &&
      (!category || m.categoryId === category) &&
      (!onlyLow || stock(state, m.id, loc) <= m.minimum),
  );
  const rooms = state.locations.filter((l) => l.kind === "sala");
  const scope = state.locations.filter(
    (l) =>
      l.kind !== "consumo" &&
      (!isRooms || l.kind === "sala") &&
      (!loc || l.id === loc),
  );
  const total = (id: string) =>
    round(scope.reduce((sum, l) => sum + stock(state, id, l.id), 0));
  function exportInventory() {
    downloadCSV(
      `jardincontrol-${section}.csv`,
      materials.flatMap((m) =>
        scope.map((l) => ({
          material: m.name,
          categoria: state.categories.find((c) => c.id === m.categoryId)?.name,
          unidad: m.unit,
          ubicacion: l.name,
          cantidad: stock(state, m.id, l.id),
          minimo: m.minimum,
          junji: m.junji ? "sí" : "no",
          consumible: m.consumable ? "sí" : "no",
          observaciones: m.notes,
        })),
      ),
    );
  }
  return (
    <>
      <Heading
        eyebrow="INVENTARIO DEL JARDÍN"
        title={navigation.find((n) => n.path === `/${section}`)!.label}
        text={
          isJunji
            ? "Origen JUNJI, con existencias en su ubicación real."
            : isRooms
              ? "Cada sala con sus materiales. Una vista para verlos todos."
              : "Consulta existencias y registra cada ingreso, consumo o traslado."
        }
      >
        <button onClick={onImport}>
          <Upload size={17} />
          Importar
        </button>
        <button onClick={exportInventory}>
          <Download size={17} />
          Exportar
        </button>
        <button className="primary" onClick={onAdd}>
          <Plus size={18} />
          Agregar material
        </button>
      </Heading>
      {isRooms && (
        <div className="room-grid">
          <button
            className={room === "all" ? "selected" : ""}
            onClick={() => setRoom("all")}
          >
            <LayoutDashboard size={19} />
            <span>
              Vista general<small>Las siete salas</small>
            </span>
          </button>
          {rooms.map((l) => (
            <button
              className={room === l.id ? "selected" : ""}
              key={l.id}
              onClick={() => setRoom(l.id)}
            >
              <Building2 size={19} />
              <span>
                {l.name}
                <small>
                  {
                    state.balances.filter(
                      (b) => b.locationId === l.id && b.quantity > 0,
                    ).length
                  }{" "}
                  materiales con stock
                </small>
              </span>
            </button>
          ))}
        </div>
      )}
      {isJunji && (
        <div className="info-banner">
          <Sparkles size={20} />
          <p>
            JUNJI indica el origen del material. Las cantidades de esta vista
            son las mismas de salas, bodega, comedor y oficina.
          </p>
        </div>
      )}
      <section className="panel">
        <div className="inventory-tools">
          <div className="search">
            <Search size={18} />
            <input
              aria-label="Buscar materiales"
              placeholder="Buscar material…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            aria-label="Categoría"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {state.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={onlyLow}
              onChange={(e) => setOnlyLow(e.target.checked)}
            />{" "}
            Stock bajo
          </label>
          <span className="results-count">{materials.length} materiales</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Material / unidad</th>
                {isRooms && room === "all" ? (
                  rooms.map((l) => (
                    <th key={l.id} className="numeric room-col">
                      {l.name}
                    </th>
                  ))
                ) : isJunji ? (
                  <th>Ubicaciones con existencias</th>
                ) : (
                  <th>Categoría</th>
                )}
                <th className="numeric">
                  {isRooms && room === "all" ? "Total salas" : "Existencias"}
                </th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id}>
                  <td>
                    <strong>{m.name}</strong>
                    <small>
                      {m.unit}
                      {m.junji ? " · JUNJI" : ""}
                      {m.consumable ? " · Consumible" : ""}
                    </small>
                    {m.notes && <small>{m.notes}</small>}
                  </td>
                  {isRooms && room === "all" ? (
                    rooms.map((l) => (
                      <td className="numeric" key={l.id}>
                        {fmt(stock(state, m.id, l.id))}
                      </td>
                    ))
                  ) : isJunji ? (
                    <td className="locations-cell">
                      {state.balances
                        .filter((b) => b.materialId === m.id && b.quantity > 0)
                        .map(
                          (b) =>
                            `${state.locations.find((l) => l.id === b.locationId)?.name}: ${fmt(b.quantity)}`,
                        )
                        .join(" · ") || "Sin existencias"}
                    </td>
                  ) : (
                    <td>
                      {
                        state.categories.find((c) => c.id === m.categoryId)
                          ?.name
                      }
                    </td>
                  )}
                  <td className="numeric">
                    <strong>{fmt(total(m.id))}</strong>
                    {total(m.id) <= m.minimum && (
                      <span className="stock-low">Stock bajo</span>
                    )}
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        onClick={() => onMove("ingreso", m.id)}
                        title="Registrar ingreso"
                        aria-label={`Ingreso: ${m.name}`}
                      >
                        <ArrowDownToLine size={16} />
                      </button>
                      <button
                        onClick={() => onMove("consumo", m.id)}
                        title="Registrar consumo"
                        aria-label={`Consumo: ${m.name}`}
                      >
                        <ArrowUpFromLine size={16} />
                      </button>
                      <button
                        onClick={() => onMove("traslado", m.id)}
                        title="Trasladar"
                        aria-label={`Traslado: ${m.name}`}
                      >
                        <ArrowRightLeft size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!materials.length && (
            <p className="empty">
              No hay materiales que coincidan con los filtros.
            </p>
          )}
        </div>
        {isRooms && (
          <div className="unit-totals">
            <h3>Totales por unidad de medida</h3>
            {UNITS.filter((u) => materials.some((m) => m.unit === u)).map(
              (u) => (
                <div className="unit-total" key={u}>
                  <strong>{u}</strong>
                  {scope.map((l) => (
                    <span key={l.id}>
                      {l.name}:{" "}
                      <b>
                        {fmt(
                          materials
                            .filter((m) => m.unit === u)
                            .reduce(
                              (s, m) => round(s + stock(state, m.id, l.id)),
                              0,
                            ),
                        )}
                      </b>
                    </span>
                  ))}
                  <span>
                    Total:{" "}
                    <b>
                      {fmt(
                        materials
                          .filter((m) => m.unit === u)
                          .reduce((s, m) => round(s + total(m.id)), 0),
                      )}
                    </b>
                  </span>
                </div>
              ),
            )}
            <p className="hint">
              Totales según los filtros actuales. Cada unidad se suma por
              separado.
            </p>
          </div>
        )}
        <div className="panel-footer">
          <span>
            Las existencias se actualizan únicamente mediante movimientos.
          </span>
          <button
            onClick={() =>
              navigate(
                `/historial${loc ? `?ubicacion=${loc}` : isJunji ? "?junji=1" : isRooms ? "?salas=1" : ""}`,
              )
            }
          >
            <History size={16} />
            Ver historial
          </button>
        </div>
      </section>
      {section === "bodega" && (
        <div className="replenishment-callout">
          <div>
            <h2>¿Es momento de reponer?</h2>
            <p>
              Distribuye consumibles desde bodega a las siete salas y los tres
              baños.
            </p>
          </div>
          <button
            className="primary"
            onClick={() =>
              onMove(
                "reposicion",
                state.materials.find((m) => m.id === "confort")?.id ??
                  state.materials.find((m) => m.consumable)?.id,
              )
            }
          >
            <ArrowUpFromLine size={18} />
            Registrar reposición
          </button>
        </div>
      )}
    </>
  );
}
