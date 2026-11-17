import { useCallback, useEffect, useState } from "react";
import {
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import {
  ChevronRight,
  Flower2,
  LogOut,
  Menu,
  RotateCcw,
  ShieldCheck,
  X,
  Check,
} from "lucide-react";
import type {
  InventoryRepository,
  InventoryState,
  MovementType,
} from "./types/inventory";
import { DemoRepository } from "./repositories/demo";
import {
  hasConfig,
  isDemo,
  supabase,
  SupabaseRepository,
} from "./repositories/supabase";
import { Modal } from "./components/Modal";
import { navigation } from "./data/navigation";
import { message } from "./lib/format";
import { Dashboard } from "./pages/Dashboard";
import { Inventory } from "./pages/Inventory";
import { HistoryPage } from "./pages/HistoryPage";
import { Login } from "./features/auth/Login";
import { MaterialForm } from "./features/inventory/MaterialForm";
import { ImportForm } from "./features/inventory/ImportForm";
import { MovementForm } from "./features/movements/MovementForm";
const repository: InventoryRepository = isDemo
  ? new DemoRepository()
  : new SupabaseRepository();
export default function App() {
  const [state, setState] = useState<InventoryState | null>(null),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false);
  const [authorized, setAuthorized] = useState(isDemo),
    [checking, setChecking] = useState(!isDemo),
    [menu, setMenu] = useState(false);
  const [modal, setModal] = useState<
      "material" | "move" | "import" | "reset" | null
    >(null),
    [moveType, setMoveType] = useState<MovementType>("ingreso"),
    [selected, setSelected] = useState(""),
    [compensates, setCompensates] = useState<string | null>(null);
  const location = useLocation();
  const load = useCallback(async () => {
    try {
      setState(await repository.load());
    } catch (e) {
      setError(message(e));
    }
  }, []);
  useEffect(() => {
    if (isDemo) return;
    if (!supabase) {
      setChecking(false);
      return;
    }
    const check = async () => {
      try {
        const { data } = await supabase!.auth.getSession();
        if (!data.session) {
          setAuthorized(false);
          setChecking(false);
          return;
        }
        const { data: allowed, error } = await supabase!
          .from("authorized_users")
          .select("user_id")
          .eq("user_id", data.session.user.id)
          .eq("active", true)
          .maybeSingle();
        if (error) throw error;
        setAuthorized(!!allowed);
        if (!allowed)
          setError(
            "Esta cuenta no está autorizada para acceder al inventario.",
          );
      } catch (e) {
        setError(message(e));
      } finally {
        setChecking(false);
      }
    };
    void check();
    const { data } = supabase.auth.onAuthStateChange(() => {
      setTimeout(() => void check(), 0);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (authorized) void load();
  }, [authorized, load]);
  useEffect(() => {
    setMenu(false);
  }, [location.pathname]);
  useEffect(() => {
    if (!isDemo) return;
    const refresh = () => void load();
    window.addEventListener("storage", refresh);
    return () => window.removeEventListener("storage", refresh);
  }, [load]);
  async function act(action: () => Promise<void>, success: string) {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
      setModal(null);
      setNotice(success);
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }
  function openMove(type: MovementType, id?: string, correction?: string) {
    setMoveType(type);
    setSelected(id ?? state?.materials[0]?.id ?? "");
    setCompensates(correction ?? null);
    setModal("move");
    setError("");
  }
  if (checking) return <div className="gate">Comprobando acceso…</div>;
  if (!authorized)
    return <Login error={error} configured={hasConfig} onError={setError} />;
  if (!state)
    return (
      <div className="gate">
        {error || "Cargando inventario…"}
        {error && <button onClick={() => void load()}>Reintentar</button>}
      </div>
    );
  return (
    <div className="app-shell">
      {menu && (
        <button
          className="scrim"
          aria-label="Cerrar menú"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a className="brand" href="/">
          <span className="brand-icon">
            <Flower2 size={26} />
          </span>
          <span>
            Jardín<span className="brand-light">Control</span>
            <small>GESTIÓN DE INVENTARIO</small>
          </span>
        </a>
        <div className="nav-caption">ESPACIO DE TRABAJO</div>
        <nav>
          {navigation.map(({ path, label, icon: Icon }, i) => (
            <NavLink
              key={path}
              to={path}
              end={path === "/"}
              className={({ isActive }) =>
                (isActive ? "active " : "") + (i === 6 ? "history-link" : "")
              }
            >
              <Icon size={19} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="support">
            <ShieldCheck size={20} />
            <span>
              Todo en su lugar<small>Más tiempo para lo importante.</small>
            </span>
          </div>
          <div className="profile">
            <span className="avatar">M</span>
            <span>
              {isDemo ? "Marité" : "Cuenta autorizada"}
              <small>Administración del jardín</small>
            </span>
            {!isDemo && (
              <button
                className="icon-button"
                aria-label="Cerrar sesión"
                onClick={() => void supabase!.auth.signOut()}
              >
                <LogOut size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="mobile-menu icon-button"
              aria-label="Abrir menú"
              onClick={() => setMenu(!menu)}
            >
              {menu ? <X /> : <Menu />}
            </button>
            <span>Mi jardín</span>
            <ChevronRight size={14} />
            <strong>
              {navigation.find((n) => n.path === location.pathname)?.label ??
                "Inventario"}
            </strong>
          </div>
          <span className="mode-badge">
            <span />
            {isDemo ? "Modo demostración" : "Acceso privado"}
          </span>
        </header>
        <main>
          {error && (
            <div className="alert error" role="alert">
              {error}
              <button
                className="icon-button"
                aria-label="Cerrar error"
                onClick={() => setError("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {notice && (
            <div className="alert success" role="status">
              <Check size={18} />
              {notice}
              <button
                className="icon-button"
                aria-label="Cerrar aviso"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          <Routes>
            <Route
              path="/"
              element={<Dashboard state={state} onMove={openMove} />}
            />
            {["salas", "junji", "bodega", "comedor", "oficina"].map(
              (section) => (
                <Route
                  key={section}
                  path={`/${section}`}
                  element={
                    <Inventory
                      key={section}
                      section={section}
                      state={state}
                      onAdd={() => {
                        setError("");
                        setModal("material");
                      }}
                      onMove={openMove}
                      onImport={() => {
                        setError("");
                        setModal("import");
                      }}
                    />
                  }
                />
              ),
            )}
            <Route
              path="/historial"
              element={
                <HistoryPage
                  state={state}
                  onCorrect={(m) =>
                    openMove(
                      m.type === "ingreso"
                        ? "consumo"
                        : m.type === "traslado"
                          ? "traslado"
                          : "ingreso",
                      m.materialId,
                      m.id,
                    )
                  }
                />
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <footer>
          <span>Desarrollado por Braulio Brevis</span>
          <span>
            JardínControl ·{" "}
            {isDemo
              ? "Datos ficticios, guardados en este navegador"
              : "Inventario privado"}{" "}
            {isDemo && (
              <button onClick={() => setModal("reset")}>
                <RotateCcw size={13} /> Reiniciar demo
              </button>
            )}
          </span>
        </footer>
      </div>
      {modal === "material" && (
        <MaterialForm
          state={state}
          serverError={error}
          busy={busy}
          close={() => setModal(null)}
          save={(m) =>
            void act(
              () => repository.addMaterial(m),
              "Material agregado. Registra un ingreso para cargar existencias.",
            )
          }
        />
      )}
      {modal === "move" && (
        <MovementForm
          state={state}
          serverError={error}
          initialType={moveType}
          selectedId={selected}
          compensatesId={compensates}
          busy={busy}
          close={() => setModal(null)}
          save={(input) =>
            void act(
              () => repository.move(input),
              "Movimiento registrado correctamente.",
            )
          }
        />
      )}
      {modal === "import" && (
        <ImportForm
          state={state}
          serverError={error}
          busy={busy}
          close={() => setModal(null)}
          save={(rows) =>
            void act(
              () => repository.importInitial(rows),
              "Inventario inicial importado.",
            )
          }
        />
      )}
      {modal === "reset" && (
        <Modal
          title="Reiniciar datos de demostración"
          onClose={() => setModal(null)}
        >
          <p>
            Se reemplazarán todos los datos demo de este navegador por los
            ejemplos originales. Exporta antes el inventario y el historial si
            deseas conservarlos.
          </p>
          <div className="form-actions">
            <button onClick={() => setModal(null)}>Cancelar</button>
            <button
              className="danger"
              disabled={busy}
              onClick={() =>
                void act(
                  () => repository.reset!(),
                  "Datos de ejemplo restablecidos.",
                )
              }
            >
              Confirmar reinicio
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
