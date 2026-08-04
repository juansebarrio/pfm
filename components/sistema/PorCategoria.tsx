"use client";

import { Fragment, useState } from "react";
import Link from "next/link";
import { ChartPie, ChevronDown, ChevronRight } from "lucide-react";
import { Card } from "@/components/sistema/Card";
import { Dona, tono } from "@/components/sistema/Dona";
import { EstadoVacio } from "@/components/sistema/EstadoVacio";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import { formatearImporte } from "@/lib/dominio/dinero";
import { repartir, type ItemReparto, type Porcion } from "@/lib/dominio/reparto";

// Vista "Por categoría": el anillo arriba y el mismo dato en lista abajo.
//
// La lista NO es redundante con el anillo: el anillo contesta "en qué se me va"
// de un vistazo y la lista da el número exacto, que es lo que se necesita para
// decidir. Por eso comparten el color: el tono del punto es el mismo tramo del
// anillo, y así la lista se lee como su leyenda sin escribir "leyenda".
//
// La fila "Otras" se puede desplegar: la bolsa puede ser la segunda porción más
// grande del mes, y una fila muerta que dice "un quinto de tu plata, no te digo
// en qué" contradice a toda la vista. Al tocarla se abren DEBAJO las categorías
// que esconde; el anillo no cambia (sigue mostrando la porción agregada).
//
// Y con `hrefsDeCategoria`, cada fila LLEVA a esos movimientos: la vista
// contesta "en qué se me fue" y el paso siguiente ("¿en qué exactamente?") no
// puede ser un callejón. Solo lo pasa Movimientos —en Presupuesto las porciones
// son plan (lo asignado), no gasto, y no hay "esos movimientos" que mostrar.
//
// Va como MAPA (clave → href) y no como función: esto es un client component y
// los callers son server components, que no pueden pasar funciones a través del
// borde ("Functions cannot be passed directly to Client Components").

/**
 * Las categorías que "Otras" esconde, en el mismo orden del reparto (monto
 * desc, después nombre) y con los puntos de porcentaje de "Otras" repartidos
 * por el método del resto mayor: si la fila madre dice 19 %, las hijas tienen
 * que sumar 19 exacto o el desglose se lee como un error de la app.
 */
function desplegarOtras(
  items: ItemReparto[],
  porciones: Porcion[],
  puntosDeOtras: number,
): Array<ItemReparto & { porcentaje: number }> {
  const visibles = new Set(
    porciones.filter((p) => !p.esOtras).map((p) => p.clave),
  );
  const escondidas = items
    .filter((i) => i.centavos > 0 && !visibles.has(i.clave))
    .sort((a, b) => b.centavos - a.centavos || a.nombre.localeCompare(b.nombre, "es"));

  const total = escondidas.reduce((s, i) => s + i.centavos, 0);
  if (total === 0) return [];

  const exactos = escondidas.map((i) => (i.centavos * puntosDeOtras) / total);
  const base = exactos.map(Math.floor);
  let restantes = puntosDeOtras - base.reduce((s, n) => s + n, 0);
  const porFraccion = exactos
    .map((valor, i) => ({ i, fraccion: valor - Math.floor(valor) }))
    .sort((a, b) => b.fraccion - a.fraccion);
  for (const { i } of porFraccion) {
    if (restantes <= 0) break;
    base[i] += 1;
    restantes -= 1;
  }

  // ninguna sub-fila con plata queda en 0 % mientras la mayor pueda ceder
  const mayor = base.indexOf(Math.max(...base));
  for (let i = 0; i < base.length; i++) {
    if (base[i] === 0 && base[mayor] > 1) {
      base[i] = 1;
      base[mayor] -= 1;
    }
  }

  return escondidas.map((item, i) => ({ ...item, porcentaje: base[i] }));
}

/**
 * Fila de la lista: un `div` cuando no lleva a ningún lado y un `Link` cuando
 * sí. El chevron es MUDO —no dice nada que la fila no diga— y está solo para
 * que se vea que la fila se toca.
 */
function Fila({
  href,
  className,
  children,
}: {
  href?: string;
  className: string;
  children: React.ReactNode;
}) {
  if (!href) return <div className={className}>{children}</div>;
  return (
    <Link href={href} className={className}>
      {children}
      <ChevronRight
        aria-hidden
        className="size-3.5 shrink-0 text-tinta-terciaria"
        strokeWidth={1.5}
      />
    </Link>
  );
}

