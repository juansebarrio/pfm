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
// El vocabulario es CHICO a propósito: cuatro marcadores. Cada uno agregado es
// una forma más de que el modelo se equivoque.
//
//   #dato Disponible en julio | $ 564.900 | bien
//   #partida Supermercado | $ 268.400 | $ 520.000
//   #ojo La Visa cierra mañana
//   #luego ¿Qué puedo recortar? | ¿Cómo viene la tarjeta?
//
// Regla de oro del parser: NUNCA perder contenido. Una línea con marcador que
// no parsea cae a texto — el usuario ve la oración, no un bloque vacío.

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
  | { tipo: "luego"; preguntas: string[] };

const TONOS: TonoDato[] = ["bien", "atencion", "mal", "neutro"];

/**
 * "$ 1.234.567,89" → 123456789 centavos. Devuelve null si no parece un importe.
 * Solo se usa para calcular el ancho de una barra: si falla, la barra no se
 * dibuja y el texto igual se muestra. Nunca alimenta un cálculo de plata.
 */
export function centavosDesdeTexto(texto: string): number | null {
  const limpio = texto.trim().replace(/^[−-]\s*/, "").replace(/^(\$|USD)\s*/i, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpio)) return null;
  const [enteros, decimales = ""] = limpio.split(",");
  const centavos =
    Number(enteros.replace(/\./g, "")) * 100 + Number(decimales.padEnd(2, "0"));
  return Number.isFinite(centavos) ? centavos : null;
}

function partes(resto: string): string[] {
  return resto.split("|").map((p) => p.trim());
}

/** Una línea con marcador → bloque, o null si no parsea (cae a texto). */
function comoBloque(linea: string): BloqueAsistente | null {
  const m = /^#(dato|partida|ojo|luego)\s+(.+)$/i.exec(linea.trim());
  if (!m) return null;
  const marcador = m[1].toLowerCase();
  const resto = m[2].trim();

  if (marcador === "ojo") return { tipo: "ojo", texto: resto };

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
 */
export function parsearRespuesta(
  respuesta: string,
  { parcial = false }: { parcial?: boolean } = {},
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
    const bloque = /^\s*#/.test(linea) ? comoBloque(linea) : null;
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
