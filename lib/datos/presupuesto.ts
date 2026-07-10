import "server-only";
import { estadoPartida, type ResultadoEstadoPartida } from "@/lib/dominio/presupuesto";
import { diaDelMes, diasDelMes, hoyBA, mesAnterior, mesDe } from "@/lib/dominio/fechas";
import type { SesionHogar } from "./sesion";

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
  activa: boolean;
  nota: string | null;
  esAhorro: boolean;
  resultado: ResultadoEstadoPartida;
};

export type PresupuestoMes = {
  id: string;
  mes: string;
  asignadoCentavos: number;
  gastadoCentavos: number;
  disponibleCentavos: number;
  grupos: Array<{ grupo: string; partidas: PartidaConEstado[] }>;
};

type Ambito = "hogar" | "personal";

/** Gastos del mes por categoría (devengado: cuenta y tarjeta por igual). */
async function gastadosPorCategoria(
  sesion: SesionHogar,
  mes: string,
  ambito: Ambito,
): Promise<Map<string, number>> {
  const hasta = `${mes.slice(0, 7)}-${String(diasDelMes(mes)).padStart(2, "0")}`;
  let consulta = sesion.supabase
    .from("movimientos")
    .select("categoria_id, importe_centavos, visibilidad, user_id")
    .eq("hogar_id", sesion.hogarId)
    .eq("tipo", "gasto")
    .gte("fecha", mes)
    .lte("fecha", hasta)
    .not("categoria_id", "is", null);
  if (ambito === "hogar") {
    consulta = consulta.eq("visibilidad", "compartido");
  } else {
    consulta = consulta.eq("visibilidad", "personal").eq("user_id", sesion.userId);
  }
  const { data } = await consulta;
  const mapa = new Map<string, number>();
  for (const m of data ?? []) {
    mapa.set(m.categoria_id, (mapa.get(m.categoria_id) ?? 0) + m.importe_centavos);
  }
  return mapa;
}

async function buscarPresupuesto(sesion: SesionHogar, mes: string, ambito: Ambito) {
  let consulta = sesion.supabase
    .from("presupuestos")
    .select("id, mes, partidas_presupuesto(id, categoria_id, asignado_centavos, rollover, activa, fija, nota, categorias(nombre, grupo, icono, orden))")
    .eq("hogar_id", sesion.hogarId)
    .eq("mes", mes)
    .eq("ambito", ambito);
  if (ambito === "personal") consulta = consulta.eq("user_id", sesion.userId);
  const { data } = await consulta.maybeSingle();
  return data;
}

/**
 * Arrastre de rollover para las partidas que acumulan: sobra del mes anterior
 * (asignado + su arrastre − gastado, nunca negativo), encadenado hacia atrás
 * hasta 12 meses o hasta que no haya presupuesto.
 */
async function calcularArrastres(
  sesion: SesionHogar,
  mes: string,
  ambito: Ambito,
  categoriasRollover: string[],
): Promise<Map<string, number>> {
  const arrastres = new Map<string, number>();
  if (categoriasRollover.length === 0) return arrastres;

  // recolectar la cadena de meses anteriores con presupuesto
  type MesDatos = { asignados: Map<string, number>; gastados: Map<string, number> };
  const cadena: MesDatos[] = [];
  let cursor = mesAnterior(mes);
  for (let i = 0; i < 12; i++) {
    const presu = await buscarPresupuesto(sesion, cursor, ambito);
    if (!presu) break;
    const asignados = new Map<string, number>();
    for (const p of presu.partidas_presupuesto ?? []) {
      if (p.rollover && p.activa && categoriasRollover.includes(p.categoria_id)) {
        asignados.set(p.categoria_id, p.asignado_centavos);
      }
    }
    cadena.push({ asignados, gastados: await gastadosPorCategoria(sesion, cursor, ambito) });
    cursor = mesAnterior(cursor);
  }

  // del mes más viejo al más nuevo: sobra(M) = asignado + sobra(M-1) − gastado
  for (const cat of categoriasRollover) {
    let sobra = 0;
    for (let i = cadena.length - 1; i >= 0; i--) {
      const asignado = cadena[i].asignados.get(cat);
      if (asignado === undefined) {
        sobra = 0; // el mes no tenía la partida con rollover: se corta la cadena
        continue;
      }
      const gastado = cadena[i].gastados.get(cat) ?? 0;
      sobra = Math.max(0, asignado + sobra - gastado);
    }
    arrastres.set(cat, sobra);
  }
  return arrastres;
}

export async function obtenerPresupuestoMes(
  sesion: SesionHogar,
  mes: string,
  ambito: Ambito,
): Promise<PresupuestoMes | null> {
  const presu = await buscarPresupuesto(sesion, mes, ambito);
  if (!presu) return null;

  const hoy = hoyBA();
  const enElMes = mesDe(hoy) === mes;
  const dia = enElMes ? diaDelMes(hoy) : diasDelMes(mes);
  const dias = diasDelMes(mes);

  const gastados = await gastadosPorCategoria(sesion, mes, ambito);
  const filas = (presu.partidas_presupuesto ?? []) as unknown as Array<{
    id: string;
    categoria_id: string;
    asignado_centavos: number;
    rollover: boolean;
    activa: boolean;
    fija: boolean;
    nota: string | null;
    categorias: { nombre: string; grupo: string; icono: string; orden: number };
  }>;

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
      const esAhorro = f.categorias.grupo === "Ahorro";
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
        activa: f.activa,
        nota: f.nota,
        esAhorro,
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

  const grupos: Array<{ grupo: string; partidas: PartidaConEstado[] }> = [];
  for (const p of partidas) {
    const grupo = grupos.find((g) => g.grupo === p.grupo);
    if (grupo) grupo.partidas.push(p);
    else grupos.push({ grupo: p.grupo, partidas: [p] });
  }

  return {
    id: presu.id,
    mes,
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
 */
export async function sugerenciasRecurrentes(
  sesion: SesionHogar,
  mes: string,
): Promise<SugerenciaRecurrente[]> {
  const { data: recurrentes } = await sesion.supabase
    .from("recurrentes")
    .select("id, descripcion, categoria_id, importe_sugerido_centavos, dia_mes, categorias(nombre)")
    .eq("hogar_id", sesion.hogarId)
    .eq("activa", true);
  if (!recurrentes || recurrentes.length === 0) return [];

  const hasta = `${mes.slice(0, 7)}-${String(diasDelMes(mes)).padStart(2, "0")}`;
  const { data: movsDelMes } = await sesion.supabase
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
