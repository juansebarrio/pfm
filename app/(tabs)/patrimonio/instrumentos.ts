// Lista CERRADA de instrumentos de la hoja de tenencia (hueco declarado del
// export, DESIGN_AUDIT §5) y helpers de etiquetado compartidos por la pantalla
// 08. Sin "server-only": estos datos viajan también al cliente.

export type Instrumento =
  | "dolar_billete"
  | "dolar_mep"
  | "fci_money_market"
  | "plazo_fijo"
  | "cedears"
  | "cripto"
  | "cuenta_remunerada"
  | "otro";

export const ETIQUETA_INSTRUMENTO: Record<Instrumento, string> = {
  dolar_billete: "Dólar billete",
  dolar_mep: "Dólar MEP",
  fci_money_market: "FCI money market",
  plazo_fijo: "Plazo fijo",
  cedears: "CEDEARs",
  cripto: "Cripto",
  cuenta_remunerada: "Cuenta remunerada",
  otro: "Otro",
};

export const INSTRUMENTOS = Object.keys(ETIQUETA_INSTRUMENTO) as Instrumento[];

/** Instrumentos que guardan cantidad en USD y se valúan al TC activo. */
export const INSTRUMENTOS_EN_USD: ReadonlySet<Instrumento> = new Set([
  "dolar_billete",
  "dolar_mep",
  "cedears",
  "cripto",
]);

/** Solo acá se deja elegir la moneda con el mini toggle; el resto se deriva. */
export const CON_TOGGLE_MONEDA: ReadonlySet<Instrumento> = new Set([
  "cedears",
  "cripto",
  "otro",
]);

export type FuenteTC = "mep" | "blue" | "oficial";

export const FUENTES: readonly FuenteTC[] = ["mep", "blue", "oficial"];

/** La sigla va en MAYÚSCULA (MEP); "blue" y "oficial" en minúscula. */
export function etiquetaFuente(fuente: string): string {
  return fuente === "mep" ? "MEP" : fuente;
}
