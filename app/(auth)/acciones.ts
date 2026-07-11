"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const esquemaCredenciales = z.object({
  email: z.email("Ingresá un email válido"),
  password: z
    .string()
    .min(8, "La contraseña necesita al menos 8 caracteres")
    .max(72, "La contraseña no puede superar 72 caracteres"),
});

/** Ruta interna de retorno (p. ej. /invitacion/<token>); nada externo. */
function volverSeguro(formulario: FormData): string {
  const volver = formulario.get("volver");
  return typeof volver === "string" && /^\/[a-zA-Z0-9\-_/]*$/.test(volver)
    ? volver
    : "/resumen";
}

export type EstadoAuth = {
  error?: string;
  aviso?: string;
};

export async function iniciarSesion(
  _estadoAnterior: EstadoAuth,
  formulario: FormData,
): Promise<EstadoAuth> {
  const parseo = esquemaCredenciales.safeParse({
    email: formulario.get("email"),
    password: formulario.get("password"),
  });

  if (!parseo.success) {
    return { error: parseo.error.issues[0].message };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword(parseo.data);

  if (error) {
    if (error.code === "invalid_credentials") {
      return { error: "Email o contraseña incorrectos." };
    }
    if (error.code === "email_not_confirmed") {
      return { error: "Confirmá tu email antes de entrar (revisá tu correo)." };
    }
    return { error: "No pudimos iniciar sesión. Probá de nuevo." };
  }

  redirect(volverSeguro(formulario));
}

export async function registrarse(
  _estadoAnterior: EstadoAuth,
  formulario: FormData,
): Promise<EstadoAuth> {
  const parseo = esquemaCredenciales.safeParse({
    email: formulario.get("email"),
    password: formulario.get("password"),
  });

  if (!parseo.success) {
    return { error: parseo.error.issues[0].message };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp(parseo.data);

  if (error) {
    if (error.code === "user_already_exists") {
      return { error: "Ya existe una cuenta con ese email. Iniciá sesión." };
    }
    if (error.code === "weak_password") {
      return { error: "Esa contraseña es demasiado débil. Probá otra." };
    }
    return { error: "No pudimos crear la cuenta. Probá de nuevo." };
  }

  // Sin sesión = el proyecto exige confirmación por email.
  if (!data.session) {
    return {
      aviso: "Te mandamos un correo para confirmar la cuenta. Después entrá desde acá.",
    };
  }

  redirect(volverSeguro(formulario));
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
