// Bloques del asistente: el lenguaje chiquito con el que la IA compone la
// interfaz de la app en vez de escribir párrafos.
//
// POR QUÉ. Un chat que devuelve texto plano desperdicia lo único que este
// asistente tiene y ChatGPT no: los números reales del hogar y un sistema de
// diseño para mostrarlos. "Te quedan $ 564.900" es una oración; la cifra en la
// tipografía de 52px con su barra de avance es la app. Así que en vez de
// prohibirle markdown (que la interfaz no renderiza) se le da un vocabulario
// mínimo que sí se renderiza, con los componentes que ya existen.
//
// El vocabulario es CHICO a propósito: cinco marcadores. Cada uno agregado es
// una forma más de que el modelo se equivoque.
//
//   #dato Disponible en julio | $ 564.900 | bien
//   #partida Supermercado | $ 268.400 | $ 520.000
//   #ojo La Visa cierra mañana
//   #luego ¿Qué puedo recortar? | ¿Cómo viene la tarjeta?
//   #comprobante comercio=Coto | monto=$ 84.320 | fecha=2026-07-28 | tipo=gasto
//
// El quinto es distinto de los otros cuatro y vale aclarar por qué se sumó: los
// primeros MUESTRAN, este PROPONE UNA ACCIÓN. Es la lectura de una foto de
// comprobante convertida en un movimiento para cargar, y por eso no se aplica
// solo: se renderiza como una tarjeta de confirmación. Ver comprobante.ts.
//
// Regla de oro del parser: NUNCA perder contenido. Una línea con marcador que
// no parsea cae a texto — el usuario ve la oración, no un bloque vacío.

import { parsearComprobante, type ComprobanteLeido } from "./comprobante";
import { centavosDesdeTexto } from "./dinero";
import { hoyBA } from "./fechas";

export type TonoDato = "bien" | "atencion" | "mal" | "neutro";

export type BloqueAsistente =
  | { tipo: "texto"; texto: string }
  | { tipo: "dato"; etiqueta: string; valor: string; tono: TonoDato }
  | {
      tipo: "partida";
      nombre: string;
      gastado: string;
      asignado: string;
      /** 0..1 para la barra; null si no se pudo calcular */
      progreso: number | null;
    }
  | { tipo: "ojo"; texto: string }
  | { tipo: "luego"; preguntas: string[] }
  | { tipo: "comprobante"; leido: ComprobanteLeido };

const TONOS: TonoDato[] = ["bien", "atencion", "mal", "neutro"];

function partes(resto: string): string[] {
  return resto.split("|").map((p) => p.trim());
}

/** Una línea con marcador → bloque, o null si no parsea (cae a texto). */
function comoBloque(linea: string, hoy: string): BloqueAsistente | null {
  const m = /^#(dato|partida|ojo|luego|comprobante)\s+(.+)$/i.exec(linea.trim());
  if (!m) return null;
  const marcador = m[1].toLowerCase();
  const resto = m[2].trim();

  if (marcador === "ojo") return { tipo: "ojo", texto: resto };

  if (marcador === "comprobante") {
    const leido = parsearComprobante(resto, hoy);
    return leido ? { tipo: "comprobante", leido } : null;
  }

  if (marcador === "luego") {
    const preguntas = partes(resto).filter((p) => p !== "").slice(0, 3);
    return preguntas.length > 0 ? { tipo: "luego", preguntas } : null;
  }

  if (marcador === "dato") {
    const [etiqueta, valor, tono] = partes(resto);
    if (!etiqueta || !valor) return null;
    return {
      tipo: "dato",
      etiqueta,
      valor,
      tono: TONOS.includes(tono as TonoDato) ? (tono as TonoDato) : "neutro",
    };
  }

  // partida
  const [nombre, gastado, asignado] = partes(resto);
  if (!nombre || !gastado || !asignado) return null;
  const g = centavosDesdeTexto(gastado);
  const a = centavosDesdeTexto(asignado);
  return {
    tipo: "partida",
    nombre,
    gastado,
    asignado,
    progreso: g !== null && a !== null && a > 0 ? Math.min(1, Math.max(0, g / a)) : null,
  };
}

/**
 * Parte la respuesta en bloques renderables.
 *
 * `parcial` = el stream sigue abierto. En ese caso la última línea se retiene
 * si empieza con un marcador todavía incompleto: sin esto se vería "#dat"
 * como texto y un instante después saltaría a ser una tarjeta.
 *
 * `hoy` (yyyy-mm-dd en BA) lo necesita #comprobante para descartar una fecha
 * futura leída mal; se inyecta para que los tests no dependan del reloj.
 */
export function parsearRespuesta(
  respuesta: string,
  { parcial = false, hoy = hoyBA() }: { parcial?: boolean; hoy?: string } = {},
): BloqueAsistente[] {
  const lineas = respuesta.split("\n");

  if (parcial && lineas.length > 0) {
    const ultima = lineas[lineas.length - 1];
    if (/^\s*#/.test(ultima)) lineas.pop();
  }

  const bloques: BloqueAsistente[] = [];
  let parrafo: string[] = [];

  const cerrarParrafo = () => {
    const texto = parrafo.join("\n").trim();
    if (texto !== "") bloques.push({ tipo: "texto", texto });
    parrafo = [];
  };

  for (const linea of lineas) {
    const bloque = /^\s*#/.test(linea) ? comoBloque(linea, hoy) : null;
    if (bloque) {
      cerrarParrafo();
      bloques.push(bloque);
    } else {
      parrafo.push(linea);
    }
  }
  cerrarParrafo();
  return bloques;
}

/** Las repreguntas que propuso el modelo (siempre van al final). */
export function repreguntas(bloques: BloqueAsistente[]): string[] {
  const ultimo = bloques.find((b) => b.tipo === "luego");
  return ultimo?.tipo === "luego" ? ultimo.preguntas : [];
}

/** Los textos de los #ojo de una respuesta, para no repetirlos más abajo. */
export function avisosDe(bloques: BloqueAsistente[]): string[] {
  return bloques.filter((b) => b.tipo === "ojo").map((b) => b.texto);
}

const clave = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]/g, "");

/**
 * Saca los avisos que ya están en pantalla más arriba.
 *
 * Al prompt se le pide no repetirlos, pero es una regla blanda y el modelo la
 * incumple: si preguntás por la tarjeta, vuelve a dibujar el mismo cartel
 * ámbar que ya mostró en la apertura. Acá se garantiza. Compara sin tildes ni
 * puntuación, porque el modelo reescribe la misma advertencia con otra coma.
 */
export function sinAvisosRepetidos(
  bloques: BloqueAsistente[],
  yaEnPantalla: string[],
): BloqueAsistente[] {
  const vistos = new Set(yaEnPantalla.map(clave));
  return bloques.filter((b) => b.tipo !== "ojo" || !vistos.has(clave(b.texto)));
}
