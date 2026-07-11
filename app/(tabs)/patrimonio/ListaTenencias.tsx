"use client";

import { useState } from "react";
import { Card } from "@/components/sistema/Card";
import { Importe } from "@/components/sistema/Importe";
import { formatearImporte } from "@/lib/dominio/dinero";
import { HojaTenencia, type TenenciaEditable } from "./HojaTenencia";

// Card "Tenencias" (08, DESIGN_AUDIT §3.27): filas con vocabulario de
// frescura; la vieja (>30 días) va en ámbar con "· actualizar". Tocar una
// fila abre la hoja en modo edición; el pie "Agregar tenencia →" (patrón
// §3.14) la abre vacía.

type Fila = TenenciaEditable & {
  valorArsCentavos: number;
  frescura: string;
  vieja: boolean;
};

type Hoja = { sello: number; tenencia: Fila | null };

export function ListaTenencias({ tenencias }: { tenencias: Fila[] }) {
  const [hoja, setHoja] = useState<Hoja | null>(null);

  function abrir(tenencia: Fila | null) {
    setHoja((previa) => ({ sello: (previa?.sello ?? 0) + 1, tenencia }));
  }

  return (
    <>
      <Card className="divide-y divide-separador">
        {tenencias.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => abrir(t)}
            className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
          >
            <span className="min-w-0">
              <span className="block truncate text-[13.5px] font-medium text-tinta">
                {t.nombre}
              </span>
              {t.moneda === "USD" && t.cantidadUsdCentavos != null ? (
                <span className="cifra mt-0.5 block text-[11px] text-tinta-secundaria">
                  {formatearImporte(t.cantidadUsdCentavos, "USD")}
                </span>
              ) : t.detalle ? (
                <span className="mt-0.5 block truncate text-[11px] text-tinta-secundaria">
                  {t.detalle}
                </span>
              ) : null}
            </span>
            <span className="shrink-0 text-right">
              <Importe
                centavos={t.valorArsCentavos}
                variante="fila-chica"
                className={`block ${t.vieja ? "text-ambar-texto" : "text-tinta"}`}
              />
              <span
                className={`cifra mt-0.5 block text-[10px] ${
                  t.vieja ? "text-ambar-texto" : "text-tinta-terciaria"
                }`}
              >
                {t.frescura}
                {t.vieja && <span className="font-medium text-verde"> · actualizar</span>}
              </span>
            </span>
          </button>
        ))}

        <button
          type="button"
          onClick={() => abrir(null)}
          className="w-full px-3.5 py-3 text-left text-[13.5px] font-medium text-verde"
        >
          Agregar tenencia →
        </button>
      </Card>

      {hoja && (
        <HojaTenencia
          key={hoja.sello}
          abierta
          onCerrar={() => setHoja(null)}
          tenencia={hoja.tenencia}
        />
      )}
    </>
  );
}
