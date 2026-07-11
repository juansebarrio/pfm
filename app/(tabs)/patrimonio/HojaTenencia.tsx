"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  convertirUsd,
  desactivarTenencia,
  guardarTenencia,
} from "@/app/acciones/patrimonio";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Chip } from "@/components/sistema/Chip";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { formatearImporte } from "@/lib/dominio/dinero";
import { hoyBA } from "@/lib/dominio/fechas";
import {
  CON_TOGGLE_MONEDA,
  ETIQUETA_INSTRUMENTO,
  INSTRUMENTOS,
  INSTRUMENTOS_EN_USD,
  etiquetaFuente,
  type Instrumento,
} from "./instrumentos";

// Hoja de alta/edición de tenencia (hueco declarado del export, DESIGN_AUDIT
// §5): lista cerrada de instrumentos, nombre autocompletado, cantidad en USD
// o valuación en pesos según el instrumento, y conversión EN VIVO que siempre
// muestra QUÉ TC usó. El padre la monta con key nueva en cada apertura.

type Moneda = "ARS" | "USD";

export type TenenciaEditable = {
  id: string;
  instrumento: string;
  nombre: string;
  detalle: string | null;
  moneda: Moneda;
  cantidadUsdCentavos: number | null;
  valuacionCentavos: number | null;
  fechaValuacion: string;
};

type Conversion = { arsCentavos: number; tcValorCentavos: number; fuente: string };

type Props = {
  abierta: boolean;
  onCerrar: () => void;
  /** modo edición */
  tenencia?: TenenciaEditable | null;
  /** alta con instrumento preseleccionado (chips de sugerencia de 08b) */
  instrumentoInicial?: Instrumento | null;
};

function esInstrumento(valor: string): valor is Instrumento {
  return (INSTRUMENTOS as readonly string[]).includes(valor);
}

function monedaDerivada(instrumento: Instrumento): Moneda {
  return INSTRUMENTOS_EN_USD.has(instrumento) ? "USD" : "ARS";
}

