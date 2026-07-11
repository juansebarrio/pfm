// Detección de transacciones en mails (avisos de consumo de bancos y
// billeteras argentinas). Dominio puro: recibe texto, devuelve la transacción
// o null. Heurístico a propósito — lo que no se entiende con confianza NO se
// sugiere (mejor un mail ignorado que una sugerencia inventada).

export type MailParaAnalizar = {
  remitente: string;
  asunto: string;
  cuerpo: string;
};

export type TransaccionDetectada = {
  tipo: "gasto" | "ingreso";
  importeCentavos: number;
  /** comercio o contraparte, si se pudo extraer */
  comercio: string | null;
  /** últimos 4 dígitos de la tarjeta mencionada, si aparecen */
  ultimos4: string | null;
};

// mismo tope que el esquema de movimientos: importes absurdos = mail mal leído
const MAX_CENTAVOS = 100_000_000_000;

// Verbos que delatan plata que SALIÓ. Frases en minúsculas (se busca sobre
// texto normalizado); cubren Mercado Pago, BBVA, Galicia, Santander, Ualá,
// Brubank, Naranja X y los genéricos de red (Visa/Mastercard).
const FRASES_GASTO = [
  "pagaste",
  "compraste",
  "compra aprobada",
  "compra realizada",
  "realizaste una compra",
  "realizaste un pago",
  "hiciste una compra",
  "hiciste un pago",
  "nuevo consumo",
  "consumo aprobado",
  "consumo con tu tarjeta",
  "se realizó un consumo",
  "se debitó",
  "debitamos",
  "débito realizado",
  "pago realizado",
  "pago aprobado",
  "pago enviado",
  "enviaste",
  "transferiste",
  "extracción",
  "retiraste",
];

const FRASES_INGRESO = [
  "recibiste",
  "te envió",
  "te envio",
  "te transfirió",
  "te transfirio",
  "te depositaron",
  "te depositó",
  "se acreditó",
  "acreditamos",
  "acreditación",
  "nueva transferencia recibida",
  "transferencia recibida",
];

// Marketing con olor a transacción ("aprovechá 3 cuotas sin interés", "20 %
// de descuento pagando con..."): si aparecen y no hay una frase transaccional
// FUERTE, el mail se descarta aunque tenga un importe.
const SENIALES_MARKETING = [
  "cuotas sin interés",
  "cuotas sin interes",
  "descuento",
  "% off",
  "promo",
  "promoción",
  "promocion",
  "beneficio exclusivo",
  "oferta",
  "sorteo",
  "suscribite",
  "reintegro de hasta",
];

/** "BBVA Argentina <avisos@bbva.com.ar>" → "BBVA Argentina" (o el mail pelado). */
export function nombreDeRemitente(remitente: string): string {
  const conNombre = remitente.match(/^\s*"?([^"<]+?)"?\s*</);
  if (conNombre) return conNombre[1].trim();
  return remitente.replace(/[<>]/g, "").trim();
}

/**
 * Importe es-AR → centavos enteros, parseando el string (ningún float toca
 * plata). Regla fija del formato argentino: el punto separa miles y la coma
 * decimales. "84.320,50" → 8432050 · "1.234" → 123400 · "980,5" → 98050.
 */
export function importeArATextoCentavos(texto: string): number | null {
  const limpio = texto.trim();
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpio)) return null;
  const [enteros, decimales = ""] = limpio.split(",");
  const pesos = enteros.replace(/\./g, "");
  const centavos = Number(pesos) * 100 + Number(decimales.padEnd(2, "0") || "0");
  if (!Number.isInteger(centavos) || centavos <= 0 || centavos > MAX_CENTAVOS) return null;
  return centavos;
}

// marcas de dólar: si el símbolo es una de estas, el monto NO es en pesos
const SIMBOLOS_USD = /^(u\$s|us\$|usd|d[oó]lares?)$/i;
const USD_CERCA = /u\$s|us\$|usd|d[oó]lar/i;

/**
 * Primer importe en PESOS del texto. Solo cuenta ARS (MVP): se descartan los
 * montos en dólares, tanto por el símbolo (U$S/USD/US$) como por una etiqueta
 * de moneda pegada antes ("Importe USD: $ …") o después ("$ 20,00 USD").
 * El número usa la gramática es-AR ESTRICTA (miles con punto, coma decimal) y
 * un lookahead que rechaza el formato US "1,500.00" (no ÷1000 silencioso) sin
 * cortar el sufijo argentino ".-" ni el punto de fin de oración.
 */
