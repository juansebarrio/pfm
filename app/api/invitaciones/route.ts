import {
  anularInvitacion,
  crearInvitacion,
  renovarInvitacion,
} from "@/lib/datos/invitaciones";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { crearClienteConToken } from "@/lib/supabase/portador";

// POST /api/invitaciones — invitar al hogar desde la app nativa.
//
// La web usa las server actions de app/acciones/hogar.ts; acá la lógica es la
// MISMA (lib/datos/invitaciones.ts), solo cambia de dónde sale la identidad
// (bearer en vez de cookies). El envío del email tiene que pasar por el server:
// RESEND_API_KEY jamás baja al dispositivo.
//
// Cuerpo (JSON):
//   { email }                                → crea la invitación (rol miembro)
//   { accion: "reenviar", invitacionId }     → renueva vencimiento + reintenta el email
//   { accion: "revocar",  invitacionId }     → la deja revocada, el token muere
//
// Respuestas: 200 { ok: true, enviado, link } (revocar: { ok: true }),
// 400/401 { error } en castellano accionable. `enviado: false` significa que el
// email no salió (sin RESEND_API_KEY): el cliente comparte `link` a mano.

export async function POST(request: Request) {
  const autorizacion = request.headers.get("authorization");
  const token = autorizacion?.startsWith("Bearer ")
    ? autorizacion.slice(7).trim()
    : null;

  // obtenerSesionHogar redirige a /login sin sesión; acá preferimos un 401
  let sesion;
  try {
    sesion = await obtenerSesionHogar(token ? crearClienteConToken(token) : undefined);
  } catch {
    return Response.json({ error: "Tu sesión venció. Entrá de nuevo." }, { status: 401 });
  }

  const cuerpo = (await request.json().catch(() => null)) as {
    accion?: unknown;
    email?: unknown;
    invitacionId?: unknown;
  } | null;
  if (!cuerpo || typeof cuerpo !== "object") {
    return Response.json({ error: "Mandá un JSON con el email a invitar." }, { status: 400 });
  }

  const accion = cuerpo.accion ?? "invitar";

  if (accion === "invitar") {
    // el rol lo fija el server: desde el nativo solo se invitan miembros
    const resultado = await crearInvitacion(sesion, { email: cuerpo.email, rol: "miembro" });
    if (!resultado.ok) return Response.json({ error: resultado.error }, { status: 400 });
    return Response.json(resultado);
  }

  if (accion === "reenviar") {
    const resultado = await renovarInvitacion(sesion, { invitacionId: cuerpo.invitacionId });
    if (!resultado.ok) return Response.json({ error: resultado.error }, { status: 400 });
    return Response.json(resultado);
  }

  if (accion === "revocar") {
    const resultado = await anularInvitacion(sesion, { invitacionId: cuerpo.invitacionId });
    if (!resultado.ok) {
      return Response.json({ error: "No pudimos revocar la invitación." }, { status: 400 });
    }
    return Response.json({ ok: true });
  }

  return Response.json(
    { error: 'La acción tiene que ser "reenviar" o "revocar".' },
    { status: 400 },
  );
}
