"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import type { ResultadoAccion } from "./movimientos";

const esquemaCuenta = z.object({
  cuentaId: z.uuid().nullable(),
  nombre: z.string().trim().min(1).max(40),
  tipo: z.enum(["efectivo", "banco", "billetera", "inversion"]),
  moneda: z.enum(["ARS", "USD"]),
  visibilidad: z.enum(["personal", "compartido"]),
});

/** Alta y edición de cuentas (hueco declarado: gestión de cuentas). */
export async function guardarCuenta(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaCuenta.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const d = parseo.data;

  const sesion = await obtenerSesionHogar();
  if (d.cuentaId) {
    const { error, data } = await sesion.supabase
      .from("cuentas")
      .update({ nombre: d.nombre, tipo: d.tipo, moneda: d.moneda, visibilidad: d.visibilidad })
      .eq("id", d.cuentaId)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error || !data?.length) return { ok: false, error: "No pudimos actualizar la cuenta" };
  } else {
    const { error } = await sesion.supabase.from("cuentas").insert({
      hogar_id: sesion.hogarId,
      user_id: sesion.userId,
      nombre: d.nombre,
      tipo: d.tipo,
      moneda: d.moneda,
      visibilidad: d.visibilidad,
    });
    if (error) return { ok: false, error: "No pudimos crear la cuenta" };
  }

  revalidatePath("/cuentas");
  return { ok: true };
}

const esquemaTarjeta = z.object({
  tarjetaId: z.uuid().nullable(),
  nombre: z.string().trim().min(1).max(40),
  banco: z.string().trim().min(1).max(40),
  red: z.enum(["visa", "mastercard", "amex", "otra"]),
  ultimos4: z.string().regex(/^\d{4}$/, "Los últimos 4 dígitos"),
  visibilidad: z.enum(["personal", "compartido"]),
});

/** Alta y edición de tarjetas (banco, red, últimos 4). */
export async function guardarTarjeta(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaTarjeta.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: parseo.error.issues[0].message };
  const d = parseo.data;

  const sesion = await obtenerSesionHogar();
  if (d.tarjetaId) {
    const { error, data } = await sesion.supabase
      .from("tarjetas")
      .update({
        nombre: d.nombre,
        banco: d.banco,
        red: d.red,
        ultimos4: d.ultimos4,
        visibilidad: d.visibilidad,
      })
      .eq("id", d.tarjetaId)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error || !data?.length) return { ok: false, error: "No pudimos actualizar la tarjeta" };
  } else {
    const { error } = await sesion.supabase.from("tarjetas").insert({
      hogar_id: sesion.hogarId,
      user_id: sesion.userId,
      nombre: d.nombre,
      banco: d.banco,
      red: d.red,
      ultimos4: d.ultimos4,
      visibilidad: d.visibilidad,
    });
    if (error) return { ok: false, error: "No pudimos crear la tarjeta" };
  }

  revalidatePath("/cuentas");
  return { ok: true };
}

const esquemaDesactivar = z.object({
  id: z.uuid(),
  tabla: z.enum(["cuentas", "tarjetas"]),
});

/** Sin borrado físico: cuentas y tarjetas se desactivan. */
export async function desactivarMedio(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaDesactivar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };

  const sesion = await obtenerSesionHogar();
  const { error, data } = await sesion.supabase
    .from(parseo.data.tabla)
    .update({ activa: false })
    .eq("id", parseo.data.id)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos desactivar" };

  revalidatePath("/cuentas");
  return { ok: true };
}
