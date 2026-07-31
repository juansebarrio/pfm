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

const TAMANO = 168;
const GROSOR = 22;
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
}: {
  porciones: Porcion[];
  totalCentavos: number;
}) {
  const tramos = arcos(porciones);

  return (
    <div className="flex justify-center">
      <div className="relative">
        <svg
          viewBox={`0 0 ${TAMANO} ${TAMANO}`}
          width={TAMANO}
          height={TAMANO}
          role="img"
          aria-label={`Gastos por categoría, total ${formatearImporte(totalCentavos)}`}
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
            return (
              <path
                key={porciones[i].clave}
                d={arco(t.desde, t.hasta - hueco)}
                fill="none"
                stroke={tono(porciones[i].indice)}
                strokeWidth={GROSOR}
              />
            );
          })}
        </svg>

        {/* el total, centrado sobre el anillo */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <p className="text-[10.5px] text-tinta-secundaria">Gastado</p>
          <p className="cifra text-[17px] font-semibold text-tinta">
            {formatearImporte(totalCentavos)}
          </p>
        </div>
      </div>
    </div>
  );
}
