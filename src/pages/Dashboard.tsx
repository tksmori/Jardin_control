import { NavLink, useNavigate } from "react-router-dom";
import {
  ArrowRightLeft,
  Building2,
  ChevronRight,
  Flower2,
  Package,
  Plus,
  TriangleAlert,
} from "lucide-react";
import type { InventoryState, MovementType } from "../types/inventory";
import { stock } from "../lib/engine";
import { fmt } from "../lib/format";
import { navigation } from "../data/navigation";
import { Heading } from "../components/Heading";
import { MovementTable } from "../components/MovementTable";

export function Dashboard({
  state,
  onMove,
}: {
  state: InventoryState;
  onMove: (t: MovementType, id?: string) => void;
}) {
  const navigate = useNavigate();
  const low = state.materials.filter((m) => stock(state, m.id) <= m.minimum);
  const rooms = state.locations.filter((l) => l.kind === "sala");
  return (
    <>
      <Heading
        eyebrow="CADA MATERIAL CUENTA"
        title="Todo listo para un nuevo día"
        text="Revisa tus existencias y mantén cada espacio abastecido."
      >
        <button className="primary" onClick={() => onMove("ingreso")}>
          <Plus size={18} />
          Registrar ingreso
        </button>
      </Heading>
      <div className="welcome-strip">
        <div className="welcome-symbol">
          <Flower2 size={34} />
        </div>
        <div>
          <h2>Un jardín organizado, más tiempo para cuidar.</h2>
          <p>Los materiales que necesitas, donde los necesitas.</p>
        </div>
        <span className="pill">Tu inventario al día</span>
      </div>
      <div className="stats">
        <Stat
          icon={<Package />}
          value={String(state.materials.length)}
          label="Materiales registrados"
          detail="Catálogo del jardín"
        />
        <Stat
          icon={<Building2 />}
          value="7"
          label="Salas del jardín"
          detail="Inventarios independientes"
        />
        <Stat
          icon={<TriangleAlert />}
          value={String(low.length)}
          label="Materiales con stock bajo"
          detail="Existencia total ≤ mínimo"
          warning
        />
        <Stat
          icon={<ArrowRightLeft />}
          value={String(state.movements.length)}
          label="Movimientos registrados"
          detail="Historial trazable"
        />
      </div>
      <div className="section-heading">
        <h2>Los espacios de tu jardín</h2>
        <span>Todo conectado en un solo lugar</span>
      </div>
      <div className="space-grid">
        {navigation.slice(1, 6).map(({ path, label, icon: Icon }, i) => (
          <button
            className="space-card"
            key={path}
            onClick={() => navigate(path)}
          >
            <span className={`space-icon tone-${i}`}>
              <Icon size={24} />
            </span>
            <h3>{label}</h3>
            <p>
              {
                [
                  "Siete salas, una vista compartida.",
                  "Materiales con origen JUNJI.",
                  "Abastecimiento y reposiciones.",
                  "Utensilios para cada comida.",
                  "Lo esencial para la administración.",
                ][i]
              }
            </p>
            <span className="space-bottom">
              Ver inventario <ChevronRight size={16} />
            </span>
          </button>
        ))}
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <div className="panel-title">
            <h2>Últimos movimientos</h2>
            <NavLink to="/historial">
              Ver historial <ChevronRight size={14} />
            </NavLink>
          </div>
          <MovementTable
            state={state}
            movements={state.movements.slice(0, 5)}
            compact
          />
        </section>
        <section className="panel alerts-panel">
          <div className="panel-title">
            <h2>Por reponer</h2>
            <span className="count">{low.length}</span>
          </div>
          {low.length ? (
            low.slice(0, 5).map((m) => (
              <div className="low-item" key={m.id}>
                <span className="low-icon">
                  <Package size={18} />
                </span>
                <div>
                  <strong>{m.name}</strong>
                  <small>
                    {fmt(stock(state, m.id))} {m.unit} · Mínimo {fmt(m.minimum)}
                  </small>
                </div>
                <button
                  className="icon-button"
                  aria-label={`Registrar ingreso de ${m.name}`}
                  onClick={() => onMove("ingreso", m.id)}
                >
                  <Plus size={18} />
                </button>
              </div>
            ))
          ) : (
            <p className="empty">Sin alertas de stock.</p>
          )}
          <p className="hint">
            Las alertas comparan las existencias totales de cada material con su
            mínimo.
          </p>
        </section>
      </div>
      <p className="subtle-note">
        {rooms.length} salas · Bodega · Comedor · Oficina · Existencias sin
        duplicaciones
      </p>
    </>
  );
}
function Stat({
  icon,
  value,
  label,
  detail,
  warning = false,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div className={`stat ${warning ? "warning" : ""}`}>
      <div className="stat-top">
        <span>{icon}</span>
        <small>{warning ? "REVISAR" : "INVENTARIO"}</small>
      </div>
      <strong>{value}</strong>
      <h3>{label}</h3>
      <p>{detail}</p>
    </div>
  );
}
