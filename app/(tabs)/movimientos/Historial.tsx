"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { borrarMovimiento } from "@/app/acciones/movimientos";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import type { MovimientoLista } from "@/lib/datos/movimientos";
import { etiquetaDia } from "@/lib/dominio/fechas";
import { DetalleMovimiento } from "./DetalleMovimiento";
import { FilaSwipe } from "./FilaSwipe";

// Historial interactivo (feature nueva): tap abre el detalle, swipe a la
// izquierda revela el borrado. Borrado optimista con reversión si el server
// falla. Una cuota borra la compra entera (todas sus hermanas de la lista).

type Dia = { fecha: string; movimientos: MovimientoLista[] };

export function Historial({ dias, hoy }: { dias: Dia[]; hoy: string }) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<MovimientoLista | null>(null);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const todos = useMemo(() => dias.flatMap((d) => d.movimientos), [dias]);

  // ids afectados por borrar m: la compra entera si es cuota, si no solo m
  function idsAfectados(m: MovimientoLista): string[] {
    if (m.compraId) return todos.filter((x) => x.compraId === m.compraId).map((x) => x.id);
    return [m.id];
  }

  function borrar(m: MovimientoLista) {
    const ids = idsAfectados(m);
    setOcultos((prev) => new Set([...prev, ...ids]));
    setAbiertoId(null);
    setDetalle(null);
    setError(null);
    iniciar(async () => {
      const r = await borrarMovimiento({ movimientoId: m.id });
      if (r.ok) {
        router.refresh();
      } else {
        setOcultos((prev) => {
          const s = new Set(prev);
          ids.forEach((i) => s.delete(i));
          return s;
        });
        setError(r.error);
      }
    });
  }

  const visibles = dias
    .map((d) => ({ fecha: d.fecha, movimientos: d.movimientos.filter((m) => !ocultos.has(m.id)) }))
    .filter((d) => d.movimientos.length > 0);

  return (
    <>
      {error && (
        <p role="alert" className="mt-3 text-center text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}

      {visibles.map((d) => (
        <Fragment key={d.fecha}>
          <EncabezadoSeccion>{etiquetaDia(d.fecha, hoy)}</EncabezadoSeccion>
          <Card className="divide-y divide-separador overflow-hidden">
            {d.movimientos.map((m) => (
              <FilaSwipe
                key={m.id}
                abierto={abiertoId === m.id}
                etiquetaBorrar={m.esCuota ? "Borrar compra" : "Borrar"}
                onAbrir={() => setAbiertoId(m.id)}
                onCerrar={() => setAbiertoId((a) => (a === m.id ? null : a))}
                onTap={() => {
                  setAbiertoId(null);
                  setDetalle(m);
                }}
                onBorrar={() => borrar(m)}
                datos={{
                  descripcion: m.descripcion,
                  icono: m.categoria?.icono,
                  metadata: [m.categoria?.nombre, m.medio].filter(Boolean).join(" · "),
                  metadataCiclo: m.cierreCiclo ?? undefined,
                  importeCentavos: m.importeCentavos,
                  esIngreso: m.tipo === "ingreso",
                  ambito: m.visibilidad === "compartido" ? "hogar" : "personal",
                  badgeCuota:
                    m.esCuota && m.nCuota && m.nCuotasTotal
                      ? `Cuota ${m.nCuota}/${m.nCuotasTotal}`
                      : undefined,
                }}
              />
            ))}
          </Card>
        </Fragment>
      ))}

      <DetalleMovimiento
        movimiento={detalle}
        onCerrar={() => setDetalle(null)}
        onBorrar={() => detalle && borrar(detalle)}
      />
    </>
  );
}
