// ⚠️ `expo/fetch`, no el fetch global. El fetch de React Native resuelve la
// promesa recién con el body completo: no se puede leer por chunks. El de Expo
// sí expone un ReadableStream, que es lo que necesita el asistente para que el
// texto aparezca mientras se genera (trampa #1 de docs/IOS-NATIVO.md §5).
import { fetch } from "expo/fetch";
import { supabase } from "@/lib/supabase";

const API = process.env.EXPO_PUBLIC_API_URL;

export type MensajeChat = { rol: "usuario" | "asistente"; texto: string };

/** Un comprobante adjunto al último mensaje. Ver src/lib/imagen.ts. */
export type ImagenAdjunta = { tipo: "image/jpeg"; base64: string };

/**
 * Pide una respuesta al asistente y va entregando el texto por pedazos.
 * La API key de Anthropic vive en Vercel: nunca baja al dispositivo.
 */
export async function preguntarAlAsistente(
  mensajes: MensajeChat[],
  alRecibir: (pedazo: string) => void,
  señal?: AbortSignal,
  opciones: {
    /** apertura: la lectura que da solo al abrir, sin que el usuario escriba */
    apertura?: boolean;
    /** la foto del comprobante, solo en el turno en que se adjunta */
    imagen?: ImagenAdjunta | null;
  } = {},
): Promise<void> {
  if (!API) throw new Error("Falta EXPO_PUBLIC_API_URL");

  // La web se autentica con cookies; acá va el access token de la sesión
  // guardada en AsyncStorage. getSession() lo refresca solo si está vencido.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error("Sesión vencida. Entrá de nuevo.");

  const respuesta = await fetch(`${API}/api/asistente`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      mensajes,
      apertura: opciones.apertura,
      imagenes: opciones.imagen ? [opciones.imagen] : undefined,
    }),
    signal: señal,
  });

  if (!respuesta.ok) {
    // el server manda texto plano legible en los errores
    throw new Error((await respuesta.text()) || "El asistente no respondió.");
  }
  if (!respuesta.body) throw new Error("El asistente no respondió.");

  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  while (true) {
    const { done, value } = await lector.read();
    if (done) break;
    // stream: true para no cortar un carácter multibyte (las tildes) al medio
    alRecibir(decodificador.decode(value, { stream: true }));
  }
}
