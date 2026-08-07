import { fetch } from "expo/fetch";
import { generarCuotas } from "@dominio/cuotas";
import { asignarCiclo, generarCiclosHasta, primerCicloEstimado } from "@dominio/ciclos";
import { hoyBA } from "@dominio/fechas";
import {
  GRUPO_INGRESOS,
  ICONOS_DISPONIBLES,
  MENSAJE_ERROR_NOMBRE,
  validarNombre,
} from "@dominio/categorias";
import { supabase } from "./supabase";
import type { SesionHogar } from "./datos";

// Capa de escritura. En la web esto eran Server Actions; acá son escrituras
// directas a Supabase desde el cliente. La barrera de seguridad no cambia: es
// la RLS + los CHECK de la base, que ya validan hogar, visibilidad y la regla
// "gasto = cuenta XOR tarjeta". La validación de acá es UX, no seguridad.

export type Resultado = { ok: true } | { ok: false; error: string };

export type ResultadoLote =
  | { ok: true; movidos: number; omitidos: number }
  | { ok: false; error: string };

// ────────────────────────────────────────────── ciclos de tarjeta

/**
 * Garantiza que la tarjeta tenga un ciclo que cubra `fecha` y devuelve su id
 * (o null si no hay de dónde partir: tarjeta sin día de cierre y sin ciclos).
 * Portado de lib/datos/ciclos-servidor.ts — la lógica vive en el dominio.
 */
async function asegurarCicloParaFecha(
  sesion: SesionHogar,
  tarjetaId: string,
  fecha: string,
): Promise<string | null> {
  const { data: tarjeta } = await supabase
    .from("tarjetas")
    .select("id, dia_cierre, ciclos_tarjeta(id, fecha_cierre)")
    .eq("id", tarjetaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!tarjeta) return null;

  const ciclos = (
    (tarjeta.ciclos_tarjeta ?? []) as Array<{ id: string; fecha_cierre: string }>
  )
    .map((c) => ({ id: c.id, fechaCierre: c.fecha_cierre }))
    .sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre));

  const asignado = asignarCiclo(fecha, ciclos);
  if (asignado) return asignado;

  // no hay ciclo que cubra la fecha: generar los estimados que falten
  const nuevos: Array<{ fecha_cierre: string; fecha_vencimiento: string }> = [];
  const ultimoCierre = ciclos.at(-1)?.fechaCierre;
  if (ultimoCierre) {
    for (const c of generarCiclosHasta(ultimoCierre, fecha)) {
      nuevos.push({ fecha_cierre: c.fechaCierre, fecha_vencimiento: c.fechaVencimiento });
    }
  } else if (tarjeta.dia_cierre) {
    const primero = primerCicloEstimado(tarjeta.dia_cierre, hoyBA());
    nuevos.push({
      fecha_cierre: primero.fechaCierre,
      fecha_vencimiento: primero.fechaVencimiento,
    });
    for (const c of generarCiclosHasta(primero.fechaCierre, fecha)) {
      nuevos.push({ fecha_cierre: c.fechaCierre, fecha_vencimiento: c.fechaVencimiento });
    }
  } else {
    return null; // sin ciclos y sin día de cierre: no hay de dónde partir
  }

  if (nuevos.length === 0) return null;
  const { data: insertados } = await supabase
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

  return asignarCiclo(fecha, [
    ...ciclos,
    ...((insertados ?? []) as Array<{ id: string; fecha_cierre: string }>).map((c) => ({
      id: c.id,
      fechaCierre: c.fecha_cierre,
    })),
  ]);
}

// ────────────────────────────────────────────── categorías

/**
 * Categoría escrita a mano: reusa la que exista con ese nombre en el ámbito
 * (sin distinguir mayúsculas) o crea una nueva en el grupo "Otros".
 * Evita duplicar "Nafta" / "nafta".
 */
