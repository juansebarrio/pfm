// Todos los importes del sistema son centavos enteros. Ningún float toca plata.

export type Moneda = "ARS" | "USD";

/**
 * Única utilidad de formato de plata de la app (es-AR).
 * `$ 520.000` / `USD 6.000`; los centavos solo se muestran si existen: `$ 1.234,56`.
 */
export function formatearImporte(centavos: number, moneda: Moneda = "ARS"): string {
  if (!Number.isInteger(centavos)) {
    throw new Error(`importe no entero: ${centavos}`);
  }
  const negativo = centavos < 0;
  const abs = Math.abs(centavos);
  const enteros = Math.floor(abs / 100);
  const resto = abs % 100;

  const miles = enteros.toLocaleString("es-AR"); // 1.234.567
  const decimales = resto === 0 ? "" : `,${String(resto).padStart(2, "0")}`;
  const simbolo = moneda === "ARS" ? "$ " : "USD ";

  return `${negativo ? "− " : ""}${simbolo}${miles}${decimales}`;
}

/**
 * El inverso de formatearImporte: "$ 1.234.567,89" → 123456789 centavos.
 * null si el texto no es un importe en formato argentino.
 *
 * Vivía en asistente.ts para calcular el ancho de una barra, donde fallar no
 * costaba nada. Ahora también convierte el monto que el modelo leyó de una foto
 * de comprobante, y eso SÍ termina siendo el importe de un movimiento. Dos
 * consecuencias de ese ascenso:
 *
 * - Es estricto de entrada: si el formato no es exactamente el argentino,
 *   devuelve null. Preferimos que la UI pida el monto a mano antes que cargar
 *   un número interpretado con otra convención de miles y decimales.
 * - DESCARTA EL SIGNO. Un "−" adelante no vuelve negativo el resultado: la base
 *   exige importe_centavos > 0 y la dirección la lleva el tipo (gasto/ingreso).
 *   Quien lea un "-$ 500" de un comprobante tiene que decidir el tipo, no
 *   esperar un centavo negativo.
 */
export function centavosDesdeTexto(texto: string): number | null {
  const limpio = texto.trim().replace(/^[−-]\s*/, "").replace(/^(\$|USD)\s*/i, "");
  if (!/^\d{1,3}(\.\d{3})*(,\d{1,2})?$|^\d+(,\d{1,2})?$/.test(limpio)) return null;
  const [enteros, decimales = ""] = limpio.split(",");
  const centavos =
    Number(enteros.replace(/\./g, "")) * 100 + Number(decimales.padEnd(2, "0"));
  return Number.isFinite(centavos) ? centavos : null;
}

/** `81 %` — con espacio antes del signo, como el export. */
export function formatearPorcentaje(valor: number): string {
  return `${Math.round(valor)} %`;
}

/**
 * Conversión USD→ARS. `tcValorCentavos` = centavos de peso por 1 dólar.
 * USD 9.500 (950.000 c) con TC $ 1.470 (147.000 c) → $ 13.965.000.
 */
export function usdAArs(usdCentavos: number, tcValorCentavos: number): number {
  if (!Number.isInteger(usdCentavos) || !Number.isInteger(tcValorCentavos)) {
    throw new Error("conversión con valores no enteros");
  }
  return Math.round((usdCentavos * tcValorCentavos) / 100);
}

/** Conversión ARS→USD, redondeada al centavo de dólar. */
export function arsAUsd(arsCentavos: number, tcValorCentavos: number): number {
  if (!Number.isInteger(arsCentavos) || !Number.isInteger(tcValorCentavos)) {
    throw new Error("conversión con valores no enteros");
  }
  return Math.round((arsCentavos * 100) / tcValorCentavos);
}
