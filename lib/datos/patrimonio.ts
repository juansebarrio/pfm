import "server-only";
import { diasEntre, hoyBA } from "@/lib/dominio/fechas";
import { usdAArs } from "@/lib/dominio/dinero";
import type { SesionHogar } from "./sesion";

export type FuenteTC = "mep" | "blue" | "oficial";

export type TipoCambioActivo = {
  fuente: FuenteTC;
  valorCentavos: number;
  fecha: string;
};

/** Último valor cargado por fuente (carga manual; automática = fase siguiente). */
export async function tiposDeCambio(sesion: SesionHogar): Promise<TipoCambioActivo[]> {
  const { data } = await sesion.supabase
    .from("tipos_cambio")
    .select("fuente, valor_centavos, fecha")
    .eq("hogar_id", sesion.hogarId)
    .order("fecha", { ascending: false });
  const porFuente = new Map<FuenteTC, TipoCambioActivo>();
  for (const t of data ?? []) {
    if (!porFuente.has(t.fuente)) {
      porFuente.set(t.fuente, {
        fuente: t.fuente,
        valorCentavos: t.valor_centavos,
        fecha: t.fecha,
      });
    }
  }
  return [...porFuente.values()];
}

export type TenenciaValuada = {
  id: string;
  instrumento: string;
  nombre: string;
  detalle: string | null;
  moneda: "ARS" | "USD";
  cantidadUsdCentavos: number | null;
  valuacionCentavos: number | null;
  fechaValuacion: string;
  /** valor en ARS al TC activo (USD) o valuación manual (ARS) */
  valorArsCentavos: number;
  /** "al TC de hoy" | "valuado hoy" | "hace 3 días" | "valuación de hace 39 días" */
  frescura: string;
  /** más de 30 días: va en ámbar con acción de actualizar */
  vieja: boolean;
};

export type Patrimonio = {
  totalArsCentavos: number;
  tenencias: TenenciaValuada[]; // ordenadas por valor desc
  composicion: Array<{ nombre: string; porcentaje: number; fraccionDelMaximo: number }>;
  snapshots: Array<{ fecha: string; totalArsCentavos: number }>;
  tcActivo: TipoCambioActivo | null;
  tcTodos: TipoCambioActivo[];
};

const CONVERTIBLES_AL_TC = new Set(["dolar_billete", "dolar_mep"]);

function textoFrescura(t: {
  instrumento: string;
  moneda: string;
  fechaValuacion: string;
  hayTc: boolean;
}, hoy: string): { frescura: string; vieja: boolean } {
  // una tenencia en USD sin TC cargado no se puede valuar: se marca en ámbar
  // ("sin TC cargado") en vez de mostrar $ 0 "al TC de hoy" como si fuera real
  if (t.moneda === "USD" && !t.hayTc) {
    return { frescura: "sin TC cargado", vieja: true };
  }
  const dias = diasEntre(t.fechaValuacion, hoy);
  if (dias > 30) return { frescura: `valuación de hace ${dias} días`, vieja: true };
  if (CONVERTIBLES_AL_TC.has(t.instrumento)) return { frescura: "al TC de hoy", vieja: false };
  if (dias <= 0) return { frescura: "valuado hoy", vieja: false };
  if (dias === 1) return { frescura: "ayer", vieja: false };
  return { frescura: `hace ${dias} días`, vieja: false };
}

export async function obtenerPatrimonio(
  sesion: SesionHogar,
  fuente: FuenteTC = "mep",
): Promise<Patrimonio> {
  const hoy = hoyBA();
  const [tcTodos, { data: tenencias }, { data: snapshots }] = await Promise.all([
    tiposDeCambio(sesion),
    sesion.supabase
      .from("tenencias")
      .select("*")
      .eq("hogar_id", sesion.hogarId)
      .eq("activa", true),
    sesion.supabase
      .from("snapshots_patrimonio")
      .select("fecha, total_ars_centavos")
      .eq("hogar_id", sesion.hogarId)
      .order("fecha", { ascending: true })
      .limit(24),
  ]);

  const tcActivo = tcTodos.find((t) => t.fuente === fuente) ?? tcTodos[0] ?? null;

  const valuadas: TenenciaValuada[] = (tenencias ?? []).map((t) => {
    const valorArs =
      t.moneda === "USD" && t.cantidad_usd_centavos !== null && tcActivo
        ? usdAArs(t.cantidad_usd_centavos, tcActivo.valorCentavos)
        : (t.valuacion_centavos ?? 0);
    return {
      id: t.id,
      instrumento: t.instrumento,
      nombre: t.nombre,
      detalle: t.detalle,
      moneda: t.moneda,
      cantidadUsdCentavos: t.cantidad_usd_centavos,
      valuacionCentavos: t.valuacion_centavos,
      fechaValuacion: t.fecha_valuacion,
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
    tenencias: valuadas,
    // barras normalizadas al MÁXIMO, no al 100 % (regla del export, audit §3.28)
    composicion: valuadas.map((t) => ({
      nombre: t.nombre,
      porcentaje: total > 0 ? Math.round((t.valorArsCentavos / total) * 100) : 0,
      fraccionDelMaximo: maximo > 0 ? t.valorArsCentavos / maximo : 0,
    })),
    snapshots: (snapshots ?? []).map((s) => ({
      fecha: s.fecha,
      totalArsCentavos: s.total_ars_centavos,
    })),
    tcActivo,
    tcTodos,
  };
}