async function encontrarOCrearCategoria(
  sesion: SesionHogar,
  nombre: string,
  ambito: "hogar" | "personal",
  // "Ingresos" cuando la categoría nace de un ingreso; "Otros" para gastos
  grupo: "Otros" | "Ingresos" = "Otros",
): Promise<string | null> {
  const patron = nombre.replace(/[\\%_]/g, (m) => `\\${m}`);
  let consulta = supabase
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

  const { data: nueva } = await supabase
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

// ────────────────────────────────────────────── medios de pago

export type MedioDePago =
  | { tipo: "cuenta"; id: string; nombre: string; etiqueta: string }
  | {
      tipo: "tarjeta";
      id: string;
      nombre: string;
      etiqueta: string;
      cicloCierre: string | null;
      cicloEstado: "estimado" | "confirmado" | null;
    };

/** Cuentas y tarjetas activas, como chips del alta rápida. */
export async function mediosDePago(sesion: SesionHogar): Promise<MedioDePago[]> {
  const [{ data: cuentas }, { data: tarjetas }] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre, tipo")
      .eq("hogar_id", sesion.hogarId)
      .eq("activa", true)
      .neq("tipo", "inversion")
      .order("creado_el"),
    supabase
      .from("tarjetas")
      .select("id, nombre, red, ultimos4, ciclos_tarjeta(id, fecha_cierre, estado_fechas, estado)")
      .eq("hogar_id", sesion.hogarId)
      .eq("activa", true)
      .order("creado_el"),
  ]);

  const medios: MedioDePago[] = (cuentas ?? []).map((c) => ({
    tipo: "cuenta" as const,
    id: c.id,
    nombre: c.nombre,
    etiqueta: c.nombre === "Mercado Pago" ? "MP" : c.nombre,
  }));

  const hoy = hoyBA();
  for (const t of tarjetas ?? []) {
    // el ciclo que se muestra tiene que ser el MISMO al que caerá el gasto de
    // hoy: el primer cierre >= hoy (espeja asignarCiclo), no el primer "abierto"
    const abierto = ((t.ciclos_tarjeta ?? []) as Array<{
      fecha_cierre: string;
      estado_fechas: "estimado" | "confirmado";
    }>)
      .filter((c) => c.fecha_cierre >= hoy)
      .sort((a, b) => a.fecha_cierre.localeCompare(b.fecha_cierre))[0];
    medios.push({
      tipo: "tarjeta",
      id: t.id,
      nombre: t.nombre,
      etiqueta: `${t.nombre} •• ${t.ultimos4}`,
      cicloCierre: abierto?.fecha_cierre ?? null,
      cicloEstado: abierto?.estado_fechas ?? null,
    });
  }
  return medios;
}

export type CategoriaSimple = {
  id: string;
  nombre: string;
  icono: string;
  grupo: string;
  ambito: "hogar" | "personal";
};

export async function categoriasDelHogar(
  sesion: SesionHogar,
): Promise<CategoriaSimple[]> {
  const { data } = await supabase
    .from("categorias")
    .select("id, nombre, icono, grupo, ambito")
    .eq("hogar_id", sesion.hogarId)
    .order("orden");
  return (data ?? []) as CategoriaSimple[];
}

// ────────────────────────────────────────────── crear gasto

/** La fecha con la que se asigna el ciclo nunca es anterior a la compra real. */
function fechaParaCiclo(fechaDevengado: string, fechaCompra: string): string {
  return fechaDevengado > fechaCompra ? fechaDevengado : fechaCompra;
}

export type EntradaGasto = {
  importeCentavos: number;
  /** por defecto gasto: es el caso frecuente y mantiene compatibles a los viejos llamadores */
  tipo?: "gasto" | "ingreso";
  medioTipo: "cuenta" | "tarjeta";
  medioId: string;
  categoriaId: string | null;
  /** categoría escrita a mano (se reusa o se crea) */
  categoriaNombre?: string;
  ambito: "hogar" | "personal";
  cuotas: 1 | 3 | 6 | 12;
  /** yyyy-mm-dd; sin fecha, hoy. Elegir otro mes es "arrastrar" el movimiento. */
  fecha?: string;
  /** el comercio, cuando se sabe. El alta rápida no lo pide; un comprobante sí. */
  descripcion?: string;
  nota?: string;
};

