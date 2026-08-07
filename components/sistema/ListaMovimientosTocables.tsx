"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DetalleMovimiento } from "@/app/(tabs)/movimientos/DetalleMovimiento";
import { borrarMovimiento } from "@/app/acciones/movimientos";
import { Card } from "@/components/sistema/Card";
import { FilaMovimiento } from "@/components/sistema/FilaMovimiento";
import type {
  CategoriaSimple,
  MedioDePago,
  MovimientoLista,
} from "@/lib/datos/movimientos";

// Una lista de movimientos donde CADA FILA abre el detalle, con editar y
// borrar. Existe para que un movimiento se comporte igual en toda la app:
// verlo en el Resumen o en el detalle de una tarjeta y no poder tocarlo, cuando
// en Movimientos sí se puede, hace que la app parezca dos apps.
//
// Es el envoltorio para las listas simples (Resumen, consumos de tarjeta). El
// historial de Movimientos no lo usa: ahí la fila además tiene swipe de borrado
// y modo selección, que acá no aplican.

export function ListaMovimientosTocables({
  movimientos,
  categorias,
  medios,
  /** fila extra al final (p. ej. "Ver los N consumos →") */
  pie,
  /** en el teléfono mostrar solo las primeras N filas (en escritorio, todas) */
  visiblesEnMovil,
}: {
  movimientos: MovimientoLista[];
  categorias: CategoriaSimple[];
  medios: MedioDePago[];
  pie?: React.ReactNode;
  visiblesEnMovil?: number;
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [detalle, setDetalle] = useState<MovimientoLista | null>(null);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function borrar(m: MovimientoLista) {
    setOcultos((prev) => new Set([...prev, m.id]));
    setDetalle(null);
    setError(null);
    iniciar(async () => {
      const r = await borrarMovimiento({ movimientoId: m.id });
      if (r.ok) {
        router.refresh();
      } else {
        setOcultos((prev) => {
          const s = new Set(prev);
          s.delete(m.id);
          return s;
        });
        setError(r.error);
      }
    });
  }

  const visibles = movimientos.filter((m) => !ocultos.has(m.id));
  if (visibles.length === 0 && !pie) return null;

  return (
    <>
      {error && (
        <p role="alert" className="mb-2 text-center text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}
      <Card className="divide-y divide-separador">
        {visibles.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setDetalle(m)}
            className={`w-full text-left transition-colors lg:hover:bg-superficie-hover ${
              visiblesEnMovil !== undefined && i >= visiblesEnMovil
                ? "hidden lg:block"
                : "block"
            }`}
          >
            <FilaMovimiento
              descripcion={m.descripcion}
              icono={m.categoria?.icono}
              metadata={[m.categoria?.nombre, m.medio].filter(Boolean).join(" · ")}
              metadataCiclo={m.cierreCiclo ?? undefined}
              importeCentavos={m.importeCentavos}
              esIngreso={m.tipo === "ingreso"}
              ambito={m.visibilidad === "compartido" ? "hogar" : "personal"}
              badgeCuota={
                m.esCuota && m.nCuota && m.nCuotasTotal
                  ? `CUOTA ${m.nCuota}/${m.nCuotasTotal}`
                  : undefined
              }
            />
          </button>
        ))}
        {pie}
      </Card>

      <DetalleMovimiento
        movimiento={detalle}
        categorias={categorias}
        medios={medios}
        onCerrar={() => setDetalle(null)}
        onBorrar={() => detalle && borrar(detalle)}
      />
    </>
  );
}
