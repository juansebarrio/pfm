import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { contextoFinanciero } from "@/lib/ia/contexto";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { crearClienteConToken } from "@/lib/supabase/portador";

// Asistente financiero: POST con el historial del chat, respuesta en
// streaming (texto plano por chunks). El contexto del hogar se arma en el
// server con la sesión del usuario (RLS) y viaja como bloque de system.
// Route handler (no server action) porque las actions no streamean.

export const maxDuration = 120; // Opus con thinking puede tomarse su tiempo

const esquemaEntrada = z.object({
  mensajes: z
    .array(
      z.object({
        rol: z.enum(["usuario", "asistente"]),
        texto: z.string().trim().min(1).max(2000),
      }),
    )
    .min(1)
    .max(24),
});

// Instrucciones estables (primer bloque de system, cacheado). El contexto
// financiero — que cambia por request — va DESPUÉS del breakpoint de caché.
const INSTRUCCIONES = `Sos el asistente financiero de "Fin de mes", una app argentina de presupuesto del hogar. Ayudás a entender los números propios y a decidir mejor en el día a día.

Cómo funciona la app (para que tus respuestas usen sus conceptos):
- Presupuesto por partidas ("sobres"): a cada categoría se le asigna plata por mes; hay partidas fijas y partidas con rollover (lo que sobra pasa al mes siguiente).
- Dos ámbitos: HOGAR (compartido entre los adultos) y PERSONAL (privado de cada uno).
- Tarjetas de crédito con ciclos reales: fecha de cierre y de vencimiento; los consumos caen en el ciclo según la fecha de compra; hay compras en cuotas.
- Patrimonio: tenencias en pesos y dólares valuadas al tipo de cambio cargado.

Reglas:
- Respondés SIEMPRE en español rioplatense (voseo), con tono cercano y concreto.
- Usá los números del contexto para responder con datos reales; citá los importes exactos en formato argentino ($ 123.456). Si el dato no está en el contexto, decilo — jamás inventes números.
- Sé breve: 2 a 6 oraciones, o una lista corta con guiones. TEXTO PLANO puro: nada de markdown (ni asteriscos, ni negritas, ni encabezados) — la interfaz no lo renderiza.
- Educación financiera general: bien (cómo funciona el interés de la tarjeta, la inflación, el método de sobres, pagar mínimo vs total).
- NO des asesoramiento de inversión específico: no recomiendes comprar o vender instrumentos puntuales (acciones, bonos, cripto, FCI). Si te lo piden, explicá conceptos generales y sugerí consultarlo con un asesor matriculado ante la CNV.
- No pidas ni menciones contraseñas, tokens ni datos de acceso.
- Si te preguntan algo ajeno a finanzas personales, redirigí con amabilidad al tema de la app.`;

export async function POST(request: Request) {
  // sin API key configurada, la feature está apagada
  if (!process.env.ANTHROPIC_API_KEY) {
    return new Response("El asistente no está configurado.", { status: 503 });
  }

  const cuerpo = await request.json().catch(() => null);
  const parseo = esquemaEntrada.safeParse(cuerpo);
  if (!parseo.success) {
    return new Response("Datos inválidos", { status: 400 });
  }

  // La web manda cookies; la app nativa manda `Authorization: Bearer`. En los
  // dos casos manda RLS: el token identifica al usuario ante Postgres.
  const autorizacion = request.headers.get("authorization");
  const token = autorizacion?.startsWith("Bearer ")
    ? autorizacion.slice(7).trim()
    : null;

  // obtenerSesionHogar redirige a /login sin sesión; acá preferimos un 401
  let sesion;
  try {
    sesion = await obtenerSesionHogar(token ? crearClienteConToken(token) : undefined);
  } catch {
    return new Response("No autorizado", { status: 401 });
  }

  let contexto: string;
  try {
    contexto = await contextoFinanciero(sesion);
  } catch {
    return new Response("No pudimos leer tus datos. Probá de nuevo.", { status: 500 });
  }

  // el historial del cliente se normaliza: roles alternados, empieza en user
  const mensajes: Anthropic.MessageParam[] = parseo.data.mensajes.map((m) => ({
    role: m.rol === "usuario" ? "user" : "assistant",
    content: m.texto,
  }));
  if (mensajes[0].role !== "user") mensajes.shift();
  if (mensajes.length === 0) return new Response("Datos inválidos", { status: 400 });

  const client = new Anthropic();
  const stream = client.beta.messages.stream({
    model: "claude-opus-5",
    max_tokens: 16000,
    // si un clasificador declinara el pedido, la API reintenta sola en el
    // modelo de fallback recomendado en la misma llamada
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "medium" }, // balance calidad/latencia para chat
    system: [
      {
        type: "text",
        text: INSTRUCCIONES,
        cache_control: { type: "ephemeral" }, // estable → prefijo cacheado
      },
      {
        type: "text",
        text: `Contexto financiero del hogar (datos reales, actualizados a esta consulta):\n\n${contexto}`,
      },
    ],
    messages: mensajes,
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let emitido = false;
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            emitido = true;
            controller.enqueue(encoder.encode(event.delta.text));
          }
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") {
          controller.enqueue(
            encoder.encode(
              `${emitido ? "\n\n" : ""}No puedo ayudarte con eso. Probá con otra consulta.`,
            ),
          );
        }
      } catch (error) {
        // el stream ya está abierto: el error viaja como texto amable
        const mensaje =
          error instanceof Anthropic.AuthenticationError
            ? "La API key del asistente es inválida. Revisá ANTHROPIC_API_KEY."
            : error instanceof Anthropic.RateLimitError
              ? "El asistente está saturado. Esperá un minuto y probá de nuevo."
              : "El asistente tuvo un problema. Probá de nuevo.";
        controller.enqueue(encoder.encode(`${emitido ? "\n\n" : ""}${mensaje}`));
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
