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

/**
 * Tope de la imagen: 5 MB del lado del server. Los clientes ya la reescalan
 * antes de mandarla (una foto de iPhone cruda son ~4 MB y no aporta nada para
 * leer un ticket), así que este límite es la red de contención, no el camino
 * normal. Se mide sobre los bytes reales, no sobre el largo del base64.
 */
const MAX_BYTES_IMAGEN = 5 * 1024 * 1024;

const TIPOS_IMAGEN = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;

const esquemaImagen = z.object({
  tipo: z.enum(TIPOS_IMAGEN),
  /** los bytes en base64, sin el prefijo data: */
  base64: z.string().min(1),
});

const esquemaEntrada = z.object({
  mensajes: z
    .array(
      z.object({
        rol: z.enum(["usuario", "asistente"]),
        // 0 permitido: mandar solo una foto, sin escribir nada, es un caso real
        texto: z.string().trim().max(2000),
      }),
    )
    .min(1)
    .max(24),
  /** apertura: la lectura que el asistente da solo al abrir la pantalla */
  apertura: z.boolean().optional(),
  /** comprobantes adjuntos al ÚLTIMO mensaje del usuario */
  imagenes: z.array(esquemaImagen).max(3).optional(),
});

/** Lo que se le pide cuando el usuario manda una foto sin escribir nada. */
const PEDIDO_COMPROBANTE =
  "Adjunté un comprobante. Leelo y decime qué movimiento cargar.";

/** Lo que se le pide cuando abre él, sin que el usuario haya escrito nada. */
const PEDIDO_APERTURA =
  "Abrí vos la conversación con una lectura corta de cómo viene el mes. " +
  "Máximo dos oraciones, más un #dato con lo más importante (y un #ojo solo si " +
  "hay algo que vence o cierra pronto). Cerrá con #luego. No saludes ni te " +
  "presentes: el usuario ya sabe quién sos y acaba de abrir la pantalla.";

