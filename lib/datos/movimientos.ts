import "server-only";
import { cache } from "react";
import { formatearDiaCorto, hoyBA, ultimoDiaDelMes } from "@/lib/dominio/fechas";
import type { SesionHogar } from "./sesion";

export type MovimientoLista = {
  id: string;
  tipo: "gasto" | "ingreso" | "transferencia" | "pago_resumen";
  descripcion: string;
  importeCentavos: number;
  fecha: string;
  creadoEl: string;
  visibilidad: "personal" | "compartido";
  esPropio: boolean;
  /**
   * Nombre del miembro que lo cargó, para la fila "Cargado por" del detalle.
   * Null en un hogar de una sola persona: ahí la pregunta no existe y la fila
   * sería ruido en cada movimiento.
   */
  cargadoPor: string | null;
  categoria: { id: string; nombre: string; icono: string } | null;
  medio: string | null; // "Visa •• 4321", "Mercado Pago", "Galicia"
  /** para preseleccionar el medio al editar */
  medioTipo: "cuenta" | "tarjeta" | null;
  medioId: string | null;
  cierreCiclo: string | null; // "cierra 28 jul"
  esCuota: boolean;
  nCuota: number | null;
  nCuotasTotal: number | null;
  compraId: string | null; // para borrar la compra completa desde una cuota
  nota: string | null;
};

const CAMPOS = `
  id, tipo, descripcion, importe_centavos, fecha, creado_el, visibilidad, user_id,
  n_cuota, compra_id, nota, cuenta_id, tarjeta_id,
  categorias(id, nombre, icono),
  cuentas!movimientos_cuenta_id_fkey(nombre),
  tarjetas(nombre, red, ultimos4),
  ciclos_tarjeta(fecha_cierre, estado),
  compras_en_cuotas(n_cuotas)
`;

type FilaCruda = {
  id: string;
  tipo: MovimientoLista["tipo"];
  descripcion: string;
  importe_centavos: number;
  fecha: string;
  creado_el: string;
  visibilidad: "personal" | "compartido";
  user_id: string;
  n_cuota: number | null;
  compra_id: string | null;
  nota: string | null;
  cuenta_id: string | null;
  tarjeta_id: string | null;
  categorias: { id: string; nombre: string; icono: string } | null;
  cuentas: { nombre: string } | null;
  tarjetas: { nombre: string; red: string; ultimos4: string } | null;
  ciclos_tarjeta: { fecha_cierre: string; estado: string } | null;
  compras_en_cuotas: { n_cuotas: number } | null;
};

function nombreTarjeta(t: { red: string; ultimos4: string }): string {
  const red = t.red === "visa" ? "Visa" : t.red === "mastercard" ? "Mastercard" : t.red;
  return `${red} •• ${t.ultimos4}`;
}

/**
 * Nombre de cada miembro del hogar, por user_id.
 *
 * Va en una consulta aparte y no embebido en el SELECT del movimiento porque
 * no hay por dónde embeberlo: `movimientos.user_id` referencia `auth.users`,
 * igual que `miembros_hogar.user_id`, y sin FK entre las dos tablas PostgREST
 * no ve la relación. `cache` la deja en UNA consulta por request, aunque la
 * pantalla pida el historial y la bandeja por separado.
 */
export const nombresDeMiembros = cache(
  async (sesion: SesionHogar): Promise<Map<string, string>> => {
    const { data } = await sesion.supabase
      .from("miembros_hogar")
      .select("user_id, nombre")
      .eq("hogar_id", sesion.hogarId);
    return new Map<string, string>((data ?? []).map((m) => [m.user_id, m.nombre]));
  },
);

/**
 * El nombre a mostrar en "Cargado por", o null si no hay nada que contestar:
 * hogar de a uno (siempre sos vos) o miembro que ya no está en el hogar.
 */
export function nombreDeQuienCargo(
  nombres: Map<string, string>,
  userId: string,
): string | null {
  return nombres.size > 1 ? (nombres.get(userId) ?? null) : null;
}