/** Alta rápida (03). Espeja crearGasto de app/acciones/movimientos.ts. */
export async function crearGasto(
  sesion: SesionHogar,
  datos: EntradaGasto,
): Promise<Resultado> {
  if (!Number.isInteger(datos.importeCentavos) || datos.importeCentavos <= 0) {
    return { ok: false, error: "El importe tiene que ser mayor a cero" };
  }

  // Un ingreso ENTRA a una cuenta: no hay tarjeta ni cuotas. El check de la
  // tabla lo exige igual; validar acá es para dar un error legible.
  const tipo = datos.tipo ?? "gasto";
  const esIngreso = tipo === "ingreso";
  if (esIngreso && datos.medioTipo !== "cuenta") {
    return { ok: false, error: "Un ingreso entra a una cuenta, no a una tarjeta" };
  }
  if (esIngreso && datos.cuotas > 1) {
    return { ok: false, error: "Un ingreso no se cobra en cuotas" };
  }

  const hoy = hoyBA();
  // la fecha elegida manda; el ciclo de tarjeta se asigna con max(fecha, hoy)
  const fecha = datos.fecha ?? hoy;
  const visibilidad = datos.ambito === "hogar" ? "compartido" : "personal";
  const nota = datos.nota?.trim() || null;

  // categoría efectiva: el id elegido, o el nombre escrito a mano resuelto
  let categoriaId = datos.categoriaId;
  if (!categoriaId && datos.categoriaNombre?.trim()) {
    categoriaId = await encontrarOCrearCategoria(
      sesion,
      datos.categoriaNombre.trim(),
      datos.ambito,
      esIngreso ? "Ingresos" : "Otros",
    );
    if (!categoriaId) return { ok: false, error: "No pudimos crear la categoría" };
  }

  // el comercio manda si lo hay (comprobante); si no, el nombre de la categoría
  // hace de descripción por defecto (el alta rápida no pide comercio)
  let descripcion: string | undefined = datos.descripcion?.trim() || undefined;
  if (!descripcion && categoriaId) {
    const { data: cat } = await supabase
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
    // por compra_id) y del historial categorizable
    if (!categoriaId) {
      return { ok: false, error: "Elegí una categoría para una compra en cuotas" };
    }

    const { data: compra, error: errCompra } = await supabase
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
      // la cuota devenga el día 1, pero para el ciclo manda la fecha real de
      // compra: así la cuota 1 no cae en un resumen que ya cerró
      const fechaCiclo = c.fecha > hoy ? c.fecha : hoy;
      hijos.push({
        hogar_id: sesion.hogarId,
        user_id: sesion.userId,
        tipo: "gasto",
        descripcion,
        importe_centavos: c.importeCentavos,
        fecha: c.fecha,
        tarjeta_id: datos.medioId,
        ciclo_id: await asegurarCicloParaFecha(sesion, datos.medioId, fechaCiclo),
        categoria_id: categoriaId,
        visibilidad,
        nota,
        compra_id: compra.id,
        n_cuota: c.n,
      });
    }
    const { error } = await supabase.from("movimientos").insert(hijos);
    if (error) return { ok: false, error: "No pudimos guardar las cuotas" };
    return { ok: true };
  }

  const { error } = await supabase.from("movimientos").insert({
    hogar_id: sesion.hogarId,
    user_id: sesion.userId,
    tipo,
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
  return { ok: true };
}

/**
 * Cambiar la fecha de un movimiento — también sirve para "arrastrarlo" a otro
 * mes. Si es de tarjeta se le reasigna el ciclo de la fecha nueva (nunca uno
 * anterior a hoy: ese resumen ya cerró). Las cuotas quedan afuera: su fecha la
 * define la serie de la compra. Espeja actualizarFecha de la web.
 */
/**
 * Editar un movimiento desde su detalle: descripción, importe, categoría,
 * medio y ámbito. Espeja actualizarMovimiento de app/acciones/movimientos.ts,
 * incluidas las reglas de cuotas: importe y medio los define la serie, y lo
 * demás se propaga a las hermanas y a la compra.
 */
export async function actualizarMovimiento(
  sesion: SesionHogar,
  datos: {
    movimientoId: string;
    descripcion: string;
    importeCentavos: number;
    categoriaId: string | null;
    medioTipo: "cuenta" | "tarjeta";
    medioId: string;
    ambito: "hogar" | "personal";
  },
): Promise<Resultado> {
  const descripcion = datos.descripcion.trim();
  if (!descripcion) return { ok: false, error: "Poné una descripción" };
  if (!Number.isInteger(datos.importeCentavos) || datos.importeCentavos <= 0) {
    return { ok: false, error: "El importe tiene que ser mayor a cero" };
  }

  const { data: mov } = await supabase
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
      supabase
        .from("movimientos")
        .update({ descripcion, categoria_id: datos.categoriaId, visibilidad })
        .eq("compra_id", mov.compra_id)
        .eq("hogar_id", sesion.hogarId),
      supabase
        .from("compras_en_cuotas")
        .update({ descripcion, visibilidad })
        .eq("id", mov.compra_id)
        .eq("hogar_id", sesion.hogarId),
    ]);
    if (errCuotas || errCompra) return { ok: false, error: "No pudimos guardar los cambios" };
    return { ok: true };
  }

  const esTarjeta = datos.medioTipo === "tarjeta";
  const { error } = await supabase
    .from("movimientos")
    .update({
      descripcion,
      importe_centavos: datos.importeCentavos,
      categoria_id: datos.categoriaId,
      visibilidad,
      cuenta_id: esTarjeta ? null : datos.medioId,
      tarjeta_id: esTarjeta ? datos.medioId : null,
      ciclo_id: esTarjeta
        ? await asegurarCicloParaFecha(
            sesion,
            datos.medioId,
            fechaParaCiclo(mov.fecha as string, hoyBA()),
          )
        : null,
    })
    .eq("id", mov.id)
    .eq("hogar_id", sesion.hogarId);
  if (error) return { ok: false, error: "No pudimos guardar los cambios" };
  return { ok: true };
}

/**
 * Mover VARIOS movimientos a una fecha, de una. Espeja actualizarFechasEnLote
 * de app/acciones/movimientos.ts y comparte su regla: si el movimiento es de
 * tarjeta se le reasigna el ciclo de la fecha nueva, nunca uno anterior a hoy.
 *
 * Las CUOTAS se omiten de la escritura pero se CUENTAN y se devuelven en
 * `omitidos`: su fecha la manda la serie de la compra. Que la pantalla pueda
 * decir "moví 6, dejé 2 cuotas afuera" es mejor que fallar entero o mentir.
 *
 * Los ciclos se resuelven UNA vez por tarjeta: todos los consumos de la misma
 * tarjeta con la misma fecha caen en el mismo ciclo.
 */
export async function actualizarFechasEnLote(
  sesion: SesionHogar,
  movimientoIds: string[],
  fecha: string,
): Promise<ResultadoLote> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "Fecha inválida" };
  if (movimientoIds.length === 0) return { ok: false, error: "No elegiste ninguno" };

  const { data: movimientos } = await supabase
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
  const porTarjeta = new Map<string | null, string[]>();
  for (const m of movibles) {
    const clave = (m.tarjeta_id as string | null) ?? null;
    porTarjeta.set(clave, [...(porTarjeta.get(clave) ?? []), m.id as string]);
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
    const { data, error } = await supabase
      .from("movimientos")
      .update(cambios)
      .in("id", ids)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error) return { ok: false, error: "No pudimos mover los movimientos" };
    movidos += data?.length ?? 0;
  }

  return { ok: true, movidos, omitidos };
}

