import "server-only";

// Cliente mínimo de la API de Gmail (REST, sin SDK): refrescar el access
// token, listar los últimos mensajes y bajar cada uno como texto plano.
// Scope usado: gmail.readonly — la app JAMÁS escribe ni borra correo.

const OAUTH = "https://oauth2.googleapis.com";
const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function refrescarAccessToken(refreshToken: string): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const r = await fetch(`${OAUTH}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!r.ok) return null;
  const data = (await r.json()) as { access_token?: string };
  return data.access_token ?? null;
}

/** Best effort: al desconectar se le pide a Google que revoque el permiso. */
export async function revocarToken(refreshToken: string): Promise<void> {
  await fetch(`${OAUTH}/revoke?token=${encodeURIComponent(refreshToken)}`, {
    method: "POST",
  }).catch(() => {});
}

export async function listarIdsDeMensajes(
  accessToken: string,
  max: number,
): Promise<string[]> {
  const r = await fetch(`${GMAIL}/messages?maxResults=${max}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) throw new Error(`Gmail list ${r.status}`);
  const data = (await r.json()) as { messages?: Array<{ id: string }> };
  return (data.messages ?? []).map((m) => m.id);
}

export type MensajeGmail = {
  id: string;
  remitente: string;
  asunto: string;
  cuerpo: string;
  /** epoch ms del mail (internalDate de Gmail) */
  fechaMs: number;
};

type ParteGmail = {
  mimeType?: string;
  body?: { data?: string };
  parts?: ParteGmail[];
};

/** Junta el texto de las partes: text/plain preferido, text/html como respaldo. */
function textoDeParte(parte: ParteGmail): { plano: string; html: string } {
  let plano = "";
  let html = "";
  const datos = parte.body?.data
    ? Buffer.from(parte.body.data, "base64url").toString("utf8")
    : "";
  if (datos && parte.mimeType === "text/plain") plano += datos;
  if (datos && parte.mimeType === "text/html") html += datos;
  for (const hija of parte.parts ?? []) {
    const t = textoDeParte(hija);
    plano += t.plano;
    html += t.html;
  }
  return { plano, html };
}

/** HTML de mail → texto plano suficiente para el parser (sin DOM). */
export function htmlATexto(html: string): string {
  return html
    .replace(/<(?:style|script)[\s\S]*?<\/(?:style|script)>/gi, " ")
    .replace(/<br\s*\/?>|<\/(?:p|div|tr|li|h[1-6]|td)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (original, n) => {
      // sin el guard, un &#1114112; (o mayor) tira RangeError y rompe la sync
      const cp = Number(n);
      return cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : original;
    })
    .replace(/&aacute;/gi, "á")
    .replace(/&eacute;/gi, "é")
    .replace(/&iacute;/gi, "í")
    .replace(/&oacute;/gi, "ó")
    .replace(/&uacute;/gi, "ú")
    .replace(/&ntilde;/gi, "ñ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

export async function obtenerMensaje(
  accessToken: string,
  id: string,
): Promise<MensajeGmail | null> {
  const r = await fetch(`${GMAIL}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return null;
  const data = (await r.json()) as {
    id: string;
    internalDate?: string;
    payload?: ParteGmail & { headers?: Array<{ name: string; value: string }> };
  };
  if (!data.payload) return null;

  const encabezado = (nombre: string) =>
    data.payload?.headers?.find((h) => h.name.toLowerCase() === nombre)?.value ?? "";

  const { plano, html } = textoDeParte(data.payload);
  const cuerpo = (plano.trim() || htmlATexto(html)).slice(0, 20_000);

  return {
    id: data.id,
    remitente: encabezado("from"),
    asunto: encabezado("subject"),
    cuerpo,
    fechaMs: Number(data.internalDate ?? Date.now()),
  };
}
