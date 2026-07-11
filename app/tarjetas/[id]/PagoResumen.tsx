"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Banknote, ChevronRight } from "lucide-react";
import { pagarResumen } from "@/app/acciones/tarjetas";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Chip } from "@/components/sistema/Chip";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { formatearImporte } from "@/lib/dominio/dinero";

// Pago del resumen: monto prefijado al total (real si está conciliado, si no
// proyectado) con chips "Total" / "Otro monto", y la cuenta de origen como
// chips (solo cuentas: un resumen no se paga con otra tarjeta). El pago es
// una transferencia y JAMÁS computa como gasto (lib/dominio/tarjetas).

type Cuenta = { id: string; etiqueta: string };

type Props = {
  cicloId: string;
  totalCentavos: number;
  cuentas: Cuenta[];
};

export function PagoResumen({ cicloId, totalCentavos, cuentas }: Props) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [pendiente, iniciarTransicion] = useTransition();
  const [modo, setModo] = useState<"total" | "otro">("total");
  const [pesos, setPesos] = useState("");
  const [cuentaId, setCuentaId] = useState<string | null>(cuentas[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);

  const pesosTotal = String(Math.round(totalCentavos / 100));
  const centavos = pesos === "" ? 0 : Number(pesos) * 100;

  function abrir() {
    setModo("total");
    setPesos(pesosTotal);
    setError(null);
    setAbierta(true);
  }

  function elegirTotal() {
    setModo("total");
    setPesos(pesosTotal);
  }

  function elegirOtro() {
    setModo("otro");
    setPesos("");
  }

  function registrar() {
    if (!cuentaId || centavos <= 0 || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await pagarResumen({
        cicloId,
        cuentaId,
        importeCentavos: centavos,
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
      <button
        type="button"
        onClick={abrir}
        className="flex w-full items-center gap-[11px] px-3.5 py-3 text-left"
      >
        <Banknote className="size-[18px] shrink-0 text-tinta-secundaria" strokeWidth={1.5} aria-hidden />
        <span className="flex-1 text-[13.5px] font-medium text-tinta">Pagar resumen</span>
        <ChevronRight className="size-4 shrink-0 text-tinta-muda" strokeWidth={1.5} aria-hidden />
      </button>

      <HojaInferior abierta={abierta} onCerrar={() => setAbierta(false)} titulo="Pagar resumen">
        <div className="flex flex-col gap-3">
          <div role="group" aria-label="Monto del pago" className="flex gap-2">
            <Chip escala="filtro" seleccionado={modo === "total"} onClick={elegirTotal}>
              Total
            </Chip>
            <Chip escala="filtro" seleccionado={modo === "otro"} onClick={elegirOtro}>
              Otro monto
            </Chip>
          </div>

          <label className="block">
            <span className="text-[12px] text-tinta-secundaria">Monto</span>
            <span className="mt-1 flex items-center gap-2 rounded-cta border border-borde bg-superficie px-3 py-2.5">
              <span className="cifra text-[16px] text-tinta-secundaria" aria-hidden>
                $
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={pesos}
                onChange={(e) => {
                  setModo("otro");
                  setPesos(e.target.value.replace(/\D/g, "").slice(0, 9));
                }}
                placeholder="0"
                aria-label="Monto del pago, en pesos"
                className="cifra w-full bg-transparent text-[16px] text-tinta outline-none placeholder:text-tinta-terciaria"
              />
            </span>
            <span className="mt-1 block text-[11px] text-tinta-secundaria">
              Total del resumen:{" "}
              <span className="cifra">{formatearImporte(totalCentavos)}</span>
            </span>
          </label>

          <div role="group" aria-label="Cuenta de origen">
            <p className="text-[12px] text-tinta-secundaria">Desde la cuenta</p>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {cuentas.map((c) => (
                <Chip
                  key={c.id}
                  escala="filtro"
                  seleccionado={c.id === cuentaId}
                  onClick={() => setCuentaId(c.id)}
                >
                  {c.etiqueta}
                </Chip>
              ))}
            </div>
          </div>

          {error && (
            <p role="alert" className="text-[12px] font-medium text-rojo">
              {error}
            </p>
          )}
          <BotonPrimario
            onClick={registrar}
            disabled={!cuentaId || centavos <= 0 || pendiente}
          >
            {pendiente ? "Registrando…" : "Registrar pago"}
          </BotonPrimario>
        </div>
      </HojaInferior>
    </>
  );
}
