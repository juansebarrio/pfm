"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { asegurarCicloParaFecha } from "@/lib/datos/ciclos-servidor";
import { generarCuotas } from "@/lib/dominio/cuotas";
import { hoyBA } from "@/lib/dominio/fechas";

const esquemaGasto = z.object({
  importeCentavos: z.number().int().positive().max(100_000_000_000),
  // el default mantiene compatibles a los llamadores viejos, que solo cargaban gastos
  tipo: z.enum(["gasto", "ingreso"]).default("gasto"),
  medioTipo: z.enum(["cuenta", "tarjeta"]),
  medioId: z.uuid(),
  categoriaId: z.uuid().nullable(),
  // categoría escrita a mano: se reusa si ya existe (por nombre) o se crea
  categoriaNombre: z.string().trim().min(1).max(40).optional(),
  ambito: z.enum(["hogar", "personal"]),
  cuotas: z.union([z.literal(1), z.literal(3), z.literal(6), z.literal(12)]),
  /** yyyy-mm-dd; sin fecha, hoy. Se permite otro mes: mover un gasto al mes
   *  siguiente es exactamente "arrastrarlo". */
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  descripcion: z.string().trim().max(80).optional(),
  nota: z.string().trim().max(200).optional(),
});

export type ResultadoAccion = { ok: true } | { ok: false; error: string };

/** La fecha con la que se asigna el ciclo nunca es anterior a la compra real. */
function fechaParaCiclo(fechaDevengado: string, fechaCompra: string): string {
  return fechaDevengado > fechaCompra ? fechaDevengado : fechaCompra;
}

/**
 * Resuelve una categoría escrita a mano: si ya existe una con ese nombre en el
 * ámbito (sin distinguir mayúsculas) la reusa; si no, la crea en el grupo
 * "Otros". Evita duplicar "Nafta" / "nafta". Devuelve null si no pudo.
 */
async function encontrarOCrearCategoria(
  sesion: Awaited<ReturnType<typeof obtenerSesionHogar>>,
  nombre: string,
  ambito: "hogar" | "personal",
  // "Ingresos" cuando la categoría nace de un ingreso; "Otros" para gastos
  grupo: "Otros" | "Ingresos" = "Otros",
): Promise<string | null> {
  const patron = nombre.replace(/[\\%_]/g, (m) => `\\${m}`);
  let consulta = sesion.supabase
    .from("categorias")
    .select("id, nombre")
    .eq("hogar_id", sesion.hogarId)
    .eq("ambito", ambito)
    .ilike("nombre", patron);
  if (ambito === "personal") consulta = consulta.eq("user_id", sesion.userId);
  const { data: candidatas } = await consulta;
  const existente = (candidatas ?? []).find(
    (c) => c.nombre.toLowerCase() === nombre.toLowerCase(),
  );
  if (existente) return existente.id;

  const { data: nueva } = await sesion.supabase
    .from("categorias")
    .insert({
      hogar_id: sesion.hogarId,
      user_id: ambito === "personal" ? sesion.userId : null,
      grupo,
      nombre,
      ambito,
      icono: "tag",
      orden: 999,
    })
    .select("id")
    .single();
  return nueva?.id ?? null;
}

/**
 * Alta rápida (03). El movimiento aparece al instante: optimistic UI del cliente.
 *
 * Sirve para gastos y para ingresos. Un ingreso es más simple por definición: la
 * plata ENTRA a una cuenta, así que no admite tarjeta (no existe "cobrar en la
 * tarjeta") ni cuotas. El check de la tabla ya lo exige — validarlo acá es para
 * dar un error entendible en vez de un 400 de Postgres.
 */
