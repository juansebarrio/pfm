"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { actualizarImpuestosEstimados } from "@/app/acciones/tarjetas";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { formatearImporte } from "@/lib/dominio/dinero";

// Fila "Impuestos y cargos estimados ✎" del desglose de 06 (§3.21: lápiz =
// valor editable). El lápiz abre una mini hoja con un solo campo en pesos
// enteros; la estimación persiste por tarjeta.

type Props = {
  tarjetaId: string;
  impuestosCentavos: number;
};

export function ImpuestosEditable({ tarjetaId, impuestosCentavos }: Props) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [pendiente, iniciarTransicion] = useTransition();
  const [pesos, setPesos] = useState("");
  const [error, setError] = useState<string | null>(null);

  const centavos = pesos === "" ? null : Number(pesos) * 100;

  function abrir() {
    setPesos(String(Math.round(impuestosCentavos / 100)));
    setError(null);
    setAbierta(true);
  }

  function guardar() {
    if (centavos === null || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await actualizarImpuestosEstimados({
        tarjetaId,
        impuestosCentavos: centavos,
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
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[12.5px] text-tinta-secundaria">
          Impuestos y cargos estimados
          <button
            type="button"
            onClick={abrir}
            aria-label="Editar impuestos y cargos estimados"
            className="hit-44 text-tinta-secundaria"
          >
            <Pencil className="size-3" strokeWidth={1.5} aria-hidden />
          </button>
        </span>
        <span className="cifra text-[12.5px] font-medium text-tinta">
          {formatearImporte(impuestosCentavos)}
        </span>
      </div>

      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo="Impuestos y cargos estimados"
      >
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="text-[12px] text-tinta-secundaria">Estimado por resumen</span>
            <span className="mt-1 flex items-center gap-2 rounded-cta border border-borde bg-superficie px-3 py-2.5">
              <span className="cifra text-[16px] text-tinta-secundaria" aria-hidden>
                $
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={pesos}
                onChange={(e) => setPesos(e.target.value.replace(/\D/g, "").slice(0, 9))}
                placeholder="0"
                aria-label="Impuestos y cargos estimados, en pesos"
                className="cifra w-full bg-transparent text-[16px] text-tinta outline-none placeholder:text-tinta-terciaria"
              />
            </span>
          </label>
          {error && (
            <p role="alert" className="text-[12px] font-medium text-rojo">
              {error}
            </p>
          )}
          <BotonPrimario onClick={guardar} disabled={centavos === null || pendiente}>
            {pendiente ? "Guardando…" : "Guardar"}
          </BotonPrimario>
        </div>
      </HojaInferior>
    </>
  );
}
