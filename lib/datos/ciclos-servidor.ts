import "server-only";
import {
  asignarCiclo,
  generarCiclosHasta,
  primerCicloEstimado,
} from "@/lib/dominio/ciclos";
import { hoyBA } from "@/lib/dominio/fechas";
import type { SesionHogar } from "./sesion";

/**
 * Garantiza que la tarjeta tenga un ciclo que cubra `fecha` y devuelve el id de
 * ese ciclo (o null si no se pudo, p. ej. tarjeta sin día de cierre y sin
 * ciclos). Genera los ciclos estimados que falten hacia adelante, para que un
 * consumo o una cuota futura nunca queden huérfanos.
 */
export async function asegurarCicloParaFecha(
  sesion: SesionHogar,
  tarjetaId: string,
  fecha: string,
): Promise<string | null> {
  const { data: tarjeta } = await sesion.supabase
    .from("tarjetas")
    .select("id, dia_cierre, ciclos_tarjeta(id, fecha_cierre)")
    .eq("id", tarjetaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!tarjeta) return null;

  const ciclos = ((tarjeta.ciclos_tarjeta ?? []) as Array<{ id: string; fecha_cierre: string }>)
    .map((c) => ({ id: c.id, fechaCierre: c.fecha_cierre }))
    .sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre));

  // ¿ya hay un ciclo que cubre la fecha?
  const asignado = asignarCiclo(fecha, ciclos);
  if (asignado) return asignado;

  // no cubre: generar estimados hacia adelante
  const hoy = hoyBA();
  const ultimoCierre = ciclos.at(-1)?.fechaCierre;

  const nuevos: Array<{ fecha_cierre: string; fecha_vencimiento: string }> = [];
  if (ultimoCierre) {
    for (const c of generarCiclosHasta(ultimoCierre, fecha)) {
      nuevos.push({ fecha_cierre: c.fechaCierre, fecha_vencimiento: c.fechaVencimiento });
    }
  } else if (tarjeta.dia_cierre) {
    // tarjeta recién dada de alta, sin ningún ciclo
    const primero = primerCicloEstimado(tarjeta.dia_cierre, hoy);
    nuevos.push({ fecha_cierre: primero.fechaCierre, fecha_vencimiento: primero.fechaVencimiento });
    for (const c of generarCiclosHasta(primero.fechaCierre, fecha)) {
      nuevos.push({ fecha_cierre: c.fechaCierre, fecha_vencimiento: c.fechaVencimiento });
    }
  } else {
    // sin ciclos y sin día de cierre: no hay de dónde partir
    return null;
  }

  if (nuevos.length === 0) return null;
  const { data: insertados } = await sesion.supabase
    .from("ciclos_tarjeta")
    .insert(
      nuevos.map((c) => ({
        tarjeta_id: tarjetaId,
        fecha_cierre: c.fecha_cierre,
        fecha_vencimiento: c.fecha_vencimiento,
        estado_fechas: "estimado",
        estado: "abierto",
      })),
    )
    .select("id, fecha_cierre");

  const todos = [
    ...ciclos,
    ...((insertados ?? []) as Array<{ id: string; fecha_cierre: string }>).map((c) => ({
      id: c.id,
      fechaCierre: c.fecha_cierre,
    })),
  ];
  return asignarCiclo(fecha, todos);
}
