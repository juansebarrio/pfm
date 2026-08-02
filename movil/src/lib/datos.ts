import { estadoPartida, type ResultadoEstadoPartida } from "@dominio/presupuesto";
import { proyectadoResumen } from "@dominio/tarjetas";
import { formatearImporte as formatearImporteLocal, usdAArs } from "@dominio/dinero";
import {
  diaDelMes,
  diasEntre,
  diasDelMes,
  formatearDiaCorto,
  hoyBA,
  mesAnterior,
  mesDe,
  ultimoDiaDelMes,
} from "@dominio/fechas";
import type { Href } from "expo-router";
import { supabase } from "./supabase";

// Capa de datos. Las consultas son las MISMAS que en lib/datos/ de la web —
// lo único que cambia es de dónde sale el cliente de Supabase (acá, el módulo
// importado; en la web, sesion.supabase). La RLS filtra por hogar y
// visibilidad igual que siempre, así que no hace falta backend intermedio.

type Ambito = "hogar" | "personal";

export type SesionHogar = {
  userId: string;
  hogarId: string;
  nombreMiembro: string;
  rol: "administrador" | "miembro";
};

// Mismas categorías que ofrece la web al crear un hogar (lib/datos/sesion.ts).
const CATEGORIAS_SUGERIDAS: Array<[string, string, string]> = [
  ["Vivienda", "Alquiler", "house"],
  ["Vivienda", "Expensas", "building-2"],
  ["Comida", "Supermercado", "shopping-cart"],
  ["Comida", "Delivery", "bike"],
  ["Comida", "Restaurantes", "utensils"],
  ["Ahorro", "Ahorro e inversión", "piggy-bank"],
  ["Salud", "Prepaga", "heart-pulse"],
  ["Salud", "Farmacia", "pill"],
  ["Servicios", "Luz", "zap"],
  ["Servicios", "Internet", "wifi"],
  ["Servicios", "Celular", "smartphone"],
  ["Suscripciones", "Suscripciones", "tv"],
  ["Transporte", "Nafta", "fuel"],
  ["Transporte", "SUBE", "bus"],
  ["Entretenimiento", "Entretenimiento", "clapperboard"],
  // Ingresos: grupo especial, solo aparece al cargar/categorizar un ingreso
  ["Ingresos", "Sueldo", "banknote"],
  ["Ingresos", "Honorarios", "briefcase"],
  ["Ingresos", "Otros ingresos", "hand-coins"],
];

// Deduplica llamadas concurrentes: al primer arranque varias pantallas piden la
// sesión a la vez, y si el usuario es nuevo cada una intentaría crear SU hogar.
// Compartiendo la promesa en curso, el bootstrap corre exactamente una vez.
let enCurso: Promise<SesionHogar | null> | null = null;

/**
 * Usuario + su hogar activo (el último al que se sumó). Si el usuario recién
 * se registró y no tiene hogar, se le crea uno con las categorías sugeridas —
 * espeja obtenerSesionHogar de lib/datos/sesion.ts, mismo onboarding sin
 * fricción en los dos clientes.
 */
export function obtenerSesionHogar(): Promise<SesionHogar | null> {
  enCurso ??= buscarOCrearSesion().finally(() => {
    enCurso = null;
  });
  return enCurso;
}

async function buscarOCrearSesion(): Promise<SesionHogar | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: miembro, error: errMiembro } = await supabase
    .from("miembros_hogar")
    .select("hogar_id, rol, nombre")
    .eq("user_id", user.id)
    .order("creado_el", { ascending: false })
    .limit(1)
    .maybeSingle();
  // Un error de red acá NO es "usuario sin hogar": si se confunden, el
  // bootstrap le crea un hogar nuevo a alguien que ya tiene el suyo.
  if (errMiembro) return null;

  if (miembro) {
    return {
      userId: user.id,
      hogarId: miembro.hogar_id,
      nombreMiembro: miembro.nombre,
      rol: miembro.rol,
    };
  }

  // primer ingreso: hogar propio + categorías sugeridas
  const nombre =
    (user.user_metadata?.nombre as string | undefined) ??
    user.email?.split("@")[0] ??
    "Yo";
  const { data: hogarId, error } = await supabase.rpc("crear_hogar", {
    nombre_hogar: "Mi hogar",
    nombre_miembro: nombre,
  });
  if (error || !hogarId) return null;
  // igual que en la web: insertar solo si el hogar sigue sin categorías
  // (el doble bootstrap concurrente duplicaba las 15)
  const { data: yaTiene } = await supabase
    .from("categorias")
    .select("id")
    .eq("hogar_id", hogarId)
    .limit(1);
  if (!yaTiene || yaTiene.length === 0) {
    await supabase.from("categorias").insert(
      CATEGORIAS_SUGERIDAS.map(([grupo, nombreCat, icono], i) => ({
        hogar_id: hogarId,
        grupo,
        nombre: nombreCat,
        icono,
        ambito: "hogar",
        orden: i,
      })),
    );
  }

  return { userId: user.id, hogarId, nombreMiembro: nombre, rol: "administrador" };
}

export type TotalesMes = { ingresosCentavos: number; gastosCentavos: number };

/**
 * Totales del mes para el totalizador: lo que entró y lo que salió (gasto e
 * ingreso; transferencias y pagos de resumen no son ni una cosa ni la otra).
 */
