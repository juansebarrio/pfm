// Ajuste por inflación del armado del mes (02).
//
// El ritual argentino de fin de mes: se parte del presupuesto del mes anterior
// y se lo empuja un porcentaje. Dos reglas del export, acá en un solo lugar
// porque las comparten la web y el nativo:
//
// 1. El ajuste se cuenta en DÉCIMAS de punto porcentual (25 = 2,5 %). Enteros,
//    no floats: la inflación se discute con un decimal, no con dieciséis.
// 2. El resultado se apoya en múltiplos de $ 25. Un presupuesto de "$ 383.727"
//    no lo planificó nadie; lo escupió una multiplicación.
//
// La cuenta multiplica antes de dividir, así el resultado no depende de cuántas
// veces se recalculó: mover el stepper de 2,5 % a 3 % y volver da el mismo
// número que no haberlo tocado.

/** Un tick del stepper: una décima de punto (0,1 %). */
export const PASO_DECIMAS = 1;

/** Lo que se propone al partir de un mes anterior: 2,5 %. */
export const DECIMAS_POR_DEFECTO = 25;

/** Techo del campo: 999,9 %. Más que eso no es inflación, es un dedo pegado. */
export const DECIMAS_MAXIMAS = 9999;

/** Toda partida ajustada cae en un múltiplo de $ 25. */
export const REDONDEO_CENTAVOS = 2500;

/**
 * asignado × (1 + décimas/1000), redondeado a $ 25.
 *
 * OJO con el borde de 0 %: el redondeo se aplica igual, así que "copiar sin
 * ajuste" de una partida de $ 383.727 devuelve $ 383.725. Es a propósito —
 * el armado siempre deja montos redondos— y es el comportamiento que la web
 * tiene desde el día uno.
 */
export function ajustarPorInflacion(
  asignadoCentavos: number,
  decimas: number,
): number {
  if (!Number.isInteger(asignadoCentavos)) throw new Error("asignado no entero");
  if (!Number.isInteger(decimas)) throw new Error("décimas no enteras");
  return (
    Math.round(
      (asignadoCentavos * (1000 + decimas)) / 1000 / REDONDEO_CENTAVOS,
    ) * REDONDEO_CENTAVOS
  );
}

/** 25 → "2,5" · 120 → "12" · 0 → "0" */
export function decimasATexto(decimas: number): string {
  const entero = Math.trunc(decimas / 10);
  const decimal = decimas % 10;
  return decimal === 0 ? String(entero) : `${entero},${decimal}`;
}

/** "2,5" → 25 · "2," → 20 · "" → 0 · cualquier cosa rara → 0 */
export function textoADecimas(texto: string): number {
  const m = texto.match(/^(\d+)(?:,(\d)?)?$/);
  return m ? Number(m[1]) * 10 + Number(m[2] ?? 0) : 0;
}

/**
 * ¿Este texto se puede seguir tipeando? Acepta los estados intermedios
 * ("", "2", "2,") además del completo, porque valida cada tecla, no el final.
 */
export function esTextoDecimasValido(texto: string): boolean {
  return /^\d{0,3}(,\d?)?$/.test(texto);
}

/** Un tick arriba o abajo, sin salirse de [0, DECIMAS_MAXIMAS]. */
export function moverDecimas(decimas: number, pasos: number): number {
  return Math.min(DECIMAS_MAXIMAS, Math.max(0, decimas + pasos * PASO_DECIMAS));
}