function aMovimiento(
  fila: FilaCruda,
  userId: string,
  nombres: Map<string, string>,
): MovimientoLista {
  return {
    id: fila.id,
    tipo: fila.tipo,
    descripcion: fila.descripcion,
    importeCentavos: fila.importe_centavos,
    fecha: fila.fecha,
    creadoEl: fila.creado_el,
    visibilidad: fila.visibilidad,
    esPropio: fila.user_id === userId,
    cargadoPor: nombreDeQuienCargo(nombres, fila.user_id),
    categoria: fila.categorias,
    medio: fila.tarjetas
      ? nombreTarjeta(fila.tarjetas)
      : (fila.cuentas?.nombre ?? null),
    cierreCiclo:
      fila.ciclos_tarjeta && fila.ciclos_tarjeta.estado === "abierto"
        ? `cierra ${formatearDiaCorto(fila.ciclos_tarjeta.fecha_cierre)}`
        : null,
    medioTipo: fila.tarjeta_id ? "tarjeta" : fila.cuenta_id ? "cuenta" : null,
    medioId: fila.tarjeta_id ?? fila.cuenta_id,
    esCuota: fila.compra_id !== null,
    nCuota: fila.n_cuota,
    nCuotasTotal: fila.compras_en_cuotas?.n_cuotas ?? null,
    compraId: fila.compra_id,
    nota: fila.nota,
  };
}

/**
 * Los gastos de un ciclo de tarjeta, con TODOS los campos del detalle. Los
 * totales del ciclo los sigue calculando detalleCiclo (tarjetas.ts): esto
 * existe para que las filas del detalle de tarjeta abran el mismo detalle de
 * movimiento que el resto de la app.
 */
export async function movimientosDeCiclo(
  sesion: SesionHogar,
  cicloId: string,
): Promise<MovimientoLista[]> {
  const [{ data }, nombres] = await Promise.all([
    sesion.supabase
      .from("movimientos")
      .select(CAMPOS)
      .eq("hogar_id", sesion.hogarId)
      .eq("ciclo_id", cicloId)
      .eq("tipo", "gasto")
      .order("fecha", { ascending: false })
      .order("creado_el", { ascending: false }),
    nombresDeMiembros(sesion),
  ]);
  return ((data ?? []) as unknown as FilaCruda[]).map((f) =>
    aMovimiento(f, sesion.userId, nombres),
  );
}

/** Bandeja de entrada: sin categorizar (las cuotas hijas no cuentan). */
export async function bandejaDeEntrada(sesion: SesionHogar): Promise<MovimientoLista[]> {
  const [{ data }, nombres] = await Promise.all([
    sesion.supabase
      .from("movimientos")
      .select(CAMPOS)
      .eq("hogar_id", sesion.hogarId)
      .is("categoria_id", null)
      .is("compra_id", null)
      .in("tipo", ["gasto", "ingreso"])
      .order("creado_el", { ascending: false })
      .limit(20),
    nombresDeMiembros(sesion),
  ]);
  return ((data ?? []) as unknown as FilaCruda[]).map((f) =>
    aMovimiento(f, sesion.userId, nombres),
  );
}

/** Historial categorizado, más nuevo primero. */
export async function movimientosCategorizados(
  sesion: SesionHogar,
  opciones: { limite?: number; buscar?: string; ambito?: "hogar" | "personal" } = {},
): Promise<MovimientoLista[]> {
  let consulta = sesion.supabase
    .from("movimientos")
    .select(CAMPOS)
    .eq("hogar_id", sesion.hogarId)
    .not("categoria_id", "is", null)
    .in("tipo", ["gasto", "ingreso"])
    .order("fecha", { ascending: false })
    .order("creado_el", { ascending: false })
    .limit(opciones.limite ?? 60);
  if (opciones.buscar) {
    consulta = consulta.ilike("descripcion", `%${opciones.buscar}%`);
  }
  if (opciones.ambito === "hogar") consulta = consulta.eq("visibilidad", "compartido");
  if (opciones.ambito === "personal")
    consulta = consulta.eq("visibilidad", "personal").eq("user_id", sesion.userId);
  const [{ data }, nombres] = await Promise.all([consulta, nombresDeMiembros(sesion)]);
  return ((data ?? []) as unknown as FilaCruda[]).map((f) =>
    aMovimiento(f, sesion.userId, nombres),
  );
}