export type ResultadoCategorizarLote =
  | { ok: true; cambiados: number }
  | { ok: false; error: string };

/**
 * Categorizar VARIOS movimientos de una — "estas cinco cargas van todas a
 * SUBE". Espeja categorizarEnLote de app/acciones/movimientos.ts, tope de 200
 * ids incluido.
 *
 * CUOTAS: al revés que la fecha, acá NO se omiten. La categoría de una compra
 * en cuotas es UNA —actualizarMovimiento ya la propaga a las hermanas por
 * compra_id—, así que el lote hace lo mismo: si cae una cuota, se categoriza la
 * compra entera. Por eso `cambiados` cuenta FILAS escritas y puede ser mayor
 * que la cantidad de ids enviados.
 */
export async function categorizarEnLote(
  sesion: SesionHogar,
  movimientoIds: string[],
  categoriaId: string,
): Promise<ResultadoCategorizarLote> {
  if (movimientoIds.length === 0) return { ok: false, error: "No elegiste ninguno" };
  if (movimientoIds.length > 200) return { ok: false, error: "Son demasiados de una" };

  // la categoría tiene que ser del hogar: un id de otro lado dejaría los
  // movimientos apuntando a algo que nadie del hogar puede leer
  const { data: categoria } = await supabase
    .from("categorias")
    .select("id")
    .eq("id", categoriaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!categoria) return { ok: false, error: "Esa categoría no es de tu hogar" };

  const { data: movimientos } = await supabase
    .from("movimientos")
    .select("id, compra_id")
    .in("id", movimientoIds)
    .eq("hogar_id", sesion.hogarId);
  if (!movimientos?.length) return { ok: false, error: "No encontramos esos movimientos" };

  const sueltos = movimientos.filter((m) => !m.compra_id).map((m) => m.id as string);
  const compras = [
    ...new Set(
      movimientos
        .map((m) => m.compra_id as string | null)
        .filter((c): c is string => c !== null),
    ),
  ];

  let cambiados = 0;
  if (sueltos.length > 0) {
    const { data, error } = await supabase
      .from("movimientos")
      .update({ categoria_id: categoriaId })
      .in("id", sueltos)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error) return { ok: false, error: "No pudimos categorizar" };
    cambiados += data?.length ?? 0;
  }
  if (compras.length > 0) {
    const { data, error } = await supabase
      .from("movimientos")
      .update({ categoria_id: categoriaId })
      .in("compra_id", compras)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error) return { ok: false, error: "No pudimos categorizar las cuotas" };
    cambiados += data?.length ?? 0;
  }
  if (cambiados === 0) return { ok: false, error: "No pudimos categorizar" };

  return { ok: true, cambiados };
}

export async function actualizarFecha(
  sesion: SesionHogar,
  movimientoId: string,
  fecha: string,
): Promise<Resultado> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return { ok: false, error: "Fecha inválida" };

  const { data: mov } = await supabase
    .from("movimientos")
    .select("id, compra_id, tarjeta_id")
    .eq("id", movimientoId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!mov) return { ok: false, error: "No encontramos ese movimiento" };
  if (mov.compra_id) {
    return { ok: false, error: "La fecha de una cuota la maneja la compra" };
  }

  const cambios: { fecha: string; ciclo_id?: string | null } = { fecha };
  if (mov.tarjeta_id) {
    cambios.ciclo_id = await asegurarCicloParaFecha(
      sesion,
      mov.tarjeta_id,
      fechaParaCiclo(fecha, hoyBA()),
    );
  }
  const { error } = await supabase
    .from("movimientos")
    .update(cambios)
    .eq("id", mov.id)
    .eq("hogar_id", sesion.hogarId);
  if (error) return { ok: false, error: "No pudimos cambiar la fecha" };
  return { ok: true };
}

/**
 * "Arrastrar" el presupuesto: copia las partidas del mes anterior tal cual al
 * mes pedido. baseParaArmar ya trae exactamente eso (activa + monto anterior).
 */
export async function repetirPresupuesto(
  sesion: SesionHogar,
  mes: string,
  ambito: "hogar" | "personal",
): Promise<Resultado> {
  const base = await baseParaArmar(sesion, mes, ambito);
  const partidas = base.filter((p) => p.activa);
  if (partidas.length === 0) {
    return { ok: false, error: "El mes anterior no tiene presupuesto para repetir" };
  }
  return armarPresupuesto(sesion, mes, ambito, partidas);
}


/**
 * Cambiar el monto asignado de una partida de un presupuesto YA armado — el
 * sobre se ajusta tocandolo, sin rearmar el mes. Espeja actualizarPartida de
 * app/acciones/presupuesto.ts; RLS garantiza que la partida sea del hogar.
 */
