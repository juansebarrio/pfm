"use client";

import { Fragment, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ListChecks } from "lucide-react";
import {
  actualizarFechasEnLote,
  borrarMovimiento,
  categorizarEnLote,
} from "@/app/acciones/movimientos";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import type { DatosFilaMovimiento } from "@/components/sistema/FilaMovimiento";
import type { CategoriaSimple, MedioDePago, MovimientoLista } from "@/lib/datos/movimientos";
import { GRUPO_INGRESOS } from "@/lib/dominio/categorias";
import { etiquetaDia, formatearDiaCorto } from "@/lib/dominio/fechas";
import { BarraSeleccion } from "./BarraSeleccion";
import { DetalleMovimiento } from "./DetalleMovimiento";
import { FilaSeleccionable } from "./FilaSeleccionable";
import { FilaSwipe } from "./FilaSwipe";

// Historial interactivo (feature nueva): tap abre el detalle, swipe a la
// izquierda revela el borrado. Borrado optimista con reversión si el server
// falla. Una cuota borra la compra entera (todas sus hermanas de la lista).
//
// Y un segundo modo: SELECCIÓN. Elegís varios y les cambiás la fecha de una —
// que es como se arrastra medio mes al siguiente sin abrir uno por uno— o los
// CATEGORIZÁS en tanda ("estas cinco cargas van todas a SUBE"). El cambio de a
// uno sigue viviendo en el detalle del movimiento.

type Dia = { fecha: string; movimientos: MovimientoLista[] };

