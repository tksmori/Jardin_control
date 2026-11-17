import { useState, type FormEvent } from "react";
import { Flower2 } from "lucide-react";
import { supabase } from "../../repositories/supabase";
export function Login({
  error,
  configured,
  onError,
}: {
  error: string;
  configured: boolean;
  onError: (s: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const d = new FormData(e.currentTarget);
    setBusy(true);
    const { error } = await supabase!.auth.signInWithPassword({
      email: String(d.get("email")),
      password: String(d.get("password")),
    });
    if (error) onError(error.message);
    setBusy(false);
  }
  return (
    <div className="gate">
      <div className="login-card">
        <Flower2 size={42} color="#7448c6" />
        <h1>JardínControl</h1>
        <p>Un lugar para cuidar tu inventario.</p>
        {configured ? (
          <form onSubmit={(e) => void login(e)}>
            <label>
              Correo electrónico
              <input
                name="email"
                type="email"
                autoComplete="username"
                required
              />
            </label>
            <label>
              Contraseña
              <input
                name="password"
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            {error && (
              <p role="alert" className="error-text">
                {error}
              </p>
            )}
            <button className="primary" disabled={busy}>
              {busy ? "Ingresando…" : "Ingresar"}
            </button>
          </form>
        ) : (
          <p>
            Falta configurar Supabase. Consulta el README. Para probar
            localmente sin credenciales, ejecuta <code>npm run dev</code>.
          </p>
        )}
        <small>Acceso exclusivo para usuarios autorizados.</small>
      </div>
    </div>
  );
}
