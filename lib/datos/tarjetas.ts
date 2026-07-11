import "server-only";
import { hoyBA } from "@/lib/dominio/fechas";
import { proyectadoResumen } from "@/lib/dominio/tarjetas";
import type { SesionHogar } from "./sesion";

export type CicloResumen = {
  id: string;
  fechaCierre: string;
  fechaVencimiento: string;
  estadoFechas: "estimado" | "confirmado";
  estado: "abierto" | "cerrado" | "conciliado";
  totalRealCentavos: number | null;
};

export type TarjetaConCiclos = {
  id: string;
  nombre: string;
  banco: string;
  red: string;
  ultimos4: string;
  etiqueta: string; // "Visa •• 4321"
  impuestosEstimadosCentavos: number;
  ciclos: CicloResumen[]; // ordenados por cierre ascendente
};

export async function obtenerTarjeta(
  sesion: SesionHogar,
  tarjetaId: string,
): Promise<TarjetaConCiclos | null> {
  const { data } = await sesion.supabase
    .from("tarjetas")
    .select(
      "id, nombre, banco, red, ultimos4, impuestos_estimados_centavos, ciclos_tarjeta(id, fecha_cierre, fecha_vencimiento, estado_fechas, estado, total_real_centavos)",
    )
    .eq("id", tarjetaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!data) return null;

  const red = data.red === "visa" ? "Visa" : data.red === "mastercard" ? "Mastercard" : data.red;
  return {
    id: data.id,
    nombre: data.nombre,
    banco: data.banco,
    red: data.red,
    ultimos4: data.ultimos4,
    etiqueta: `${red} •• ${data.ultimos4}`,
    impuestosEstimadosCentavos: data.impuestos_estimados_centavos,
    ciclos: (data.ciclos_tarjeta ?? [])
      .map((c) => ({
        id: c.id,
        fechaCierre: c.fecha_cierre,
        fechaVencimiento: c.fecha_vencimiento,
        estadoFechas: c.estado_fechas,
        estado: c.estado,
        totalRealCentavos: c.total_real_centavos,
      }))
      .sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre)),
  };
}

export type ConsumoCiclo = {
  id: string;
  descripcion: string;
  fecha: string;
  importeCentavos: number;
  categoriaNombre: string | null;
  visibilidad: "personal" | "compartido";
  esCuota: boolean;
  nCuota: number | null;
  nCuotasTotal: number | null;
};

export type DetalleCiclo = {
  consumos: ConsumoCiclo[]; // todos, más nuevo primero
  consumosCentavos: number; // sin cuotas
  cuotasCentavos: number; // cuotas del ciclo
  proyectadoCentavos: number; // consumos + cuotas + impuestos
  pagadoCentavos: number; // pagos de resumen aplicados a este ciclo
};

