"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { asegurarCicloParaFecha } from "@/lib/datos/ciclos-servidor";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { extraerTransaccion } from "@/lib/dominio/correo";
import { fechaDesdeMs } from "@/lib/dominio/fechas";
import { descifrarToken } from "@/lib/gmail/cifrado";
import {
  listarIdsDeMensajes,
  obtenerMensaje,
  refrescarAccessToken,
  revocarToken,
} from "@/lib/gmail/cliente";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import type { ResultadoAccion } from "./movimientos";

// Conexión Gmail (opción A): el usuario conecta su casilla con OAuth
// (gmail.readonly), la app lee los últimos mails y convierte los avisos de
// consumo en SUGERENCIAS. Nada entra al presupuesto sin un tap del usuario.

const CUANTOS_MAILS = 50;

/**
 * Redirige al consentimiento de Google pidiendo el scope de lectura de Gmail.
 * access_type=offline + prompt=consent fuerzan un refresh token nuevo, que el
 * callback guarda cifrado. login_hint apunta a la cuenta con la que ya entró.
 */
export async function conectarGmail(): Promise<ResultadoAccion> {
  if (process.env.NEXT_PUBLIC_GOOGLE !== "true") {
    return { ok: false, error: "La conexión con Google no está habilitada." };
  }
  const sesion = await obtenerSesionHogar();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const {
    data: { user },
  } = await sesion.supabase.auth.getUser();

  const { data, error } = await sesion.supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${base}/auth/callback?conectar=gmail`,
      scopes: "https://www.googleapis.com/auth/gmail.readonly",
      queryParams: {
        access_type: "offline",
        prompt: "consent",
        ...(user?.email ? { login_hint: user.email } : {}),
      },
    },
  });
  if (error || !data.url) {
    return { ok: false, error: "No pudimos abrir Google. Probá de nuevo." };
  }
  redirect(data.url);
}

export type ResultadoSincronizacion =
  | { ok: true; nuevas: number; revisados: number }
  | { ok: false; error: string };

/**
 * Lee los últimos 50 mails de la casilla conectada y crea sugerencias con los
 * que parecen transacciones. Idempotente: gmail_id único por usuario, así que
 * re-sincronizar no duplica ni resucita descartadas.
 */
export async function sincronizarGmail(): Promise<ResultadoSincronizacion> {
  const sesion = await obtenerSesionHogar();

  // el token cifrado no es legible con el cliente del usuario (revoke de
  // columna): lo lee el admin, se descifra y jamás sale de esta función
  const admin = crearClienteAdmin();
  const { data: conexion } = await admin
    .from("conexiones_gmail")
    .select("refresh_token_cifrado")
    .eq("user_id", sesion.userId)
    .maybeSingle();
  if (!conexion) return { ok: false, error: "No hay una casilla conectada." };

  let refreshToken: string;
  try {
    refreshToken = descifrarToken(conexion.refresh_token_cifrado);
  } catch {
    return { ok: false, error: "La conexión se dañó. Volvé a conectar Gmail." };
  }

  const accessToken = await refrescarAccessToken(refreshToken);
  if (!accessToken) {
    return {
      ok: false,
      error: "Google rechazó la conexión (¿venció?). Volvé a conectar Gmail.",
    };
  }

  let ids: string[];
  try {
    ids = await listarIdsDeMensajes(accessToken, CUANTOS_MAILS);
  } catch {
    return { ok: false, error: "No pudimos leer el correo. Probá en un rato." };
  }
  if (ids.length === 0) return { ok: true, nuevas: 0, revisados: 0 };

  // ya vistos (pendientes, aceptadas o descartadas): no se vuelven a sugerir.
  // si este select falla, abortamos: seguir con yaVistos vacío re-sugeriría
  // todo y el mensaje "N nuevas" mentiría
  const { data: vistas, error: errVistas } = await sesion.supabase
    .from("sugerencias_correo")
    .select("gmail_id")
    .eq("user_id", sesion.userId)
    .in("gmail_id", ids);
  if (errVistas) return { ok: false, error: "No pudimos revisar el correo. Probá en un rato." };
  const yaVistos = new Set((vistas ?? []).map((v) => v.gmail_id));
  const nuevosIds = ids.filter((id) => !yaVistos.has(id));

  // bajar mensajes en tandas chicas para no saturar la API. Si un fetch cae
  // (corte de red), cortamos con mensaje amable en vez de explotar la action.
  const mensajes = [];
  try {
    for (let i = 0; i < nuevosIds.length; i += 10) {
      mensajes.push(
        ...(await Promise.all(
          nuevosIds.slice(i, i + 10).map((id) => obtenerMensaje(accessToken, id)),
        )),
      );
    }
  } catch {
    return { ok: false, error: "No pudimos leer el correo. Probá en un rato." };
  }

  const { data: tarjetas } = await sesion.supabase
    .from("tarjetas")
    .select("id, ultimos4")
    .eq("hogar_id", sesion.hogarId)
    .eq("activa", true);

  const filas = [];
  for (const mensaje of mensajes) {
    if (!mensaje) continue;
    const t = extraerTransaccion({
      remitente: mensaje.remitente,
      asunto: mensaje.asunto,
      cuerpo: mensaje.cuerpo,
    });
    if (!t) continue;
    filas.push({
      hogar_id: sesion.hogarId,
      user_id: sesion.userId,
      gmail_id: mensaje.id,
      remitente: mensaje.remitente.slice(0, 200),
      asunto: mensaje.asunto.slice(0, 200),
      fecha: fechaDesdeMs(mensaje.fechaMs),
      tipo: t.tipo,
      importe_centavos: t.importeCentavos,
      comercio: t.comercio,
      ultimos4: t.ultimos4,
      tarjeta_id: t.ultimos4
        ? ((tarjetas ?? []).find((x) => x.ultimos4 === t.ultimos4)?.id ?? null)
        : null,
    });
  }

  if (filas.length > 0) {
    const { error } = await sesion.supabase
      .from("sugerencias_correo")
      .upsert(filas, { onConflict: "user_id,gmail_id", ignoreDuplicates: true });
    if (error) return { ok: false, error: "No pudimos guardar las sugerencias." };
  }

  await sesion.supabase
    .from("conexiones_gmail")
    .update({ ultima_sincronizacion: new Date().toISOString() })
    .eq("user_id", sesion.userId);

  revalidatePath("/cuentas");
  revalidatePath("/sugerencias");
  revalidatePath("/resumen");
  return { ok: true, nuevas: filas.length, revisados: ids.length };
}

/**
 * Borra la conexión y revoca el permiso en Google. Las sugerencias pendientes
 * NO se borran: son datos ya extraídos que el usuario todavía puede aceptar o
 * descartar. Se borra la conexión PRIMERO; solo si eso funciona se revoca en
 * Google (así un revoke exitoso nunca deja una conexión con token muerto).
 */
export async function desconectarGmail(): Promise<ResultadoAccion> {
  const sesion = await obtenerSesionHogar();

  const admin = crearClienteAdmin();
  const { data: conexion } = await admin
    .from("conexiones_gmail")
    .select("refresh_token_cifrado")
    .eq("user_id", sesion.userId)
    .maybeSingle();

  const { error } = await sesion.supabase
    .from("conexiones_gmail")
    .delete()
    .eq("user_id", sesion.userId);
  if (error) return { ok: false, error: "No pudimos desconectar. Probá de nuevo." };

  if (conexion) {
    try {
      await revocarToken(descifrarToken(conexion.refresh_token_cifrado));
    } catch {
      // token ilegible o revoke caído: la conexión ya se borró, no bloquea
    }
  }

  revalidatePath("/cuentas");
  revalidatePath("/resumen");
  return { ok: true };
}

const esquemaAceptar = z.object({
  sugerenciaId: z.uuid(),
  medioTipo: z.enum(["cuenta", "tarjeta"]),
  medioId: z.uuid(),
  categoriaId: z.uuid().nullable(),
  ambito: z.enum(["hogar", "personal"]),
});

/**
 * Aceptar una sugerencia = crear el movimiento con la FECHA del mail (no la de
 * hoy: el consumo fue cuando fue) y marcarla aceptada. Sin categoría va a la
 * bandeja de entrada, como cualquier gasto sin categorizar.
 */
export async function aceptarSugerencia(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaAceptar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const datos = parseo.data;

  const sesion = await obtenerSesionHogar();
  const { data: sugerencia } = await sesion.supabase
    .from("sugerencias_correo")
    .select("id, tipo, importe_centavos, fecha, comercio, remitente, estado")
    .eq("id", datos.sugerenciaId)
    .eq("user_id", sesion.userId)
    .maybeSingle();
  if (!sugerencia || sugerencia.estado !== "pendiente") {
    return { ok: false, error: "Esa sugerencia ya no está pendiente." };
  }
  if (sugerencia.tipo === "ingreso" && datos.medioTipo !== "cuenta") {
    return { ok: false, error: "Un ingreso entra a una cuenta, no a una tarjeta." };
  }

  // el medio tiene que ser del hogar y estar activo
  const { data: medio } = await sesion.supabase
    .from(datos.medioTipo === "cuenta" ? "cuentas" : "tarjetas")
    .select("id")
    .eq("id", datos.medioId)
    .eq("hogar_id", sesion.hogarId)
    .eq("activa", true)
    .maybeSingle();
  if (!medio) return { ok: false, error: "Elegí un medio de pago válido." };

  // el ciclo se resuelve ANTES de reclamar: si la tarjeta no tiene de dónde
  // colgar el consumo, cortamos sin tocar el estado (si no, el gasto quedaría
  // sin ciclo y desaparecería de los resúmenes)
  let cicloId: string | null = null;
  if (datos.medioTipo === "tarjeta") {
    cicloId = await asegurarCicloParaFecha(sesion, datos.medioId, sugerencia.fecha);
    if (!cicloId) {
      return {
        ok: false,
        error: "Configurá el día de cierre de la tarjeta antes de agregar el gasto.",
      };
    }
  }

  // reclamo ATÓMICO: paso a "aceptada" solo si sigue "pendiente". Si dos taps o
  // dos pestañas corren a la vez, solo uno matchea la fila y crea el movimiento.
  const { data: reclamada } = await sesion.supabase
    .from("sugerencias_correo")
    .update({ estado: "aceptada" })
    .eq("id", sugerencia.id)
    .eq("user_id", sesion.userId)
    .eq("estado", "pendiente")
    .select("id");
  if (!reclamada?.length) {
    return { ok: false, error: "Esa sugerencia ya no está pendiente." };
  }

  const { data: movimiento, error } = await sesion.supabase
    .from("movimientos")
    .insert({
      hogar_id: sesion.hogarId,
      user_id: sesion.userId,
      tipo: sugerencia.tipo,
      descripcion: sugerencia.comercio ?? "Movimiento del correo",
      importe_centavos: sugerencia.importe_centavos,
      fecha: sugerencia.fecha,
      cuenta_id: datos.medioTipo === "cuenta" ? datos.medioId : null,
      tarjeta_id: datos.medioTipo === "tarjeta" ? datos.medioId : null,
      ciclo_id: cicloId,
      categoria_id: datos.categoriaId,
      visibilidad: datos.ambito === "hogar" ? "compartido" : "personal",
    })
    .select("id")
    .single();
  if (error || !movimiento) {
    // el insert falló: devuelvo la sugerencia a "pendiente" para no perderla
    await sesion.supabase
      .from("sugerencias_correo")
      .update({ estado: "pendiente" })
      .eq("id", sugerencia.id)
      .eq("user_id", sesion.userId);
    return { ok: false, error: "No pudimos crear el movimiento." };
  }

  await sesion.supabase
    .from("sugerencias_correo")
    .update({ movimiento_id: movimiento.id })
    .eq("id", sugerencia.id)
    .eq("user_id", sesion.userId);

  revalidatePath("/sugerencias");
  revalidatePath("/movimientos");
  revalidatePath("/resumen");
  revalidatePath("/presupuesto");
  return { ok: true };
}

const esquemaDescartar = z.object({ sugerenciaId: z.uuid() });

/** Descartada no vuelve: el gmail_id queda registrado y no se re-sugiere. */
export async function descartarSugerencia(entrada: unknown): Promise<ResultadoAccion> {
  const parseo = esquemaDescartar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };

  const sesion = await obtenerSesionHogar();
  const { error, data } = await sesion.supabase
    .from("sugerencias_correo")
    .update({ estado: "descartada" })
    .eq("id", parseo.data.sugerenciaId)
    .eq("user_id", sesion.userId)
    .eq("estado", "pendiente")
    .select("id");
  if (error || !data?.length) {
    return { ok: false, error: "No pudimos descartar la sugerencia." };
  }

  revalidatePath("/sugerencias");
  revalidatePath("/resumen");
  return { ok: true };
}
