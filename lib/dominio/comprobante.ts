// Leer un comprobante: ticket, mail de compra o screenshot → un movimiento.
//
// POR QUÉ ESTE MÓDULO EXISTE. La foto la lee el modelo, pero lo que hace con
// esa lectura es plata que entra al presupuesto. Así que la lectura no se
// aplica: se propone. Este módulo es la frontera entre "lo que el modelo dijo
// que vio" y "lo que la app está dispuesta a cargar", y esa frontera se testea.
//
// El modelo contesta con un marcador más del lenguaje de bloques
// (ver asistente.ts), con campos clave=valor en vez de posicionales:
//
//   #comprobante comercio=Coto | monto=$ 84.320 | fecha=2026-07-28 |
//                tipo=gasto | categoria=Supermercado | medio=Visa Galicia 4321
//
// clave=valor y no posicional a propósito: en un comprobante real SIEMPRE
// falta algo — el ticket del kiosco no dice el medio, el mail de Mercado Pago
// no dice la categoría. Con campos nombrados, lo que falta simplemente no
// viene, y la UI pregunta por eso y nada más. Con campos posicionales habría
// que mandar vacíos y contar barras.
//
// REGLA: de acá no sale un movimiento cargado. Sale una PROPUESTA, con lo que
// falta declarado. Quien carga es el usuario tocando "Cargar".

import { centavosDesdeTexto } from "./dinero";

export type TipoLeido = "gasto" | "ingreso";

/** Lo que el modelo dice haber leído. Todo puede faltar: es una foto. */
export type ComprobanteLeido = {
  /** el comercio o el concepto: "Coto", "Transferencia recibida" */
  comercio: string | null;
  /** el importe tal como lo escribió el modelo, para mostrarlo igual */
  montoTexto: string | null;
  /** el mismo importe en centavos; null si no parseó */
  montoCentavos: number | null;
  /** yyyy-mm-dd ya normalizada y validada */
  fecha: string | null;
  tipo: TipoLeido | null;
  /** nombre de categoría propuesto; se resuelve contra las del hogar */
  categoria: string | null;
  /** el medio tal como aparece en el comprobante: "Visa ••4321", "Efectivo" */
  medio: string | null;
  /** cantidad de cuotas si el comprobante lo dice */
  cuotas: number | null;
};

export type CampoFaltante = "monto" | "fecha" | "tipo" | "medio" | "categoria";

/** Qué preguntarle al usuario, en el orden en que lo va a resolver. */
const ORDEN_CAMPOS: CampoFaltante[] = ["monto", "fecha", "tipo", "medio", "categoria"];

const CLAVES = new Set([
  "comercio",
  "monto",
  "fecha",
  "tipo",
  "categoria",
  "medio",
  "cuotas",
]);

/**
 * "2026-07-28" o "28/07/2026" o "28/07/26" → "2026-07-28". null si no es una
 * fecha real (31/02) o si está tan lejos que seguro se leyó mal.
 *
 * El modelo tiende a copiar el formato del ticket, que en Argentina es
 * dd/mm/aaaa. Normalizar acá es más barato que pelearlo en el prompt.
 */
