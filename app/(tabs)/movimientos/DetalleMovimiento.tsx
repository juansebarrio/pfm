"use client";

import { Trash2 } from "lucide-react";
import { Badge } from "@/components/sistema/Badge";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import { Importe } from "@/components/sistema/Importe";
import type { MovimientoLista } from "@/lib/datos/movimientos";
import { formatearDiaLargo } from "@/lib/dominio/fechas";

// Detalle de un movimiento en hoja inferior (feature nueva). Muestra todo lo
// que hay y ofrece el borrado; si es una cuota, aclara que borra la compra.

const NOMBRE_TIPO: Record<MovimientoLista["tipo"], string | null> = {
  gasto: null, // es lo esperado, no hace falta rotularlo
  ingreso: "Ingreso",
  transferencia: "Transferencia",
  pago_resumen: "Pago de resumen",
};

function Fila({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <dt className="text-[12.5px] text-tinta-secundaria">{etiqueta}</dt>
      <dd className="min-w-0 truncate text-right text-[13.5px] font-medium text-tinta">
        {children}
      </dd>
    </div>
  );
}

export function DetalleMovimiento({
  movimiento,
  onCerrar,
  onBorrar,
}: {
  movimiento: MovimientoLista | null;
  onCerrar: () => void;
  onBorrar: () => void;
}) {
  const m = movimiento;
  const esIngreso = m?.tipo === "ingreso";
  const tipo = m ? NOMBRE_TIPO[m.tipo] : null;

  return (
    <HojaInferior
      abierta={m !== null}
      onCerrar={onCerrar}
      titulo="Detalle del movimiento"
    >
      {m && (
        <div>
          <div className="text-center">
            <Importe
              centavos={m.importeCentavos}
              variante="card"
              conSigno={esIngreso}
              className={esIngreso ? "text-verde" : "text-tinta"}
            />
            <p className="mt-1 text-[15px] font-medium text-tinta">{m.descripcion}</p>
          </div>

          <dl className="mt-4 divide-y divide-separador rounded-card border border-borde">
            <Fila etiqueta="Categoría">
              {m.categoria ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconoCategoria nombre={m.categoria.icono} className="size-4" />
                  {m.categoria.nombre}
                </span>
              ) : (
                <span className="text-tinta-secundaria">Sin categorizar</span>
              )}
            </Fila>
            {m.medio && <Fila etiqueta="Medio">{m.medio}</Fila>}
            <Fila etiqueta="Fecha">{formatearDiaLargo(m.fecha)}</Fila>
            <Fila etiqueta="Ámbito">
              <Badge variante={m.visibilidad === "compartido" ? "hogar" : "personal"}>
                {m.visibilidad === "compartido" ? "hogar" : "personal"}
              </Badge>
            </Fila>
            {m.cierreCiclo && (
              <Fila etiqueta="Ciclo">
                <span className="text-ambar-texto">{m.cierreCiclo}</span>
              </Fila>
            )}
            {m.esCuota && m.nCuota && m.nCuotasTotal && (
              <Fila etiqueta="Cuota">
                <Badge variante="cuota">{`Cuota ${m.nCuota}/${m.nCuotasTotal}`}</Badge>
              </Fila>
            )}
            {tipo && <Fila etiqueta="Tipo">{tipo}</Fila>}
            {m.nota && <Fila etiqueta="Nota">{m.nota}</Fila>}
          </dl>

          {m.esCuota && (
            <p className="mt-2.5 text-[11.5px] leading-[1.5] text-tinta-secundaria">
              Es una cuota de una compra. Borrar acá elimina la compra completa
              {m.nCuotasTotal ? ` (${m.nCuotasTotal} cuotas)` : ""}.
            </p>
          )}

          <button
            type="button"
            onClick={onBorrar}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-cta border border-rojo py-3.5 text-[14px] font-semibold text-rojo"
          >
            <Trash2 className="size-4" strokeWidth={1.8} aria-hidden />
            {m.esCuota && m.nCuotasTotal
              ? `Borrar la compra · ${m.nCuotasTotal} cuotas`
              : "Borrar movimiento"}
          </button>
        </div>
      )}
    </HojaInferior>
  );
}
