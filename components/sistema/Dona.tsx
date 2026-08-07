import { arcos, type Porcion } from "@/lib/dominio/reparto";
import { formatearImporte } from "@/lib/dominio/dinero";

// Anillo de gastos por categoría. SVG propio, como el sparkline de Patrimonio:
// el proyecto no trae librerías de gráficos y este no amerita la primera.
//
// La rampa (--reparto-1..7) va del verde de marca a un gris neutro. NO usa rojo
// ni ámbar a propósito: en esta app significan "excedido" y "atención", y una
// categoría no está en problemas por ser la más grande del mes.
//
// El total va en el centro, que es donde el ojo cae primero y donde el número
// contesta la pregunta que trajo al usuario ("¿cuánto gasté?").
//
// En escritorio el anillo dialoga con su lista: pasar el mouse por una porción
// la resalta (las demás bajan de opacidad) y el centro pasa a decir ESA
// categoría con su monto y su porcentaje; `resaltada`/`onResaltar` conectan el
// mismo estado con las filas de la lista, en las dos direcciones. El viewBox es
// fijo y el tamaño lo pone CSS: 200 en el teléfono, más aire en lg.

const TAMANO = 200;
const GROSOR = 25;
const RADIO = (TAMANO - GROSOR) / 2;
const CENTRO = TAMANO / 2;

/** Un separador finito entre porciones para que dos tonos vecinos se distingan. */
const HUECO_GRADOS = 1.4;

export function tono(indice: number): string {
  // más allá de la rampa se repite el último: no debería pasar (la cola se
  // colapsa en "Otras"), pero un índice suelto no puede quedar transparente
  return `var(--reparto-${Math.min(indice + 1, 7)})`;
}

/** Punto del borde del anillo para un ángulo en grados, 0 = las 12 en punto. */
function punto(grados: number, radio: number): [number, number] {
  const rad = ((grados - 90) * Math.PI) / 180;
  return [CENTRO + radio * Math.cos(rad), CENTRO + radio * Math.sin(rad)];
}

/** Path del arco de una porción, dibujado como trazo grueso sobre el radio. */
function arco(desde: number, hasta: number): string {
  const barrido = hasta - desde;
  // un arco de 360° con el mismo inicio y fin no dibuja nada: se parte en dos
  if (barrido >= 359.9) {
    const [x1, y1] = punto(0, RADIO);
    const [x2, y2] = punto(180, RADIO);
    return `M ${x1} ${y1} A ${RADIO} ${RADIO} 0 1 1 ${x2} ${y2} A ${RADIO} ${RADIO} 0 1 1 ${x1} ${y1}`;
  }
  const [x1, y1] = punto(desde, RADIO);
  const [x2, y2] = punto(hasta, RADIO);
  return `M ${x1} ${y1} A ${RADIO} ${RADIO} 0 ${barrido > 180 ? 1 : 0} 1 ${x2} ${y2}`;
}

export function Dona({
  porciones,
  totalCentavos,
  etiqueta = "Gastado",
  resaltada = null,
  onResaltar,
}: {
  porciones: Porcion[];
  totalCentavos: number;
  /** "Gastado" en Movimientos, "Asignado" en Presupuesto */
  etiqueta?: string;
  /** clave de la porción resaltada (desde el anillo o desde la lista) */
  resaltada?: string | null;
  onResaltar?: (clave: string | null) => void;
}) {
  const tramos = arcos(porciones);
  const porcionResaltada = porciones.find((p) => p.clave === resaltada) ?? null;

  return (
    <div className="flex justify-center">
      <div className="relative">
        <svg
          viewBox={`0 0 ${TAMANO} ${TAMANO}`}
          className="h-auto w-[200px] lg:w-[320px]"
          role="img"
          aria-label={`${etiqueta} por categoría, total ${formatearImporte(totalCentavos)}`}
        >
          {/* la pista de atrás: si hay una sola porción, igual se ve un anillo */}
          <circle
            cx={CENTRO}
            cy={CENTRO}
            r={RADIO}
            fill="none"
            stroke="var(--pista)"
            strokeWidth={GROSOR}
          />
          {tramos.map((t, i) => {
            // el hueco se le saca al final, y solo si la porción da para eso:
            // una porción de 1° no puede perder 1,4° o desaparecería
            const ancho = t.hasta - t.desde;
            const hueco = ancho > HUECO_GRADOS * 2 ? HUECO_GRADOS : 0;
            const clave = porciones[i].clave;
            const esLaResaltada = resaltada === clave;
            return (
              <path
                key={clave}
                d={arco(t.desde, t.hasta - hueco)}
                fill="none"
                stroke={tono(porciones[i].indice)}
                strokeWidth={esLaResaltada ? GROSOR + 3 : GROSOR}
                className="transition-opacity duration-150"
                opacity={resaltada !== null && !esLaResaltada ? 0.3 : 1}
                onMouseEnter={onResaltar ? () => onResaltar(clave) : undefined}
                onMouseLeave={onResaltar ? () => onResaltar(null) : undefined}
              />
            );
          })}
        </svg>

        {/* el centro: el total — o la porción resaltada, con monto y porcentaje */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          {porcionResaltada ? (
            <>
              <p className="max-w-[120px] truncate text-[10.5px] text-tinta-secundaria lg:max-w-[190px] lg:text-[12px]">
                {porcionResaltada.nombre}
              </p>
              <p className="cifra text-[19px] font-semibold text-tinta lg:text-[24px]">
                {formatearImporte(porcionResaltada.centavos)}
              </p>
              <p className="cifra text-[11px] text-tinta-terciaria lg:text-[12.5px]">
                {porcionResaltada.porcentaje} %
              </p>
            </>
          ) : (
            <>
              <p className="text-[10.5px] text-tinta-secundaria lg:text-[12px]">{etiqueta}</p>
              <p className="cifra text-[19px] font-semibold text-tinta lg:text-[24px]">
                {formatearImporte(totalCentavos)}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