export async function crearGasto(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaGasto.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const datos = parseo.data;
  const esIngreso = datos.tipo === "ingreso";

  if (esIngreso && datos.medioTipo !== "cuenta") {
    return { ok: false, error: "Un ingreso entra a una cuenta, no a una tarjeta" };
  }
  if (esIngreso && datos.cuotas > 1) {
    return { ok: false, error: "Un ingreso no se cobra en cuotas" };
  }

  const sesion = await obtenerSesionHogar();
  const hoy = hoyBA();
  // la fecha elegida manda; para tarjeta, el ciclo se asigna con max(fecha, hoy)
  // vía fechaParaCiclo para no caer en un resumen que ya cerró
  const fecha = datos.fecha ?? hoy;
  const visibilidad = datos.ambito === "hogar" ? "compartido" : "personal";
  const nota = datos.nota ?? null;

  // categoría efectiva: el id elegido, o el nombre escrito a mano resuelto
  let categoriaId = datos.categoriaId;
  if (!categoriaId && datos.categoriaNombre) {
    categoriaId = await encontrarOCrearCategoria(
      sesion,
      datos.categoriaNombre,
      datos.ambito,
      esIngreso ? "Ingresos" : "Otros",
    );
    if (!categoriaId) return { ok: false, error: "No pudimos crear la categoría" };
  }

  // nombre de la categoría como descripción por defecto (03 no tiene comercio)
  let descripcion = datos.descripcion;
  if (!descripcion && categoriaId) {
    const { data: cat } = await sesion.supabase
      .from("categorias")
      .select("nombre")
      .eq("id", categoriaId)
      .single();
    descripcion = cat?.nombre;
  }
  descripcion ||= esIngreso ? "Ingreso" : "Gasto";

  if (datos.cuotas > 1) {
    if (datos.medioTipo !== "tarjeta") {
      return { ok: false, error: "Las cuotas son solo con tarjeta" };
    }
    // sin categoría, las cuotas hijas quedarían fuera de la bandeja (se filtra
    // por compra_id) y del historial categorizable: no habría cómo asignarlas
    if (!categoriaId) {
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
        fecha,
        visibilidad,
      })
      .select()
      .single();
    if (errCompra || !compra) return { ok: false, error: "No pudimos guardar la compra" };

    const hijos = [];
    for (const c of generarCuotas(datos.importeCentavos, datos.cuotas, fecha)) {
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
          fechaParaCiclo(c.fecha, hoy), // nunca antes de HOY: el ciclo viejo ya cerró
        ),
        categoria_id: categoriaId,
        visibilidad,
        nota,
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
      tipo: datos.tipo,
      descripcion,
      importe_centavos: datos.importeCentavos,
      fecha,
      cuenta_id: datos.medioTipo === "cuenta" ? datos.medioId : null,
      tarjeta_id: datos.medioTipo === "tarjeta" ? datos.medioId : null,
      ciclo_id:
        datos.medioTipo === "tarjeta"
          ? await asegurarCicloParaFecha(sesion, datos.medioId, fechaParaCiclo(fecha, hoy))
          : null,
      categoria_id: categoriaId,
      visibilidad,
      nota,
    });
    if (error) {
      return { ok: false, error: `No pudimos guardar el ${esIngreso ? "ingreso" : "gasto"}` };
    }
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

const esquemaNota = z.object({
  movimientoId: z.uuid(),
  nota: z.string().trim().max(200),
});

/** Editar el comentario de un movimiento desde su detalle. Vacío = sin nota. */
export async function actualizarNota(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaNota.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Comentario inválido" };

  const sesion = await obtenerSesionHogar();
  const { error, data } = await sesion.supabase
    .from("movimientos")
    .update({ nota: parseo.data.nota || null })
    .eq("id", parseo.data.movimientoId)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos guardar el comentario" };

  revalidatePath("/movimientos");
  return { ok: true };
}

