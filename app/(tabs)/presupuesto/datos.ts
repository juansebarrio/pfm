import "server-only";
import type { SesionHogar } from "@/lib/datos/sesion";

/**
 * ¿Ese mes/ámbito ya tiene presupuesto? Chequeo liviano para decidir si se
 * muestra el link "Armar presupuesto de {mes} →" (01b). Sigue el criterio de
 * buscarPresupuesto en lib/datos/presupuesto.ts: lo personal filtra por user.
 */
export async function existePresupuesto(
  sesion: SesionHogar,
  mes: string,
  ambito: "hogar" | "personal",
): Promise<boolean> {
  let consulta = sesion.supabase
    .from("presupuestos")
    .select("id")
    .eq("hogar_id", sesion.hogarId)
    .eq("mes", mes)
    .eq("ambito", ambito);
  if (ambito === "personal") consulta = consulta.eq("user_id", sesion.userId);
  const { data } = await consulta.maybeSingle();
  return Boolean(data);
}
