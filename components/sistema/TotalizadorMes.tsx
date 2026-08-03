import { formatearImporte } from "@/lib/dominio/dinero";
import type { TotalesMes } from "@/lib/datos/movimientos";

// Franja de tres cifras arriba de Movimientos y del Calendario: lo que entró,
// lo que salió y el saldo entre ambos en el mes que se mira. Es CAJA (ingresos
// − gastos), no el "disponible" del presupuesto — ese vive en Resumen y mide
// contra lo asignado.

export function TotalizadorMes({ totales }: { totales: TotalesMes }) {
  const balance = totales.ingresosCentavos - totales.gastosCentavos;
  return (
    <div className="mt-4 grid grid-cols-3 divide-x divide-separador rounded-card border border-borde bg-superficie">
      <div className="px-3 py-2.5">
        <p className="text-[10.5px] text-tinta-secundaria">Ingresos</p>
        <p className="cifra truncate text-[13.5px] font-semibold text-verde">
          {formatearImporte(totales.ingresosCentavos)}
        </p>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[10.5px] text-tinta-secundaria">Gastos</p>
        <p className="cifra truncate text-[13.5px] font-semibold text-tinta">
          {formatearImporte(totales.gastosCentavos)}
        </p>
      </div>
      <div className="px-3 py-2.5">
        <p className="text-[10.5px] text-tinta-secundaria">Balance</p>
        {/* en negativo va en tinta con su signo: el rojo del sistema se
            reserva para "excedido", y gastar más de lo que entró no lo es */}
        <p
          className={`cifra truncate text-[13.5px] font-semibold ${
            balance < 0 ? "text-tinta" : "text-verde"
          }`}
        >
          {formatearImporte(balance)}
        </p>
      </div>
    </div>
  );
}
