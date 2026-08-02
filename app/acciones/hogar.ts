"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  anularInvitacion,
  crearInvitacion,
  renovarInvitacion,
  type ResultadoInvitacion as Resultado,
} from "@/lib/datos/invitaciones";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

// La lógica de invitar/reenviar/revocar vive en lib/datos/invitaciones.ts,
// compartida con /api/invitaciones (la app nativa). Acá quedan los envoltorios
// de la web: sesión por cookies + revalidación de /hogar.

// alias inline y no re-export: Turbopack solo borra las declaraciones de tipo
// locales al validar que un archivo "use server" exporte únicamente funciones
export type ResultadoInvitacion = Resultado;

/** Invitar por email (09). Solo administradores (lo garantiza la RLS). */
export async function invitarAlHogar(entrada: unknown) {
  const sesion = await obtenerSesionHogar();
  const resultado = await crearInvitacion(sesion, entrada);
  if (resultado.ok) revalidatePath("/hogar");
  return resultado;
}

/** Reenviar: renueva el vencimiento y reintenta el email. */
export async function reenviarInvitacion(entrada: unknown) {
  const sesion = await obtenerSesionHogar();
  const resultado = await renovarInvitacion(sesion, entrada);
  if (resultado.ok) revalidatePath("/hogar");
  return resultado;
}

export async function revocarInvitacion(entrada: unknown): Promise<{ ok: boolean }> {
  const sesion = await obtenerSesionHogar();
  const resultado = await anularInvitacion(sesion, entrada);
  revalidatePath("/hogar");
  return resultado;
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