export async function actualizarPartida(
  _sesion: SesionHogar,
  datos: { partidaId: string; asignadoCentavos: number },
): Promise<Resultado> {
  if (!Number.isInteger(datos.asignadoCentavos) || datos.asignadoCentavos < 0) {
    return { ok: false, error: "Ese monto no sirve" };
  }
  const { data, error } = await supabase
    .from("partidas_presupuesto")
    .update({ asignado_centavos: datos.asignadoCentavos })
    .eq("id", datos.partidaId)
    .select("id");
  if (error || !data || data.length === 0) {
    return { ok: false, error: "No pudimos guardar el monto. Proba de nuevo." };
  }
  return { ok: true };
}
/**
 * Sumar una partida a un presupuesto YA armado. Espeja agregarPartida de
 * app/acciones/presupuesto.ts; la unicidad (presupuesto, categoria) la
 * garantiza la base.
 */
export async function agregarPartida(
  sesion: SesionHogar,
  datos: {
    mes: string;
    ambito: "hogar" | "personal";
    categoriaId: string;
    asignadoCentavos: number;
  },
): Promise<Resultado> {
  if (!Number.isInteger(datos.asignadoCentavos) || datos.asignadoCentavos <= 0) {
    return { ok: false, error: "Ese monto no sirve" };
  }

  let consulta = supabase
    .from("presupuestos")
    .select("id")
    .eq("hogar_id", sesion.hogarId)
    .eq("mes", datos.mes)
    .eq("ambito", datos.ambito);
  consulta =
    datos.ambito === "personal"
      ? consulta.eq("user_id", sesion.userId)
      : consulta.is("user_id", null);
  const { data: presupuesto } = await consulta.maybeSingle();
  if (!presupuesto) return { ok: false, error: "Ese mes no tiene presupuesto armado" };

  // La fila puede existir apagada: la categoria que se desactivo al armar el
  // mes (o que el arrastre copio apagada) no se ve en la lista y el selector
  // la ofrece, pero la unicidad (presupuesto, categoria) la cuenta igual.
  // Sumar sobre una apagada es reactivarla, con la misma forma que el insert.
  const { data: previa } = await supabase
    .from("partidas_presupuesto")
    .select("id, activa")
    .eq("presupuesto_id", presupuesto.id)
    .eq("categoria_id", datos.categoriaId)
    .maybeSingle();
  if (previa) {
    if (previa.activa) return { ok: false, error: "Esa categoria ya tiene partida este mes" };
    const { error } = await supabase
      .from("partidas_presupuesto")
      .update({
        asignado_centavos: datos.asignadoCentavos,
        activa: true,
        fija: false,
        rollover: false,
        nota: null,
      })
      .eq("id", previa.id);
    if (error) return { ok: false, error: "No pudimos sumar la partida. Proba de nuevo." };
    return { ok: true };
  }

  const { error } = await supabase.from("partidas_presupuesto").insert({
    presupuesto_id: presupuesto.id,
    categoria_id: datos.categoriaId,
    asignado_centavos: datos.asignadoCentavos,
    activa: true,
    fija: false,
    rollover: false,
    nota: null,
  });
  if (error) {
    return {
      ok: false,
      error:
        error.code === "23505"
          ? "Esa categoria ya tiene partida este mes"
          : "No pudimos sumar la partida. Proba de nuevo.",
    };
  }
  return { ok: true };
}

// ────────────────────────────────────────────── categorías propias
//
// Qué permite la RLS (verificado con un usuario real): crear ✓, editar ✓,
// BORRAR ✗ — no hay policy de delete, a propósito: los movimientos referencian
// categorias con una FK sin cascade. Espeja app/acciones/categorias.ts.

export type EntradaCategoria = {
  nombre: string;
  grupo: string;
  icono: string;
  ambito: "hogar" | "personal";
};

/** Los nombres del ámbito, para detectar repetidos antes de escribir. */
async function nombresDelAmbito(
  sesion: SesionHogar,
  ambito: "hogar" | "personal",
  excluirId?: string,
): Promise<string[]> {
  let consulta = supabase
    .from("categorias")
    .select("id, nombre")
    .eq("hogar_id", sesion.hogarId)
    .eq("ambito", ambito);
  if (ambito === "personal") consulta = consulta.eq("user_id", sesion.userId);
  const { data } = await consulta;
  return (data ?? []).filter((c) => c.id !== excluirId).map((c) => c.nombre);
}

export async function crearCategoria(
  sesion: SesionHogar,
  datos: EntradaCategoria,
): Promise<Resultado> {
  const problema = validarNombre(
    datos.nombre,
    await nombresDelAmbito(sesion, datos.ambito),
  );
  if (problema) return { ok: false, error: MENSAJE_ERROR_NOMBRE[problema] };

  // orden 500: después de las sugeridas (0-17), antes de las creadas al pasar (999)
  const { error } = await supabase.from("categorias").insert({
    hogar_id: sesion.hogarId,
    user_id: datos.ambito === "personal" ? sesion.userId : null,
    grupo: datos.grupo,
    nombre: datos.nombre.trim(),
    ambito: datos.ambito,
    icono: ICONOS_DISPONIBLES.includes(datos.icono) ? datos.icono : "tag",
    orden: 500,
  });
  if (error) return { ok: false, error: "No pudimos crear la categoría" };
  return { ok: true };
}

