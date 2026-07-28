import { estadoPartida, type ResultadoEstadoPartida } from "@dominio/presupuesto";
import { formatearImporte as formatearImporteLocal, usdAArs } from "@dominio/dinero";
import {
  diaDelMes,
  diasEntre,
  diasDelMes,
  hoyBA,
  mesAnterior,
  mesDe,
} from "@dominio/fechas";
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

/** Usuario + su hogar activo (el último al que se sumó). */
export async function obtenerSesionHogar(): Promise<SesionHogar | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: miembro } = await supabase
    .from("miembros_hogar")
    .select("hogar_id, rol, nombre")
    .eq("user_id", user.id)
    .order("creado_el", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!miembro) return null;

  return {
    userId: user.id,
    hogarId: miembro.hogar_id,
    nombreMiembro: miembro.nombre,
    rol: miembro.rol,
  };
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
};

type FilaMovimientoDb = {
  id: string;
  descripcion: string;
  importe_centavos: number;
  fecha: string;
  tipo: string;
  visibilidad: string;
  n_cuota: number | null;
  categorias: { nombre: string; icono: string } | null;
  cuentas: { nombre: string } | null;
  tarjetas: { nombre: string; ultimos4: string } | null;
  compras_en_cuotas: { n_cuotas: number } | null;
};

// OJO: movimientos tiene DOS FK a cuentas (cuenta_id y cuenta_destino_id), así
// que el embed hay que desambiguarlo por nombre de constraint o PostgREST falla.
const SELECT_MOVIMIENTO =
  "id, descripcion, importe_centavos, fecha, tipo, visibilidad, n_cuota, " +
  "categorias(nombre, icono), cuentas!movimientos_cuenta_id_fkey(nombre), " +
  "tarjetas(nombre, ultimos4), compras_en_cuotas(n_cuotas)";

function aFila(m: FilaMovimientoDb): MovimientoFila {
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
  };
}

/** Historial: movimientos ya categorizados, del más nuevo al más viejo. */
export async function movimientosCategorizados(
  sesion: SesionHogar,
  limite = 40,
): Promise<MovimientoFila[]> {
  const { data } = await supabase
    .from("movimientos")
    .select(SELECT_MOVIMIENTO)
    .eq("hogar_id", sesion.hogarId)
    .not("categoria_id", "is", null)
    .order("fecha", { ascending: false })
    .order("creado_el", { ascending: false })
    .limit(limite);
  return ((data ?? []) as unknown as FilaMovimientoDb[]).map(aFila);
}

/**
 * Bandeja de entrada: lo que llegó sin categoría y espera un tap.
 * `compra_id is null` excluye las cuotas hijas — si no, una compra en 12 cuotas
 * metería 12 filas pendientes en la bandeja (se categoriza la compra, no cada
 * cuota).
 */
export async function bandejaDeEntrada(sesion: SesionHogar): Promise<MovimientoFila[]> {
  const { data } = await supabase
    .from("movimientos")
    .select(SELECT_MOVIMIENTO)
    .eq("hogar_id", sesion.hogarId)
    .is("categoria_id", null)
    .is("compra_id", null)
    .in("tipo", ["gasto", "ingreso"])
    .order("creado_el", { ascending: false })
    .limit(20);
  return ((data ?? []) as unknown as FilaMovimientoDb[]).map(aFila);
}

// ──────────────────────────────────────────────────────── avisos (resumen)

const DIAS_AVISO_TARJETA = 3;

export type Aviso = {
  id: string;
  tipo: "cierre" | "vencimiento" | "bandeja";
  titulo: string;
  meta: string;
  badge?: "estimada" | "confirmada";
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
 * Avisos de "Para atender" (04). Espeja app/(tabs)/resumen/datos.ts de la web:
 * cierres de tarjeta cercanos y bandeja con pendientes. El proyectado de cada
 * ciclo = consumos del ciclo + impuestos estimados de la tarjeta.
 */
export async function avisosParaAtender(sesion: SesionHogar): Promise<Aviso[]> {
  const hoy = hoyBA();
  const [{ data: tarjetas }, bandeja] = await Promise.all([
    supabase
      .from("tarjetas")
      .select(
        "id, nombre, impuestos_estimados_centavos, ciclos_tarjeta(id, fecha_cierre, estado_fechas, estado)",
      )
      .eq("hogar_id", sesion.hogarId)
      .eq("activa", true),
    bandejaDeEntrada(sesion),
  ]);

  type Ciclo = {
    id: string;
    fecha_cierre: string;
    estado_fechas: "estimado" | "confirmado";
    estado: string;
  };
  type Tarjeta = {
    id: string;
    nombre: string;
    impuestos_estimados_centavos: number;
    ciclos_tarjeta: Ciclo[];
  };

  const cierres: Array<{ tarjeta: Tarjeta; ciclo: Ciclo; dias: number }> = [];
  for (const t of (tarjetas ?? []) as unknown as Tarjeta[]) {
    for (const c of t.ciclos_tarjeta ?? []) {
      const dias = diasEntre(hoy, c.fecha_cierre);
      if (c.estado === "abierto" && dias >= 0 && dias <= DIAS_AVISO_TARJETA) {
        cierres.push({ tarjeta: t, ciclo: c, dias });
      }
    }
  }

  // consumos por ciclo, para el proyectado
  const consumos = new Map<string, number>();
  if (cierres.length > 0) {
    const { data } = await supabase
      .from("movimientos")
      .select("ciclo_id, importe_centavos")
      .eq("hogar_id", sesion.hogarId)
      .eq("tipo", "gasto")
      .in("ciclo_id", cierres.map((c) => c.ciclo.id));
    for (const m of data ?? []) {
      consumos.set(m.ciclo_id, (consumos.get(m.ciclo_id) ?? 0) + m.importe_centavos);
    }
  }

  const avisos: Aviso[] = cierres.map((c) => ({
    id: `cierre-${c.ciclo.id}`,
    tipo: "cierre" as const,
    titulo: `${c.tarjeta.nombre} ${fraseCierre(c.dias)}`,
    meta: `proyectado ${formatearImporteLocal(
      (consumos.get(c.ciclo.id) ?? 0) + c.tarjeta.impuestos_estimados_centavos,
    )}`,
    badge: c.ciclo.estado_fechas === "confirmado" ? ("confirmada" as const) : ("estimada" as const),
  }));

  if (bandeja.length > 0) {
    avisos.push({
      id: "bandeja",
      tipo: "bandeja",
      titulo:
        bandeja.length === 1
          ? "1 movimiento sin categorizar"
          : `${bandeja.length} movimientos sin categorizar`,
      meta: resumenBandeja(bandeja),
      accion: "Categorizar",
    });
  }

  return avisos;
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
  const porFuente = new Map<string, { valorCentavos: number }>();
  for (const t of tcs ?? []) {
    if (!porFuente.has(t.fuente)) porFuente.set(t.fuente, { valorCentavos: t.valor_centavos });
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
  };
}
