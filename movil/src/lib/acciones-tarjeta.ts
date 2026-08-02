import { hoyBA } from "@dominio/fechas";
import { supabase } from "./supabase";
import type { Resultado } from "./acciones";
import type { SesionHogar } from "./datos";

// Escrituras del detalle de tarjeta (06). Espejan las server actions de
// app/acciones/tarjetas.ts y app/acciones/cuentas.ts: misma validación y misma
// semántica; la barrera de seguridad sigue siendo la RLS, como en acciones.ts.
// También viven acá los dos helpers puros de app/tarjetas/[id]/datos.ts que
// comparten la pantalla de tarjeta y la de ciclo.

/** Tope de importes de las actions web (z.max de app/acciones/tarjetas.ts). */
const MAX_IMPORTE_CENTAVOS = 100_000_000_000;

// ────────────────────────────────────────────── helpers puros (datos.ts web)

/** Suma días corridos a una fecha YYYY-MM-DD (negativo resta). */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

/**
 * Ciclo por defecto de 06: el abierto más próximo (primer abierto cuyo
 * cierre no pasó). Si todos los abiertos ya cerraron por fecha, el más
 * reciente de ellos; si no hay abiertos, el último ciclo (histórico).
 * `ciclos` tiene que venir ordenado por cierre ASCENDENTE — espejo exacto de
 * indiceCicloVigente de app/tarjetas/[id]/datos.ts.
 */
export function indiceCicloVigente(
  ciclos: Array<{ estado: "abierto" | "cerrado" | "conciliado"; fechaCierre: string }>,
  hoy: string,
): number {
  const abiertos = ciclos
    .map((ciclo, indice) => ({ ciclo, indice }))
    .filter(({ ciclo }) => ciclo.estado === "abierto");
  const proximo = abiertos.find(({ ciclo }) => ciclo.fechaCierre >= hoy);
  if (proximo) return proximo.indice;
  if (abiertos.length > 0) return abiertos[abiertos.length - 1].indice;
  return ciclos.length - 1;
}

// ────────────────────────────────────────────── ciclo del hogar activo

type CicloValidado = {
  id: string;
  tarjeta_id: string;
  fecha_cierre: string;
  estado: string;
  total_real_centavos: number | null;
  tarjetas: { hogar_id: string; nombre: string } | null;
};

/**
 * Trae un ciclo validando que su tarjeta pertenezca al hogar ACTIVO de la
 * sesión. La RLS ya impide ver ciclos de hogares ajenos, pero un usuario
 * miembro de varios hogares podría, con el hogar A activo, operar sobre un
 * ciclo del hogar B (también suyo) y generar un movimiento inconsistente.
 * Espejo de cicloDelHogarActivo de app/acciones/tarjetas.ts.
 */
async function cicloDelHogarActivo(
  sesion: SesionHogar,
  cicloId: string,
): Promise<CicloValidado | null> {
  const { data } = await supabase
    .from("ciclos_tarjeta")
    .select(
      "id, tarjeta_id, fecha_cierre, estado, total_real_centavos, tarjetas!inner(hogar_id, nombre)",
    )
    .eq("id", cicloId)
    .eq("tarjetas.hogar_id", sesion.hogarId)
    .maybeSingle();
  return (data as unknown as CicloValidado) ?? null;
}

// ────────────────────────────────────────────── conciliar

/**
 * Conciliación (hueco declarado): un solo campo con el total real del resumen.
 * Persiste total_real_centavos, el ciclo pasa a conciliado y la diferencia
 * queda visible en el historial. Sin matching línea por línea. Espeja
 * conciliarResumen de app/acciones/tarjetas.ts.
 */
export async function conciliarResumen(
  sesion: SesionHogar,
  datos: { cicloId: string; totalRealCentavos: number },
): Promise<Resultado> {
  if (
    !Number.isInteger(datos.totalRealCentavos) ||
    datos.totalRealCentavos <= 0 ||
    datos.totalRealCentavos > MAX_IMPORTE_CENTAVOS
  ) {
    return { ok: false, error: "Total inválido" };
  }

  const ciclo = await cicloDelHogarActivo(sesion, datos.cicloId);
  if (!ciclo) return { ok: false, error: "Ciclo inexistente" };

  const { error } = await supabase
    .from("ciclos_tarjeta")
    .update({
      total_real_centavos: datos.totalRealCentavos,
      estado: "conciliado",
    })
    .eq("id", datos.cicloId);
  if (error) return { ok: false, error: "No pudimos conciliar" };
  return { ok: true };
}

// ────────────────────────────────────────────── pagar

/**
 * Pago de resumen (total, mínimo o parcial): movimiento pago_resumen desde la
 * cuenta elegida. Jamás computa en presupuesto ni en gastos (criterio del
 * brief, lib/dominio/tarjetas). Espeja pagarResumen de app/acciones/tarjetas.ts.
 */
export async function pagarResumen(
  sesion: SesionHogar,
  datos: { cicloId: string; cuentaId: string; importeCentavos: number },
): Promise<Resultado> {
  if (
    !Number.isInteger(datos.importeCentavos) ||
    datos.importeCentavos <= 0 ||
    datos.importeCentavos > MAX_IMPORTE_CENTAVOS
  ) {
    return { ok: false, error: "Datos inválidos" };
  }

  const ciclo = await cicloDelHogarActivo(sesion, datos.cicloId);
  if (!ciclo) return { ok: false, error: "Ciclo inexistente" };

  // la cuenta de pago también tiene que ser del hogar activo
  const { data: cuenta } = await supabase
    .from("cuentas")
    .select("id")
    .eq("id", datos.cuentaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!cuenta) return { ok: false, error: "Cuenta inexistente" };

  const nombreTarjeta = ciclo.tarjetas?.nombre ?? "tarjeta";
  const { error } = await supabase.from("movimientos").insert({
    hogar_id: sesion.hogarId,
    user_id: sesion.userId,
    tipo: "pago_resumen",
    descripcion: `Pago resumen ${nombreTarjeta}`,
    importe_centavos: datos.importeCentavos,
    fecha: hoyBA(),
    cuenta_id: datos.cuentaId,
    tarjeta_id: ciclo.tarjeta_id,
    ciclo_id: ciclo.id,
    visibilidad: "compartido",
  });
  if (error) return { ok: false, error: "No pudimos registrar el pago" };
  return { ok: true };
}

// ────────────────────────────────────────────── día de cierre

/**
 * Cargar el día de cierre de una tarjeta que quedó sin él. Espeja la rama de
 * edición de guardarTarjeta (app/acciones/cuentas.ts): misma validación 1–28 y
 * solo el update — el primer ciclo NO se crea acá, igual que en la web: lo crea
 * asegurarCicloParaFecha (acciones.ts) al caer el primer consumo.
 */
export async function actualizarDiaCierre(
  sesion: SesionHogar,
  datos: { tarjetaId: string; diaCierre: number },
): Promise<Resultado> {
  if (!Number.isInteger(datos.diaCierre) || datos.diaCierre < 1 || datos.diaCierre > 28) {
    return { ok: false, error: "El día de cierre va del 1 al 28" };
  }

  const { error, data } = await supabase
    .from("tarjetas")
    .update({ dia_cierre: datos.diaCierre })
    .eq("id", datos.tarjetaId)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: "No pudimos guardar el día de cierre" };
  }
  return { ok: true };
}
