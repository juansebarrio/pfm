"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionHogar } from "@/lib/datos/sesion";

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
