"use client";

import { CalendarArrowDown, X } from "lucide-react";

// Barra de acción del modo selección: cuántos elegiste y a qué fecha moverlos.
//
// Va FIJA abajo y tapando la tab bar a propósito. Mientras seleccionás estás en
// un modo, y ofrecer "Patrimonio" al lado de "Mover 3 movimientos" invita a
// perder la selección de un toque.

export function BarraSeleccion({
  cantidad,
  fecha,
  pendiente,
  onFecha,
  onMover,
  onCancelar,
}: {
  cantidad: number;
  fecha: string;
  pendiente: boolean;
  onFecha: (f: string) => void;
  onMover: () => void;
  onCancelar: () => void;
}) {
  return (
    <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-borde bg-papel px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] font-semibold text-tinta">
          {cantidad === 0
            ? "Elegí movimientos para mover"
            : `${cantidad} ${cantidad === 1 ? "elegido" : "elegidos"}`}
        </p>
        <button
          type="button"
          onClick={onCancelar}
          className="hit-44 flex items-center gap-1 text-[13px] font-medium text-tinta-secundaria"
        >
          <X className="size-4" strokeWidth={2} aria-hidden />
          Cancelar
        </button>
      </div>

      <div className="mt-2.5 flex items-center gap-2">
        <label className="min-w-0 flex-1">
          <span className="sr-only">Fecha a la que mover</span>
          <input
            type="date"
            value={fecha}
            onChange={(e) => onFecha(e.target.value)}
            className="h-11 w-full rounded-cta border border-borde bg-superficie px-3 text-[14px] text-tinta"
          />
        </label>
        <button
          type="button"
          disabled={cantidad === 0 || !fecha || pendiente}
          onClick={onMover}
          className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-cta bg-verde px-4 text-[14px] font-semibold text-papel disabled:opacity-40"
        >
          <CalendarArrowDown className="size-[17px]" strokeWidth={2} aria-hidden />
          {pendiente ? "Moviendo…" : "Mover"}
        </button>
      </div>
    </div>
  );
}