export function HojaTenencia({
  abierta,
  onCerrar,
  tenencia = null,
  instrumentoInicial = null,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [convirtiendo, iniciarConversion] = useTransition();
  const edicion = tenencia !== null;

  const [instrumento, setInstrumento] = useState<Instrumento | null>(
    tenencia
      ? esInstrumento(tenencia.instrumento)
        ? tenencia.instrumento
        : "otro"
      : instrumentoInicial,
  );
  const [nombre, setNombre] = useState(
    tenencia?.nombre ?? (instrumentoInicial ? ETIQUETA_INSTRUMENTO[instrumentoInicial] : ""),
  );
  // mientras el nombre no fue tocado, elegir instrumento lo autocompleta
  const [nombreEditado, setNombreEditado] = useState(edicion);
  const [detalle, setDetalle] = useState(tenencia?.detalle ?? "");
  const [moneda, setMoneda] = useState<Moneda>(
    tenencia?.moneda ?? (instrumentoInicial ? monedaDerivada(instrumentoInicial) : "ARS"),
  );
  const [cantidadUsd, setCantidadUsd] = useState(
    tenencia?.cantidadUsdCentavos != null
      ? String(Math.round(tenencia.cantidadUsdCentavos / 100))
      : "",
  );
  const [valuacionPesos, setValuacionPesos] = useState(
    tenencia?.valuacionCentavos != null
      ? String(Math.round(tenencia.valuacionCentavos / 100))
      : "",
  );
  const [fecha, setFecha] = useState(tenencia?.fechaValuacion ?? hoyBA());
  const [conversion, setConversion] = useState<Conversion | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pedidoRef = useRef(0);

  const usdCentavos =
    moneda === "USD" && /^\d+$/.test(cantidadUsd) ? Number(cantidadUsd) * 100 : null;

  // conversión en vivo con debounce simple; se descartan respuestas viejas
  useEffect(() => {
    if (usdCentavos === null || usdCentavos <= 0) {
      setConversion(null);
      return;
    }
    const temporizador = setTimeout(() => {
      const pedido = ++pedidoRef.current;
      iniciarConversion(async () => {
        const resultado = await convertirUsd({ usdCentavos });
        if (pedidoRef.current !== pedido) return;
        setConversion(resultado.ok ? resultado : null);
      });
    }, 350);
    return () => clearTimeout(temporizador);
  }, [usdCentavos, iniciarConversion]);

  function elegirInstrumento(elegido: Instrumento) {
    setInstrumento(elegido);
    setMoneda(monedaDerivada(elegido));
    if (!nombreEditado) setNombre(ETIQUETA_INSTRUMENTO[elegido]);
  }

  function guardar() {
    if (pendiente) return;
    if (!instrumento) {
      setError("Elegí un instrumento");
      return;
    }
    if (nombre.trim() === "") {
      setError("Poné un nombre");
      return;
    }
    const cantidad =
      moneda === "USD" && cantidadUsd !== "" ? Number(cantidadUsd) * 100 : null;
    const valuacion =
      moneda === "ARS" && valuacionPesos !== "" ? Number(valuacionPesos) * 100 : null;
    if (moneda === "USD" ? !cantidad : !valuacion) {
      setError(moneda === "USD" ? "Cargá la cantidad en USD" : "Cargá la valuación en pesos");
      return;
    }
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await guardarTenencia({
        tenenciaId: tenencia?.id ?? null,
        instrumento,
        nombre: nombre.trim(),
        detalle: detalle.trim() === "" ? null : detalle.trim(),
        moneda,
        cantidadUsdCentavos: cantidad,
        valuacionCentavos: valuacion,
        fechaValuacion: fecha,
      });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      onCerrar();
      router.refresh();
    });
  }

  function desactivar() {
    if (!tenencia || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await desactivarTenencia({ tenenciaId: tenencia.id });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      onCerrar();
      router.refresh();
    });
  }

  const claseInput =
    "mt-1 w-full rounded-cta border border-borde bg-superficie px-3 py-2.5 text-[15px] text-tinta outline-none placeholder:text-tinta-terciaria";

  return (
    <HojaInferior
      abierta={abierta}
      onCerrar={onCerrar}
      titulo={edicion ? "Editar tenencia" : "Cargar tenencia"}
    >
      <div className="flex flex-col gap-4">
        <fieldset>
          <legend className="text-[12px] text-tinta-secundaria">Instrumento</legend>
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            {INSTRUMENTOS.map((opcion) => (
              <Chip
                key={opcion}
                escala="filtro"
                tonoSeleccion="verde"
                seleccionado={instrumento === opcion}
                onClick={() => elegirInstrumento(opcion)}
                className="w-full justify-center"
              >
                {ETIQUETA_INSTRUMENTO[opcion]}
              </Chip>
            ))}
          </div>
        </fieldset>

        <label className="block">
          <span className="text-[12px] text-tinta-secundaria">Nombre</span>
          <input
            type="text"
            value={nombre}
            maxLength={60}
            onChange={(e) => {
              setNombre(e.target.value);
              setNombreEditado(e.target.value !== "");
            }}
            placeholder="Dólar MEP"
            className={claseInput}
          />
        </label>

        <label className="block">
          <span className="text-[12px] text-tinta-secundaria">Detalle (opcional)</span>
          <input
            type="text"
            value={detalle}
            maxLength={80}
            onChange={(e) => setDetalle(e.target.value)}
            placeholder="Mercado Pago + Galicia"
            className={claseInput}
          />
        </label>

        {instrumento && (
          <div>
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-tinta-secundaria">
                {moneda === "USD" ? "Cantidad en USD" : "Valuación en pesos"}
              </span>
              {CON_TOGGLE_MONEDA.has(instrumento) && (
                <span className="flex gap-1" role="group" aria-label="Moneda">
                  <Chip
                    escala="mini"
                    seleccionado={moneda === "USD"}
                    onClick={() => setMoneda("USD")}
                  >
                    USD
                  </Chip>
                  <Chip
                    escala="mini"
                    seleccionado={moneda === "ARS"}
                    onClick={() => setMoneda("ARS")}
                  >
                    ARS
                  </Chip>
                </span>
              )}
            </div>
            <label className="mt-1 flex items-center gap-2 rounded-cta border border-borde bg-superficie px-3 py-2.5">
              <span className="cifra text-[16px] text-tinta-secundaria" aria-hidden>
                {moneda === "USD" ? "USD" : "$"}
              </span>
              <input
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                value={moneda === "USD" ? cantidadUsd : valuacionPesos}
                onChange={(e) => {
                  const limpio = e.target.value.replace(/\D/g, "").slice(0, 9);
                  if (moneda === "USD") setCantidadUsd(limpio);
                  else setValuacionPesos(limpio);
                }}
                placeholder="0"
                aria-label={moneda === "USD" ? "Cantidad en USD" : "Valuación en pesos"}
                className="cifra w-full bg-transparent text-[16px] text-tinta outline-none placeholder:text-tinta-terciaria"
              />
            </label>
            {moneda === "USD" && (conversion || convirtiendo) && (
              <p aria-live="polite" className="cifra mt-1.5 text-[12px] text-tinta-secundaria">
                {conversion ? (
                  <>
                    ≈ {formatearImporte(conversion.arsCentavos)} al{" "}
                    {etiquetaFuente(conversion.fuente)}{" "}
                    {formatearImporte(conversion.tcValorCentavos)}
                  </>
                ) : (
                  "…"
                )}
              </p>
            )}
          </div>
        )}

        <label className="block">
          <span className="text-[12px] text-tinta-secundaria">Fecha de valuación</span>
          <input
            type="date"
            value={fecha}
            max={hoyBA()}
            onChange={(e) => setFecha(e.target.value)}
            className={`cifra ${claseInput}`}
          />
        </label>

        {error && (
          <p role="alert" className="text-[12px] font-medium text-rojo">
            {error}
          </p>
        )}

        <BotonPrimario onClick={guardar} disabled={pendiente || !instrumento}>
          {pendiente ? "Guardando…" : "Guardar tenencia"}
        </BotonPrimario>

        {edicion && (
          <button
            type="button"
            onClick={desactivar}
            disabled={pendiente}
            className="mx-auto -mt-1 text-[12px] font-medium text-rojo disabled:opacity-60"
          >
            Desactivar
          </button>
        )}
      </div>
    </HojaInferior>
  );
}
