"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { obtenerPatrimonio } from "@/lib/datos/patrimonio";
import { arsAUsd, usdAArs } from "@/lib/dominio/dinero";
import { hoyBA } from "@/lib/dominio/fechas";
import type { ResultadoAccion } from "./movimientos";

const INSTRUMENTOS = [
  "dolar_billete",
  "dolar_mep",
  "fci_money_market",
  "plazo_fijo",
  "cedears",
  "cripto",
  "cuenta_remunerada",
  "otro",
] as const;

// Los instrumentos en dólares guardan cantidad y se convierten con el TC
// activo; los demás guardan valuación manual en pesos con su fecha.
const esquemaTenencia = z
  .object({
    tenenciaId: z.uuid().nullable(),
    instrumento: z.enum(INSTRUMENTOS),
    nombre: z.string().trim().min(1).max(60),
    detalle: z.string().trim().max(80).nullable(),
    moneda: z.enum(["ARS", "USD"]),
    cantidadUsdCentavos: z.number().int().positive().max(1_000_000_000_00).nullable(),
    valuacionCentavos: z.number().int().positive().max(100_000_000_000).nullable(),
    fechaValuacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  })
  .refine(
    (d) =>
      d.moneda === "USD" ? d.cantidadUsdCentavos !== null : d.valuacionCentavos !== null,
    { message: "Falta la cantidad (USD) o la valuación (ARS)" },
  );

/** Alta y edición de tenencia (hueco declarado del export). */
export async function guardarTenencia(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaTenencia.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: parseo.error.issues[0].message };
  const d = parseo.data;

  const sesion = await obtenerSesionHogar();
  const fila = {
    hogar_id: sesion.hogarId,
    user_id: sesion.userId,
    instrumento: d.instrumento,
    nombre: d.nombre,
    detalle: d.detalle,
    moneda: d.moneda,
    cantidad_usd_centavos: d.moneda === "USD" ? d.cantidadUsdCentavos : null,
    valuacion_centavos: d.moneda === "ARS" ? d.valuacionCentavos : null,
    fecha_valuacion: d.fechaValuacion,
    visibilidad: "compartido",
  };

  if (d.tenenciaId) {
    const { error, data } = await sesion.supabase
      .from("tenencias")
      .update(fila)
      .eq("id", d.tenenciaId)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error || !data?.length) return { ok: false, error: "No pudimos actualizar la tenencia" };
  } else {
    const { error } = await sesion.supabase.from("tenencias").insert(fila);
    if (error) return { ok: false, error: "No pudimos guardar la tenencia" };
  }

  revalidatePath("/patrimonio");
  return { ok: true };
}

/** Sin borrado físico: la tenencia se desactiva. */
export async function desactivarTenencia(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = z.object({ tenenciaId: z.uuid() }).safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Tenencia inválida" };

  const sesion = await obtenerSesionHogar();
  const { error, data } = await sesion.supabase
    .from("tenencias")
    .update({ activa: false })
    .eq("id", parseo.data.tenenciaId)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos desactivar" };

  revalidatePath("/patrimonio");
  return { ok: true };
}

const esquemaTC = z.object({
  fuente: z.enum(["mep", "blue", "oficial"]),
  valorCentavos: z.number().int().positive().max(100_000_000),
});

/** Carga manual del TC del día por fuente; histórico en tipos_cambio. */
export async function cargarTipoCambio(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaTC.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Valor inválido" };

  const sesion = await obtenerSesionHogar();
  const { error } = await sesion.supabase.from("tipos_cambio").upsert(
    {
      hogar_id: sesion.hogarId,
      fecha: hoyBA(),
      fuente: parseo.data.fuente,
      valor_centavos: parseo.data.valorCentavos,
    },
    { onConflict: "hogar_id,fecha,fuente" },
  );
  if (error) return { ok: false, error: "No pudimos guardar el valor" };

  revalidatePath("/patrimonio");
  return { ok: true };
}

/**
 * "Guardar foto del mes": snapshot manual del patrimonio de hoy.
 * El job automático (Trigger.dev) queda anotado como fase siguiente.
 */
export async function guardarSnapshot(): Promise<ResultadoAccion> {
  const sesion = await obtenerSesionHogar();
  const patrimonio = await obtenerPatrimonio(sesion);
  if (!patrimonio.tcActivo) {
    return { ok: false, error: "Cargá primero un tipo de cambio" };
  }

  const { error } = await sesion.supabase.from("snapshots_patrimonio").upsert(
    {
      hogar_id: sesion.hogarId,
      fecha: hoyBA(),
      total_ars_centavos: patrimonio.totalArsCentavos,
      total_usd_centavos: arsAUsd(
        patrimonio.totalArsCentavos,
        patrimonio.tcActivo.valorCentavos,
      ),
      detalle: Object.fromEntries(
        patrimonio.tenencias.map((t) => [t.nombre, t.valorArsCentavos]),
      ),
    },
    { onConflict: "hogar_id,fecha" },
  );
  if (error) return { ok: false, error: "No pudimos guardar la foto" };

  revalidatePath("/patrimonio");
  return { ok: true };
}

/** Conversión para mostrar en vivo en la hoja de tenencia ("qué TC usó"). */
export async function convertirUsd(entrada: unknown): Promise<
  { ok: true; arsCentavos: number; tcValorCentavos: number; fuente: string } | { ok: false }
> {
  const parseo = z.object({ usdCentavos: z.number().int().positive() }).safeParse(entrada);
  if (!parseo.success) return { ok: false };
  const sesion = await obtenerSesionHogar();
  const patrimonio = await obtenerPatrimonio(sesion);
  if (!patrimonio.tcActivo) return { ok: false };
  return {
    ok: true,
    arsCentavos: usdAArs(parseo.data.usdCentavos, patrimonio.tcActivo.valorCentavos),
    tcValorCentavos: patrimonio.tcActivo.valorCentavos,
    fuente: patrimonio.tcActivo.fuente,
  };
}
