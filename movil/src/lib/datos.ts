import { supabase } from "./supabase";

// Capa de datos del spike. Las consultas son las MISMAS que en lib/datos/ de
// la web — lo único que cambia es de dónde sale el cliente de Supabase (acá es
// el módulo importado; en la web venía de sesion.supabase). La RLS filtra por
// hogar y visibilidad igual que siempre: no hace falta backend intermedio.

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

export type ResumenPresupuesto = {
  asignadoCentavos: number;
  gastadoCentavos: number;
  disponibleCentavos: number;
};

/**
 * Presupuesto del mes para un ámbito. Espeja obtenerPresupuestoMes de la web
 * (versión reducida para el spike: totales, sin el desglose por partidas).
 */
export async function obtenerPresupuestoMes(
  sesion: SesionHogar,
  mes: string,
  ambito: "hogar" | "personal" = "hogar",
): Promise<ResumenPresupuesto | null> {
  let consultaPresupuesto = supabase
    .from("presupuestos")
    .select("id")
    .eq("hogar_id", sesion.hogarId)
    .eq("mes", mes)
    .eq("ambito", ambito);
  consultaPresupuesto =
    ambito === "personal"
      ? consultaPresupuesto.eq("user_id", sesion.userId)
      : consultaPresupuesto.is("user_id", null);

  const { data: presupuesto } = await consultaPresupuesto.maybeSingle();
  if (!presupuesto) return null;

  const { data: partidas } = await supabase
    .from("partidas_presupuesto")
    .select("categoria_id, asignado_centavos, activa")
    .eq("presupuesto_id", presupuesto.id);

  const activas = (partidas ?? []).filter((p) => p.activa);
  const asignadoCentavos = activas.reduce((s, p) => s + p.asignado_centavos, 0);

  // gastos del mes por categoría (mismo criterio que la web: devengado)
  const ultimoDia = new Date(
    Number(mes.slice(0, 4)),
    Number(mes.slice(5, 7)),
    0,
  ).getDate();
  const hasta = `${mes.slice(0, 7)}-${String(ultimoDia).padStart(2, "0")}`;

  let consultaGastos = supabase
    .from("movimientos")
    .select("importe_centavos, categoria_id")
    .eq("hogar_id", sesion.hogarId)
    .eq("tipo", "gasto")
    .gte("fecha", mes)
    .lte("fecha", hasta)
    .not("categoria_id", "is", null);
  consultaGastos =
    ambito === "hogar"
      ? consultaGastos.eq("visibilidad", "compartido")
      : consultaGastos.eq("visibilidad", "personal").eq("user_id", sesion.userId);

  const { data: gastos } = await consultaGastos;
  const categoriasDelPresupuesto = new Set(activas.map((p) => p.categoria_id));
  const gastadoCentavos = (gastos ?? [])
    .filter((g) => categoriasDelPresupuesto.has(g.categoria_id))
    .reduce((s, g) => s + g.importe_centavos, 0);

  return {
    asignadoCentavos,
    gastadoCentavos,
    disponibleCentavos: asignadoCentavos - gastadoCentavos,
  };
}

export type MovimientoFila = {
  id: string;
  descripcion: string;
  importeCentavos: number;
  esIngreso: boolean;
  categoria: string | null;
  icono: string | null;
  ambito: "hogar" | "personal";
};

/** Últimos movimientos categorizados, como en la home de la web. */
export async function ultimosMovimientos(
  sesion: SesionHogar,
  limite = 3,
): Promise<MovimientoFila[]> {
  const { data } = await supabase
    .from("movimientos")
    .select("id, descripcion, importe_centavos, tipo, visibilidad, categorias(nombre, icono)")
    .eq("hogar_id", sesion.hogarId)
    .not("categoria_id", "is", null)
    .order("fecha", { ascending: false })
    .order("creado_el", { ascending: false })
    .limit(limite);

  return (data ?? []).map((m) => {
    const categoria = m.categorias as unknown as
      | { nombre: string; icono: string }
      | null;
    return {
      id: m.id,
      descripcion: m.descripcion,
      importeCentavos: m.importe_centavos,
      esIngreso: m.tipo === "ingreso",
      categoria: categoria?.nombre ?? null,
      icono: categoria?.icono ?? null,
      ambito: m.visibilidad === "compartido" ? "hogar" : "personal",
    };
  });
}