export async function totalesDelMes(sesion: SesionHogar, mes: string): Promise<TotalesMes> {
  const hasta = ultimoDiaDelMes(mes);
  const { data } = await supabase
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

// ──────────────────────────────────────────────────────── presupuesto

export type PartidaConEstado = {
  id: string;
  categoriaId: string;
  nombre: string;
  grupo: string;
  icono: string;
  asignadoCentavos: number;
  gastadoCentavos: number;
  rolloverCentavos: number;
  fija: boolean;
  rollover: boolean;
  nota: string | null;
  esAhorro: boolean;
  resultado: ResultadoEstadoPartida;
};

export type PresupuestoMes = {
  asignadoCentavos: number;
  gastadoCentavos: number;
  disponibleCentavos: number;
  grupos: Array<{ grupo: string; partidas: PartidaConEstado[] }>;
};

type FilaPartida = {
  id: string;
  categoria_id: string;
  asignado_centavos: number;
  rollover: boolean;
  activa: boolean;
  fija: boolean;
  nota: string | null;
  categorias: { nombre: string; grupo: string; icono: string; orden: number };
};

async function buscarPresupuesto(sesion: SesionHogar, mes: string, ambito: Ambito) {
  let consulta = supabase
    .from("presupuestos")
    .select(
      "id, mes, partidas_presupuesto(id, categoria_id, asignado_centavos, rollover, activa, fija, nota, categorias(nombre, grupo, icono, orden))",
    )
    .eq("hogar_id", sesion.hogarId)
    .eq("mes", mes)
    .eq("ambito", ambito);
  consulta =
    ambito === "personal"
      ? consulta.eq("user_id", sesion.userId)
      : consulta.is("user_id", null);
  const { data } = await consulta.maybeSingle();
  return data;
}

/** Gastos del mes por categoría (devengado: cuenta y tarjeta por igual). */
async function gastadosPorCategoria(
  sesion: SesionHogar,
  mes: string,
  ambito: Ambito,
): Promise<Map<string, number>> {
  const hasta = `${mes.slice(0, 7)}-${String(diasDelMes(mes)).padStart(2, "0")}`;
  let consulta = supabase
    .from("movimientos")
    .select("categoria_id, importe_centavos")
    .eq("hogar_id", sesion.hogarId)
    .eq("tipo", "gasto")
    .gte("fecha", mes)
    .lte("fecha", hasta)
    .not("categoria_id", "is", null);
  consulta =
    ambito === "hogar"
      ? consulta.eq("visibilidad", "compartido")
      : consulta.eq("visibilidad", "personal").eq("user_id", sesion.userId);

  const { data } = await consulta;
  const mapa = new Map<string, number>();
  for (const m of data ?? []) {
    mapa.set(m.categoria_id, (mapa.get(m.categoria_id) ?? 0) + m.importe_centavos);
  }
  return mapa;
}

/** sobra(M) = asignado + sobra(M−1) − gastado, encadenado hasta 12 meses atrás. */
async function calcularArrastres(
  sesion: SesionHogar,
  mes: string,
  ambito: Ambito,
  categoriasRollover: string[],
): Promise<Map<string, number>> {
  const arrastres = new Map<string, number>();
  if (categoriasRollover.length === 0) return arrastres;

  const cadena: Array<{ asignados: Map<string, number>; gastados: Map<string, number> }> = [];
  let cursor = mesAnterior(mes);
  for (let i = 0; i < 12; i++) {
    const presu = await buscarPresupuesto(sesion, cursor, ambito);
    if (!presu) break;
    const asignados = new Map<string, number>();
    for (const p of (presu.partidas_presupuesto ?? []) as unknown as FilaPartida[]) {
      if (p.rollover && p.activa && categoriasRollover.includes(p.categoria_id)) {
        asignados.set(p.categoria_id, p.asignado_centavos);
      }
    }
    cadena.push({ asignados, gastados: await gastadosPorCategoria(sesion, cursor, ambito) });
    cursor = mesAnterior(cursor);
  }

  for (const cat of categoriasRollover) {
    let sobra = 0;
    for (let i = cadena.length - 1; i >= 0; i--) {
      const asignado = cadena[i].asignados.get(cat);
      if (asignado === undefined) {
        sobra = 0; // el mes no tenía la partida con rollover: se corta la cadena
        continue;
      }
      sobra = Math.max(0, asignado + sobra - (cadena[i].gastados.get(cat) ?? 0));
    }
    arrastres.set(cat, sobra);
  }
  return arrastres;
}

export async function obtenerPresupuestoMes(
  sesion: SesionHogar,
  mes: string,
  ambito: Ambito = "hogar",
): Promise<PresupuestoMes | null> {
  const presu = await buscarPresupuesto(sesion, mes, ambito);
  if (!presu) return null;

  const hoy = hoyBA();
  const enElMes = mesDe(hoy) === mes;
  const dias = diasDelMes(mes);
  const dia = enElMes ? diaDelMes(hoy) : dias;

  const filas = (presu.partidas_presupuesto ?? []) as unknown as FilaPartida[];
  const gastados = await gastadosPorCategoria(sesion, mes, ambito);
  const arrastres = await calcularArrastres(
    sesion,
    mes,
    ambito,
    filas.filter((f) => f.rollover && f.activa).map((f) => f.categoria_id),
  );

  const partidas: PartidaConEstado[] = filas
    .filter((f) => f.activa)
    .sort((a, b) => a.categorias.orden - b.categorias.orden)
    .map((f) => {
      const gastado = gastados.get(f.categoria_id) ?? 0;
      const arrastre = arrastres.get(f.categoria_id) ?? 0;
      return {
        id: f.id,
        categoriaId: f.categoria_id,
        nombre: f.categorias.nombre,
        grupo: f.categorias.grupo,
        icono: f.categorias.icono,
        asignadoCentavos: f.asignado_centavos,
        gastadoCentavos: gastado,
        rolloverCentavos: arrastre,
        fija: f.fija,
        rollover: f.rollover,
        nota: f.nota,
        esAhorro: f.categorias.grupo === "Ahorro",
        // ⭐ misma función de dominio que usa la web
        resultado: estadoPartida({
          asignadoCentavos: f.asignado_centavos,
          gastadoCentavos: gastado,
          rolloverCentavos: arrastre,
          fija: f.fija,
          rollover: f.rollover,
          diaDelMes: dia,
          diasDelMes: dias,
        }),
      };
    });

  const asignado = partidas.reduce((s, p) => s + p.asignadoCentavos, 0);
  const gastado = partidas.reduce((s, p) => s + p.gastadoCentavos, 0);

  const grupos: PresupuestoMes["grupos"] = [];
  for (const p of partidas) {
    const g = grupos.find((x) => x.grupo === p.grupo);
    if (g) g.partidas.push(p);
    else grupos.push({ grupo: p.grupo, partidas: [p] });
  }

  return {
    asignadoCentavos: asignado,
    gastadoCentavos: gastado,
    disponibleCentavos: asignado - gastado,
    grupos,
  };
}

export type SugerenciaRecurrente = {
  id: string;
  descripcion: string;
  categoriaId: string | null;
  categoriaNombre: string | null;
  importeSugeridoCentavos: number;
  diaMes: number;
  fechaVencimiento: string; // YYYY-MM-DD dentro del mes
};

/**
 * Recurrentes del hogar que todavía no tienen movimiento este mes.
 * Nunca se autoinsertan: son filas fantasma que se confirman con un tap.
 * Espeja sugerenciasRecurrentes de lib/datos/presupuesto.ts de la web.
 */
export async function sugerenciasRecurrentes(
  sesion: SesionHogar,
  mes: string,
): Promise<SugerenciaRecurrente[]> {
  const { data: recurrentes } = await supabase
    .from("recurrentes")
    .select("id, descripcion, categoria_id, importe_sugerido_centavos, dia_mes, categorias(nombre)")
    .eq("hogar_id", sesion.hogarId)
    .eq("activa", true);
  if (!recurrentes || recurrentes.length === 0) return [];

  const hasta = ultimoDiaDelMes(mes);
  const { data: movsDelMes } = await supabase
    .from("movimientos")
    .select("categoria_id")
    .eq("hogar_id", sesion.hogarId)
    .eq("tipo", "gasto")
    .gte("fecha", mes)
    .lte("fecha", hasta)
    .not("categoria_id", "is", null);
  const categoriasConGasto = new Set((movsDelMes ?? []).map((m) => m.categoria_id));

  return recurrentes
    .filter((r) => !r.categoria_id || !categoriasConGasto.has(r.categoria_id))
    .map((r) => ({
      id: r.id,
      descripcion: r.descripcion,
      categoriaId: r.categoria_id,
      categoriaNombre:
        (r.categorias as unknown as { nombre: string } | null)?.nombre ?? null,
      importeSugeridoCentavos: r.importe_sugerido_centavos,
      diaMes: r.dia_mes,
      fechaVencimiento: `${mes.slice(0, 7)}-${String(r.dia_mes).padStart(2, "0")}`,
    }));
}

// ──────────────────────────────────────────────────────── movimientos

export type MovimientoFila = {
  id: string;
  descripcion: string;
  importeCentavos: number;
  fecha: string;
  esIngreso: boolean;
  categoria: string | null;
  icono: string | null;
  medio: string | null;
  ambito: "hogar" | "personal";
  badgeCuota?: string;
  /**
   * Ciclo de tarjeta al que devenga el gasto, si sigue abierto — la web lo
   * muestra como "· cierra 28 jul". `estado` es el de las FECHAS del ciclo
   * (estimadas o confirmadas), para poder marcar la fecha como estimada.
   */
  cierreCiclo: { fechaCierre: string; estado: "estimado" | "confirmado" } | null;
  /** lo que solo mira el detalle: la lista no los usa */
  tipo: "gasto" | "ingreso" | "transferencia" | "pago_resumen";
  /**
   * Nombre del miembro que lo cargó, para la fila "Cargado por". Null en un
   * hogar de una sola persona: ahí la pregunta no existe y la fila sería ruido
   * en cada movimiento.
   */
  cargadoPor: string | null;
  esPropio: boolean;
  nota: string | null;
  nCuotasTotal: number | null;
  /** para el formulario de edición */
  categoriaId: string | null;
  medioTipo: "cuenta" | "tarjeta" | null;
  medioId: string | null;
  esCuota: boolean;
};

type FilaMovimientoDb = {
  id: string;
  descripcion: string;
  importe_centavos: number;
  fecha: string;
  tipo: string;
  visibilidad: string;
  user_id: string;
  n_cuota: number | null;
  nota: string | null;
  compra_id: string | null;
  cuenta_id: string | null;
  tarjeta_id: string | null;
  categorias: { id: string; nombre: string; icono: string } | null;
  cuentas: { nombre: string } | null;
  tarjetas: { nombre: string; ultimos4: string } | null;
  ciclos_tarjeta: {
    fecha_cierre: string;
    estado_fechas: "estimado" | "confirmado";
    estado: string;
  } | null;
  compras_en_cuotas: { n_cuotas: number } | null;
};

// OJO: movimientos tiene DOS FK a cuentas (cuenta_id y cuenta_destino_id), así
// que el embed hay que desambiguarlo por nombre de constraint o PostgREST falla.
const SELECT_MOVIMIENTO =
  "id, descripcion, importe_centavos, fecha, tipo, visibilidad, user_id, n_cuota, nota, " +
  "compra_id, cuenta_id, tarjeta_id, " +
  "categorias(id, nombre, icono), cuentas!movimientos_cuenta_id_fkey(nombre), " +
  "tarjetas(nombre, ultimos4), ciclos_tarjeta(fecha_cierre, estado_fechas, estado), " +
  "compras_en_cuotas(n_cuotas)";

/**
 * Nombre de cada miembro del hogar, por user_id — lo que contesta "¿esto lo
 * cargaste vos o yo?" en el detalle.
 *
 * Va aparte y no embebido en SELECT_MOVIMIENTO porque no hay por dónde
 * embeberlo: `movimientos.user_id` referencia `auth.users`, igual que
 * `miembros_hogar.user_id`, y sin FK entre las dos tablas PostgREST no ve la
 * relación. Es una consulta de dos filas y sale en paralelo con la lista.
 * Espeja nombresDeMiembros de lib/datos/movimientos.ts (web).
 */
export async function nombresDeMiembros(
  sesion: SesionHogar,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from("miembros_hogar")
    .select("user_id, nombre")
    .eq("hogar_id", sesion.hogarId);
  return new Map<string, string>((data ?? []).map((m) => [m.user_id, m.nombre]));
}

/** El contexto que `aFila` necesita para resolver "cargado por". */
type QuienCarga = { userId: string; nombres: Map<string, string> };

function aFila(m: FilaMovimientoDb, quien: QuienCarga): MovimientoFila {
  // "Visa Galicia •• 4321" o "Mercado Pago"
  const medio = m.tarjetas
    ? `${m.tarjetas.nombre} •• ${m.tarjetas.ultimos4}`
    : (m.cuentas?.nombre ?? null);
  return {
    id: m.id,
    descripcion: m.descripcion,
    importeCentavos: m.importe_centavos,
    fecha: m.fecha,
    esIngreso: m.tipo === "ingreso",
    categoria: m.categorias?.nombre ?? null,
    icono: m.categorias?.icono ?? null,
    medio,
    ambito: m.visibilidad === "compartido" ? "hogar" : "personal",
    badgeCuota:
      m.n_cuota && m.compras_en_cuotas
        ? `CUOTA ${m.n_cuota}/${m.compras_en_cuotas.n_cuotas}`
        : undefined,
    // misma semántica que la web (app/(tabs)/movimientos/datos.ts): el cierre
    // solo interesa mientras el ciclo sigue abierto
    cierreCiclo:
      m.ciclos_tarjeta && m.ciclos_tarjeta.estado === "abierto"
        ? {
            fechaCierre: m.ciclos_tarjeta.fecha_cierre,
            estado: m.ciclos_tarjeta.estado_fechas,
          }
        : null,
    tipo: m.tipo as MovimientoFila["tipo"],
    // en un hogar de a uno siempre sos vos: la fila no aporta nada y no se manda
    cargadoPor: quien.nombres.size > 1 ? (quien.nombres.get(m.user_id) ?? null) : null,
    esPropio: m.user_id === quien.userId,
    nota: m.nota ?? null,
    nCuotasTotal: m.compras_en_cuotas?.n_cuotas ?? null,
    categoriaId: m.categorias?.id ?? null,
    medioTipo: m.tarjeta_id ? "tarjeta" : m.cuenta_id ? "cuenta" : null,
    medioId: m.tarjeta_id ?? m.cuenta_id ?? null,
    esCuota: m.compra_id !== null,
  };
}

/**
 * Historial: movimientos ya categorizados, del más nuevo al más viejo.
 *
 * Con `mes` (aaaa-mm-01) el historial se recorta a ese mes y el tope sube: el
 * límite natural pasa a ser el mes entero, y 40 cortaría en silencio uno cargado.
 */
export async function movimientosCategorizados(
  sesion: SesionHogar,
  opciones: { limite?: number; mes?: string } = {},
): Promise<MovimientoFila[]> {
  let consulta = supabase
    .from("movimientos")
    .select(SELECT_MOVIMIENTO)
    .eq("hogar_id", sesion.hogarId)
    .not("categoria_id", "is", null)
    .order("fecha", { ascending: false })
    .order("creado_el", { ascending: false })
    .limit(opciones.limite ?? (opciones.mes ? 300 : 40));
  if (opciones.mes) {
    consulta = consulta.gte("fecha", opciones.mes).lte("fecha", ultimoDiaDelMes(opciones.mes));
  }
  const [{ data }, nombres] = await Promise.all([consulta, nombresDeMiembros(sesion)]);
  return ((data ?? []) as unknown as FilaMovimientoDb[]).map((m) =>
    aFila(m, { userId: sesion.userId, nombres }),
  );
}

/**
 * Bandeja de entrada: lo que llegó sin categoría y espera un tap.
 * `compra_id is null` excluye las cuotas hijas — si no, una compra en 12 cuotas
 * metería 12 filas pendientes en la bandeja (se categoriza la compra, no cada
 * cuota).
 */
export async function bandejaDeEntrada(sesion: SesionHogar): Promise<MovimientoFila[]> {
  const [{ data }, nombres] = await Promise.all([
    supabase
      .from("movimientos")
      .select(SELECT_MOVIMIENTO)
      .eq("hogar_id", sesion.hogarId)
      .is("categoria_id", null)
      .is("compra_id", null)
      .in("tipo", ["gasto", "ingreso"])
      .order("creado_el", { ascending: false })
      .limit(20),
    nombresDeMiembros(sesion),
  ]);
  return ((data ?? []) as unknown as FilaMovimientoDb[]).map((m) =>
    aFila(m, { userId: sesion.userId, nombres }),
  );
}

// ──────────────────────────────────────────────────────── categorías recientes

/** ventana de "reciente" para ordenar la grilla del alta rápida */
const DIAS_RECIENTES = 60;
/** cuántos tiles entran antes del "todas →" (2 filas de 4, como la web) */
export const TOPE_RECIENTES = 8;

/**
 * Cuántas veces se usó cada categoría en los últimos 60 días.
 *
 * Es la mitad "de servidor" de categoriasRecientes de lib/datos/movimientos.ts
 * (web). Allá la función hace las dos consultas y devuelve las 8 ya recortadas;
 * acá se parte en dos porque el alta rápida cambia de ámbito y de tipo sin
 * volver al servidor: el conteo se pide UNA vez al montar y el recorte se
 * rehace en el cliente con cada toque del segmented.
 */
export async function usosDeCategorias(sesion: SesionHogar): Promise<Map<string, number>> {
  const desde = new Date(Date.now() - DIAS_RECIENTES * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("movimientos")
    .select("categoria_id")
    .eq("hogar_id", sesion.hogarId)
    .eq("tipo", "gasto")
    .gte("fecha", desde)
    .not("categoria_id", "is", null);
  const conteo = new Map<string, number>();
  for (const u of data ?? []) {
    conteo.set(u.categoria_id, (conteo.get(u.categoria_id) ?? 0) + 1);
  }
  return conteo;
}

/**
 * Las categorías recientes para la grilla del alta: por frecuencia de uso,
 * completadas por el orden del hogar (el sort es estable, así que las que nunca
 * usaste quedan en el orden en que las creaste). Espeja el recorte de
 * categoriasRecientes de lib/datos/movimientos.ts.
 */
export function categoriasRecientes<T extends { id: string }>(
  categorias: readonly T[],
  usos: Map<string, number>,
  tope: number = TOPE_RECIENTES,
): T[] {
  return [...categorias]
    .sort((a, b) => (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0))
    .slice(0, tope);
}

// ──────────────────────────────────────────────────────── avisos (resumen)

const DIAS_AVISO_TARJETA = 3;
const DIAS_AVISO_RECURRENTE = 10; // el export avisa Luz (18 jul) el día 10: ventana de 10 días

export type Aviso = {
  id: string;
  tipo: "cierre" | "vencimiento" | "recurrente" | "bandeja";
  titulo: string;
  meta: string;
  /** a dónde lleva el toque: cierre/vencimiento → la tarjeta, recurrente → presupuesto, bandeja → movimientos */
  href: Href;
  badge?: "estimada" | "confirmada";
  /** acción textual verde ("Categorizar"): sin acción, la card lleva chevron */
  accion?: string;
};

/** "cierra hoy" / "cierra mañana" / "cierra en N días". */
function fraseCierre(dias: number): string {
  if (dias === 0) return "cierra hoy";
  if (dias === 1) return "cierra mañana";
  return `cierra en ${dias} días`;
}

/** "Rappi, una transferencia y uno más" — primer gasto + ingreso + resto. */
function resumenBandeja(items: MovimientoFila[]): string {
  const fragmentos: string[] = [];
  const primerGasto = items.find((i) => !i.esIngreso);
  if (primerGasto) fragmentos.push(primerGasto.descripcion);
  if (items.some((i) => i.esIngreso)) fragmentos.push("una transferencia");
  const restantes = items.length - fragmentos.length;
  if (restantes > 0) fragmentos.push(`${restantes === 1 ? "uno" : restantes} más`);
  if (fragmentos.length === 1) return fragmentos[0];
  return `${fragmentos.slice(0, -1).join(", ")} y ${fragmentos[fragmentos.length - 1]}`;
}

/**
 * Avisos de "Para atender" (04). Espeja app/(tabs)/resumen/datos.ts de la web
 * en sus cuatro fuentes y su orden de prioridad: cierres de tarjeta cercanos,
 * vencimientos de resumen, recurrentes por vencer sin movimiento y bandeja con
 * pendientes. (La fuente "correo" no aplica: la feature Gmail está dormida y
 * el nativo no tiene pantalla de sugerencias.) El proyectado de cada ciclo =
 * consumos del ciclo + impuestos estimados de la tarjeta.
 */
export async function avisosParaAtender(sesion: SesionHogar): Promise<Aviso[]> {
  const hoy = hoyBA();
  const [{ data: tarjetas }, recurrentes, bandeja] = await Promise.all([
    supabase
      .from("tarjetas")
      .select(
        "id, nombre, impuestos_estimados_centavos, ciclos_tarjeta(id, fecha_cierre, fecha_vencimiento, estado_fechas, estado, total_real_centavos)",
      )
      .eq("hogar_id", sesion.hogarId)
      .eq("activa", true),
    sugerenciasRecurrentes(sesion, mesDe(hoy)),
    bandejaDeEntrada(sesion),
  ]);

  type Ciclo = {
    id: string;
    fecha_cierre: string;
    fecha_vencimiento: string;
    estado_fechas: "estimado" | "confirmado";
    estado: string;
    total_real_centavos: number | null;
  };
  type Tarjeta = {
    id: string;
    nombre: string;
    impuestos_estimados_centavos: number;
    ciclos_tarjeta: Ciclo[];
  };
  type Candidato = { tarjeta: Tarjeta; ciclo: Ciclo };

  const cierres: Array<Candidato & { dias: number }> = [];
  const vencimientos: Candidato[] = [];
  for (const t of (tarjetas ?? []) as unknown as Tarjeta[]) {
    for (const c of t.ciclos_tarjeta ?? []) {
      const aCierre = diasEntre(hoy, c.fecha_cierre);
      if (c.estado === "abierto" && aCierre >= 0 && aCierre <= DIAS_AVISO_TARJETA) {
        cierres.push({ tarjeta: t, ciclo: c, dias: aCierre });
      }
      const aVencimiento = diasEntre(hoy, c.fecha_vencimiento);
      if (aVencimiento >= 0 && aVencimiento <= DIAS_AVISO_TARJETA) {
        vencimientos.push({ tarjeta: t, ciclo: c });
      }
    }
  }

  // consumos por ciclo, para el proyectado (cierres y vencimientos sin total real)
  const idsConProyectado = [
    ...cierres.map((c) => c.ciclo.id),
    ...vencimientos
      .filter((v) => v.ciclo.total_real_centavos === null)
      .map((v) => v.ciclo.id),
  ];
  const consumos = new Map<string, number>();
  if (idsConProyectado.length > 0) {
    const { data } = await supabase
      .from("movimientos")
      .select("ciclo_id, importe_centavos")
      .eq("hogar_id", sesion.hogarId)
      .eq("tipo", "gasto")
      .in("ciclo_id", [...new Set(idsConProyectado)]);
    for (const m of data ?? []) {
      consumos.set(m.ciclo_id, (consumos.get(m.ciclo_id) ?? 0) + m.importe_centavos);
    }
  }

  // pagos de resumen ya aplicados a cada ciclo con vencimiento cercano
  const pagos = new Map<string, number>();
  if (vencimientos.length > 0) {
    const { data } = await supabase
      .from("movimientos")
      .select("ciclo_id, importe_centavos")
      .eq("hogar_id", sesion.hogarId)
      .eq("tipo", "pago_resumen")
      .in("ciclo_id", [...new Set(vencimientos.map((v) => v.ciclo.id))]);
    for (const m of data ?? []) {
      pagos.set(m.ciclo_id, (pagos.get(m.ciclo_id) ?? 0) + m.importe_centavos);
    }
  }

  const proyectado = (c: Candidato) =>
    (consumos.get(c.ciclo.id) ?? 0) + c.tarjeta.impuestos_estimados_centavos;
  const totalAPagar = (c: Candidato) => c.ciclo.total_real_centavos ?? proyectado(c);

  const avisos: Aviso[] = [];

  for (const c of cierres) {
    avisos.push({
      id: `cierre-${c.ciclo.id}`,
      tipo: "cierre",
      titulo: `${c.tarjeta.nombre} ${fraseCierre(c.dias)}`,
      meta: `proyectado ${formatearImporteLocal(proyectado(c))}`,
      href: `/tarjeta/${c.tarjeta.id}` as Href,
      badge: c.ciclo.estado_fechas === "confirmado" ? "confirmada" : "estimada",
    });
  }

  for (const v of vencimientos) {
    // si ya se pagó (total o más), el resumen dejó de estar pendiente: sin aviso
    if ((pagos.get(v.ciclo.id) ?? 0) >= totalAPagar(v)) continue;
    const total = v.ciclo.total_real_centavos;
    avisos.push({
      id: `vencimiento-${v.ciclo.id}`,
      tipo: "vencimiento",
      titulo: `Vence el resumen de ${v.tarjeta.nombre} el ${formatearDiaCorto(v.ciclo.fecha_vencimiento)}`,
      meta:
        total !== null
          ? formatearImporteLocal(total)
          : `proyectado ${formatearImporteLocal(proyectado(v))}`,
      href: `/tarjeta/${v.tarjeta.id}` as Href,
    });
  }

  for (const r of recurrentes) {
    const dias = diasEntre(hoy, r.fechaVencimiento);
    if (dias < 0 || dias > DIAS_AVISO_RECURRENTE) continue;
    avisos.push({
      id: `recurrente-${r.id}`,
      tipo: "recurrente",
      titulo: `Vence ${r.descripcion} el ${formatearDiaCorto(r.fechaVencimiento)}`,
      meta: `${formatearImporteLocal(r.importeSugeridoCentavos)} sugerido · recurrente`,
      href: "/presupuesto",
    });
  }

  if (bandeja.length > 0) {
    avisos.push({
      id: "bandeja",
      tipo: "bandeja",
      titulo:
        bandeja.length === 1
          ? "1 movimiento sin categorizar"
          : `${bandeja.length} movimientos sin categorizar`,
      meta: resumenBandeja(bandeja),
      href: "/movimientos",
      accion: "Categorizar",
    });
  }

  return avisos;
}

// ──────────────────────────────────────────────────────── medios (listado)

export type CuentaFila = {
  id: string;
  nombre: string;
  tipo: string;
  moneda: string;
  visibilidad: string;
  activa: boolean;
};

export type TarjetaFila = {
  id: string;
  nombre: string;
  banco: string;
  red: string;
  ultimos4: string;
  visibilidad: string;
  activa: boolean;
  diaCierre: number | null;
};

/** Activas primero; dentro de cada grupo, por orden de creación. */
function activasPrimero<T extends { activa: boolean }>(filas: T[]): T[] {
  return [...filas].sort((a, b) => Number(b.activa) - Number(a.activa));
}

export async function listarMedios(
  sesion: SesionHogar,
): Promise<{ cuentas: CuentaFila[]; tarjetas: TarjetaFila[] }> {
  const [{ data: cuentas }, { data: tarjetas }] = await Promise.all([
    supabase
      .from("cuentas")
      .select("id, nombre, tipo, moneda, visibilidad, activa")
      .eq("hogar_id", sesion.hogarId)
      .order("creado_el"),
    supabase
      .from("tarjetas")
      .select("id, nombre, banco, red, ultimos4, visibilidad, activa, dia_cierre")
      .eq("hogar_id", sesion.hogarId)
      .order("creado_el"),
  ]);
  return {
    cuentas: activasPrimero((cuentas ?? []) as CuentaFila[]),
    tarjetas: activasPrimero(
      (tarjetas ?? []).map((t) => ({
        id: t.id,
        nombre: t.nombre,
        banco: t.banco,
        red: t.red,
        ultimos4: t.ultimos4,
        visibilidad: t.visibilidad,
        activa: t.activa,
        diaCierre: t.dia_cierre,
      })),
    ),
  };
}

// ──────────────────────────────────────────────────────── tarjeta y cuotas

export type CicloFila = {
  id: string;
  fechaCierre: string;
  fechaVencimiento: string;
  estadoFechas: "estimado" | "confirmado";
  estado: "abierto" | "cerrado" | "conciliado";
  totalRealCentavos: number | null;
  /** consumos del ciclo + impuestos estimados de la tarjeta */
  proyectadoCentavos: number;
};

export type DetalleTarjeta = {
  nombre: string;
  banco: string;
  ultimos4: string;
  diaCierre: number | null;
  impuestosCentavos: number;
  ciclos: CicloFila[];
};

export async function obtenerTarjeta(
  sesion: SesionHogar,
  tarjetaId: string,
): Promise<DetalleTarjeta | null> {
  const { data: t } = await supabase
    .from("tarjetas")
    .select(
      "nombre, banco, ultimos4, dia_cierre, impuestos_estimados_centavos, ciclos_tarjeta(id, fecha_cierre, fecha_vencimiento, estado_fechas, estado, total_real_centavos)",
    )
    .eq("id", tarjetaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!t) return null;

  type C = {
    id: string;
    fecha_cierre: string;
    fecha_vencimiento: string;
    estado_fechas: "estimado" | "confirmado";
    estado: "abierto" | "cerrado" | "conciliado";
    total_real_centavos: number | null;
  };
  const ciclosDb = ((t.ciclos_tarjeta ?? []) as unknown as C[]).sort((a, b) =>
    b.fecha_cierre.localeCompare(a.fecha_cierre),
  );

  // consumos por ciclo, para el proyectado
  const consumos = new Map<string, number>();
  if (ciclosDb.length > 0) {
    const { data } = await supabase
      .from("movimientos")
      .select("ciclo_id, importe_centavos")
      .eq("hogar_id", sesion.hogarId)
      .eq("tipo", "gasto")
      .in("ciclo_id", ciclosDb.map((c) => c.id));
    for (const m of data ?? []) {
      consumos.set(m.ciclo_id, (consumos.get(m.ciclo_id) ?? 0) + m.importe_centavos);
    }
  }

  return {
    nombre: t.nombre,
    banco: t.banco,
    ultimos4: t.ultimos4,
    diaCierre: t.dia_cierre,
    impuestosCentavos: t.impuestos_estimados_centavos,
    ciclos: ciclosDb.map((c) => ({
      id: c.id,
      fechaCierre: c.fecha_cierre,
      fechaVencimiento: c.fecha_vencimiento,
      estadoFechas: c.estado_fechas,
      estado: c.estado,
      totalRealCentavos: c.total_real_centavos,
      proyectadoCentavos:
        (consumos.get(c.id) ?? 0) + t.impuestos_estimados_centavos,
    })),
  };
}

/**
 * Los consumos de un ciclo de tarjeta, con TODOS los campos del detalle.
 * Espeja movimientosDeCiclo de lib/datos/movimientos.ts (web): existe para que
 * las filas del detalle de ciclo abran el mismo detalle de movimiento que el
 * resto de la app. Los totales del ciclo los calcula totalesDeCiclo.
 */
export async function movimientosDeCiclo(
  sesion: SesionHogar,
  cicloId: string,
): Promise<MovimientoFila[]> {
  const [{ data }, nombres] = await Promise.all([
    supabase
      .from("movimientos")
      .select(SELECT_MOVIMIENTO)
      .eq("hogar_id", sesion.hogarId)
      .eq("ciclo_id", cicloId)
      .eq("tipo", "gasto")
      .order("fecha", { ascending: false })
      .order("creado_el", { ascending: false }),
    nombresDeMiembros(sesion),
  ]);
  return ((data ?? []) as unknown as FilaMovimientoDb[]).map((m) =>
    aFila(m, { userId: sesion.userId, nombres }),
  );
}

export type TotalesCiclo = {
  consumosCentavos: number; // sin cuotas
  cuotasCentavos: number; // cuotas del ciclo
  impuestosCentavos: number; // estimados de la tarjeta, tal cual llegan
  proyectadoCentavos: number; // consumos + cuotas + impuestos
  pagadoCentavos: number; // pagos de resumen aplicados a este ciclo
};

/**
 * Totales de un ciclo para el desglose de 06: consumos sueltos, cuotas del
 * mes, proyectado y pagado. Espeja los agregados de detalleCiclo de
 * lib/datos/tarjetas.ts (web), con la misma función de dominio para el
 * proyectado.
 */
export async function totalesDeCiclo(
  sesion: SesionHogar,
  cicloId: string,
  impuestosEstimadosCentavos: number,
): Promise<TotalesCiclo> {
  const { data } = await supabase
    .from("movimientos")
    .select("tipo, importe_centavos, compra_id")
    .eq("hogar_id", sesion.hogarId)
    .eq("ciclo_id", cicloId);

  let consumos = 0;
  let cuotas = 0;
  let pagado = 0;
  for (const m of (data ?? []) as Array<{
    tipo: string;
    importe_centavos: number;
    compra_id: string | null;
  }>) {
    if (m.tipo === "pago_resumen") pagado += m.importe_centavos;
    else if (m.tipo === "gasto") {
      if (m.compra_id !== null) cuotas += m.importe_centavos;
      else consumos += m.importe_centavos;
    }
  }

  return {
    consumosCentavos: consumos,
    cuotasCentavos: cuotas,
    impuestosCentavos: impuestosEstimadosCentavos,
    // ⭐ misma función de dominio que usa la web
    proyectadoCentavos: proyectadoResumen({
      consumosCentavos: consumos,
      cuotasCentavos: cuotas,
      impuestosCentavos: impuestosEstimadosCentavos,
    }),
    pagadoCentavos: pagado,
  };
}

export type CompraEnCuotas = {
  id: string;
  descripcion: string;
  totalCentavos: number;
  nCuotas: number;
  fecha: string;
  tarjeta: string | null;
  /** cuotas ya devengadas (fecha <= hoy) */
  pagadas: number;
  restanteCentavos: number;
};

/** Compras en cuotas con su progreso — pantalla 07. */
export async function comprasEnCuotas(
  sesion: SesionHogar,
): Promise<CompraEnCuotas[]> {
  const hoy = hoyBA();
  const { data } = await supabase
    .from("compras_en_cuotas")
    .select("id, descripcion, total_centavos, n_cuotas, fecha, tarjetas(nombre), movimientos(fecha, importe_centavos)")
    .eq("hogar_id", sesion.hogarId)
    .order("fecha", { ascending: false });

  type Fila = {
    id: string;
    descripcion: string;
    total_centavos: number;
    n_cuotas: number;
    fecha: string;
    tarjetas: { nombre: string } | null;
    movimientos: Array<{ fecha: string; importe_centavos: number }>;
  };

  return ((data ?? []) as unknown as Fila[])
    .map((c) => {
      const cuotas = c.movimientos ?? [];
      const pagadas = cuotas.filter((m) => m.fecha <= hoy).length;
      const restante = cuotas
        .filter((m) => m.fecha > hoy)
        .reduce((s, m) => s + m.importe_centavos, 0);
      return {
        id: c.id,
        descripcion: c.descripcion,
        totalCentavos: c.total_centavos,
        nCuotas: c.n_cuotas,
        fecha: c.fecha,
        tarjeta: c.tarjetas?.nombre ?? null,
        pagadas,
        restanteCentavos: restante,
      };
    })
    // las terminadas no interesan: la pantalla es de compromisos vigentes
    .filter((c) => c.pagadas < c.nCuotas);
}

// ──────────────────────────────────────────────────────── hogar

export type MiembroFila = {
  userId: string;
  nombre: string;
  rol: "administrador" | "miembro";
  esUsuarioActual: boolean;
};

export async function obtenerHogar(
  sesion: SesionHogar,
): Promise<{ nombre: string; miembros: MiembroFila[] }> {
  const [{ data: hogar }, { data: miembros }] = await Promise.all([
    supabase.from("hogares").select("nombre").eq("id", sesion.hogarId).maybeSingle(),
    supabase
      .from("miembros_hogar")
      .select("user_id, nombre, rol")
      .eq("hogar_id", sesion.hogarId)
      .order("creado_el"),
  ]);
  return {
    nombre: hogar?.nombre ?? "Mi hogar",
    miembros: (miembros ?? []).map((m) => ({
      userId: m.user_id,
      nombre: m.nombre,
      rol: m.rol,
      esUsuarioActual: m.user_id === sesion.userId,
    })),
  };
}

// ──────────────────────────────────────────────────────── patrimonio

export type TenenciaValuada = {
  id: string;
  nombre: string;
  detalle: string | null;
  valorArsCentavos: number;
  frescura: string;
  vieja: boolean;
  fraccionDelMaximo: number;
  porcentaje: number;
};

export type Patrimonio = {
  totalArsCentavos: number;
  tenencias: TenenciaValuada[];
  tcFuente: string | null;
  tcValorCentavos: number | null;
  /** Fecha YYYY-MM-DD de la cotización activa: el TC siempre se muestra con fecha (§1.2). */
  tcFecha: string | null;
};

const CONVERTIBLES_AL_TC = new Set(["dolar_billete", "dolar_mep"]);

/** "al TC de hoy" / "valuado hoy" / "hace 3 días" / "sin TC cargado". */
function textoFrescura(
  t: { instrumento: string; moneda: string; fechaValuacion: string; hayTc: boolean },
  hoy: string,
): { frescura: string; vieja: boolean } {
  // una tenencia en USD sin TC no se puede valuar: ámbar en vez de "$ 0"
  if (t.moneda === "USD" && !t.hayTc) return { frescura: "sin TC cargado", vieja: true };
  const dias = diasEntre(t.fechaValuacion, hoy);
  if (dias > 30) return { frescura: `valuación de hace ${dias} días`, vieja: true };
  if (CONVERTIBLES_AL_TC.has(t.instrumento)) return { frescura: "al TC de hoy", vieja: false };
  if (dias <= 0) return { frescura: "valuado hoy", vieja: false };
  if (dias === 1) return { frescura: "ayer", vieja: false };
  return { frescura: `hace ${dias} días`, vieja: false };
}

export async function obtenerPatrimonio(
  sesion: SesionHogar,
  fuente = "mep",
): Promise<Patrimonio> {
  const hoy = hoyBA();
  const [{ data: tcs }, { data: tenencias }] = await Promise.all([
    supabase
      .from("tipos_cambio")
      .select("fuente, valor_centavos, fecha")
      .eq("hogar_id", sesion.hogarId)
      .order("fecha", { ascending: false }),
    supabase
      .from("tenencias")
      .select("*")
      .eq("hogar_id", sesion.hogarId)
      .eq("activa", true),
  ]);

  // último valor cargado por fuente
  const porFuente = new Map<string, { valorCentavos: number; fecha: string }>();
  for (const t of tcs ?? []) {
    if (!porFuente.has(t.fuente))
      porFuente.set(t.fuente, { valorCentavos: t.valor_centavos, fecha: t.fecha });
  }
  const tcActivo =
    porFuente.get(fuente) ?? [...porFuente.values()][0] ?? null;
  const fuenteActiva = porFuente.has(fuente) ? fuente : ([...porFuente.keys()][0] ?? null);

  const valuadas = (tenencias ?? []).map((t) => {
    const valorArs =
      t.moneda === "USD" && t.cantidad_usd_centavos !== null && tcActivo
        ? usdAArs(t.cantidad_usd_centavos, tcActivo.valorCentavos)
        : (t.valuacion_centavos ?? 0);
    return {
      id: t.id as string,
      nombre: t.nombre as string,
      detalle: (t.detalle ?? null) as string | null,
      valorArsCentavos: valorArs,
      ...textoFrescura(
        {
          instrumento: t.instrumento,
          moneda: t.moneda,
          fechaValuacion: t.fecha_valuacion,
          hayTc: tcActivo !== null,
        },
        hoy,
      ),
    };
  });

  valuadas.sort((a, b) => b.valorArsCentavos - a.valorArsCentavos);
  const total = valuadas.reduce((s, t) => s + t.valorArsCentavos, 0);
  const maximo = valuadas[0]?.valorArsCentavos ?? 0;

  return {
    totalArsCentavos: total,
    // barras normalizadas al MÁXIMO, no al 100 % (regla del export, §3.28)
    tenencias: valuadas.map((t) => ({
      ...t,
      fraccionDelMaximo: maximo > 0 ? t.valorArsCentavos / maximo : 0,
      porcentaje: total > 0 ? Math.round((t.valorArsCentavos / total) * 100) : 0,
    })),
    tcFuente: fuenteActiva,
    tcValorCentavos: tcActivo?.valorCentavos ?? null,
    tcFecha: tcActivo?.fecha ?? null,
  };
}

/**
 * Gastos del mes agrupados por categoría, para la vista "Por categoría".
 * Espeja gastosPorCategoria de lib/datos/movimientos.ts.
 *
 * Solo GASTOS: un ingreso no es algo "en lo que se te va la plata". Lo sin
 * categorizar tampoco entra — vive en la bandeja y todavía no es nada.
 */
export async function gastosPorCategoria(
  sesion: SesionHogar,
  mes: string,
  ambito?: "hogar" | "personal",
): Promise<Array<{ clave: string; nombre: string; icono: string | null; centavos: number }>> {
  let consulta = supabase
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
