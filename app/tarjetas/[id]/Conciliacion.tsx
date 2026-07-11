"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, RefreshCw } from "lucide-react";
import { conciliarResumen } from "@/app/acciones/tarjetas";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { formatearImporte } from "@/lib/dominio/dinero";
import { diferenciaConciliacion } from "@/lib/dominio/tarjetas";

// Conciliación del resumen (hueco declarado del export, DESIGN_AUDIT §5):
// UN solo campo con el total real en pesos enteros y la diferencia contra lo
// proyectado EN VIVO debajo, con color semántico (verde chica, ámbar grande).
// Sin matching línea por línea: cargás el total y listo.

type Props = {
  cicloId: string;
  proyectadoCentavos: number;
};

export function Conciliacion({ cicloId, proyectadoCentavos }: Props) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [pendiente, iniciarTransicion] = useTransition();
  const [pesos, setPesos] = useState(""); // solo dígitos, pesos enteros
  const [error, setError] = useState<string | null>(null);

  const centavos = pesos === "" ? null : Number(pesos) * 100;
  const dif = centavos !== null ? diferenciaConciliacion(centavos, proyectadoCentavos) : null;

  function abrir() {
    setPesos("");
    setError(null);
    setAbierta(true);
  }

  function guardar() {
    if (centavos === null || centavos <= 0 || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await conciliarResumen({ cicloId, totalRealCentavos: centavos });
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
      {/* Mejora aplicada (propuesta §3.3, ok de Juanse): la acción clave del
          diferencial argentino con affordance clara — chevron de fila accionable */}
      <button
        type="button"
        onClick={abrir}
        className="mt-3 block w-full border-t border-separador pt-3 text-left"
      >
        <span className="flex items-center gap-2">
          <RefreshCw className="size-[15px] shrink-0 text-verde" strokeWidth={1.5} aria-hidden />
          <span className="flex-1 text-[13px] font-medium text-verde">Conciliar resumen</span>
          <ChevronRight className="size-4 shrink-0 text-tinta-muda" strokeWidth={1.5} aria-hidden />
        </span>
        <span className="mt-1 block text-[11px] text-tinta-secundaria">
          Cuando llegue el real, cargá el total y vemos la diferencia.
        </span>
      </button>

      <HojaInferior abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Conciliar resumen">
        <div className="flex flex-col gap-3">
          <label className="block">
            <span className="text-[12px] text-tinta-secundaria">Total real del resumen</span>
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
                aria-label="Total real del resumen, en pesos"
                className="cifra w-full bg-transparent text-[16px] text-tinta outline-none placeholder:text-tinta-terciaria"
              />
            </span>
          </label>

          {dif && (
            <p
              aria-live="polite"
              className={`text-[12.5px] font-medium ${
                dif.tono === "verde" ? "text-verde" : "text-ambar-texto"
              }`}
            >
              {dif.centavos === 0 ? (
                "clavado al proyectado"
              ) : (
                <>
                  <span className="cifra">
                    {dif.centavos > 0 ? "+ " : "− "}
                    {formatearImporte(Math.abs(dif.centavos))}
                  </span>
                  {dif.centavos > 0 ? " sobre lo proyectado" : " bajo lo proyectado"}
                </>
              )}
            </p>
          )}

          {error && (
            <p role="alert" className="text-[12px] font-medium text-rojo">
              {error}
            </p>
          )}
          <BotonPrimario
            onClick={guardar}
            disabled={centavos === null || centavos <= 0 || pendiente}
          >
            {pendiente ? "Guardando…" : "Guardar"}
          </BotonPrimario>
        </div>
      </HojaInferior>
    </>
  );
}
