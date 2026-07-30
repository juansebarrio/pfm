import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatearMesLargo, mesAnterior, mesSiguiente } from "@/lib/dominio/fechas";

// Flechas para moverse mes a mes. Lo usan Movimientos y Presupuesto: es la
// MISMA fila en las dos, que es lo que hace que la app se sienta una sola.
//
// Son LINKS, no estado de cliente: el mes viaja en la URL igual que los demás
// filtros, así que la página sigue siendo un Server Component, se filtra en la
// base y no en el navegador, y volver atrás en el navegador vuelve al mes
// anterior como uno espera.
//
// Adelante NO se topa en el mes en curso: las cuotas de una compra generan
// movimientos con fecha futura, y arrastrar un gasto al mes que viene es una
// operación que la app ofrece. Mirar diciembre desde julio tiene sentido.

export function NavegadorMes({
  mes,
  mesActual,
  ruta,
  /** los demás filtros, para no perderlos al cambiar de mes */
  otrosParametros,
  className = "mt-4",
}: {
  mes: string;
  mesActual: string;
  /** "/movimientos" | "/presupuesto" */
  ruta: string;
  otrosParametros: Record<string, string>;
  className?: string;
}) {
  const href = (destino: string) => {
    const params = new URLSearchParams(otrosParametros);
    // el mes en curso no se escribe en la URL: es el default y ensucia el link
    if (destino !== mesActual) params.set("mes", destino.slice(0, 7));
    const cadena = params.toString();
    return `${ruta}${cadena ? `?${cadena}` : ""}`;
  };

  const esActual = mes === mesActual;

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <Link
        href={href(mesAnterior(mes))}
        aria-label={`Ver ${formatearMesLargo(mesAnterior(mes))}`}
        className="hit-44 flex size-9 items-center justify-center rounded-full text-tinta-secundaria"
      >
        <ChevronLeft className="size-5" strokeWidth={1.8} aria-hidden />
      </Link>

      <div className="flex flex-col items-center">
        <p className="text-[15px] font-semibold text-tinta capitalize">
          {formatearMesLargo(mes)}
        </p>
        {/* el atajo solo aparece cuando sirve: si ya estás en el mes en curso,
            un "Ir al mes actual" que no hace nada es ruido */}
        {!esActual && (
          <Link
            href={href(mesActual)}
            className="text-[11.5px] font-medium text-verde underline underline-offset-2"
          >
            Volver a este mes
          </Link>
        )}
      </div>

      <Link
        href={href(mesSiguiente(mes))}
        aria-label={`Ver ${formatearMesLargo(mesSiguiente(mes))}`}
        className="hit-44 flex size-9 items-center justify-center rounded-full text-tinta-secundaria"
      >
        <ChevronRight className="size-5" strokeWidth={1.8} aria-hidden />
      </Link>
    </div>
  );
}
