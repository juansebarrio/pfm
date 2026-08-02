"use client";

import { useState } from "react";
import { CalendarArrowDown, Tag, X } from "lucide-react";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import type { CategoriaSimple } from "@/lib/datos/movimientos";

// Barra de acción del modo selección: cuántos elegiste y qué hacer con ellos.
//
// Va FIJA abajo y tapando la tab bar a propósito. Mientras seleccionás estás en
// un modo, y ofrecer "Patrimonio" al lado de "Mover 3 movimientos" invita a
// perder la selección de un toque.
//
// Dos acciones sobre la misma selección: moverlos de fecha (arrastrar medio mes
// al siguiente) y CATEGORIZARLOS en tanda ("estas cinco cargas van todas a
// SUBE"). La categoría se elige en la misma hoja de chips que la edición del
// detalle: es la misma tarea, y verse igual es lo que la hace aprenderse una
// sola vez.

export function BarraSeleccion({
  cantidad,
  fecha,
  pendiente,
  categorias,
  pendienteCategoria,
  onFecha,
  onMover,
  onCategorizar,
  onCancelar,
}: {
  cantidad: number;
  fecha: string;
  pendiente: boolean;
  /** las que aplican a TODO lo elegido; sin ninguna no se ofrece categorizar */
  categorias: CategoriaSimple[];
  pendienteCategoria: boolean;
  onFecha: (f: string) => void;
  onMover: () => void;
  onCategorizar: (categoriaId: string) => void;
  onCancelar: () => void;
}) {
  const [hoja, setHoja] = useState(false);
  const ocupado = pendiente || pendienteCategoria;

  return (
    <>
      <div className="fixed bottom-0 left-1/2 z-50 w-full max-w-[430px] -translate-x-1/2 border-t border-borde bg-papel px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between">
          <p className="text-[13.5px] font-semibold text-tinta">
            {cantidad === 0
              ? "Elegí movimientos para mover o categorizar"
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
            disabled={cantidad === 0 || !fecha || ocupado}
            onClick={onMover}
            className="flex h-11 shrink-0 items-center justify-center gap-2 rounded-cta bg-verde px-4 text-[14px] font-semibold text-papel disabled:opacity-40"
          >
            <CalendarArrowDown className="size-[17px]" strokeWidth={2} aria-hidden />
            {pendiente ? "Moviendo…" : "Mover"}
          </button>
        </div>

        {categorias.length > 0 && (
          <button
            type="button"
            disabled={cantidad === 0 || ocupado}
            onClick={() => setHoja(true)}
            className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-cta border border-borde text-[14px] font-semibold text-tinta disabled:opacity-40"
          >
            <Tag className="size-[17px]" strokeWidth={1.8} aria-hidden />
            {pendienteCategoria ? "Categorizando…" : "Categorizar"}
          </button>
        )}
      </div>

      <HojaInferior
        abierta={hoja}
        onCerrar={() => setHoja(false)}
        titulo={
          cantidad === 1 ? "Categoría del movimiento" : `Categoría de ${cantidad} movimientos`
        }
      >
        <div className="flex max-h-[50vh] flex-wrap gap-1.5 overflow-y-auto">
          {categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setHoja(false);
                onCategorizar(c.id);
              }}
              className="flex items-center gap-1.5 rounded-chip border border-borde bg-papel px-2.5 py-1.5 text-[12px] text-tinta"
            >
              <IconoCategoria nombre={c.icono} />
              {c.nombre}
            </button>
          ))}
        </div>
        <p className="mt-3 text-[11.5px] leading-[1.5] text-tinta-secundaria">
          Se aplica a todo lo elegido. La categoría anterior se reemplaza.
        </p>
      </HojaInferior>
    </>
  );
}
