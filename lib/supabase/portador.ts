import { createClient } from "@supabase/supabase-js";

/**
 * Cliente para pedidos que traen `Authorization: Bearer <access_token>` en vez
 * de cookies — el caso de la app nativa, que guarda la sesión en AsyncStorage.
 *
 * RLS aplica igual que siempre: el token identifica al usuario ante Postgres.
 * No persiste ni refresca sesión: vive lo que dura el request.
 */
export function crearClienteConToken(token: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}