function extraerImporteArs(texto: string): number | null {
  const patron =
    /(u\$s|us\$|usd|d[oó]lares?|ar\$|ars|\$)\s*(\d{1,3}(?:\.\d{3})*(?:,\d{1,2})?)(?![.,]?\d)/gi;
  for (const m of texto.matchAll(patron)) {
    if (SIMBOLOS_USD.test(m[1])) continue; // símbolo de dólar
    const inicio = m.index ?? 0;
    const fin = inicio + m[0].length;
    // moneda declarada como etiqueta antes o después del monto
    if (USD_CERCA.test(texto.slice(Math.max(0, inicio - 8), inicio))) continue;
    if (/^\s*(u\$s|us\$|usd|d[oó]lar)/i.test(texto.slice(fin, fin + 6))) continue;
    const centavos = importeArATextoCentavos(m[2]);
    if (centavos !== null) return centavos;
  }
  return null;
}

function extraerUltimos4(texto: string): string | null {
  const m = texto.match(
    /(?:terminada en|terminación|terminacion|term\.?|finalizada en|\*{2,4})\s*(\d{4})(?!\d)/i,
  );
  return m ? m[1] : null;
}

// fragmentos que el patrón " … en X" atrapa pero NO son un comercio
const NO_COMERCIOS = new Set([
  "el exterior",
  "el interior",
  "el pais",
  "el país",
  "linea",
  "línea",
  "cuotas",
  "efectivo",
]);

/** Recorta un nombre de comercio: corta en puntuación, saca ruido, cap 60. */
function limpiarComercio(crudo: string): string | null {
  const corte = crudo.split(/[.\n\r;|]|,\s|\s{2,}| por \$| con tu | el \d/i)[0];
  const limpio = corte.replace(/\s+/g, " ").replace(/[*"']/g, "").trim();
  if (limpio.length < 2 || limpio.length > 60) return null;
  if (/^\d+$/.test(limpio)) return null;
  if (NO_COMERCIOS.has(limpio.toLowerCase())) return null;
  return limpio;
}

function extraerComercio(texto: string, tipo: "gasto" | "ingreso"): string | null {
  const patrones =
    tipo === "gasto"
      ? [
          /pagaste\s+\$?\s*[\d.,]+\s+a\s+(.+)/gi, // MP: "Pagaste $ 6.800 a Café Cuervo"
          /(?:compra|consumo|pago)[^\n$]{0,40}?\sen\s+(.+)/gi, // "compra aprobada en COTO"
          /compraste\s+en\s+(.+)/gi,
          /(?:enviaste|transferiste)\s+\$?\s*[\d.,]+\s+a\s+(.+)/gi,
        ]
      : [
          /recibiste\s+\$?\s*[\d.,]+\s+de\s+(.+)/gi, // MP: "Recibiste $ 5.000 de Vale"
          /(.+?)\s+te\s+(?:envió|envio|transfirió|transfirio)/gi,
          /transferencia\s+recibida\s+de\s+(.+)/gi,
        ];
  // se revisan TODAS las coincidencias: la primera puede ser ruido ("terminada
  // en 8810" también matchea "… en …") y la buena venir después
  for (const p of patrones) {
    for (const m of texto.matchAll(p)) {
      const comercio = limpiarComercio(m[1]);
      if (comercio) return comercio;
    }
  }
  return null;
}

/**
 * ¿Este mail describe una transacción? Exige DOS señales: una frase
 * transaccional y un importe en pesos. El marketing con importes se filtra.
 */
export function extraerTransaccion(mail: MailParaAnalizar): TransaccionDetectada | null {
  const texto = `${mail.asunto}\n${mail.cuerpo}`.replace(/ /g, " ");
  const norm = texto.toLowerCase();

  const esGasto = FRASES_GASTO.some((f) => norm.includes(f));
  const esIngreso = FRASES_INGRESO.some((f) => norm.includes(f));
  if (!esGasto && !esIngreso) return null;
  // gasto le gana a ingreso si aparecen ambos ("pagaste" + "se acreditó el pago")
  const tipo: "gasto" | "ingreso" = esGasto ? "gasto" : "ingreso";

  // el marketing se mira SOLO en el asunto: los avisos de consumo reales casi
  // siempre traen un footer promocional ("Conocé los descuentos…") en el
  // cuerpo, y mirarlo entero los descartaba a todos (falsos negativos).
  const asunto = mail.asunto.toLowerCase();
  if (SENIALES_MARKETING.some((f) => asunto.includes(f))) return null;

  const importeCentavos = extraerImporteArs(texto);
  if (importeCentavos === null) return null;

  return {
    tipo,
    importeCentavos,
    comercio: extraerComercio(texto, tipo),
    ultimos4: extraerUltimos4(texto),
  };
}
