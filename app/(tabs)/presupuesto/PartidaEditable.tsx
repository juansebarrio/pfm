"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { actualizarPartida } from "@/app/acciones/presupuesto";
import { CardPartida, type DatosPartida } from "@/components/sistema/CardPartida";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { centavosDesdeTexto, formatearImporte } from "@/lib/dominio/dinero";

// La partida se ajusta tocándola: el sobre abre una hoja con el monto y listo.
// Antes un presupuesto armado era intocable (el armado redirige si el mes
// existe) — este es el único camino de edición, así que vive en la fila misma.
//
// Las desactivadas no abren nada: su edición es otra historia (reactivar,
// nota), no un monto.
//
// Al pie, el camino al detalle: la hoja dice cuánto gastaste y hasta acá no
// ofrecía nada para ver DE QUÉ está hecho ese número. Va como link discreto,
// abajo del guardar: es la salida, no la acción de la hoja.

export function PartidaEditable({
  partidaId,
  categoriaId,
  mes,
  datos,
}: {
  partidaId: string;
  /** la categoría de la partida, para filtrar sus movimientos */
  categoriaId: string;
  /** "YYYY-MM-01": la partida es de un mes y sus gastos también */
  mes: string;
  datos: DatosPartida;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [montoTexto, setMontoTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  if (datos.desactivada) return <CardPartida {...datos} />;

  const montoCentavos = centavosDesdeTexto(montoTexto);
  const listo = montoCentavos !== null && montoCentavos !== datos.asignadoCentavos;

  function abrir() {
    setMontoTexto(formatearImporte(datos.asignadoCentavos));
    setError(null);
    setAbierta(true);
  }

  function guardar() {
    if (!listo || pendiente || montoCentavos === null) return;
    setError(null);
    iniciar(async () => {
      const r = await actualizarPartida({ partidaId, asignadoCentavos: montoCentavos });
      if (r.ok) {
        router.refresh();
        setAbierta(false);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <>
      <button type="button" onClick={abrir} className="block w-full text-left">
        <CardPartida {...datos} />
      </button>

      <HojaInferior abierta={abierta} onCerrar={() => setAbierta(false)} titulo={datos.nombre}>
        <p className="text-[11.5px] text-tinta-secundaria">
          Asignado en el mes{datos.fija ? " · partida fija" : ""}
        </p>
        <input
          type="text"
          inputMode="decimal"
          value={montoTexto}
          onChange={(e) => setMontoTexto(e.target.value)}
          aria-label="Monto asignado"
          aria-invalid={montoTexto !== "" && montoCentavos === null}
          className={`cifra mt-1.5 h-14 w-full rounded-cta border bg-papel px-3.5 text-[26px] font-semibold text-tinta ${
            montoTexto !== "" && montoCentavos === null ? "border-rojo" : "border-borde"
          }`}
        />
        <p className="mt-2 text-[11.5px] text-tinta-secundaria">
          Gastado hasta ahora:{" "}
          <span className="cifra text-[12.5px] text-tinta">
            {formatearImporte(datos.gastadoCentavos)}
          </span>
          . Cambiar el monto no toca los movimientos, solo cuánto le das al sobre.
        </p>

        {error && <p className="mt-2 text-[12.5px] text-rojo">{error}</p>}

        <button
          type="button"
          onClick={guardar}
          disabled={!listo || pendiente}
          className="mt-4 h-12 w-full rounded-cta bg-verde text-[15px] font-semibold text-papel disabled:opacity-40"
        >
          {pendiente ? "Guardando…" : "Guardar monto"}
        </button>

        <p className="mt-3 text-center">
          <Link
            href={`/movimientos?categoria=${categoriaId}&mes=${mes.slice(0, 7)}`}
            className="hit-44 inline-block text-[13px] font-medium text-verde"
          >
            Ver los movimientos de {datos.nombre} →
          </Link>
        </p>
      </HojaInferior>
    </>
  );
}
