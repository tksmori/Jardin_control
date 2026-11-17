import type { MovementType } from "../types/inventory";
export const labels: Record<MovementType, string> = {
  ingreso: "Ingreso",
  consumo: "Consumo",
  traslado: "Traslado",
  reposicion: "Reposición",
};
export const fmt = (n: number) =>
  n.toLocaleString("es-CL", { maximumFractionDigits: 3 });
export const date = (s: string) =>
  new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(new Date(s));
export const nowLocal = () => {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
};
export const message = (e: unknown) =>
  e instanceof Error
    ? e.message
    : String((e as { message?: string })?.message ?? e);
