"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { asegurarCicloParaFecha } from "@/lib/datos/ciclos-servidor";
import { generarCuotas } from "@/lib/dominio/cuotas";
import { hoyBA } from "@/lib/dominio/fechas";

const esquemaGasto = z.object({
  importeCentavos: z.number().int().positive().max(100_000_000_000),
  medioTipo: z.enum(["cuenta", "tarjeta"]),
  medioId: z.uuid(),
  categoriaId: z.uuid().nullable(),
  ambito: z.enum(["hogar", "personal"]),
  cuotas: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  descripcion: z.string().trim().max(80).optional(),
});

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

/** La fecha con la que se asigna el ciclo nunca es anterior a la compra real. */
function fechaParaCiclo(fechaDevengado: string, fechaCompra: string): string {
  return fechaDevengado > fechaCompra ? fechaDevengado : fechaCompra;
}

/** Alta rápida (03). El gasto aparece al instante: optimistic UI del lado cliente. */
export async function crearGasto(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaGasto.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const datos = parseo.data;

  const sesion = await obtenerSesionHogar();
  const hoy = hoyBA();
  const visibilidad = datos.ambito === "hogar" ? "compartido" : "personal";

  // nombre de la categoría como descripción por defecto (03 no tiene campo de texto)
  let descripcion = datos.descripcion;
  if (!descripcion && datos.categoriaId) {
    const { data: cat } = await sesion.supabase
      .from("categorias")
      .select("nombre")
      .eq("id", datos.categoriaId)
      .single();
    descripcion = cat?.nombre;
  }
  descripcion ||= "Gasto";

  if (datos.cuotas > 1) {
    if (datos.medioTipo !== "tarjeta") {
      return { ok: false, error: "Las cuotas son solo con tarjeta" };
    }
    // sin categoría, las cuotas hijas quedarían fuera de la bandeja (se filtra
    // por compra_id) y del historial categorizable: no habría cómo asignarlas
    if (!datos.categoriaId) {
      return { ok: false, error: "Elegí una categoría para una compra en cuotas" };
    }
    const { data: compra, error: errCompra } = await sesion.supabase
      .from("compras_en_cuotas")
      .insert({
        hogar_id: sesion.hogarId,
        user_id: sesion.userId,
        tarjeta_id: datos.medioId,
        descripcion,
        total_centavos: datos.importeCentavos,
        n_cuotas: datos.cuotas,
        fecha: hoy,
        visibilidad,
      })
      .select()
      .single();
    if (errCompra || !compra) return { ok: false, error: "No pudimos guardar la compra" };

    const hijos = [];
    for (const c of generarCuotas(datos.importeCentavos, datos.cuotas, hoy)) {
      // la cuota devenga el día 1, pero para el ciclo de tarjeta manda la fecha
      // real de compra: así la cuota 1 no cae en un resumen que cerró antes
      hijos.push({
        hogar_id: sesion.hogarId,
        user_id: sesion.userId,
        tipo: "gasto",
        descripcion,
        importe_centavos: c.importeCentavos,
        fecha: c.fecha,
        tarjeta_id: datos.medioId,
        ciclo_id: await asegurarCicloParaFecha(
          sesion,
          datos.medioId,
          fechaParaCiclo(c.fecha, hoy),
        ),
        categoria_id: datos.categoriaId,
        visibilidad,
        compra_id: compra.id,
        n_cuota: c.n,
      });
    }
    const { error } = await sesion.supabase.from("movimientos").insert(hijos);
    if (error) return { ok: false, error: "No pudimos guardar las cuotas" };
  } else {
    const { error } = await sesion.supabase.from("movimientos").insert({
      hogar_id: sesion.hogarId,
      user_id: sesion.userId,
      tipo: "gasto",
      descripcion,
      importe_centavos: datos.importeCentavos,
      fecha: hoy,
      cuenta_id: datos.medioTipo === "cuenta" ? datos.medioId : null,
      tarjeta_id: datos.medioTipo === "tarjeta" ? datos.medioId : null,
      ciclo_id:
        datos.medioTipo === "tarjeta"
          ? await asegurarCicloParaFecha(sesion, datos.medioId, hoy)
          : null,
      categoria_id: datos.categoriaId,
      visibilidad,
    });
    if (error) return { ok: false, error: "No pudimos guardar el gasto" };
  }

  revalidatePath("/resumen");
  revalidatePath("/movimientos");
  revalidatePath("/presupuesto");
  return { ok: true };
}