export function Historial({
  dias,
  hoy,
  categorias = [],
  medios = [],
}: {
  dias: Dia[];
  hoy: string;
  /** para el formulario de edición del detalle */
  categorias?: CategoriaSimple[];
  medios?: MedioDePago[];
}) {
  const router = useRouter();
  const [, iniciar] = useTransition();
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [detalle, setDetalle] = useState<MovimientoLista | null>(null);
  const [ocultos, setOcultos] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const [seleccionando, setSeleccionando] = useState(false);
  const [elegidos, setElegidos] = useState<Set<string>>(new Set());
  const [fechaDestino, setFechaDestino] = useState(hoy);
  const [moviendo, setMoviendo] = useState(false);
  const [categorizando, setCategorizando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

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

  function alternar(id: string) {
    setElegidos((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  function salirDeSeleccion() {
    setSeleccionando(false);
    setElegidos(new Set());
  }

  async function mover() {
    if (elegidos.size === 0 || moviendo) return;
    setMoviendo(true);
    setError(null);
    setAviso(null);
    const r = await actualizarFechasEnLote({
      movimientoIds: [...elegidos],
      fecha: fechaDestino,
    });
    setMoviendo(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    // el resultado se cuenta como pasó: si alguna cuota se coló, se dice
    setAviso(
      `${r.movidos === 1 ? "Moviste 1 movimiento" : `Moviste ${r.movidos} movimientos`} al ${formatearDiaCorto(fechaDestino)}` +
        (r.omitidos > 0
          ? ` · ${r.omitidos === 1 ? "1 cuota quedó" : `${r.omitidos} cuotas quedaron`} afuera: su fecha la maneja la compra`
          : ""),
    );
    salirDeSeleccion();
    router.refresh();
  }

  async function categorizar(categoriaId: string) {
    if (elegidos.size === 0 || categorizando) return;
    setCategorizando(true);
    setError(null);
    setAviso(null);
    const r = await categorizarEnLote({ movimientoIds: [...elegidos], categoriaId });
    setCategorizando(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    const nombre = categorias.find((c) => c.id === categoriaId)?.nombre;
    setAviso(
      `${r.cambiados === 1 ? "1 movimiento quedó" : `${r.cambiados} movimientos quedaron`}` +
        (nombre ? ` en ${nombre}` : " categorizados"),
    );
    salirDeSeleccion();
    router.refresh();
  }

  const visibles = dias
    .map((d) => ({ fecha: d.fecha, movimientos: d.movimientos.filter((m) => !ocultos.has(m.id)) }))
    .filter((d) => d.movimientos.length > 0);

  const hayAlgo = visibles.length > 0;
  const seleccionables = todos.filter((m) => !m.esCuota && !ocultos.has(m.id));
  const todosElegidos =
    seleccionables.length > 0 && elegidos.size === seleccionables.length;

  // Qué categorías se ofrecen para el lote. Misma regla que la bandeja, pero
  // mirando TODO lo elegido:
  //  · ámbito — si lo elegido es todo del mismo lado, las de ese lado; si
  //    mezcla, solo las del hogar: una categoría personal es de un miembro y
  //    ponérsela a un movimiento compartido lo dejaría sin categoría para el
  //    resto del hogar.
  //  · tipo — un ingreso se categoriza con las de Ingresos y un gasto con el
  //    resto; si la selección mezcla, no se filtra por grupo.
  const movimientosElegidos = todos.filter((m) => elegidos.has(m.id));
  const ambitosElegidos = new Set(
    movimientosElegidos.map((m) => (m.visibilidad === "compartido" ? "hogar" : "personal")),
  );
  const ambitoDelLote = ambitosElegidos.size === 1 ? [...ambitosElegidos][0] : "hogar";
  const soloIngresos =
    movimientosElegidos.length > 0 && movimientosElegidos.every((m) => m.tipo === "ingreso");
  const soloGastos =
    movimientosElegidos.length > 0 && movimientosElegidos.every((m) => m.tipo !== "ingreso");
  const categoriasDelLote = categorias.filter((c) => {
    if (c.ambito !== ambitoDelLote) return false;
    if (soloIngresos) return c.grupo === GRUPO_INGRESOS;
    if (soloGastos) return c.grupo !== GRUPO_INGRESOS;
    return true;
  });

  return (
    <>
      {error && (
        <p role="alert" className="mt-3 text-center text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}
      {aviso && (
        <p role="status" className="mt-3 text-center text-[12.5px] leading-[1.5] font-medium text-verde">
          {aviso}
        </p>
      )}

      {hayAlgo && (
        <div className="mt-4 flex items-center justify-end gap-3">
          {seleccionando && seleccionables.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setElegidos(todosElegidos ? new Set() : new Set(seleccionables.map((m) => m.id)))
              }
              className="hit-44 text-[12.5px] font-medium text-verde"
            >
              {todosElegidos ? "Ninguno" : "Todos"}
            </button>
          )}
          <button
            type="button"
            onClick={() => (seleccionando ? salirDeSeleccion() : setSeleccionando(true))}
            className="hit-44 flex items-center gap-1.5 text-[12.5px] font-medium text-tinta-secundaria"
          >
            <ListChecks className="size-[15px]" strokeWidth={1.8} aria-hidden />
            {seleccionando ? "Salir" : "Seleccionar"}
          </button>
        </div>
      )}

      {visibles.map((d) => (
        <Fragment key={d.fecha}>
          <EncabezadoSeccion>{etiquetaDia(d.fecha, hoy)}</EncabezadoSeccion>
          <Card className="divide-y divide-separador overflow-hidden">
            {d.movimientos.map((m) => {
              const datos: DatosFilaMovimiento = {
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
              };

              return seleccionando ? (
                <FilaSeleccionable
                  key={m.id}
                  datos={datos}
                  elegido={elegidos.has(m.id)}
                  seleccionable={!m.esCuota}
                  onAlternar={() => alternar(m.id)}
                />
              ) : (
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
                  datos={datos}
                />
              );
            })}
          </Card>
        </Fragment>
      ))}

      {/* aire para que la barra fija no tape el último movimiento (la barra
          creció: además de mover, categoriza) */}
      {seleccionando && <div className="h-52" />}

      {seleccionando && (
        <BarraSeleccion
          cantidad={elegidos.size}
          fecha={fechaDestino}
          pendiente={moviendo}
          categorias={categoriasDelLote}
          pendienteCategoria={categorizando}
          onFecha={setFechaDestino}
          onMover={mover}
          onCategorizar={categorizar}
          onCancelar={salirDeSeleccion}
        />
      )}

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