/** Renombrar / cambiar ícono / mover de grupo. El ámbito NO se cambia. */
export async function editarCategoria(
  sesion: SesionHogar,
  categoriaId: string,
  datos: { nombre: string; grupo: string; icono: string },
): Promise<Resultado> {
  const { data: actual } = await supabase
    .from("categorias")
    .select("id, ambito, grupo")
    .eq("id", categoriaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!actual) return { ok: false, error: "No encontramos esa categoría" };

  // cruzar la frontera Ingresos/gasto dejaría movimientos del lado equivocado
  const eraIngreso = actual.grupo === GRUPO_INGRESOS;
  const seraIngreso = datos.grupo === GRUPO_INGRESOS;
  if (eraIngreso !== seraIngreso) {
    return {
      ok: false,
      error: eraIngreso
        ? "Una categoría de ingreso no puede pasar a gasto"
        : "Una categoría de gasto no puede pasar a ingreso",
    };
  }

  const problema = validarNombre(
    datos.nombre,
    await nombresDelAmbito(sesion, actual.ambito as "hogar" | "personal", categoriaId),
  );
  if (problema) return { ok: false, error: MENSAJE_ERROR_NOMBRE[problema] };

  const { error } = await supabase
    .from("categorias")
    .update({
      nombre: datos.nombre.trim(),
      grupo: datos.grupo,
      icono: ICONOS_DISPONIBLES.includes(datos.icono) ? datos.icono : "tag",
    })
    .eq("id", categoriaId)
    .eq("hogar_id", sesion.hogarId);
  if (error) return { ok: false, error: "No pudimos guardar los cambios" };
  return { ok: true };
}

/** Editar el comentario de un movimiento. Vacío borra la nota. */
export async function actualizarNota(
  sesion: SesionHogar,
  movimientoId: string,
  nota: string,
): Promise<Resultado> {
  const limpia = nota.trim();
  const { error, data } = await supabase
    .from("movimientos")
    .update({ nota: limpia === "" ? null : limpia.slice(0, 200) })
    .eq("id", movimientoId)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos guardar el comentario" };
  return { ok: true };
}

// ────────────────────────────────────────────── cuentas y tarjetas

export type EntradaCuenta = {
  nombre: string;
  tipo: "efectivo" | "banco" | "billetera" | "inversion";
  moneda: "ARS" | "USD";
  visibilidad: "compartido" | "personal";
};

export async function crearCuenta(
  sesion: SesionHogar,
  d: EntradaCuenta,
): Promise<Resultado> {
  if (!d.nombre.trim()) return { ok: false, error: "Poné un nombre" };
  const { error } = await supabase.from("cuentas").insert({
    hogar_id: sesion.hogarId,
    user_id: sesion.userId,
    nombre: d.nombre.trim(),
    tipo: d.tipo,
    moneda: d.moneda,
    visibilidad: d.visibilidad,
  });
  if (error) return { ok: false, error: "No pudimos crear la cuenta" };
  return { ok: true };
}

export type EntradaTarjeta = {
  nombre: string;
  banco: string;
  red: "visa" | "mastercard" | "amex" | "otra";
  ultimos4: string;
  visibilidad: "compartido" | "personal";
  diaCierre: number | null;
};

/** Alta de tarjeta. Con día de cierre, se le crea el primer ciclo estimado. */
export async function crearTarjeta(
  sesion: SesionHogar,
  d: EntradaTarjeta,
): Promise<Resultado> {
  if (!d.nombre.trim() || !d.banco.trim()) {
    return { ok: false, error: "Completá nombre y banco" };
  }
  if (!/^\d{4}$/.test(d.ultimos4)) {
    return { ok: false, error: "Los últimos 4 dígitos tienen que ser 4 números" };
  }
  if (d.diaCierre !== null && (d.diaCierre < 1 || d.diaCierre > 28)) {
    return { ok: false, error: "El día de cierre va del 1 al 28" };
  }

  const { data: nueva, error } = await supabase
    .from("tarjetas")
    .insert({
      hogar_id: sesion.hogarId,
      user_id: sesion.userId,
      nombre: d.nombre.trim(),
      banco: d.banco.trim(),
      red: d.red,
      ultimos4: d.ultimos4,
      visibilidad: d.visibilidad,
      dia_cierre: d.diaCierre,
    })
    .select("id")
    .single();
  if (error || !nueva) return { ok: false, error: "No pudimos crear la tarjeta" };

  // primer ciclo estimado, para que la tarjeta pueda recibir gastos desde ya
  if (d.diaCierre !== null) {
    const primero = primerCicloEstimado(d.diaCierre, hoyBA());
    await supabase.from("ciclos_tarjeta").insert({
      tarjeta_id: nueva.id,
      fecha_cierre: primero.fechaCierre,
      fecha_vencimiento: primero.fechaVencimiento,
      estado_fechas: "estimado",
      estado: "abierto",
    });
  }
  return { ok: true };
}