export function normalizarFecha(texto: string, hoy: string): string | null {
  const limpio = texto.trim();
  let anio: number, mes: number, dia: number;

  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(limpio);
  const local = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2}|\d{4})$/.exec(limpio);
  if (iso) {
    [anio, mes, dia] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (local) {
    dia = Number(local[1]);
    mes = Number(local[2]);
    const a = Number(local[3]);
    anio = local[3].length === 2 ? 2000 + a : a;
  } else {
    return null;
  }

  // que la fecha exista de verdad: Date corrige 31/02 a 03/03 en silencio
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate();
  if (dia > diasDelMes) return null;

  const fecha = `${anio}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;

  // un ticket no es del futuro ni de hace diez años: eso es un OCR mal leído
  const anioHoy = Number(hoy.slice(0, 4));
  if (fecha > hoy || anio < anioHoy - 5) return null;
  return fecha;
}

/**
 * El resto de una línea `#comprobante` → la lectura. null si no hay NADA
 * aprovechable (así la línea cae a texto y el usuario ve lo que el modelo dijo,
 * en vez de una tarjeta vacía — la regla de oro del parser de bloques).
 */
export function parsearComprobante(resto: string, hoy: string): ComprobanteLeido | null {
  const campos = new Map<string, string>();
  for (const parte of resto.split("|")) {
    const corte = parte.indexOf("=");
    if (corte === -1) continue;
    const clave = parte.slice(0, corte).trim().toLowerCase();
    const valor = parte.slice(corte + 1).trim();
    // "categoria=—" y amigos: el modelo marcando que no sabe
    if (!CLAVES.has(clave) || valor === "" || /^[—–-]$|^n\/?a$|^null$/i.test(valor)) continue;
    campos.set(clave, valor);
  }
  if (campos.size === 0) return null;

  const montoTexto = campos.get("monto") ?? null;
  const fechaCruda = campos.get("fecha");
  const tipoCrudo = campos.get("tipo")?.toLowerCase();
  const cuotasCrudo = campos.get("cuotas");
  const cuotas = cuotasCrudo ? Number.parseInt(cuotasCrudo, 10) : null;

  return {
    comercio: campos.get("comercio") ?? null,
    montoTexto,
    montoCentavos: montoTexto ? centavosDesdeTexto(montoTexto) : null,
    fecha: fechaCruda ? normalizarFecha(fechaCruda, hoy) : null,
    tipo: tipoCrudo === "gasto" || tipoCrudo === "ingreso" ? tipoCrudo : null,
    categoria: campos.get("categoria") ?? null,
    medio: campos.get("medio") ?? null,
    cuotas: cuotas !== null && Number.isFinite(cuotas) && cuotas > 1 ? cuotas : null,
  };
}

/**
 * Lo que falta para poder cargar. La CATEGORÍA no bloquea: un movimiento sin
 * categoría es exactamente lo que vive en la bandeja de entrada, así que si el
 * modelo no supo qué es, se carga igual y queda ahí para categorizar después.
 * Lo que sí bloquea es lo que la base exige: importe, fecha, tipo y un medio.
 */
export function faltantes(c: ComprobanteLeido): CampoFaltante[] {
  const falta = new Set<CampoFaltante>();
  if (c.montoCentavos === null || c.montoCentavos <= 0) falta.add("monto");
  if (c.fecha === null) falta.add("fecha");
  if (c.tipo === null) falta.add("tipo");
  if (c.medio === null) falta.add("medio");
  if (c.categoria === null) falta.add("categoria");
  return ORDEN_CAMPOS.filter((campo) => falta.has(campo));
}

/** Los campos que bloquean la carga (categoría no: eso es la bandeja). */
export function bloqueantes(c: ComprobanteLeido): CampoFaltante[] {
  return faltantes(c).filter((campo) => campo !== "categoria");
}

/** Un medio del hogar, como lo ve este módulo. */
export type MedioSimple = {
  id: string;
  tipo: "cuenta" | "tarjeta";
  nombre: string;
  /** últimos 4 de la tarjeta, si es tarjeta */
  ultimos4?: string | null;
};

const sinAcentos = (texto: string) =>
  texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * El texto del medio leído → un medio real del hogar. null si no hay match
 * claro: preferimos preguntar antes que adivinar en qué tarjeta cayó un gasto.
 *
 * DOS pasadas, las dos inequívocas:
 *
 *  1. Los últimos 4 dígitos, que es lo que imprime el ticket ("VISA ****4321").
 *  2. El nombre exacto (sin tildes ni mayúsculas). Al modelo se le da la lista
 *     de medios y se le pide el nombre textual, así que este es el camino
 *     previsto, no un atajo.
 *
 * NO hay pasada difusa por substring, y eso fue una decisión, no un olvido: la
 * tenía y la saqué porque con una cuenta "Galicia" y una tarjeta "Visa Galicia"
 * un medio leído como "Galicia crédito" caía en la CUENTA. Un medio mal
 * preseleccionado que el usuario no revisa es plata en el lugar equivocado;
 * pedirle un toque es siempre correcto. Preguntar sale más barato que adivinar.
 */
export function elegirMedio(leido: string | null, medios: MedioSimple[]): MedioSimple | null {
  if (!leido) return null;

  const digitos = [...leido.matchAll(/\d{4}/g)].map((m) => m[0]);
  for (const cuatro of digitos) {
    const porNumero = medios.filter((m) => m.ultimos4 === cuatro);
    if (porNumero.length === 1) return porNumero[0];
  }

  const texto = sinAcentos(leido).trim();
  const exactos = medios.filter((m) => sinAcentos(m.nombre).trim() === texto);
  return exactos.length === 1 ? exactos[0] : null;
}

/**
 * Una categoría leída → una del hogar. Compara sin tildes ni mayúsculas.
 * null si no existe: entonces se ofrece crearla, no se inventa sola.
 */
export function elegirCategoria<T extends { id: string; nombre: string }>(
  leida: string | null,
  categorias: T[],
): T | null {
  if (!leida) return null;
  const buscada = sinAcentos(leida).trim();
  return categorias.find((c) => sinAcentos(c.nombre).trim() === buscada) ?? null;
}

/** Lo que el usuario ya resolvió en la tarjeta de confirmación. */
export type Confirmado = {
  montoCentavos: number;
  fecha: string;
  tipo: TipoLeido;
  medio: { id: string; tipo: "cuenta" | "tarjeta" };
  /** null = va a la bandeja de entrada, a categorizar después */
  categoriaId: string | null;
  ambito: "hogar" | "personal";
  comercio: string | null;
};

/** El alta que va a la base, con la misma forma que espera crearGasto. */
export type AltaDesdeComprobante = {
  importeCentavos: number;
  tipo: TipoLeido;
  medioTipo: "cuenta" | "tarjeta";
  medioId: string;
  categoriaId: string | null;
  ambito: "hogar" | "personal";
  cuotas: 1;
  fecha: string;
  descripcion: string;
  nota: string;
};

export const NOTA_PROCEDENCIA = "Leído de una foto de comprobante";

/**
 * La lectura confirmada → el alta. Es el único lugar donde un comprobante se
 * convierte en algo que se escribe, y lo comparten la web y la app nativa para
 * que no se les vaya la mano cada una por su lado.
 *
 * SIEMPRE cuotas: 1, incluso si el comprobante decía "6 cuotas". Armar la serie
 * de una compra son seis filas más una compra_en_cuotas, y equivocarse en el
 * total leído de una foto multiplica el desastre por seis. La cantidad leída se
 * MUESTRA en la confirmación como aviso, para que el usuario la cargue desde
 * Compras en cuotas si quiere la serie. Un movimiento por el total es la lectura
 * conservadora y siempre corregible.
 *
 * La nota deja la procedencia escrita: dentro de un mes, "¿de dónde salió este
 * gasto de $ 84.320?" tiene respuesta.
 */
export function altaDesdeComprobante(c: Confirmado): AltaDesdeComprobante {
  return {
    importeCentavos: c.montoCentavos,
    tipo: c.tipo,
    medioTipo: c.medio.tipo,
    medioId: c.medio.id,
    categoriaId: c.categoriaId,
    ambito: c.ambito,
    cuotas: 1,
    fecha: c.fecha,
    descripcion: (c.comercio ?? "").trim() || (c.tipo === "ingreso" ? "Ingreso" : "Gasto"),
    nota: NOTA_PROCEDENCIA,
  };
}
