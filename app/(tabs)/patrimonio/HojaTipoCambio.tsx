"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cargarTipoCambio } from "@/app/acciones/patrimonio";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { etiquetaFuente, type FuenteTC } from "./instrumentos";

// Hoja de carga del TC del día (hueco declarado del export): un solo campo en
// pesos enteros, mismo estilo que las hojas de 06. La cotización automática
// queda anotada como fase siguiente.

type Props = {
  fuente: FuenteTC;
  abierta: boolean;
  onCerrar: () => void;
};

export function HojaTipoCambio({ fuente, abierta, onCerrar }: Props) {
  const router = useRouter();
  const [pesos, setPesos] = useState(""); // solo dígitos, pesos enteros
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciarTransicion] = useTransition();

  const centavos = pesos === "" ? null : Number(pesos) * 100;
  const etiqueta = etiquetaFuente(fuente);

  function guardar() {
    if (centavos === null || centavos <= 0 || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await cargarTipoCambio({ fuente, valorCentavos: centavos });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      onCerrar();
      router.refresh();
    });
  }

  return (
    <HojaInferior abierta={abierta} onCerrar={onCerrar} titulo={`Tipo de cambio ${etiqueta}`}>
      <div className="flex flex-col gap-3">
        <label className="block">
          <span className="text-[12px] text-tinta-secundaria">Valor de hoy, en pesos</span>
          <span className="mt-1 flex items-center gap-2 rounded-cta border border-borde bg-superficie px-3 py-2.5">
            <span className="cifra text-[16px] text-tinta-secundaria" aria-hidden>
              $
            </span>
            <input
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="off"
              value={pesos}
              onChange={(e) => setPesos(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="0"
              aria-label={`Valor del dólar ${etiqueta} de hoy, en pesos`}
              className="cifra w-full bg-transparent text-[16px] text-tinta outline-none placeholder:text-tinta-terciaria"
            />
          </span>
        </label>

        {error && (
          <p role="alert" className="text-[12px] font-medium text-rojo">
            {error}
          </p>
        )}

        <BotonPrimario
          onClick={guardar}
          disabled={centavos === null || centavos <= 0 || pendiente}
        >
          {pendiente ? "Guardando…" : "Guardar valor de hoy"}
        </BotonPrimario>

        <p className="text-[11px] text-tinta-terciaria">
          Carga manual. La cotización automática llega en una próxima versión.
        </p>
      </div>
    </HojaInferior>
  );
}
