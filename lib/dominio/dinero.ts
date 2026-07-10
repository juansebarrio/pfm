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