export type CategoriaSimple = {
  id: string;
  nombre: string;
  icono: string;
  grupo: string;
  ambito: "hogar" | "personal";
};

export async function categoriasDelHogar(sesion: SesionHogar): Promise<CategoriaSimple[]> {
  const { data } = await sesion.supabase
    .from("categorias")
    .select("id, nombre, icono, grupo, ambito")
    .eq("hogar_id", sesion.hogarId)
    .order("orden", { ascending: true });
  return (data ?? []) as CategoriaSimple[];
}

/**
 * Las 8 categorías recientes del usuario para la grilla de alta rápida:
 * por frecuencia de uso en los últimos 60 días, completadas por orden.
 */
export async function categoriasRecientes(
  sesion: SesionHogar,
  ambito: "hogar" | "personal",
): Promise<CategoriaSimple[]> {
  const todas = (await categoriasDelHogar(sesion)).filter((c) => c.ambito === ambito);
  const desde = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
  const { data: usos } = await sesion.supabase
    .from("movimientos")
    .select("categoria_id")
    .eq("hogar_id", sesion.hogarId)
    .eq("tipo", "gasto")
    .gte("fecha", desde)
    .not("categoria_id", "is", null);
  const conteo = new Map<string, number>();
  for (const u of usos ?? []) {
    conteo.set(u.categoria_id, (conteo.get(u.categoria_id) ?? 0) + 1);
  }
  return [...todas]
    .sort((a, b) => (conteo.get(b.id) ?? 0) - (conteo.get(a.id) ?? 0))
    .slice(0, 8);
}

export type TotalesMes = {
  ingresosCentavos: number;
  gastosCentavos: number;
};

/**
 * Totales del mes para el totalizador: lo que entró y lo que salió (gasto e
 * ingreso; transferencias y pagos de resumen no son ni una cosa ni la otra).
 * Incluye lo compartido y lo personal tuyo — es "tu mes", no el del hogar.
 */
export async function totalesDelMes(sesion: SesionHogar, mes: string): Promise<TotalesMes> {
  const hasta = ultimoDiaDelMes(mes);
  const { data } = await sesion.supabase
    .from("movimientos")
    .select("tipo, importe_centavos")
    .eq("hogar_id", sesion.hogarId)
    .in("tipo", ["gasto", "ingreso"])
    .gte("fecha", mes)
    .lte("fecha", hasta);
  let ingresos = 0;
  let gastos = 0;
  for (const m of data ?? []) {
    if (m.tipo === "ingreso") ingresos += m.importe_centavos;
    else gastos += m.importe_centavos;
  }
  return { ingresosCentavos: ingresos, gastosCentavos: gastos };
}

export type MedioDePago =
  | { tipo: "cuenta"; id: string; nombre: string; etiqueta: string }
  | {
      tipo: "tarjeta";
      id: string;
      nombre: string;
      etiqueta: string;
      /** los 4 últimos, sueltos: con eso se matchea un comprobante leído */
      ultimos4: string | null;
      cicloCierre: string | null; // YYYY-MM-DD del ciclo abierto
      cicloEstado: "estimado" | "confirmado" | null;
    };

