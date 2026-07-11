"use client";

import { useState } from "react";
import { Card } from "@/components/sistema/Card";
import { FilaMovimiento } from "@/components/sistema/FilaMovimiento";

// Lista "Consumos del ciclo" de 06: 5 filas visibles + fila-link
// "Ver los N consumos →" que expande la lista completa (estado local).

export type FilaConsumo = {
  id: string;
  descripcion: string;
  icono?: string;
  metadata: string;
  importeCentavos: number;
  badgeCuota?: string;
};

const VISIBLES = 5;

export function ListaConsumos({ filas }: { filas: FilaConsumo[] }) {
  const [expandida, setExpandida] = useState(false);
  const visibles = expandida ? filas : filas.slice(0, VISIBLES);

  return (
    <Card className="divide-y divide-separador">
      {visibles.map((f) => (
        <FilaMovimiento
          key={f.id}
          descripcion={f.descripcion}
          icono={f.icono}
          metadata={f.metadata}
          importeCentavos={f.importeCentavos}
          badgeCuota={f.badgeCuota}
        />
      ))}
      {!expandida && filas.length > VISIBLES && (
        <button
          type="button"
          onClick={() => setExpandida(true)}
          className="block w-full px-3.5 py-3 text-left text-[13.5px] font-medium text-verde"
        >
          Ver los {filas.length} consumos →
        </button>
      )}
    </Card>
  );
}
