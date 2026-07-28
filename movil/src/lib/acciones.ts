import { generarCuotas } from "@dominio/cuotas";
import { asignarCiclo, generarCiclosHasta, primerCicloEstimado } from "@dominio/ciclos";
import { hoyBA } from "@dominio/fechas";
import { supabase } from "./supabase";
import type { SesionHogar } from "./datos";

// Capa de escritura. En la web esto eran Server Actions; acá son escrituras
// directas a Supabase desde el cliente. La barrera de seguridad no cambia: es
// la RLS + los CHECK de la base, que ya validan hogar, visibilidad y la regla
// "gasto = cuenta XOR tarjeta". La validación de acá es UX, no seguridad.

export type Resultado = { ok: true } | { ok: false; error: string };

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
      grupo: "Otros",
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
  ambito: "hogar" | "personal";
};

export async function categoriasDelHogar(
  sesion: SesionHogar,
): Promise<CategoriaSimple[]> {
  const { data } = await supabase
    .from("categorias")
    .select("id, nombre, icono, ambito")
    .eq("hogar_id", sesion.hogarId)
    .order("orden");
  return (data ?? []) as CategoriaSimple[];
}

// ────────────────────────────────────────────── crear gasto

export type EntradaGasto = {
  importeCentavos: number;
  medioTipo: "cuenta" | "tarjeta";
  medioId: string;
  categoriaId: string | null;
  /** categoría escrita a mano (se reusa o se crea) */
  categoriaNombre?: string;
  ambito: "hogar" | "personal";
  cuotas: 1 | 3 | 6 | 12;
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

  const hoy = hoyBA();
  const visibilidad = datos.ambito === "hogar" ? "compartido" : "personal";
  const nota = datos.nota?.trim() || null;

  // categoría efectiva: el id elegido, o el nombre escrito a mano resuelto
  let categoriaId = datos.categoriaId;
  if (!categoriaId && datos.categoriaNombre?.trim()) {
    categoriaId = await encontrarOCrearCategoria(
      sesion,
      datos.categoriaNombre.trim(),
      datos.ambito,
    );
    if (!categoriaId) return { ok: false, error: "No pudimos crear la categoría" };
  }

  // el nombre de la categoría hace de descripción por defecto (03 no pide comercio)
  let descripcion: string | undefined;
  if (categoriaId) {
    const { data: cat } = await supabase
      .from("categorias")
      .select("nombre")
      .eq("id", categoriaId)
      .single();
    descripcion = cat?.nombre;
  }
  descripcion ||= "Gasto";

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
        fecha: hoy,
        visibilidad,
      })
      .select()
      .single();
    if (errCompra || !compra) return { ok: false, error: "No pudimos guardar la compra" };

    const hijos = [];
    for (const c of generarCuotas(datos.importeCentavos, datos.cuotas, hoy)) {
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
    categoria_id: categoriaId,
    visibilidad,
    nota,
  });
  if (error) return { ok: false, error: "No pudimos guardar el gasto" };
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
