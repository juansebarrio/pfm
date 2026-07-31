// De montos por categoría a las porciones que dibuja la vista "Por categoría".
//
// Es dominio y no un helper de pantalla porque acá viven dos decisiones que se
// ven en la interfaz y que es fácil errarle:
//
// 1. LOS PORCENTAJES SUMAN 100. Redondear cada uno por su cuenta da listas que
//    suman 99 o 101, y en una app de plata eso se lee como un error de la app.
//    Se usa el método del resto mayor: se redondea todo para abajo y los puntos
//    que sobran van a los que tenían la fracción más grande.
//
// 2. LA COLA LARGA SE COLAPSA. Un hogar puede tener 20 categorías; 20 porciones
//    son confeti ilegible. Las que no entran se suman en "Otras", que va última
//    aunque su total sea mayor que el de alguna de las que sí entraron.
//
// El color NO se decide acá, pero sí el ORDEN, que es lo que la rampa usa: la
// porción 0 es la más gastada. Ojo con los tonos que se elijan afuera: en esta
// app el rojo y el ámbar SIGNIFICAN algo (excedido, atención), así que una
// categoría no debería pintarse con ellos solo por ser grande.

export type ItemReparto = {
  clave: string;
  nombre: string;
  icono: string | null;
  centavos: number;
};

export type Porcion = ItemReparto & {
  /** entero 0-100; el conjunto suma exactamente 100 */
  porcentaje: number;
  /** posición en el orden (0 = la más gastada), para elegir el tono */
  indice: number;
  /** true si es la bolsa "Otras" */
  esOtras: boolean;
};

export const CLAVE_OTRAS = "otras";

/**
 * Montos por categoría → porciones ordenadas de mayor a menor.
 *
 * `maximo` es cuántas porciones propias se muestran antes de colapsar el resto
 * en "Otras". Con 6, una lista de 7 muestra las 7 (colapsar una sola sería
 * absurdo: "Otras" ocuparía lo mismo que la categoría que esconde).
 */
export function repartir(
  items: ItemReparto[],
  { maximo = 6 }: { maximo?: number } = {},
): Porcion[] {
  const positivos = items.filter((i) => i.centavos > 0);
  const total = positivos.reduce((s, i) => s + i.centavos, 0);
  if (total === 0) return [];

  const ordenados = [...positivos].sort(
    (a, b) => b.centavos - a.centavos || a.nombre.localeCompare(b.nombre, "es"),
  );

  // colapsar solo si de verdad esconde MÁS DE UNA: si sobra una sola, "Otras"
  // ocuparía el mismo lugar que la categoría que reemplaza
  const agrupados: ItemReparto[] =
    ordenados.length > maximo + 1
      ? [
          ...ordenados.slice(0, maximo),
          {
            clave: CLAVE_OTRAS,
            nombre: "Otras",
            icono: null,
            centavos: ordenados
              .slice(maximo)
              .reduce((s, i) => s + i.centavos, 0),
          },
        ]
      : ordenados;

  return conPorcentajes(agrupados, total).map((p, indice) => ({
    ...p,
    indice,
    esOtras: p.clave === CLAVE_OTRAS,
  }));
}

/**
 * Reparte 100 puntos por el método del resto mayor.
 *
 * Cada porcentaje se redondea para abajo y los puntos que quedan sin repartir
 * van a las porciones con la fracción más grande. Así la suma da 100 exacto sin
 * que ninguna porción se aleje más de un punto de su valor real.
 *
 * Una porción con monto > 0 nunca queda en 0 %: mostrar "$ 1.200 · 0 %" es peor
 * que redondear para arriba, así que se le da el mínimo de 1 y se lo descuenta
 * de la más grande, que es la que menos lo nota.
 */
function conPorcentajes(items: ItemReparto[], total: number): Array<ItemReparto & { porcentaje: number }> {
  const exactos = items.map((i) => (i.centavos * 100) / total);
  const base = exactos.map(Math.floor);
  let restantes = 100 - base.reduce((s, n) => s + n, 0);

  // los puntos sobrantes, a las fracciones más grandes
  const porFraccion = exactos
    .map((valor, i) => ({ i, fraccion: valor - Math.floor(valor) }))
    .sort((a, b) => b.fraccion - a.fraccion);
  for (const { i } of porFraccion) {
    if (restantes <= 0) break;
    base[i] += 1;
    restantes -= 1;
  }

  // ninguna porción con plata se muestra en 0 %
  const mayor = base.indexOf(Math.max(...base));
  for (let i = 0; i < base.length; i++) {
    if (base[i] === 0 && items[i].centavos > 0 && base[mayor] > 1) {
      base[i] = 1;
      base[mayor] -= 1;
    }
  }

  return items.map((item, i) => ({ ...item, porcentaje: base[i] }));
}

/**
 * Los arcos de la dona, en grados desde las 12 en punto y en sentido horario.
 * Se calculan sobre los CENTAVOS, no sobre el porcentaje redondeado: si no, el
 * anillo cerraría corto o largo según por dónde cayeron los redondeos.
 */
export function arcos(porciones: Porcion[]): Array<{ desde: number; hasta: number }> {
  const total = porciones.reduce((s, p) => s + p.centavos, 0);
  if (total === 0) return [];
  let acumulado = 0;
  return porciones.map((p) => {
    const desde = (acumulado / total) * 360;
    acumulado += p.centavos;
    return { desde, hasta: (acumulado / total) * 360 };
  });
}
