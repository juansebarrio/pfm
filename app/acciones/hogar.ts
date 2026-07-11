"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { enviarEmailInvitacion } from "@/lib/envio/invitaciones";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const DIAS_VIGENCIA = 14;

function linkDeInvitacion(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/invitacion/${token}`;
}

export type ResultadoInvitacion =
  | { ok: true; enviado: boolean; link: string }
  | { ok: false; error: string };

const esquemaInvitar = z.object({
  email: z.email("Ingresá un email válido"),
  rol: z.enum(["administrador", "miembro"]).default("miembro"),
});

/** Invitar por email (09). Solo administradores (lo garantiza la RLS). */
export async function invitarAlHogar(entrada: unknown): Promise<ResultadoInvitacion> {
  const parseo = esquemaInvitar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: parseo.error.issues[0].message };

  const sesion = await obtenerSesionHogar();

  const { data: existente } = await sesion.supabase
    .from("invitaciones")
    .select("id")
    .eq("hogar_id", sesion.hogarId)
    .eq("email", parseo.data.email)
    .eq("estado", "pendiente")
    .maybeSingle();
  if (existente) return { ok: false, error: "Ya hay una invitación pendiente para ese email." };

  const vence = new Date(Date.now() + DIAS_VIGENCIA * 86400000).toISOString();
  const { data: invitacion, error } = await sesion.supabase
    .from("invitaciones")
    .insert({
      hogar_id: sesion.hogarId,
      email: parseo.data.email,
      rol: parseo.data.rol,
      vence_el: vence,
      creada_por: sesion.userId,
    })
    .select("token")
    .single();
  if (error || !invitacion) {
    return { ok: false, error: "No pudimos crear la invitación (¿sos administrador?)." };
  }

  const { data: hogar } = await sesion.supabase
    .from("hogares")
    .select("nombre")
    .eq("id", sesion.hogarId)
    .single();

  const link = linkDeInvitacion(invitacion.token);
  const { enviado } = await enviarEmailInvitacion({
    email: parseo.data.email,
    nombreHogar: hogar?.nombre ?? "Mi hogar",
    nombreInvita: sesion.nombreMiembro,
    link,
  });

  revalidatePath("/hogar");
  return { ok: true, enviado, link };
}

const esquemaId = z.object({ invitacionId: z.uuid() });

/** Reenviar: renueva el vencimiento y reintenta el email. */
export async function reenviarInvitacion(entrada: unknown): Promise<ResultadoInvitacion> {
  const parseo = esquemaId.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Invitación inválida" };

  const sesion = await obtenerSesionHogar();
  const vence = new Date(Date.now() + DIAS_VIGENCIA * 86400000).toISOString();
  const { data, error } = await sesion.supabase
    .from("invitaciones")
    .update({ vence_el: vence, estado: "pendiente" })
    .eq("id", parseo.data.invitacionId)
    .eq("hogar_id", sesion.hogarId)
    .select("email, token")
    .single();
  if (error || !data) return { ok: false, error: "No pudimos reenviar." };

  const { data: hogar } = await sesion.supabase
    .from("hogares")
    .select("nombre")
    .eq("id", sesion.hogarId)
    .single();

  const link = linkDeInvitacion(data.token);
  const { enviado } = await enviarEmailInvitacion({
    email: data.email,
    nombreHogar: hogar?.nombre ?? "Mi hogar",
    nombreInvita: sesion.nombreMiembro,
    link,
  });

  revalidatePath("/hogar");
  return { ok: true, enviado, link };
}

export async function revocarInvitacion(entrada: unknown): Promise<{ ok: boolean }> {
  const parseo = esquemaId.safeParse(entrada);
  if (!parseo.success) return { ok: false };

  const sesion = await obtenerSesionHogar();
  const { error } = await sesion.supabase
    .from("invitaciones")
    .update({ estado: "revocada" })
    .eq("id", parseo.data.invitacionId)
    .eq("hogar_id", sesion.hogarId);

  revalidatePath("/hogar");
  return { ok: !error };
}

const esquemaAceptar = z.object({
  token: z.string().min(10).max(120),
  nombre: z.string().trim().min(1).max(60),
});

/**
 * Aceptación (ruta pública /invitacion/[token], usuario ya autenticado):
 * la función SQL valida token, estado y vencimiento, y da el alta con el rol.
 */
export async function aceptarInvitacion(
  entrada: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parseo = esquemaAceptar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("aceptar_invitacion", {
    token_invitacion: parseo.data.token,
    nombre_miembro: parseo.data.nombre,
  });
  if (error) {
    const mensaje = error.message.includes("vencida")
      ? "La invitación venció. Pedí que te la reenvíen."
      : error.message.includes("pendiente")
        ? "Esa invitación ya no está disponible."
        : error.message.includes("ya sos miembro")
          ? "Ya sos parte de este hogar."
          : "No pudimos sumarte al hogar.";
    return { ok: false, error: mensaje };
  }

  revalidatePath("/hogar");
  return { ok: true };
}
