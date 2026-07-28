import { fetch } from "expo/fetch";
import { supabase } from "@/lib/supabase";

const API = process.env.EXPO_PUBLIC_API_URL;

/**
 * Entrar a la demo sin credenciales. El login pasa en el server y acá solo
 * bajan los tokens: las credenciales de la demo NO viajan en el bundle (todo
 * `EXPO_PUBLIC_*` es público dentro del .ipa).
 */
export async function entrarDemo(): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!API) return { ok: false, error: "Falta EXPO_PUBLIC_API_URL" };

  const respuesta = await fetch(`${API}/api/demo`, { method: "POST" });
  const cuerpo = (await respuesta.json().catch(() => null)) as {
    accessToken?: string;
    refreshToken?: string;
    error?: string;
  } | null;

  if (!respuesta.ok || !cuerpo?.accessToken || !cuerpo.refreshToken) {
    return { ok: false, error: cuerpo?.error ?? "No pudimos entrar a la demo." };
  }

  // setSession la persiste en AsyncStorage y dispara onAuthStateChange, así que
  // el contexto de sesión se entera solo y el login redirige.
  const { error } = await supabase.auth.setSession({
    access_token: cuerpo.accessToken,
    refresh_token: cuerpo.refreshToken,
  });
  if (error) return { ok: false, error: "No pudimos abrir la sesión de demo." };
  return { ok: true };
}

/**
 * Borrar la cuenta. Apple lo exige desde la app (guía 5.1.1(v)). La decisión
 * de qué se borra y qué se traspasa vive en el server (lib/datos/borrar-cuenta):
 * necesita la secret key para tocar auth.users, que jamás baja al dispositivo.
 */
export async function borrarMiCuenta(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  if (!API) return { ok: false, error: "Falta EXPO_PUBLIC_API_URL" };

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Sesión vencida. Entrá de nuevo." };

  const respuesta = await fetch(`${API}/api/cuenta`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respuesta.ok) {
    return { ok: false, error: (await respuesta.text()) || "No pudimos borrarla." };
  }
  return { ok: true };
}
