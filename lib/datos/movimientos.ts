import "server-only";
import { formatearDiaCorto } from "@/lib/dominio/fechas";
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
  categoria: { id: string; nombre: string; icono: string } | null;
  medio: string | null; // "Visa •• 4321", "Mercado Pago", "Galicia"
  cierreCiclo: string | null; // "cierra 28 jul"
  esCuota: boolean;
  nCuota: number | null;
  nCuotasTotal: number | null;
};

const CAMPOS = `
  id, tipo, descripcion, importe_centavos, fecha, creado_el, visibilidad, user_id,
  n_cuota, compra_id,
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

function aMovimiento(fila: FilaCruda, userId: string): MovimientoLista {
  return {
    id: fila.id,
    tipo: fila.tipo,
    descripcion: fila.descripcion,
    importeCentavos: fila.importe_centavos,
    fecha: fila.fecha,
    creadoEl: fila.creado_el,
    visibilidad: fila.visibilidad,
    esPropio: fila.user_id === userId,
    categoria: fila.categorias,
    medio: fila.tarjetas
      ? nombreTarjeta(fila.tarjetas)
      : (fila.cuentas?.nombre ?? null),
    cierreCiclo:
      fila.ciclos_tarjeta && fila.ciclos_tarjeta.estado === "abierto"
        ? `cierra ${formatearDiaCorto(fila.ciclos_tarjeta.fecha_cierre)}`
        : null,
    esCuota: fila.compra_id !== null,
    nCuota: fila.n_cuota,
    nCuotasTotal: fila.compras_en_cuotas?.n_cuotas ?? null,
  };
}

/** Bandeja de entrada: sin categorizar (las cuotas hijas no cuentan). */
export async function bandejaDeEntrada(sesion: SesionHogar): Promise<MovimientoLista[]> {
  const { data } = await sesion.supabase
    .from("movimientos")
    .select(CAMPOS)
    .eq("hogar_id", sesion.hogarId)
    .is("categoria_id", null)
    .is("compra_id", null)
    .in("tipo", ["gasto", "ingreso"])
    .order("creado_el", { ascending: false })
    .limit(20);
  return ((data ?? []) as unknown as FilaCruda[]).map((f) => aMovimiento(f, sesion.userId));
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
  const { data } = await consulta;
  return ((data ?? []) as unknown as FilaCruda[]).map((f) => aMovimiento(f, sesion.userId));
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

export type MedioDePago =
  | { tipo: "cuenta"; id: string; nombre: string; etiqueta: string }
  | {
      tipo: "tarjeta";
      id: string;
      nombre: string;
      etiqueta: string;
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

  for (const t of tarjetas ?? []) {
    const abierto = (t.ciclos_tarjeta ?? [])
      .filter((c: { estado: string }) => c.estado === "abierto")
      .sort((a: { fecha_cierre: string }, b: { fecha_cierre: string }) =>
        a.fecha_cierre.localeCompare(b.fecha_cierre),
      )[0];
    medios.push({
      tipo: "tarjeta",
      id: t.id,
      nombre: t.nombre,
      etiqueta: `${t.red === "visa" ? "Visa" : t.red === "mastercard" ? "MC" : t.red} •• ${t.ultimos4}`,
      cicloCierre: abierto?.fecha_cierre ?? null,
      cicloEstado: abierto?.estado_fechas ?? null,
    });
  }
  return medios;
}
