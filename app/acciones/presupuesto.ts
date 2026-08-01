"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { mesAnterior } from "@/lib/dominio/fechas";

const esquemaArmado = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}-01$/),
  ambito: z.enum(["hogar", "personal"]),
  partidas: z
    .array(
      z.object({
        categoriaId: z.uuid(),
        asignadoCentavos: z.number().int().min(0),
        activa: z.boolean(),
        fija: z.boolean(),
        rollover: z.boolean(),
        nota: z.string().trim().max(120).nullable(),
      }),
    )
    .min(1)
    .max(60),
});

export type ResultadoArmado = { ok: true } | { ok: false; error: string };

const esquemaRepetir = z.object({
  mes: z.string().regex(/^\d{4}-\d{2}-01$/),
  ambito: z.enum(["hogar", "personal"]),
});

/**
 * "Arrastrar" el presupuesto: copia tal cual las partidas del mes anterior al
 * mes pedido, con sus montos y flags. Para ajustar antes de confirmar está el
 * armado a mano; esto es el camino de un toque para el mes que ya funciona.
 */
export async function repetirPresupuesto(entrada: unknown): Promise<ResultadoArmado> {
  const parseo = esquemaRepetir.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const { mes, ambito } = parseo.data;

  const sesion = await obtenerSesionHogar();
  const previo = mesAnterior(mes);

  let consulta = sesion.supabase
    .from("presupuestos")
    .select("id, partidas_presupuesto(categoria_id, asignado_centavos, activa, fija, rollover, nota)")
    .eq("hogar_id", sesion.hogarId)
    .eq("mes", previo)
    .eq("ambito", ambito);
  consulta =
    ambito === "personal"
      ? consulta.eq("user_id", sesion.userId)
      : consulta.is("user_id", null);
  const { data: anterior } = await consulta.maybeSingle();
  const partidas = (anterior?.partidas_presupuesto ?? []) as Array<{
    categoria_id: string;
    asignado_centavos: number;
    activa: boolean;
    fija: boolean;
    rollover: boolean;
    nota: string | null;
  }>;
  if (partidas.length === 0) {
    return { ok: false, error: "El mes anterior no tiene presupuesto para repetir" };
  }

  return armarPresupuesto({
    mes,
    ambito,
    partidas: partidas.map((p) => ({
      categoriaId: p.categoria_id,
      asignadoCentavos: p.asignado_centavos,
      activa: p.activa,
      fija: p.fija,
      rollover: p.rollover,
      nota: p.nota,
    })),
  });
}

/** Confirmar el armado del mes (02): crea presupuesto + partidas. */
export async function armarPresupuesto(entrada: unknown): Promise<ResultadoArmado> {
  const parseo = esquemaArmado.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const datos = parseo.data;

  const sesion = await obtenerSesionHogar();

  const { data: existente } = await sesion.supabase
    .from("presupuestos")
    .select("id")
    .eq("hogar_id", sesion.hogarId)
    .eq("mes", datos.mes)
    .eq("ambito", datos.ambito)
    .maybeSingle();
  if (existente) return { ok: false, error: "Ese mes ya tiene presupuesto" };

  const { data: presupuesto, error: errPresu } = await sesion.supabase
    .from("presupuestos")
    .insert({
      hogar_id: sesion.hogarId,
      mes: datos.mes,
      ambito: datos.ambito,
      user_id: datos.ambito === "personal" ? sesion.userId : null,
    })
    .select()
    .single();
  if (errPresu || !presupuesto) return { ok: false, error: "No pudimos crear el presupuesto" };

  const { error: errPartidas } = await sesion.supabase.from("partidas_presupuesto").insert(
    datos.partidas.map((p) => ({
      presupuesto_id: presupuesto.id,
      categoria_id: p.categoriaId,
      asignado_centavos: p.asignadoCentavos,
      activa: p.activa,
      fija: p.fija,
      rollover: p.rollover,
      nota: p.nota,
    })),
  );
  if (errPartidas) {
    await sesion.supabase.from("presupuestos").delete().eq("id", presupuesto.id);
    return { ok: false, error: "No pudimos crear las partidas" };
  }

  revalidatePath("/presupuesto");
  revalidatePath("/resumen");
  return { ok: true };
}

const esquemaPartida = z.object({
  partidaId: z.uuid(),
  asignadoCentavos: z
    .number()
    .int()
    .min(0)
    .max(9_999_999_999_99),
});

/**
 * Cambiar el monto asignado de una partida de un presupuesto YA armado — el
 * sobre se ajusta tocándolo, sin rearmar el mes. RLS garantiza que la partida
 * sea de un presupuesto del hogar (y, si es personal, del usuario). Poner $ 0
 * es válido: la partida sigue visible, con "queda" en cero — desactivarla es
 * otra decisión (nota y flag), no un caso especial del monto.
 */
export async function actualizarPartida(entrada: unknown): Promise<ResultadoArmado> {
  const parseo = esquemaPartida.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const datos = parseo.data;

  const sesion = await obtenerSesionHogar();

  const { data, error } = await sesion.supabase
    .from("partidas_presupuesto")
    .update({ asignado_centavos: datos.asignadoCentavos })
    .eq("id", datos.partidaId)
    .select("id");

  // sin fila afectada = la partida no existe o RLS la bloqueó: mismo mensaje
  if (error || !data || data.length === 0) {
    return { ok: false, error: "No pudimos guardar el monto. Probá de nuevo." };
  }

  revalidatePath("/presupuesto");
  revalidatePath("/resumen");
  return { ok: true };
}