const esquemaFecha = z.object({
  movimientoId: z.uuid(),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

/**
 * Cambiar la fecha de un movimiento — también sirve para "arrastrarlo" a otro
 * mes. Si es de tarjeta se le reasigna el ciclo que corresponde a la fecha
 * nueva (nunca uno anterior a hoy: ese resumen ya cerró). Las cuotas quedan
 * afuera: su fecha la define la serie de la compra.
 */
export async function actualizarFecha(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaFecha.safeParse(entrada);
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
    return { ok: false, error: "La fecha de una cuota la maneja la compra" };
  }

  const cambios: { fecha: string; ciclo_id?: string | null } = {
    fecha: parseo.data.fecha,
  };
  if (mov.tarjeta_id) {
    cambios.ciclo_id = await asegurarCicloParaFecha(
      sesion,
      mov.tarjeta_id,
      fechaParaCiclo(parseo.data.fecha, hoyBA()),
    );
  }
  const { error } = await sesion.supabase
    .from("movimientos")
    .update(cambios)
    .eq("id", mov.id)
    .eq("hogar_id", sesion.hogarId);
  if (error) return { ok: false, error: "No pudimos cambiar la fecha" };

  revalidatePath("/movimientos");
  revalidatePath("/resumen");
  revalidatePath("/presupuesto");
  return { ok: true };
}

const esquemaMovimiento = z.object({
  movimientoId: z.uuid(),
  descripcion: z.string().trim().min(1).max(80),
  importeCentavos: z.number().int().positive().max(100_000_000_000),
  categoriaId: z.uuid().nullable(),
  medioTipo: z.enum(["cuenta", "tarjeta"]),
  medioId: z.uuid(),
  ambito: z.enum(["hogar", "personal"]),
});

/**
 * Editar un movimiento desde su detalle: descripción, importe, categoría,
 * medio y ámbito. La fecha tiene su propia acción (actualizarFecha) porque se
 * edita inline en el detalle desde antes.
 *
 * Las CUOTAS tienen reglas propias: el importe y el medio los define la serie
 * (cambiarlos en una sola rompería la suma de la compra), pero descripción,
 * categoría y ámbito se editan Y SE PROPAGAN a las hermanas y a la compra —
 * renombrar "Notebook" en la cuota 3 y que las otras cinco sigan diciendo lo
 * viejo sería peor que no dejar editar.
 *
 * Si el medio pasa a otra tarjeta, el ciclo se reasigna con la fecha del
 * movimiento (nunca a un resumen que ya cerró); si pasa a cuenta, ciclo null.
 */
export async function actualizarMovimiento(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaMovimiento.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const datos = parseo.data;

  const sesion = await obtenerSesionHogar();
  const { data: mov } = await sesion.supabase
    .from("movimientos")
    .select("id, tipo, fecha, compra_id, cuenta_id, tarjeta_id, importe_centavos")
    .eq("id", datos.movimientoId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!mov) return { ok: false, error: "No encontramos ese movimiento" };
  if (mov.tipo !== "gasto" && mov.tipo !== "ingreso") {
    return { ok: false, error: "Este tipo de movimiento no se edita desde acá" };
  }
  if (mov.tipo === "ingreso" && datos.medioTipo !== "cuenta") {
    return { ok: false, error: "Un ingreso entra a una cuenta, no a una tarjeta" };
  }

  const visibilidad = datos.ambito === "hogar" ? "compartido" : "personal";

  if (mov.compra_id) {
    const medioActual = mov.tarjeta_id ?? mov.cuenta_id;
    if (datos.importeCentavos !== mov.importe_centavos || datos.medioId !== medioActual) {
      return { ok: false, error: "El importe y el medio de una cuota los maneja la compra" };
    }
    const [{ error: errCuotas }, { error: errCompra }] = await Promise.all([
      sesion.supabase
        .from("movimientos")
        .update({
          descripcion: datos.descripcion,
          categoria_id: datos.categoriaId,
          visibilidad,
        })
        .eq("compra_id", mov.compra_id)
        .eq("hogar_id", sesion.hogarId),
      sesion.supabase
        .from("compras_en_cuotas")
        .update({ descripcion: datos.descripcion, visibilidad })
        .eq("id", mov.compra_id)
        .eq("hogar_id", sesion.hogarId),
    ]);
    if (errCuotas || errCompra) return { ok: false, error: "No pudimos guardar los cambios" };
  } else {
    const esTarjeta = datos.medioTipo === "tarjeta";
    const { error } = await sesion.supabase
      .from("movimientos")
      .update({
        descripcion: datos.descripcion,
        importe_centavos: datos.importeCentavos,
        categoria_id: datos.categoriaId,
        visibilidad,
        cuenta_id: esTarjeta ? null : datos.medioId,
        tarjeta_id: esTarjeta ? datos.medioId : null,
        ciclo_id: esTarjeta
          ? await asegurarCicloParaFecha(
              sesion,
              datos.medioId,
              fechaParaCiclo(mov.fecha, hoyBA()),
            )
          : null,
      })
      .eq("id", mov.id)
      .eq("hogar_id", sesion.hogarId);
    if (error) return { ok: false, error: "No pudimos guardar los cambios" };
  }

  revalidatePath("/movimientos");
  revalidatePath("/resumen");
  revalidatePath("/presupuesto");
  revalidatePath("/cuotas");
  return { ok: true };
}

const esquemaFechasEnLote = z.object({
  movimientoIds: z.array(z.uuid()).min(1).max(200),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export type ResultadoLote =
  | { ok: true; movidos: number; omitidos: number }
  | { ok: false; error: string };

/**
 * Mover VARIOS movimientos a una fecha, de una. Es la versión masiva de
 * actualizarFecha y comparte su regla: si el movimiento es de tarjeta, se le
 * reasigna el ciclo que corresponde a la fecha nueva, nunca uno anterior a hoy.
 *
 * Las CUOTAS se omiten en silencio de la escritura pero se CUENTAN y se
 * devuelven en `omitidos`: su fecha la manda la serie de la compra, y mover una
 * cuota suelta rompería la serie. Que la pantalla pueda decir "moví 6, dejé 2
 * cuotas afuera" es mejor que fallar entero o que mentir con un "listo".
 *
 * Los ciclos se resuelven UNA vez por tarjeta, no una por movimiento: todos los
 * consumos de la misma tarjeta con la misma fecha caen en el mismo ciclo.
 */
export async function actualizarFechasEnLote(entrada: unknown): Promise<ResultadoLote> {
  const parseo = esquemaFechasEnLote.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const { movimientoIds, fecha } = parseo.data;

  const sesion = await obtenerSesionHogar();
  const { data: movimientos } = await sesion.supabase
    .from("movimientos")
    .select("id, compra_id, tarjeta_id")
    .in("id", movimientoIds)
    .eq("hogar_id", sesion.hogarId);
  if (!movimientos?.length) return { ok: false, error: "No encontramos esos movimientos" };

  const movibles = movimientos.filter((m) => !m.compra_id);
  const omitidos = movimientos.length - movibles.length;
  if (movibles.length === 0) {
    return { ok: false, error: "La fecha de una cuota la maneja la compra" };
  }

  const hoy = hoyBA();
  // agrupados por tarjeta (null = de cuenta, no llevan ciclo)
  const porTarjeta = new Map<string | null, string[]>();
  for (const m of movibles) {
    const clave = m.tarjeta_id ?? null;
    porTarjeta.set(clave, [...(porTarjeta.get(clave) ?? []), m.id]);
  }

  let movidos = 0;
  for (const [tarjetaId, ids] of porTarjeta) {
    const cambios: { fecha: string; ciclo_id?: string | null } = { fecha };
    if (tarjetaId) {
      cambios.ciclo_id = await asegurarCicloParaFecha(
        sesion,
        tarjetaId,
        fechaParaCiclo(fecha, hoy),
      );
    }
    const { data, error } = await sesion.supabase
      .from("movimientos")
      .update(cambios)
      .in("id", ids)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error) return { ok: false, error: "No pudimos mover los movimientos" };
    movidos += data?.length ?? 0;
  }

  revalidatePath("/movimientos");
  revalidatePath("/resumen");
  revalidatePath("/presupuesto");
  return { ok: true, movidos, omitidos };
}

const esquemaCategorizarEnLote = z.object({
  movimientoIds: z.array(z.uuid()).min(1).max(200),
  categoriaId: z.uuid(),
});

export type ResultadoCategorizarLote =
  | { ok: true; cambiados: number }
  | { ok: false; error: string };

/**
 * Categorizar VARIOS movimientos de una — "estas cinco cargas van todas a
 * SUBE". Es la versión masiva de categorizarMovimiento y espeja la validación
 * de actualizarFechasEnLote: máximo 200 ids, solo lo del propio hogar, y el
 * resultado se cuenta en vez de asumirse.
 *
 * CUOTAS: al revés que la fecha, acá NO se omiten. La categoría de una compra
 * en cuotas es UNA —actualizarMovimiento ya la propaga a todas las hermanas
 * por compra_id—, así que el lote hace lo mismo: si en la selección cae una
 * cuota, se categoriza la compra entera. Por eso `cambiados` cuenta FILAS
 * escritas y puede ser mayor que la cantidad de ids enviados. Hoy la selección
 * del historial ni siquiera deja marcar cuotas (su fecha la manda la serie),
 * pero la acción tiene que ser coherente sola.
 */
export async function categorizarEnLote(
  entrada: unknown,
): Promise<ResultadoCategorizarLote> {
  const parseo = esquemaCategorizarEnLote.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const { movimientoIds, categoriaId } = parseo.data;

  const sesion = await obtenerSesionHogar();
  // la categoría tiene que ser del hogar: un id de otro lado dejaría los
  // movimientos apuntando a algo que nadie del hogar puede leer
  const { data: categoria } = await sesion.supabase
    .from("categorias")
    .select("id")
    .eq("id", categoriaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!categoria) return { ok: false, error: "Esa categoría no es de tu hogar" };

  const { data: movimientos } = await sesion.supabase
    .from("movimientos")
    .select("id, compra_id")
    .in("id", movimientoIds)
    .eq("hogar_id", sesion.hogarId);
  if (!movimientos?.length) return { ok: false, error: "No encontramos esos movimientos" };

  const sueltos = movimientos.filter((m) => !m.compra_id).map((m) => m.id);
  const compras = [
    ...new Set(
      movimientos.map((m) => m.compra_id).filter((c): c is string => c !== null),
    ),
  ];

  let cambiados = 0;
  if (sueltos.length > 0) {
    const { data, error } = await sesion.supabase
      .from("movimientos")
      .update({ categoria_id: categoriaId })
      .in("id", sueltos)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error) return { ok: false, error: "No pudimos categorizar" };
    cambiados += data?.length ?? 0;
  }
  if (compras.length > 0) {
    const { data, error } = await sesion.supabase
      .from("movimientos")
      .update({ categoria_id: categoriaId })
      .in("compra_id", compras)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error) return { ok: false, error: "No pudimos categorizar las cuotas" };
    cambiados += data?.length ?? 0;
  }
  if (cambiados === 0) return { ok: false, error: "No pudimos categorizar" };

  revalidatePath("/movimientos");
  revalidatePath("/resumen");
  revalidatePath("/presupuesto");
  revalidatePath("/cuotas");
  return { ok: true, cambiados };
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
