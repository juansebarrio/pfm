import "server-only";
import { bandejaDeEntrada, type MovimientoLista } from "@/lib/datos/movimientos";
import { sugerenciasRecurrentes } from "@/lib/datos/presupuesto";
import type { SesionHogar } from "@/lib/datos/sesion";
import { nombreDeRemitente } from "@/lib/dominio/correo";
import { formatearImporte } from "@/lib/dominio/dinero";
import { diasEntre, formatearDiaCorto, mesDe } from "@/lib/dominio/fechas";

// Avisos de "Para atender" (04). Cuatro fuentes, en este orden de prioridad:
// cierres de tarjeta cercanos, vencimientos de resumen, recurrentes por vencer
// sin movimiento y bandeja de entrada con pendientes (DESIGN_AUDIT.md §4.11).

const DIAS_AVISO_TARJETA = 3;
const DIAS_AVISO_RECURRENTE = 10; // el export avisa Luz (18 jul) el día 10: ventana de 10 días

export type Aviso = {
  id: string;
  tipo: "cierre" | "vencimiento" | "recurrente" | "bandeja" | "correo";
  titulo: string;
  meta: string;
  /** la meta lleva plata → va en mono (.cifra) */
  metaCifra: boolean;
  href: string;
  /** estado de la fecha de cierre del ciclo (punteado ámbar = estimada) */
  badge?: "estimada" | "confirmada";
  /** acción textual verde ("Categorizar"): con acción se ejecuta, con chevron se navega */
  accion?: string;
};

type CicloFila = {
  id: string;
  fecha_cierre: string;
  fecha_vencimiento: string;
  estado_fechas: "estimado" | "confirmado";
  estado: "abierto" | "cerrado" | "conciliado";
  total_real_centavos: number | null;
};

type TarjetaFila = {
  id: string;
  nombre: string;
  impuestos_estimados_centavos: number;
  ciclos_tarjeta: CicloFila[];
};

async function tarjetasConCiclos(sesion: SesionHogar): Promise<TarjetaFila[]> {
  const { data } = await sesion.supabase
    .from("tarjetas")
    .select(
      "id, nombre, impuestos_estimados_centavos, ciclos_tarjeta(id, fecha_cierre, fecha_vencimiento, estado_fechas, estado, total_real_centavos)",
    )
    .eq("hogar_id", sesion.hogarId)
    .eq("activa", true);
  return ((data ?? []) as unknown as TarjetaFila[]);
}

/** Consumos (gasto) sumados por ciclo, para el proyectado = consumos + impuestos. */
async function consumosPorCiclo(
  sesion: SesionHogar,
  cicloIds: string[],
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (cicloIds.length === 0) return mapa;
  const { data } = await sesion.supabase
    .from("movimientos")
    .select("ciclo_id, importe_centavos")
    .eq("hogar_id", sesion.hogarId)
    .eq("tipo", "gasto")
    .in("ciclo_id", cicloIds);
  const filas = (data ?? []) as Array<{ ciclo_id: string; importe_centavos: number }>;
  for (const m of filas) {
    mapa.set(m.ciclo_id, (mapa.get(m.ciclo_id) ?? 0) + m.importe_centavos);
  }
  return mapa;
}

/** Suma de pagos de resumen (pago_resumen) aplicados a cada ciclo. */
async function pagosPorCiclo(
  sesion: SesionHogar,
  cicloIds: string[],
): Promise<Map<string, number>> {
  const mapa = new Map<string, number>();
  if (cicloIds.length === 0) return mapa;
  const { data } = await sesion.supabase
    .from("movimientos")
    .select("ciclo_id, importe_centavos")
    .eq("hogar_id", sesion.hogarId)
    .eq("tipo", "pago_resumen")
    .in("ciclo_id", cicloIds);
  const filas = (data ?? []) as Array<{ ciclo_id: string; importe_centavos: number }>;
  for (const m of filas) {
    mapa.set(m.ciclo_id, (mapa.get(m.ciclo_id) ?? 0) + m.importe_centavos);
  }
  return mapa;
}

function fraseCierre(dias: number): string {
  if (dias === 0) return "cierra hoy";
  if (dias === 1) return "cierra mañana";
  return `cierra en ${dias} días`;
}

/** "Rappi, una transferencia y uno más" — primer gasto + ingreso + resto contado. */
function resumenBandeja(items: MovimientoLista[]): string {
  const fragmentos: string[] = [];
  const primerGasto = items.find((i) => i.tipo === "gasto");
  if (primerGasto) fragmentos.push(primerGasto.descripcion);
  if (items.some((i) => i.tipo === "ingreso")) fragmentos.push("una transferencia");
  const restantes = items.length - fragmentos.length;
  if (restantes > 0) fragmentos.push(`${restantes === 1 ? "uno" : restantes} más`);
  if (fragmentos.length === 1) return fragmentos[0];
  return `${fragmentos.slice(0, -1).join(", ")} y ${fragmentos[fragmentos.length - 1]}`;
}