export async function detalleCiclo(
  sesion: SesionHogar,
  cicloId: string,
  impuestosEstimadosCentavos: number,
): Promise<DetalleCiclo> {
  const { data } = await sesion.supabase
    .from("movimientos")
    .select(
      "id, tipo, descripcion, fecha, importe_centavos, visibilidad, compra_id, n_cuota, categorias(nombre), compras_en_cuotas(n_cuotas)",
    )
    .eq("ciclo_id", cicloId)
    .order("fecha", { ascending: false })
    .order("creado_el", { ascending: false });

  type Fila = {
    id: string;
    tipo: string;
    descripcion: string;
    fecha: string;
    importe_centavos: number;
    visibilidad: "personal" | "compartido";
    compra_id: string | null;
    n_cuota: number | null;
    categorias: { nombre: string } | null;
    compras_en_cuotas: { n_cuotas: number } | null;
  };
  const filas = ((data ?? []) as unknown as Fila[]);

  const gastos = filas.filter((f) => f.tipo === "gasto");
  const pagos = filas.filter((f) => f.tipo === "pago_resumen");
  const consumos: ConsumoCiclo[] = gastos.map((f) => ({
    id: f.id,
    descripcion: f.descripcion,
    fecha: f.fecha,
    importeCentavos: f.importe_centavos,
    categoriaNombre: f.categorias?.nombre ?? null,
    visibilidad: f.visibilidad,
    esCuota: f.compra_id !== null,
    nCuota: f.n_cuota,
    nCuotasTotal: f.compras_en_cuotas?.n_cuotas ?? null,
  }));

  const consumosCentavos = consumos
    .filter((c) => !c.esCuota)
    .reduce((s, c) => s + c.importeCentavos, 0);
  const cuotasCentavos = consumos
    .filter((c) => c.esCuota)
    .reduce((s, c) => s + c.importeCentavos, 0);

  return {
    consumos,
    consumosCentavos,
    cuotasCentavos,
    proyectadoCentavos: proyectadoResumen({
      consumosCentavos,
      cuotasCentavos,
      impuestosCentavos: impuestosEstimadosCentavos,
    }),
    pagadoCentavos: pagos.reduce((s, p) => s + p.importe_centavos, 0),
  };
}

export type CompraActiva = {
  id: string;
  descripcion: string;
  cuotaMensualCentavos: number;
  nCuotas: number;
  cuotaActual: number; // la cuota que devenga este mes (o la última pasada)
  tarjetaEtiqueta: string;
  terminaMes: string; // YYYY-MM-01 de la última cuota
};

/** Cuotas de todo el hogar para 07: movimientos hijos + compras con progreso. */
export async function cuotasDelHogar(sesion: SesionHogar): Promise<{
  cuotas: Array<{ fecha: string; importeCentavos: number }>;
  compras: CompraActiva[];
}> {
  const { data: hijas } = await sesion.supabase
    .from("movimientos")
    .select("fecha, importe_centavos, n_cuota, compra_id")
    .eq("hogar_id", sesion.hogarId)
    .not("compra_id", "is", null);

  const { data: compras } = await sesion.supabase
    .from("compras_en_cuotas")
    .select("id, descripcion, total_centavos, n_cuotas, fecha, tarjetas(red, ultimos4)")
    .eq("hogar_id", sesion.hogarId);

  const cuotas = (hijas ?? []).map((h) => ({
    fecha: h.fecha,
    importeCentavos: h.importe_centavos,
  }));

  const hoyMes = hoyBA().slice(0, 7);
  const activas: CompraActiva[] = [];
  for (const c of compras ?? []) {
    const hijasDeCompra = (hijas ?? [])
      .filter((h) => h.compra_id === c.id)
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    if (hijasDeCompra.length === 0) continue;
    const ultima = hijasDeCompra[hijasDeCompra.length - 1];
    if (ultima.fecha.slice(0, 7) < hoyMes) continue; // ya terminó
    const delMes =
      hijasDeCompra.find((h) => h.fecha.slice(0, 7) === hoyMes) ??
      [...hijasDeCompra].reverse().find((h) => h.fecha.slice(0, 7) <= hoyMes);
    const tarjeta = c.tarjetas as unknown as { red: string; ultimos4: string } | null;
    const red =
      tarjeta?.red === "visa" ? "Visa" : tarjeta?.red === "mastercard" ? "Mastercard" : "";
    activas.push({
      id: c.id,
      descripcion: c.descripcion,
      cuotaMensualCentavos: hijasDeCompra[0].importe_centavos,
      nCuotas: c.n_cuotas,
      cuotaActual: delMes?.n_cuota ?? 0,
      tarjetaEtiqueta: `${red} •• ${tarjeta?.ultimos4 ?? ""}`,
      terminaMes: `${ultima.fecha.slice(0, 7)}-01`,
    });
  }
  activas.sort((a, b) => b.cuotaMensualCentavos - a.cuotaMensualCentavos);

  return { cuotas, compras: activas };
}