/** Cuentas y tarjetas activas como chips de medio de pago (03). */
export async function mediosDePago(sesion: SesionHogar): Promise<MedioDePago[]> {
  const [{ data: cuentas }, { data: tarjetas }] = await Promise.all([
    sesion.supabase
      .from("cuentas")
      .select("id, nombre, tipo")
      .eq("hogar_id", sesion.hogarId)
      .eq("activa", true)
      .neq("tipo", "inversion")
      .order("creado_el"),
    sesion.supabase
      .from("tarjetas")
      .select("id, nombre, red, ultimos4, ciclos_tarjeta(id, fecha_cierre, estado_fechas, estado)")
      .eq("hogar_id", sesion.hogarId)
      .eq("activa", true)
      .order("creado_el"),
  ]);

  const medios: MedioDePago[] = (cuentas ?? []).map((c) => ({
    tipo: "cuenta",
    id: c.id,
    nombre: c.nombre,
    etiqueta: c.nombre === "Mercado Pago" ? "MP" : c.nombre,
  }));

  const hoy = hoyBA();
  for (const t of tarjetas ?? []) {
    // el ciclo que muestra la alta rápida tiene que ser el MISMO al que caerá
    // el gasto de hoy: el primer cierre >= hoy (espeja asignarCiclo), no el
    // primer "abierto" a secas (que podría ser uno cuyo cierre ya pasó)
    const abierto = (t.ciclos_tarjeta ?? [])
      .filter((c: { fecha_cierre: string }) => c.fecha_cierre >= hoy)
      .sort((a: { fecha_cierre: string }, b: { fecha_cierre: string }) =>
        a.fecha_cierre.localeCompare(b.fecha_cierre),
      )[0];
    medios.push({
      tipo: "tarjeta",
      id: t.id,
      nombre: t.nombre,
      etiqueta: `${t.red === "visa" ? "Visa" : t.red === "mastercard" ? "MC" : t.red} •• ${t.ultimos4}`,
      ultimos4: t.ultimos4 ?? null,
      cicloCierre: abierto?.fecha_cierre ?? null,
      cicloEstado: abierto?.estado_fechas ?? null,
    });
  }
  return medios;
}

/**
 * Gastos del mes agrupados por categoría, para la vista "Por categoría".
 *
 * Solo GASTOS: un ingreso no es algo "en lo que se te va la plata", y mezclarlo
 * daría porcentajes sin sentido. Lo sin categorizar tampoco entra — vive en la
 * bandeja y todavía no es nada.
 *
 * Sin `ambito` devuelve tu mes completo (lo compartido más lo tuyo personal),
 * que es lo que corresponde en Movimientos; con ámbito, se recorta como el
 * presupuesto de esa solapa.
 */
export async function gastosPorCategoria(
  sesion: SesionHogar,
  mes: string,
  ambito?: "hogar" | "personal",
): Promise<Array<{ clave: string; nombre: string; icono: string | null; centavos: number }>> {
  let consulta = sesion.supabase
    .from("movimientos")
    .select("categoria_id, importe_centavos, categorias(nombre, icono)")
    .eq("hogar_id", sesion.hogarId)
    .eq("tipo", "gasto")
    .gte("fecha", mes)
    .lte("fecha", ultimoDiaDelMes(mes))
    .not("categoria_id", "is", null);
  if (ambito === "hogar") consulta = consulta.eq("visibilidad", "compartido");
  if (ambito === "personal") {
    consulta = consulta.eq("visibilidad", "personal").eq("user_id", sesion.userId);
  }

  const { data } = await consulta;
  const porCategoria = new Map<string, { nombre: string; icono: string | null; centavos: number }>();
  for (const m of (data ?? []) as unknown as Array<{
    categoria_id: string;
    importe_centavos: number;
    categorias: { nombre: string; icono: string } | null;
  }>) {
    const previo = porCategoria.get(m.categoria_id);
    porCategoria.set(m.categoria_id, {
      nombre: previo?.nombre ?? m.categorias?.nombre ?? "Sin categoría",
      icono: previo?.icono ?? m.categorias?.icono ?? null,
      centavos: (previo?.centavos ?? 0) + m.importe_centavos,
    });
  }
  return [...porCategoria].map(([clave, v]) => ({ clave, ...v }));
}