const esquemaCategorizar = z.object({
  movimientoId: z.uuid(),
  categoriaId: z.uuid(),
});

/** Categorización inline desde la bandeja (05): asignás y pasa al historial. */
export async function categorizarMovimiento(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaCategorizar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };

  const sesion = await obtenerSesionHogar();
  const { error, data } = await sesion.supabase
    .from("movimientos")
    .update({ categoria_id: parseo.data.categoriaId })
    .eq("id", parseo.data.movimientoId)
    .eq("hogar_id", sesion.hogarId)
    .select();
  if (error || !data?.length) return { ok: false, error: "No pudimos categorizar" };

  revalidatePath("/movimientos");
  revalidatePath("/resumen");
  revalidatePath("/presupuesto");
  return { ok: true };
}

const esquemaBorrar = z.object({ movimientoId: z.uuid() });

/**
 * Borrar un movimiento. Si es una cuota (compra_id), borra la COMPRA completa
 * — una cuota suelta rompería la serie; el on-delete-cascade limpia las hijas.
 * RLS de movimientos/compras garantiza que solo se toca lo propio o compartido.
 */
export async function borrarMovimiento(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaBorrar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };

  const sesion = await obtenerSesionHogar();
  const { data: mov } = await sesion.supabase
    .from("movimientos")
    .select("id, compra_id, tarjeta_id")
    .eq("id", parseo.data.movimientoId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!mov) return { ok: false, error: "No encontramos ese movimiento" };

  if (mov.compra_id) {
    const { error } = await sesion.supabase
      .from("compras_en_cuotas")
      .delete()
      .eq("id", mov.compra_id)
      .eq("hogar_id", sesion.hogarId);
    if (error) return { ok: false, error: "No pudimos borrar la compra" };
  } else {
    const { error, data } = await sesion.supabase
      .from("movimientos")
      .delete()
      .eq("id", mov.id)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error || !data?.length) return { ok: false, error: "No pudimos borrar el movimiento" };
  }

  revalidatePath("/movimientos");
  revalidatePath("/resumen");
  revalidatePath("/presupuesto");
  revalidatePath("/cuotas");
  if (mov.tarjeta_id) revalidatePath(`/tarjetas/${mov.tarjeta_id}`);
  return { ok: true };
}

const esquemaRecurrente = z.object({
  recurrenteId: z.uuid(),
  mes: z.string().regex(/^\d{4}-\d{2}-01$/),
});

/** Confirma una sugerencia de recurrente con un tap. Nunca se autoinsertan. */
export async function confirmarRecurrente(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaRecurrente.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };

  const sesion = await obtenerSesionHogar();
  const { data: recurrente } = await sesion.supabase
    .from("recurrentes")
    .select("*")
    .eq("id", parseo.data.recurrenteId)
    .eq("hogar_id", sesion.hogarId)
    .single();
  if (!recurrente) return { ok: false, error: "Recurrente inexistente" };

  const fecha = `${parseo.data.mes.slice(0, 7)}-${String(recurrente.dia_mes).padStart(2, "0")}`;
  const { error } = await sesion.supabase.from("movimientos").insert({
    hogar_id: sesion.hogarId,
    user_id: sesion.userId,
    tipo: "gasto",
    descripcion: recurrente.descripcion,
    importe_centavos: recurrente.importe_sugerido_centavos,
    fecha,
    cuenta_id: recurrente.cuenta_id,
    tarjeta_id: recurrente.tarjeta_id,
    // un recurrente de tarjeta también debe caer en su ciclo
    ciclo_id: recurrente.tarjeta_id
      ? await asegurarCicloParaFecha(sesion, recurrente.tarjeta_id, fecha)
      : null,
    categoria_id: recurrente.categoria_id,
    visibilidad: recurrente.visibilidad,
  });
  if (error) return { ok: false, error: "No pudimos registrar el pago" };

  revalidatePath("/presupuesto");
  revalidatePath("/resumen");
  revalidatePath("/movimientos");
  return { ok: true };
}
