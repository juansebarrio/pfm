import { fetch } from "expo/fetch";
import { supabase } from "@/lib/supabase";

const API = process.env.EXPO_PUBLIC_API_URL;

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