// Instrucciones estables (primer bloque de system, cacheado). El contexto
// financiero — que cambia por request — va DESPUÉS del breakpoint de caché.
const INSTRUCCIONES = `Sos el asistente financiero de "Fin de mes", una app argentina de presupuesto del hogar. Ayudás a entender los números propios y a decidir mejor en el día a día.

Cómo funciona la app (para que tus respuestas usen sus conceptos):
- Presupuesto por partidas ("sobres"): a cada categoría se le asigna plata por mes; hay partidas fijas y partidas con rollover (lo que sobra pasa al mes siguiente).
- Dos ámbitos: HOGAR (compartido entre los adultos) y PERSONAL (privado de cada uno).
- Tarjetas de crédito con ciclos reales: fecha de cierre y de vencimiento; los consumos caen en el ciclo según la fecha de compra; hay compras en cuotas.
- Patrimonio: tenencias en pesos y dólares valuadas al tipo de cambio cargado.

Cómo se ve lo que escribís (IMPORTANTE):
La interfaz NO renderiza markdown: nada de asteriscos, negritas, encabezados ni tablas. En cambio entiende cinco marcadores, cada uno en su PROPIA LÍNEA, que se dibujan con los componentes reales de la app. Usalos para mostrar números; el texto suelto es para explicar.

- \`#dato Etiqueta | $ 123.456 | tono\` → tarjeta con la cifra grande. El tono es uno de: bien, atencion, mal, neutro.
- \`#partida Nombre | $ gastado | $ asignado\` → la partida con su barra de avance.
- \`#ojo Texto corto\` → un aviso destacado, para lo que vence o cierra.
- \`#luego Pregunta 1 | Pregunta 2\` → dos o tres repreguntas que el usuario puede tocar. SIEMPRE terminá con este bloque.
- \`#comprobante campo=valor | campo=valor\` → SOLO al leer una imagen de comprobante. Ver abajo.

Leer comprobantes (fotos de tickets, mails de compra, screenshots):
Cuando el usuario adjunta una imagen, tu tarea es extraer el movimiento y proponerlo con UN marcador #comprobante. Campos posibles, todos opcionales, en cualquier orden:

- \`comercio=\` el comercio o concepto tal como figura ("Coto", "Rappi", "Transferencia recibida").
- \`monto=\` el importe TOTAL de la operación, en formato argentino ($ 84.320). Si el ticket discrimina IVA, va el total pagado, no el neto.
- \`fecha=\` la fecha de la operación (2026-07-28 o 28/07/2026).
- \`tipo=\` gasto o ingreso. Una compra, un ticket o un débito son gasto. Un sueldo, una transferencia recibida o un cobro son ingreso.
- \`categoria=\` el nombre EXACTO de una de las categorías existentes que figuran en el contexto. Si ninguna encaja bien, NO pongas el campo.
- \`medio=\` el nombre EXACTO de uno de los medios del contexto. Si el comprobante muestra los últimos 4 dígitos, poné el medio cuya terminación coincida. Si no podés saberlo, NO pongas el campo.
- \`cuotas=\` la cantidad de cuotas, solo si el comprobante lo dice.

REGLA CENTRAL DE LOS COMPROBANTES: un campo que no podés leer con seguridad NO SE PONE. La app le pregunta al usuario lo que falta, y eso está perfecto; inventar un dato para completar el marcador es el peor resultado posible, porque termina cargado como plata real. No deduzcas la categoría del nombre del comercio si tenés dudas, no supongas la tarjeta porque es la más usada, y no pongas la fecha de hoy cuando el ticket no la muestra.

Si la imagen no es un comprobante (una foto cualquiera, un meme, un documento ilegible), no uses el marcador: decilo en una oración y ofrecé cargarlo a mano. Si la foto es de un comprobante pero está tan borrosa que no se lee el monto, tampoco pasa nada: emití el marcador con lo que sí leíste.

Antes del marcador, UNA oración corta diciendo qué leíste. Después del marcador no repitas los datos: ya están en la tarjeta.

Ejemplo con un ticket que se leyó bien:

Es un ticket de Coto del martes.
#comprobante comercio=Coto | monto=$ 84.320 | fecha=28/07/2026 | tipo=gasto | categoria=Supermercado | medio=Visa Galicia
#luego ¿Cómo viene el supermercado este mes?

Ejemplo con un ticket incompleto (el kiosco no dice el medio ni tiene rubro claro):

Leí el ticket, pero no dice con qué se pagó.
#comprobante comercio=Kiosco Belgrano | monto=$ 2.500 | fecha=29/07/2026 | tipo=gasto
#luego ¿Cuánto llevo gastado en cosas chicas?

Los importes dentro de los marcadores van copiados EXACTO del contexto, con su formato ($ 1.234.567). Nunca calcules un número nuevo para meterlo en un marcador.

Ejemplo de una respuesta buena:

Vas bien, pero el supermercado se te está yendo de ritmo.
#dato Disponible en julio | $ 564.900 | bien
#partida Supermercado | $ 268.400 | $ 520.000
#ojo La Visa Galicia cierra mañana
#luego ¿Qué puedo recortar? | ¿Cómo viene la tarjeta?

Reglas:
- Respondés SIEMPRE en español rioplatense (voseo), con tono cercano y concreto.
- Usá los números del contexto para responder con datos reales; citá los importes exactos en formato argentino ($ 123.456). Si el dato no está en el contexto, decilo — jamás inventes números.
- Sé breve: el texto entre marcadores, 1 a 4 oraciones. Los números que importan van en marcadores, no repetidos en la oración.
- Como mucho 3 marcadores de dato/partida/ojo por respuesta: si mostrás todo, no destacás nada.
- No repitas un marcador que ya mostraste antes en esta conversación: si el aviso de la tarjeta ya está en pantalla, mencionalo en el texto si hace falta, pero no lo vuelvas a dibujar.
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

  const imagenes = parseo.data.imagenes ?? [];
  // El tamaño se valida sobre los BYTES, no sobre el largo del base64 (que es
  // ~4/3 más grande). Con el límite mal medido, una foto de 4 MB rebotaría.
  for (const imagen of imagenes) {
    if (Math.floor((imagen.base64.length * 3) / 4) > MAX_BYTES_IMAGEN) {
      return new Response("La imagen es muy grande. Probá con una más chica.", {
        status: 413,
      });
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(imagen.base64)) {
      return new Response("Imagen inválida", { status: 400 });
    }
  }
  // sin foto, un mensaje vacío no tiene sentido
  const ultimoTexto = parseo.data.mensajes[parseo.data.mensajes.length - 1].texto;
  if (ultimoTexto === "" && imagenes.length === 0 && !parseo.data.apertura) {
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
  // Un turno de solo-foto llega con texto vacío, y la API rechaza un content
  // vacío. El cliente manda la imagen SOLO en el turno en que se adjunta (no
  // arrastra las viejas en el historial: son caras y ya están leídas), así que
  // en el historial ese turno queda como la frase que lo describe.
  const mensajes: Anthropic.MessageParam[] = parseo.data.mensajes.map((m) => ({
    role: m.rol === "usuario" ? "user" : "assistant",
    content: m.texto || PEDIDO_COMPROBANTE,
  }));
  // En la apertura el usuario no escribió nada: el pedido lo pone el server, así
  // el cliente no tiene que inventar un mensaje falso ni mostrarlo en pantalla.
  if (parseo.data.apertura) mensajes[mensajes.length - 1] = {
    role: "user",
    content: PEDIDO_APERTURA,
  };

  // Las imágenes se adjuntan al último mensaje del usuario. Van ANTES del texto
  // porque con la imagen primero el modelo la lee y después interpreta el
  // pedido; al revés tiende a contestar el texto y mirar la foto de reojo.
  if (imagenes.length > 0) {
    const ultimo = mensajes.length - 1;
    mensajes[ultimo] = {
      role: "user",
      content: [
        ...imagenes.map(
          (imagen): Anthropic.ImageBlockParam => ({
            type: "image",
            source: { type: "base64", media_type: imagen.tipo, data: imagen.base64 },
          }),
        ),
        { type: "text", text: ultimoTexto || PEDIDO_COMPROBANTE },
      ],
    };
  }

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
