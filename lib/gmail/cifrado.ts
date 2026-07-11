import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// El refresh token de Google se guarda cifrado con AES-256-GCM. La clave vive
// en GMAIL_TOKEN_KEY (32 bytes en base64, solo servidor): si la base de datos
// se filtrara, los tokens no sirven sin la clave.

function clave(): Buffer {
  const b64 = process.env.GMAIL_TOKEN_KEY;
  if (!b64) throw new Error("Falta GMAIL_TOKEN_KEY (32 bytes en base64)");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("GMAIL_TOKEN_KEY debe ser 32 bytes en base64");
  return k;
}

/** "iv.tag.datos" en base64. */
export function cifrarToken(texto: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", clave(), iv);
  const datos = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), datos].map((b) => b.toString("base64")).join(".");
}

export function descifrarToken(guardado: string): string {
  const [iv, tag, datos] = guardado.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", clave(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(datos), decipher.final()]).toString("utf8");
}
