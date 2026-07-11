"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarFechasCiclo } from "@/app/acciones/tarjetas";
import { Badge } from "@/components/sistema/Badge";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { HojaInferior } from "@/components/sistema/HojaInferior";

// Bloque inferior del timeline de ciclo (§3.23): dos columnas "cierre 28 jul"
// / "vence 6 ago" (mono 11px, fecha 600) + badge estimada/confirmada + acción
// "confirmar fecha" (solo con fechas estimadas del ciclo vigente). La acción
// abre la hoja con los dos inputs de fecha: confirmar sin tocar nada solo
// confirma; corregir la fecha además reasigna los consumos de ciclo.

type Props = {
  cicloId: string;
  fechaCierre: string; // YYYY-MM-DD
  fechaVencimiento: string; // YYYY-MM-DD
  cierreCorto: string; // "28 jul"
  vencimientoCorto: string; // "6 ago"
  estadoFechas: "estimado" | "confirmado";
  /** false en ciclos históricos: sin acciones */
  conAcciones: boolean;
};

export function ConfirmarFecha({
  cicloId,
  fechaCierre,
  fechaVencimiento,
  cierreCorto,
  vencimientoCorto,
  estadoFechas,
  conAcciones,
}: Props) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [pendiente, iniciarTransicion] = useTransition();
  const [cierre, setCierre] = useState(fechaCierre);
  const [vencimiento, setVencimiento] = useState(fechaVencimiento);
  const [error, setError] = useState<string | null>(null);

  const badge = estadoFechas === "confirmado" ? "confirmada" : "estimada";
  const mostrarAccion = conAcciones && estadoFechas === "estimado";

  function abrir() {
    setCierre(fechaCierre);
    setVencimiento(fechaVencimiento);
    setError(null);
    setAbierta(true);
  }

  function confirmar() {
    if (pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await confirmarFechasCiclo({
        cicloId,
        fechaCierre: cierre,
        fechaVencimiento: vencimiento,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setAbierta(false);
      router.refresh();
    });
  }

  return (
    <>
      <div className="mt-3 flex justify-end gap-10 border-t border-separador pt-2.5">
        <div className="flex flex-col items-start gap-[5px]">
          <p className="cifra text-[11px] text-tinta-secundaria">
            cierre <span className="font-semibold text-tinta">{cierreCorto}</span>
          </p>
          <Badge variante={badge}>{badge}</Badge>
          {mostrarAccion && (
            <button
              type="button"
              onClick={abrir}
              className="hit-44 text-[11px] font-medium text-verde"
            >
              confirmar fecha
            </button>
          )}
        </div>
        <div className="flex flex-col items-start gap-[5px]">
          <p className="cifra text-[11px] text-tinta-secundaria">
            vence <span className="font-semibold text-tinta">{vencimientoCorto}</span>
          </p>
          <Badge variante={badge}>{badge}</Badge>
          {mostrarAccion && (
            <button
              type="button"
              onClick={abrir}
              className="hit-44 text-[11px] font-medium text-verde"
            >
              confirmar fecha
            </button>
          )}
        </div>
      </div>

      {mostrarAccion && (
        <HojaInferior abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Confirmar fechas">
          <div className="flex flex-col gap-3">
            <label className="block">
              <span className="text-[12px] text-tinta-secundaria">Cierre</span>
              <input
                type="date"
                value={cierre}
                onChange={(e) => setCierre(e.target.value)}
                className="cifra mt-1 w-full rounded-cta border border-borde bg-superficie px-3 py-2.5 text-[15px] text-tinta"
              />
            </label>
            <label className="block">
              <span className="text-[12px] text-tinta-secundaria">Vencimiento</span>
              <input
                type="date"
                value={vencimiento}
                onChange={(e) => setVencimiento(e.target.value)}
                className="cifra mt-1 w-full rounded-cta border border-borde bg-superficie px-3 py-2.5 text-[15px] text-tinta"
              />
            </label>
            <p className="text-[11px] text-tinta-secundaria">
              Si corregís la fecha, los consumos se reacomodan de ciclo solos.
            </p>
            {error && (
              <p role="alert" className="text-[12px] font-medium text-rojo">
                {error}
              </p>
            )}
            <BotonPrimario
              onClick={confirmar}
              disabled={pendiente || !cierre || !vencimiento}
            >
              {pendiente ? "Guardando…" : "Confirmar fechas"}
            </BotonPrimario>
          </div>
        </HojaInferior>
      )}
    </>
  );
}