/** Sin borrado físico: cuentas y tarjetas se desactivan. */
export async function cambiarActiva(
  sesion: SesionHogar,
  tabla: "cuentas" | "tarjetas",
  id: string,
  activa: boolean,
): Promise<Resultado> {
  const { error, data } = await supabase
    .from(tabla)
    .update({ activa })
    .eq("id", id)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: activa ? "No pudimos reactivar" : "No pudimos desactivar" };
  }
  return { ok: true };
}

// ────────────────────────────────────────────── armar presupuesto

export type PartidaArmado = {
  categoriaId: string;
  nombre: string;
  icono: string;
  asignadoCentavos: number;
  asignadoAnteriorCentavos: number;
  activa: boolean;
  fija: boolean;
  rollover: boolean;
};

/**
 * Base para armar un mes: las partidas del mes anterior en su orden, más las
 * categorías que no estaban (nuevas o desactivadas), apagadas en 0.
 */
export async function baseParaArmar(
  sesion: SesionHogar,
  mes: string,
  ambito: "hogar" | "personal",
): Promise<PartidaArmado[]> {
  const { obtenerPresupuestoMes } = await import("./datos");
  const mesPrevio = mesAnteriorDe(mes);
  const [anterior, categorias] = await Promise.all([
    obtenerPresupuestoMes(sesion, mesPrevio, ambito),
    categoriasDelHogar(sesion),
  ]);
  // las categorías de ingreso no son partidas: el presupuesto es de gastos
  const delAmbito = categorias.filter((c) => c.ambito === ambito && c.grupo !== "Ingresos");

  if (!anterior) {
    return delAmbito.map((c) => ({
      categoriaId: c.id,
      nombre: c.nombre,
      icono: c.icono,
      asignadoCentavos: 0,
      asignadoAnteriorCentavos: 0,
      activa: false,
      fija: false,
      rollover: false,
    }));
  }

  const previas = anterior.grupos.flatMap((g) => g.partidas);
  const idsPrevias = new Set(previas.map((p) => p.categoriaId));
  return [
    ...previas.map((p) => ({
      categoriaId: p.categoriaId,
      nombre: p.nombre,
      icono: p.icono,
      asignadoCentavos: p.asignadoCentavos, // se sugiere lo del mes anterior
      asignadoAnteriorCentavos: p.asignadoCentavos,
      activa: true,
      fija: p.fija,
      rollover: p.rollover,
    })),
    ...delAmbito
      .filter((c) => !idsPrevias.has(c.id))
      .map((c) => ({
        categoriaId: c.id,
        nombre: c.nombre,
        icono: c.icono,
        asignadoCentavos: 0,
        asignadoAnteriorCentavos: 0,
        activa: false,
        fija: false,
        rollover: false,
      })),
  ];
}

/** mesAnterior sin importar el módulo entero de fechas dos veces. */
function mesAnteriorDe(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const total = anio * 12 + (m - 1) - 1;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

export async function armarPresupuesto(
  sesion: SesionHogar,
  mes: string,
  ambito: "hogar" | "personal",
  partidas: PartidaArmado[],
): Promise<Resultado> {
  let consulta = supabase
    .from("presupuestos")
    .select("id")
    .eq("hogar_id", sesion.hogarId)
    .eq("mes", mes)
    .eq("ambito", ambito);
  consulta =
    ambito === "personal"
      ? consulta.eq("user_id", sesion.userId)
      : consulta.is("user_id", null);
  const { data: existente } = await consulta.maybeSingle();
  if (existente) return { ok: false, error: "Ese mes ya tiene presupuesto" };

  const { data: presupuesto, error: errPresu } = await supabase
    .from("presupuestos")
    .insert({
      hogar_id: sesion.hogarId,
      mes,
      ambito,
      user_id: ambito === "personal" ? sesion.userId : null,
    })
    .select()
    .single();
  if (errPresu || !presupuesto) {
    return { ok: false, error: "No pudimos crear el presupuesto" };
  }

  const { error: errPartidas } = await supabase.from("partidas_presupuesto").insert(
    partidas.map((p) => ({
      presupuesto_id: presupuesto.id,
      categoria_id: p.categoriaId,
      asignado_centavos: p.asignadoCentavos,
      activa: p.activa,
      fija: p.fija,
      rollover: p.rollover,
    })),
  );
  if (errPartidas) {
    // sin partidas el presupuesto es basura: se revierte
    await supabase.from("presupuestos").delete().eq("id", presupuesto.id);
    return { ok: false, error: "No pudimos crear las partidas" };
  }
  return { ok: true };
}

// ────────────────────────────────────────────── recurrentes

/**
 * Confirmar una fila fantasma de recurrente: crea el movimiento del mes con el
 * importe sugerido, en la fecha de vencimiento. Espeja confirmarRecurrente de
 * app/acciones/movimientos.ts.
 *
 * Un recurrente NUNCA se autoinserta — el gasto existe recién cuando alguien lo
 * confirma con un tap. Si el recurrente es de tarjeta, el movimiento también
 * tiene que caer en su ciclo, o el resumen queda mintiendo.
 */
export async function confirmarRecurrente(
  sesion: SesionHogar,
  recurrenteId: string,
  mes: string,
): Promise<Resultado> {
  const { data: recurrente } = await supabase
    .from("recurrentes")
    .select("*")
    .eq("id", recurrenteId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!recurrente) return { ok: false, error: "Recurrente inexistente" };

  const fecha = `${mes.slice(0, 7)}-${String(recurrente.dia_mes).padStart(2, "0")}`;
  const { error } = await supabase.from("movimientos").insert({
    hogar_id: sesion.hogarId,
    user_id: sesion.userId,
    tipo: "gasto",
    descripcion: recurrente.descripcion,
    importe_centavos: recurrente.importe_sugerido_centavos,
    fecha,
    cuenta_id: recurrente.cuenta_id,
    tarjeta_id: recurrente.tarjeta_id,
    ciclo_id: recurrente.tarjeta_id
      ? await asegurarCicloParaFecha(sesion, recurrente.tarjeta_id, fecha)
      : null,
    categoria_id: recurrente.categoria_id,
    visibilidad: recurrente.visibilidad,
  });
  if (error) return { ok: false, error: "No pudimos registrar el pago" };
  return { ok: true };
}

/** Categorización inline desde la bandeja (05): asignás y pasa al historial. */
export async function categorizarMovimiento(
  sesion: SesionHogar,
  movimientoId: string,
  categoriaId: string,
): Promise<Resultado> {
  const { error, data } = await supabase
    .from("movimientos")
    .update({ categoria_id: categoriaId })
    .eq("id", movimientoId)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos categorizar" };
  return { ok: true };
}

/**
 * Borrar un movimiento. Si es una cuota (compra_id), borra la COMPRA completa
 * — una cuota suelta rompería la serie; el on-delete-cascade limpia las hijas.
 * Espeja app/acciones/movimientos.ts: mismo criterio en los dos clientes.
 */
export async function borrarMovimiento(
  sesion: SesionHogar,
  movimientoId: string,
): Promise<Resultado> {
  const { data: mov } = await supabase
    .from("movimientos")
    .select("id, compra_id")
    .eq("id", movimientoId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!mov) return { ok: false, error: "No encontramos ese movimiento" };

  if (mov.compra_id) {
    const { error } = await supabase
      .from("compras_en_cuotas")
      .delete()
      .eq("id", mov.compra_id)
      .eq("hogar_id", sesion.hogarId);
    if (error) return { ok: false, error: "No pudimos borrar la compra" };
  } else {
    const { error, data } = await supabase
      .from("movimientos")
      .delete()
      .eq("id", mov.id)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error || !data?.length) {
      return { ok: false, error: "No pudimos borrar el movimiento" };
    }
  }
  return { ok: true };
}

