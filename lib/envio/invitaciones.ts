import "server-only";

/**
 * Envío del email de invitación. Detrás de RESEND_API_KEY: sin la variable,
 * el link se loguea en consola y se devuelve para copiar — esta versión
 * funciona completa sin depender del servicio externo (DESIGN_NOTES.md §5).
 */
export async function enviarEmailInvitacion(entrada: {
  email: string;
  nombreHogar: string;
  nombreInvita: string;
  link: string;
}): Promise<{ enviado: boolean }> {
  const clave = process.env.RESEND_API_KEY;

  if (!clave) {
    console.info(
      `[invitación] Sin RESEND_API_KEY: compartí este link con ${entrada.email} → ${entrada.link}`,
    );
    return { enviado: false };
  }

  const respuesta = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${clave}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Fin de mes <invitaciones@resend.dev>",
      to: [entrada.email],
      subject: `${entrada.nombreInvita} te invita al hogar ${entrada.nombreHogar} en Fin de mes`,
      text: [
        `${entrada.nombreInvita} te invitó a compartir el presupuesto del hogar ${entrada.nombreHogar} en Fin de mes.`,
        "",
        `Entrá con este link (vence en 14 días): ${entrada.link}`,
        "",
        "Por email. Vos elegís tu clave al entrar.",
      ].join("\n"),
    }),
  });

  if (!respuesta.ok) {
    console.error(`[invitación] Resend devolvió ${respuesta.status}; el link sigue siendo válido: ${entrada.link}`);
    return { enviado: false };
  }
  return { enviado: true };
}