/** Sugerencias del correo pendientes DEL USUARIO (privadas, no del hogar). */
async function sugerenciasDeCorreo(
  sesion: SesionHogar,
): Promise<{ cantidad: number; muestra: string[] }> {
  const { data, count } = await sesion.supabase
    .from("sugerencias_correo")
    .select("comercio, remitente", { count: "exact" })
    .eq("user_id", sesion.userId)
    .eq("estado", "pendiente")
    .order("fecha", { ascending: false })
    .limit(2);
  return {
    cantidad: count ?? 0,
    // sin comercio parseado, el remitente ("BBVA", "Mercado Pago") es mejor
    // fallback que un genérico repetido ("un movimiento y un movimiento")
    muestra: (data ?? []).map((s) => s.comercio ?? nombreDeRemitente(s.remitente)),
  };
}

export async function avisosParaAtender(
  sesion: SesionHogar,
  hoy: string,
): Promise<Aviso[]> {
  // las sugerencias del correo solo se consultan con el flag de Google activo:
  // sin él (y sin la migración) tocar sugerencias_correo rompería el resumen
  const conGoogle = process.env.NEXT_PUBLIC_GOOGLE === "true";
  const [tarjetas, recurrentes, bandeja, correo] = await Promise.all([
    tarjetasConCiclos(sesion),
    sugerenciasRecurrentes(sesion, mesDe(hoy)),
    bandejaDeEntrada(sesion),
    conGoogle ? sugerenciasDeCorreo(sesion) : Promise.resolve({ cantidad: 0, muestra: [] }),
  ]);

  type Candidato = { tarjeta: TarjetaFila; ciclo: CicloFila };
  const cierres: Array<Candidato & { dias: number }> = [];
  const vencimientos: Candidato[] = [];
  for (const tarjeta of tarjetas) {
    for (const ciclo of tarjeta.ciclos_tarjeta ?? []) {
      const aCierre = diasEntre(hoy, ciclo.fecha_cierre);
      if (ciclo.estado === "abierto" && aCierre >= 0 && aCierre <= DIAS_AVISO_TARJETA) {
        cierres.push({ tarjeta, ciclo, dias: aCierre });
      }
      const aVencimiento = diasEntre(hoy, ciclo.fecha_vencimiento);
      if (aVencimiento >= 0 && aVencimiento <= DIAS_AVISO_TARJETA) {
        vencimientos.push({ tarjeta, ciclo });
      }
    }
  }

  const idsConProyectado = [
    ...cierres.map((c) => c.ciclo.id),
    ...vencimientos
      .filter((v) => v.ciclo.total_real_centavos === null)
      .map((v) => v.ciclo.id),
  ];
  const consumos = await consumosPorCiclo(sesion, [...new Set(idsConProyectado)]);
  const pagos = await pagosPorCiclo(sesion, [...new Set(vencimientos.map((v) => v.ciclo.id))]);
  const proyectado = (c: Candidato) =>
    (consumos.get(c.ciclo.id) ?? 0) + c.tarjeta.impuestos_estimados_centavos;
  const totalAPagar = (c: Candidato) => c.ciclo.total_real_centavos ?? proyectado(c);

  const avisos: Aviso[] = [];

  for (const c of cierres) {
    avisos.push({
      id: `cierre-${c.ciclo.id}`,
      tipo: "cierre",
      titulo: `${c.tarjeta.nombre} ${fraseCierre(c.dias)}`,
      meta: `proyectado ${formatearImporte(proyectado(c))}`,
      metaCifra: true,
      href: `/tarjetas/${c.tarjeta.id}`,
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
      meta: total !== null ? formatearImporte(total) : `proyectado ${formatearImporte(proyectado(v))}`,
      metaCifra: true,
      href: `/tarjetas/${v.tarjeta.id}`,
    });
  }

  for (const r of recurrentes) {
    const dias = diasEntre(hoy, r.fechaVencimiento);
    if (dias < 0 || dias > DIAS_AVISO_RECURRENTE) continue;
    avisos.push({
      id: `recurrente-${r.id}`,
      tipo: "recurrente",
      titulo: `Vence ${r.descripcion} el ${formatearDiaCorto(r.fechaVencimiento)}`,
      meta: `${formatearImporte(r.importeSugeridoCentavos)} sugerido · recurrente`,
      metaCifra: true,
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
      metaCifra: false,
      href: "/movimientos",
      accion: "Categorizar",
    });
  }

  if (correo.cantidad > 0) {
    const resto = correo.cantidad - correo.muestra.length;
    avisos.push({
      id: "correo",
      tipo: "correo",
      titulo:
        correo.cantidad === 1
          ? "1 movimiento sugerido desde tu correo"
          : `${correo.cantidad} movimientos sugeridos desde tu correo`,
      meta:
        resto > 0
          ? `${correo.muestra.join(", ")} y ${resto === 1 ? "uno" : resto} más`
          : correo.muestra.join(" y "),
      metaCifra: false,
      href: "/sugerencias",
      accion: "Revisar",
    });
  }

  return avisos;
}
