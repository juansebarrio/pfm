"use client";

import { useState } from "react";
import { ListaMovimientosTocables } from "@/components/sistema/ListaMovimientosTocables";
import type {
  CategoriaSimple,
  MedioDePago,
  MovimientoLista,
} from "@/lib/datos/movimientos";

// Lista "Consumos del ciclo" de 06: 5 filas visibles + fila-link
// "Ver los N consumos →" que expande la lista completa (estado local).
//
// Cada fila abre el detalle del movimiento, el mismo de toda la app: era la
// única lista donde un movimiento no se podía tocar.

const VISIBLES = 5;

export function ListaConsumos({
  movimientos,
  categorias,
  medios,
}: {
  movimientos: MovimientoLista[];
  categorias: CategoriaSimple[];
  medios: MedioDePago[];
}) {
  const [expandida, setExpandida] = useState(false);
  const visibles = expandida ? movimientos : movimientos.slice(0, VISIBLES);

  return (
    <ListaMovimientosTocables
      movimientos={visibles}
      categorias={categorias}
      medios={medios}
      pie={
        !expandida && movimientos.length > VISIBLES ? (
          <button
            type="button"
            onClick={() => setExpandida(true)}
            className="block w-full px-3.5 py-3 text-left text-[13.5px] font-medium text-verde"
          >
            Ver los {movimientos.length} consumos →
          </button>
        ) : undefined
      }
    />
  );
}