export function PorCategoria({
  items,
  /** texto del estado vacío, que cambia según la pantalla */
  vacio,
  tituloVacio = "Todavía no hay gastos",
  /** "Gastado" en Movimientos, "Asignado" en Presupuesto */
  etiquetaTotal = "Gastado",
  /** total de gastos del mes, incluido lo que NO tiene categoría */
  totalGastosCentavos,
  /** clave de categoría → adónde va su fila; sin entrada, la fila no navega */
  hrefsDeCategoria,
}: {
  items: ItemReparto[];
  vacio: string;
  tituloVacio?: string;
  etiquetaTotal?: string;
  totalGastosCentavos?: number;
  hrefsDeCategoria?: Record<string, string>;
}) {
  // arranca colapsada: el desglose es para quien pregunta, no para todos
  const [otrasAbierta, setOtrasAbierta] = useState(false);

  const porciones = repartir(items);
  const total = porciones.reduce((s, p) => s + p.centavos, 0);
  // Lo que gastaste y todavía no clasificaste no puede entrar en un reparto
  // POR categoría, pero tampoco puede desaparecer: sin esto el anillo dice
  // "gastaste $ 2.279.300" tres centímetros abajo de un totalizador que dice
  // $ 2.670.150, y el usuario no tiene forma de saber por qué no coinciden.
  const sinCategorizar = Math.max(0, (totalGastosCentavos ?? total) - total);

  const otras = porciones.find((p) => p.esOtras);
  const dentroDeOtras = otras
    ? desplegarOtras(items, porciones, otras.porcentaje)
    : [];

  if (porciones.length === 0) {
    return (
      <div className="mt-8">
        <EstadoVacio Icono={ChartPie} titulo={tituloVacio} cuerpo={vacio} />
      </div>
    );
  }

  return (
    // en escritorio el anillo y su lista van lado a lado: son la misma cifra
    // en dos lenguas y leerlas juntas es el punto de la vista
    <div className="mt-5 lg:grid lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start lg:gap-10">
      <div className="lg:sticky lg:top-10">
        <Dona porciones={porciones} totalCentavos={total} etiqueta={etiquetaTotal} />

        {sinCategorizar > 0 && (
          <p className="mt-3 text-center text-[11.5px] leading-[1.5] text-tinta-terciaria">
            No entran {formatearImporte(sinCategorizar)} sin categorizar: elegiles
            categoría y aparecen acá.
          </p>
        )}
      </div>

      <Card className="mt-7 divide-y divide-separador lg:mt-0">
        {porciones.map((p) =>
          p.esOtras ? (
            <Fragment key={p.clave}>
              {/* "Otras" no es una categoría, es una bolsa: no lleva ícono,
                  pero sí se abre para mostrar lo que tiene adentro */}
              <button
                type="button"
                onClick={() => setOtrasAbierta((v) => !v)}
                aria-expanded={otrasAbierta}
                className="flex w-full items-center gap-3 px-4 py-3 text-left"
              >
                <span
                  aria-hidden
                  className="size-2.5 shrink-0 rounded-full"
                  style={{ background: tono(p.indice) }}
                />
                <span className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span className="truncate text-[14px] text-tinta">{p.nombre}</span>
                  <ChevronDown
                    aria-hidden
                    className={`size-3.5 shrink-0 text-tinta-terciaria transition-transform ${
                      otrasAbierta ? "rotate-180" : ""
                    }`}
                  />
                </span>
                <span className="cifra shrink-0 text-[13.5px] font-semibold text-tinta">
                  {formatearImporte(p.centavos)}
                </span>
                <span className="cifra w-9 shrink-0 text-right text-[12px] text-tinta-secundaria">
                  {p.porcentaje} %
                </span>
              </button>
              {/* las de adentro de la bolsa también llevan a sus movimientos:
                  desplegar y quedarse mirando sería el mismo callejón */}
              {otrasAbierta &&
                dentroDeOtras.map((s) => (
                  <Fila
                    key={s.clave}
                    href={hrefsDeCategoria?.[s.clave]}
                    className="flex items-center gap-3 py-2.5 pl-[38px] pr-4"
                  >
                    {/* el neutro de "Otras", no un color propio: el anillo no
                        tiene un tramo para esta categoría */}
                    <span
                      aria-hidden
                      className="size-1.5 shrink-0 rounded-full"
                      style={{ background: tono(p.indice) }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] text-tinta-secundaria">
                      {s.nombre}
                    </span>
                    <span className="cifra shrink-0 text-[12.5px] font-medium text-tinta">
                      {formatearImporte(s.centavos)}
                    </span>
                    <span className="cifra w-9 shrink-0 text-right text-[11px] text-tinta-terciaria">
                      {s.porcentaje} %
                    </span>
                  </Fila>
                ))}
            </Fragment>
          ) : (
            <Fila
              key={p.clave}
              href={hrefsDeCategoria?.[p.clave]}
              className="flex items-center gap-3 px-4 py-3"
            >
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: tono(p.indice) }}
              />
              <IconoCategoria nombre={p.icono ?? "tag"} />
              <span className="min-w-0 flex-1 truncate text-[14px] text-tinta">
                {p.nombre}
              </span>
              <span className="cifra shrink-0 text-[13.5px] font-semibold text-tinta">
                {formatearImporte(p.centavos)}
              </span>
              <span className="cifra w-9 shrink-0 text-right text-[12px] text-tinta-secundaria">
                {p.porcentaje} %
              </span>
            </Fila>
          ),
        )}
      </Card>
    </div>
  );
}
