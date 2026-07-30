"use client";

import { Check } from "lucide-react";
import { FilaMovimiento, type DatosFilaMovimiento } from "@/components/sistema/FilaMovimiento";

// La misma fila del historial, pero en modo selección: una casilla adelante y
// el tap alterna en vez de abrir el detalle.
//
// Es un componente aparte de FilaSwipe y no un modo suyo: FilaSwipe maneja
// captura de puntero y umbrales de arrastre, y meterle un "no arrastres ahora"
// era la forma más fácil de romper el gesto de borrado sin darse cuenta. Acá el
// gesto directamente no existe.
//
// Las CUOTAS no se pueden elegir: su fecha la manda la serie de la compra, así
// que moverlas de a una rompería la serie. Se muestran apagadas y sin casilla —
// el badge "Cuota 2/6" que ya trae la fila explica por qué.

export function FilaSeleccionable({
  datos,
  elegido,
  seleccionable,
  onAlternar,
}: {
  datos: DatosFilaMovimiento;
  elegido: boolean;
  seleccionable: boolean;
  onAlternar: () => void;
}) {
  if (!seleccionable) {
    return (
      <div className="flex items-center gap-2 bg-superficie pl-3 opacity-40">
        <span
          aria-hidden
          className="size-[22px] shrink-0 rounded-md border border-dashed border-borde"
        />
        <div className="min-w-0 flex-1">
          <FilaMovimiento {...datos} />
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={elegido}
      onClick={onAlternar}
      className="flex w-full items-center gap-2 bg-superficie pl-3 text-left"
    >
      <span
        aria-hidden
        className={`flex size-[22px] shrink-0 items-center justify-center rounded-md border ${
          elegido ? "border-verde bg-verde text-papel" : "border-borde bg-papel"
        }`}
      >
        {elegido && <Check className="size-[15px]" strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <FilaMovimiento {...datos} />
      </div>
    </button>
  );
}
