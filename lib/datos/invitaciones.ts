import "server-only";
import { z } from "zod";
import { enviarEmailInvitacion } from "@/lib/envio/invitaciones";
import type { SesionHogar } from "./sesion";

// Lógica de invitaciones al hogar, compartida entre la server action de la web
// (app/acciones/hogar.ts) y la ruta para la app nativa (app/api/invitaciones).
// La sesión entra por parámetro: cada llamador la arma como corresponde
// (cookies en la web, Bearer en el nativo) y la RLS aplica igual en los dos.

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
export async function crearInvitacion(
  sesion: SesionHogar,
  entrada: unknown,
): Promise<ResultadoInvitacion> {
  const parseo = esquemaInvitar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: parseo.error.issues[0].message };

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

  return { ok: true, enviado, link };
}

const esquemaId = z.object({ invitacionId: z.uuid() });

/** Reenviar: renueva el vencimiento y reintenta el email. */
export async function renovarInvitacion(
  sesion: SesionHogar,
  entrada: unknown,
): Promise<ResultadoInvitacion> {
  const parseo = esquemaId.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Invitación inválida" };

  const vence = new Date(Date.now() + DIAS_VIGENCIA * 86400000).toISOString();
  // solo se reenvía lo que sigue pendiente: reenviar no debe resucitar una
  // invitación revocada ni revalidar el token de una ya aceptada
  const { data, error } = await sesion.supabase
    .from("invitaciones")
    .update({ vence_el: vence })
    .eq("id", parseo.data.invitacionId)
    .eq("hogar_id", sesion.hogarId)
    .eq("estado", "pendiente")
    .select("email, token")
    .single();
  if (error || !data) {
    return { ok: false, error: "Esa invitación ya no está pendiente." };
  }

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

  return { ok: true, enviado, link };
}

/** Revocar: la invitación queda "revocada" y su token deja de servir. */
export async function anularInvitacion(
  sesion: SesionHogar,
  entrada: unknown,
): Promise<{ ok: boolean }> {
  const parseo = esquemaId.safeParse(entrada);
  if (!parseo.success) return { ok: false };

  const { error } = await sesion.supabase
    .from("invitaciones")
    .update({ estado: "revocada" })
    .eq("id", parseo.data.invitacionId)
    .eq("hogar_id", sesion.hogarId);

  return { ok: !error };
}