// ────────────────────────────────────────────── invitaciones al hogar
//
// Invitar y reenviar NO son escrituras directas: el email sale del server de la
// web (/api/invitaciones), porque RESEND_API_KEY es server-only y jamás baja al
// dispositivo. Revocar sí es un update directo — la server action de la web
// hace exactamente eso, sin lógica extra, y la RLS de administradores es la
// misma barrera en los dos clientes.

export type ResultadoInvitacion =
  | { ok: true; enviado: boolean; link: string }
  | { ok: false; error: string };

/** POST autenticado a /api/invitaciones; los errores llegan en castellano. */
async function llamarInvitaciones(
  cuerpo: Record<string, string>,
): Promise<ResultadoInvitacion> {
  const api = process.env.EXPO_PUBLIC_API_URL;
  if (!api) return { ok: false, error: "Falta EXPO_PUBLIC_API_URL" };

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { ok: false, error: "Sesión vencida. Entrá de nuevo." };

  try {
    const respuesta = await fetch(`${api}/api/invitaciones`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(cuerpo),
    });
    const json = (await respuesta.json().catch(() => null)) as {
      ok?: boolean;
      enviado?: boolean;
      link?: string;
      error?: string;
    } | null;
    if (!respuesta.ok || !json?.ok) {
      return {
        ok: false,
        error: json?.error ?? "El servidor no respondió. Probá de nuevo.",
      };
    }
    return { ok: true, enviado: json.enviado === true, link: json.link ?? "" };
  } catch {
    return { ok: false, error: "Sin conexión. Probá de nuevo." };
  }
}

/** Invitar por email (09). El server valida y manda el mail; rol miembro. */
export function invitarAlHogar(email: string): Promise<ResultadoInvitacion> {
  return llamarInvitaciones({ email });
}

/** Reenviar: renueva el vencimiento y reintenta el email. */
export function reenviarInvitacion(invitacionId: string): Promise<ResultadoInvitacion> {
  return llamarInvitaciones({ accion: "reenviar", invitacionId });
}

/**
 * Revocar: la invitación queda "revocada" y su token deja de servir. Espeja
 * revocarInvitacion de app/acciones/hogar.ts; el select confirma que la RLS
 * dejó pasar el update (sin él, un update de 0 filas parecería un éxito).
 */
export async function revocarInvitacion(
  sesion: SesionHogar,
  invitacionId: string,
): Promise<Resultado> {
  const { error, data } = await supabase
    .from("invitaciones")
    .update({ estado: "revocada" })
    .eq("id", invitacionId)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: "No pudimos revocar la invitación." };
  }
  return { ok: true };
}
