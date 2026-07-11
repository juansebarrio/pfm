import "server-only";
import type { MovimientoLista } from "@/lib/datos/movimientos";
import type { SesionHogar } from "@/lib/datos/sesion";
import { formatearDiaCorto } from "@/lib/dominio/fechas";

// Helpers propios de la pantalla 05: el historial con los filtros de la fila
// de chips (cuenta/tarjeta, categoría, miembro) que lib/datos/movimientos.ts
// no cubre. Espejo del patrón de consulta de esa capa (CAMPOS y el mapeo son
// privados allá, por eso se replican acá).

const CAMPOS = `
  id, tipo, descripcion, importe_centavos, fecha, creado_el, visibilidad, user_id,
  n_cuota, compra_id, nota,
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
    compraId: fila.compra_id,
    nota: fila.nota,
  };
}

export type FiltrosHistorial = {
  buscar?: string;
  ambito?: "hogar" | "personal";
  categoriaId?: string;
  /** user_id del miembro (lo personal ajeno igual no llega: RLS) */
  miembroId?: string;
  medio?: { tipo: "cuenta" | "tarjeta"; id: string };
  /** filtrar solo gastos o solo ingresos (por defecto, ambos) */
  tipo?: "gasto" | "ingreso";
};

/** Historial con los filtros de la pantalla 05, más nuevo primero. */
export async function movimientosFiltrados(
  sesion: SesionHogar,
  filtros: FiltrosHistorial = {},
): Promise<MovimientoLista[]> {
  let consulta = sesion.supabase
    .from("movimientos")
    .select(CAMPOS)
    .eq("hogar_id", sesion.hogarId)
    .in("tipo", ["gasto", "ingreso"])
    .order("fecha", { ascending: false })
    .order("creado_el", { ascending: false })
    .limit(60);
  // Por defecto el historial es lo ya categorizado (lo sin categorizar vive en
  // la bandeja). Pero al filtrar por tipo el usuario pide "mostrame todo esto":
  // los ingresos no se categorizan (las categorías son partidas de gasto), así
  // que sin esta excepción "Solo ingresos" daría siempre vacío.
  if (!filtros.tipo) consulta = consulta.not("categoria_id", "is", null);
  if (filtros.buscar) {
    consulta = consulta.ilike("descripcion", `%${filtros.buscar}%`);
  }
  if (filtros.ambito === "hogar") consulta = consulta.eq("visibilidad", "compartido");
  if (filtros.ambito === "personal")
    consulta = consulta.eq("visibilidad", "personal").eq("user_id", sesion.userId);
  if (filtros.categoriaId) consulta = consulta.eq("categoria_id", filtros.categoriaId);
  if (filtros.miembroId) consulta = consulta.eq("user_id", filtros.miembroId);
  if (filtros.tipo) consulta = consulta.eq("tipo", filtros.tipo);
  if (filtros.medio?.tipo === "cuenta") consulta = consulta.eq("cuenta_id", filtros.medio.id);
  if (filtros.medio?.tipo === "tarjeta") consulta = consulta.eq("tarjeta_id", filtros.medio.id);
  const { data } = await consulta;
  return ((data ?? []) as unknown as FilaCruda[]).map((f) => aMovimiento(f, sesion.userId));
}

export type MiembroSimple = { userId: string; nombre: string };

/** Miembros del hogar para el chip de filtro "Miembro". */
export async function miembrosDelHogar(sesion: SesionHogar): Promise<MiembroSimple[]> {
  const { data } = await sesion.supabase
    .from("miembros_hogar")
    .select("user_id, nombre")
    .eq("hogar_id", sesion.hogarId)
    .order("creado_el", { ascending: true });
  return (data ?? []).map((m) => ({ userId: m.user_id, nombre: m.nombre }));
}
