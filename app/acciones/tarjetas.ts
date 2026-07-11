"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionHogar, type SesionHogar } from "@/lib/datos/sesion";
import { proponerCicloSiguiente } from "@/lib/dominio/ciclos";
import { hoyBA } from "@/lib/dominio/fechas";
import type { ResultadoAccion } from "./movimientos";

/**
 * Trae un ciclo validando que su tarjeta pertenezca al hogar ACTIVO de la
 * sesión. La RLS ya impide ver ciclos de hogares ajenos, pero un usuario
 * miembro de varios hogares podría, con el hogar A activo, operar sobre un
 * ciclo del hogar B (también suyo) y generar un movimiento inconsistente.
 */
async function cicloDelHogarActivo(sesion: SesionHogar, cicloId: string) {
  const { data } = await sesion.supabase
    .from("ciclos_tarjeta")
    .select("id, tarjeta_id, fecha_cierre, estado, total_real_centavos, tarjetas!inner(hogar_id, nombre)")
    .eq("id", cicloId)
    .eq("tarjetas.hogar_id", sesion.hogarId)
    .maybeSingle();
  return data;
}

const esquemaConfirmarFecha = z.object({
  cicloId: z.uuid(),
  // la fecha puede venir corregida; si no cambia, solo confirma
  fechaCierre: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Confirmar (o corregir) las fechas de un ciclo: estimado → confirmado.
 * Si la fecha de cierre cambió, los consumos afectados se reasignan de ciclo
 * (función SQL reasignar_consumos_tarjeta). Si no existe el ciclo siguiente,
 * se propone estimado (mismo día corrido a día hábil).
 */
export async function confirmarFechasCiclo(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaConfirmarFecha.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Fechas inválidas" };
  const datos = parseo.data;
  if (datos.fechaVencimiento <= datos.fechaCierre) {
    return { ok: false, error: "El vencimiento tiene que ser posterior al cierre" };
  }

  const sesion = await obtenerSesionHogar();
  const ciclo = await cicloDelHogarActivo(sesion, datos.cicloId);
  if (!ciclo) return { ok: false, error: "Ciclo inexistente" };

  const { error: errUpdate } = await sesion.supabase
    .from("ciclos_tarjeta")
    .update({
      fecha_cierre: datos.fechaCierre,
      fecha_vencimiento: datos.fechaVencimiento,
      estado_fechas: "confirmado",
    })
    .eq("id", datos.cicloId);
  if (errUpdate) return { ok: false, error: "No pudimos guardar las fechas" };

  // ciclo siguiente estimado, si no existe uno posterior
  const { data: posteriores } = await sesion.supabase
    .from("ciclos_tarjeta")
    .select("id")
    .eq("tarjeta_id", ciclo.tarjeta_id)
    .gt("fecha_cierre", datos.fechaCierre);
  if (!posteriores || posteriores.length === 0) {
    const propuesta = proponerCicloSiguiente(datos.fechaCierre);
    await sesion.supabase.from("ciclos_tarjeta").insert({
      tarjeta_id: ciclo.tarjeta_id,
      fecha_cierre: propuesta.fechaCierre,
      fecha_vencimiento: propuesta.fechaVencimiento,
      estado_fechas: "estimado",
      estado: "abierto",
    });
  }

  // Reasignar SIEMPRE: la función es idempotente (solo cambia filas cuyo ciclo
  // calculado difiere) y así rescata los consumos/cuotas que estaban con
  // ciclo_id null porque su fecha caía después del último cierre conocido.
  const { error: errReasignar } = await sesion.supabase.rpc(
    "reasignar_consumos_tarjeta",
    { tarjeta: ciclo.tarjeta_id },
  );
  if (errReasignar) return { ok: false, error: "No pudimos reasignar los consumos" };

  revalidatePath(`/tarjetas/${ciclo.tarjeta_id}`);
  revalidatePath("/resumen");
  return { ok: true };
}

const esquemaConciliar = z.object({
  cicloId: z.uuid(),
  totalRealCentavos: z.number().int().positive().max(100_000_000_000),
});

/**
 * Conciliación (hueco declarado): un solo campo con el total real del resumen.
 * Persiste total_real_centavos, el ciclo pasa a conciliado y la diferencia
 * queda visible en el historial. Sin matching línea por línea.
 */
export async function conciliarResumen(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaConciliar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Total inválido" };

  const sesion = await obtenerSesionHogar();
  const ciclo = await cicloDelHogarActivo(sesion, parseo.data.cicloId);
  if (!ciclo) return { ok: false, error: "Ciclo inexistente" };

  const { error } = await sesion.supabase
    .from("ciclos_tarjeta")
    .update({
      total_real_centavos: parseo.data.totalRealCentavos,
      estado: "conciliado",
    })
    .eq("id", parseo.data.cicloId);
  if (error) return { ok: false, error: "No pudimos conciliar" };

  revalidatePath(`/tarjetas/${ciclo.tarjeta_id}`);
  return { ok: true };
}

const esquemaPago = z.object({
  cicloId: z.uuid(),
  cuentaId: z.uuid(),
  importeCentavos: z.number().int().positive().max(100_000_000_000),
});

/**
 * Pago de resumen (total, mínimo o parcial): movimiento pago_resumen desde la
 * cuenta elegida. Jamás computa en presupuesto ni en gastos (criterio del brief,
 * test en lib/dominio/tarjetas.test.ts).
 */
export async function pagarResumen(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaPago.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };

  const sesion = await obtenerSesionHogar();
  const ciclo = await cicloDelHogarActivo(sesion, parseo.data.cicloId);
  if (!ciclo) return { ok: false, error: "Ciclo inexistente" };

  // la cuenta de pago también tiene que ser del hogar activo
  const { data: cuenta } = await sesion.supabase
    .from("cuentas")
    .select("id")
    .eq("id", parseo.data.cuentaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!cuenta) return { ok: false, error: "Cuenta inexistente" };

  const nombreTarjeta =
    (ciclo.tarjetas as unknown as { nombre: string } | null)?.nombre ?? "tarjeta";
  const { error } = await sesion.supabase.from("movimientos").insert({
    hogar_id: sesion.hogarId,
    user_id: sesion.userId,
    tipo: "pago_resumen",
    descripcion: `Pago resumen ${nombreTarjeta}`,
    importe_centavos: parseo.data.importeCentavos,
    fecha: hoyBA(),
    cuenta_id: parseo.data.cuentaId,
    tarjeta_id: ciclo.tarjeta_id,
    ciclo_id: ciclo.id,
    visibilidad: "compartido",
  });
  if (error) return { ok: false, error: "No pudimos registrar el pago" };

  revalidatePath(`/tarjetas/${ciclo.tarjeta_id}`);
  revalidatePath("/resumen");
  revalidatePath("/movimientos");
  return { ok: true };
}

const esquemaImpuestos = z.object({
  tarjetaId: z.uuid(),
  impuestosCentavos: z.number().int().min(0).max(100_000_000_000),
});

/** Estimación editable de impuestos y cargos por tarjeta (06); persiste. */
export async function actualizarImpuestosEstimados(
  entrada: unknown,
): Promise<ResultadoAccion> {
  const parseo = esquemaImpuestos.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Importe inválido" };

  const sesion = await obtenerSesionHogar();
  const { data, error } = await sesion.supabase
    .from("tarjetas")
    .update({ impuestos_estimados_centavos: parseo.data.impuestosCentavos })
    .eq("id", parseo.data.tarjetaId)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos guardar" };

  revalidatePath(`/tarjetas/${parseo.data.tarjetaId}`);
  return { ok: true };
}
