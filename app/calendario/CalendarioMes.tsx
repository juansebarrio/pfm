"use client";

import { useState } from "react";
import { Zap } from "lucide-react";
import { Card } from "@/components/sistema/Card";
import { ListaMovimientosTocables } from "@/components/sistema/ListaMovimientosTocables";
import type {
  CategoriaSimple,
  MedioDePago,
  MovimientoLista,
} from "@/lib/datos/movimientos";
import type { RecurrenteActivo } from "@/lib/datos/presupuesto";
import {
  DIAS_SEMANA,
  plataPorDia,
  recurrentesPorDia,
  semanasDelMes,
} from "@/lib/dominio/calendario";
import { formatearImporte } from "@/lib/dominio/dinero";
import { formatearDiaLargo } from "@/lib/dominio/fechas";

// La grilla del mes. En las celdas, puntos y no cifras: en 44px un importe
// solo entra abreviado y la app no abrevia plata. El detalle del día elegido
// va abajo, con las MISMAS filas tocables del resto de la app (abrir, editar,
// borrar) — el calendario es otra puerta al mismo lugar, no una vista aparte.
//
// Puntos: tinta = hubo gastos · verde = hubo ingresos · ámbar = vence un fijo.

export function CalendarioMes({
  mes,
  hoy,
  movimientos,
  recurrentes,
  categorias,
  medios,
}: {
  mes: string;
  hoy: string;
  movimientos: MovimientoLista[];
  recurrentes: RecurrenteActivo[];
  categorias: CategoriaSimple[];
  medios: MedioDePago[];
}) {
  const [elegido, setElegido] = useState<string>(() =>
    hoy.startsWith(mes.slice(0, 8)) ? hoy : mes,
  );

  const semanas = semanasDelMes(mes);
  const plata = plataPorDia(
    movimientos.map((m) => ({
      fecha: m.fecha,
      tipo: m.tipo === "ingreso" ? ("ingreso" as const) : ("gasto" as const),
      importeCentavos: m.importeCentavos,
    })),
  );
  const fijos = recurrentesPorDia(mes, recurrentes);

  const delDia = movimientos.filter((m) => m.fecha === elegido);
  const fijosDelDia = fijos.get(elegido) ?? [];
  const esFuturo = elegido > hoy;

  return (
    <div>
      {/* etiquetas L a D */}
      <div className="mt-5 grid grid-cols-7 text-center">
        {DIAS_SEMANA.map((d, i) => (
          <span key={i} className="text-[10.5px] font-medium text-tinta-terciaria">
            {d}
          </span>
        ))}
      </div>

      {/* la grilla */}
      <div className="mt-1.5 grid grid-cols-7 gap-1" role="grid" aria-label="Días del mes">
        {semanas.flat().map((fecha, i) => {
          if (fecha === null) return <div key={`v-${i}`} aria-hidden />;
          const dia = Number(fecha.slice(8));
          const p = plata.get(fecha);
          const tieneFijos = fijos.has(fecha) && fecha >= hoy;
          const esHoy = fecha === hoy;
          const activo = fecha === elegido;
          return (
            <button
              key={fecha}
              type="button"
              onClick={() => setElegido(fecha)}
              aria-pressed={activo}
              aria-label={`${dia} de ${mes.slice(5, 7)}`}
              className={`flex aspect-square flex-col items-center justify-center rounded-[10px] border ${
                activo
                  ? "border-verde bg-verde-suave"
                  : esHoy
                    ? "border-verde/50 bg-superficie"
                    : "border-transparent bg-superficie"
              }`}
            >
              <span
                className={`cifra text-[13px] ${
                  esHoy ? "font-semibold text-verde" : fecha > hoy ? "text-tinta-secundaria" : "text-tinta"
                }`}
              >
                {dia}
              </span>
              <span className="mt-0.5 flex h-1.5 items-center gap-[3px]">
                {p && p.gastosCentavos > 0 && (
                  <span className="size-1.5 rounded-full bg-tinta-secundaria" />
                )}
                {p && p.ingresosCentavos > 0 && (
                  <span className="size-1.5 rounded-full bg-verde" />
                )}
                {tieneFijos && <span className="size-1.5 rounded-full bg-ambar" />}
              </span>
            </button>
          );
        })}
      </div>

      {/* leyenda */}
      <p className="mt-2.5 flex items-center justify-center gap-3 text-[10.5px] text-tinta-terciaria">
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-tinta-secundaria" /> gastos
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-verde" /> ingresos
        </span>
        <span className="flex items-center gap-1">
          <span className="size-1.5 rounded-full bg-ambar" /> fijo por vencer
        </span>
      </p>

      {/* el día elegido */}
      <h2 className="mt-6 mb-3 text-[13px] font-semibold text-tinta">
        {formatearDiaLargo(elegido)}
      </h2>

      {/* los fijos que vencen ese día (solo mirando adelante) */}
      {fijosDelDia.length > 0 && esFuturo && (
        <Card className="mb-2.5 divide-y divide-separador">
          {fijosDelDia.map((r) => (
            <div key={r.id} className="flex items-center gap-[11px] px-3.5 py-3">
              <Zap className="size-[18px] shrink-0 text-ambar" strokeWidth={1.5} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13.5px] font-medium text-tinta">{r.descripcion}</p>
                <p className="cifra mt-[3px] text-[11px] text-tinta-secundaria">
                  {formatearImporte(r.importeSugeridoCentavos)} sugerido
                  {r.categoria ? ` · ${r.categoria}` : ""}
                </p>
              </div>
            </div>
          ))}
        </Card>
      )}

      {delDia.length > 0 ? (
        <ListaMovimientosTocables movimientos={delDia} categorias={categorias} medios={medios} />
      ) : (
        (fijosDelDia.length === 0 || !esFuturo) && (
          <Card className="px-3.5 py-3.5">
            <p className="text-[13px] text-tinta-secundaria">
              {esFuturo ? "Nada agendado para ese día" : "Sin movimientos ese día"}
            </p>
          </Card>
        )
      )}
    </div>
  );
}
