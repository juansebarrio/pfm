import "server-only";
import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con la SECRET key (salta RLS y los revokes de columna). Uso acotado
 * a propósito: hoy solo lo necesita la sincronización de Gmail para leer el
 * refresh token cifrado, que el rol authenticated no puede SELECTear.
 * Todo lo demás sigue pasando por el cliente del usuario + RLS.
 */
export function crearClienteAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const secreto = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secreto) {
    throw new Error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY");
  }
  return createClient(url, secreto, { auth: { persistSession: false } });
}
