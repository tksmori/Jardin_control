import {
  LayoutDashboard,
  Building2,
  Sparkles,
  Boxes,
  Utensils,
  ClipboardList,
  History,
} from "lucide-react";
export const navigation = [
  { path: "/", label: "Resumen general", icon: LayoutDashboard },
  { path: "/salas", label: "Inventario salas", icon: Building2 },
  { path: "/junji", label: "Materiales JUNJI", icon: Sparkles },
  { path: "/bodega", label: "Material de bodega", icon: Boxes },
  { path: "/comedor", label: "Comedor", icon: Utensils },
  { path: "/oficina", label: "Oficina", icon: ClipboardList },
  { path: "/historial", label: "Historial de movimientos", icon: History },
];
