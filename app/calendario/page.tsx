import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { NavegadorMes } from "@/components/sistema/NavegadorMes";
import { TotalizadorMes } from "@/components/sistema/TotalizadorMes";
import {
  categoriasDelHogar,
  mediosDePago,
  movimientosCategorizados,
  totalesDelMes,
} from "@/lib/datos/movimientos";
import { recurrentesActivos } from "@/lib/datos/presupuesto";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { formatearMesLargo, hoyBA, mesDe, mesDesdeParametro } from "@/lib/dominio/fechas";
import { CalendarioMes } from "./CalendarioMes";

// El calendario del mes: los días pasados cuentan lo que pasó (gastos e
// ingresos reales) y los futuros lo que viene (recurrentes con su día).
// Server Component: el mes viaja en la URL como en Movimientos/Presupuesto.

export default async function PaginaCalendario({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>;
}) {
  const params = await searchParams;
  const hoy = hoyBA();
  const mes = mesDesdeParametro(params.mes) ?? mesDe(hoy);

  const sesion = await obtenerSesionHogar();
  const [movimientos, recurrentes, categorias, medios, totales] = await Promise.all([
    movimientosCategorizados(sesion, { mes }),
    recurrentesActivos(sesion),
    categoriasDelHogar(sesion),
    mediosDePago(sesion),
    totalesDelMes(sesion, mes),
  ]);

  return (
    <div className="px-5 pt-8 pb-10">
      <Link
        href="/resumen"
        className="hit-44 inline-flex items-center gap-1.5 text-[13px] text-tinta-secundaria"
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
        Volver al resumen
      </Link>

      <h1 className="mt-4 text-[22px] font-semibold text-tinta">Calendario</h1>
      <p className="mt-0.5 text-[12.5px] text-tinta-secundaria">
        Lo que pasó y lo que viene en {formatearMesLargo(mes)}
      </p>

      <NavegadorMes mes={mes} mesActual={mesDe(hoy)} ruta="/calendario" otrosParametros={{}} />

      {/* El mismo totalizador de Movimientos: la grilla dice CUÁNDO pasó la
          plata y esta franja dice CUÁNTA fue en el mes entero. */}
      <TotalizadorMes totales={totales} />

      <CalendarioMes
        mes={mes}
        hoy={hoy}
        movimientos={movimientos}
        recurrentes={recurrentes}
        categorias={categorias}
        medios={medios}
      />
    </div>
  );
}
