import { ChartPie } from "lucide-react";
import { Card } from "@/components/sistema/Card";
import { Dona, tono } from "@/components/sistema/Dona";
import { EstadoVacio } from "@/components/sistema/EstadoVacio";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import { formatearImporte } from "@/lib/dominio/dinero";
import { repartir, type ItemReparto } from "@/lib/dominio/reparto";

// Vista "Por categoría": el anillo arriba y el mismo dato en lista abajo.
//
// La lista NO es redundante con el anillo: el anillo contesta "en qué se me va"
// de un vistazo y la lista da el número exacto, que es lo que se necesita para
// decidir. Por eso comparten el color: el tono del punto es el mismo tramo del
// anillo, y así la lista se lee como su leyenda sin escribir "leyenda".

export function PorCategoria({
  items,
  /** texto del estado vacío, que cambia según la pantalla */
  vacio,
  tituloVacio = "Todavía no hay gastos",
  /** "Gastado" en Movimientos, "Asignado" en Presupuesto */
  etiquetaTotal = "Gastado",
  /** total de gastos del mes, incluido lo que NO tiene categoría */
  totalGastosCentavos,
}: {
  items: ItemReparto[];
  vacio: string;
  tituloVacio?: string;
  etiquetaTotal?: string;
  totalGastosCentavos?: number;
}) {
  const porciones = repartir(items);
  const total = porciones.reduce((s, p) => s + p.centavos, 0);
  // Lo que gastaste y todavía no clasificaste no puede entrar en un reparto
  // POR categoría, pero tampoco puede desaparecer: sin esto el anillo dice
  // "gastaste $ 2.279.300" tres centímetros abajo de un totalizador que dice
  // $ 2.670.150, y el usuario no tiene forma de saber por qué no coinciden.
  const sinCategorizar = Math.max(0, (totalGastosCentavos ?? total) - total);

  if (porciones.length === 0) {
    return (
      <div className="mt-8">
        <EstadoVacio Icono={ChartPie} titulo={tituloVacio} cuerpo={vacio} />
      </div>
    );
  }

  return (
    <div className="mt-5">
      <Dona porciones={porciones} totalCentavos={total} etiqueta={etiquetaTotal} />

      {sinCategorizar > 0 && (
        <p className="mt-3 text-center text-[11.5px] leading-[1.5] text-tinta-terciaria">
          No entran {formatearImporte(sinCategorizar)} sin categorizar: elegiles
          categoría y aparecen acá.
        </p>
      )}

      <Card className="mt-7 divide-y divide-separador">
        {porciones.map((p) => (
          <div key={p.clave} className="flex items-center gap-3 px-4 py-3">
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: tono(p.indice) }}
            />
            {/* "Otras" no es una categoría, es una bolsa: no lleva ícono */}
            {!p.esOtras && <IconoCategoria nombre={p.icono ?? "tag"} />}
            <span className="min-w-0 flex-1 truncate text-[14px] text-tinta">
              {p.nombre}
            </span>
            <span className="cifra shrink-0 text-[13.5px] font-semibold text-tinta">
              {formatearImporte(p.centavos)}
            </span>
            <span className="cifra w-9 shrink-0 text-right text-[12px] text-tinta-secundaria">
              {p.porcentaje} %
            </span>
          </div>
        ))}
      </Card>
    </div>
  );
}
