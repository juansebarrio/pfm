"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Chip } from "@/components/sistema/Chip";
import { HojaTipoCambio } from "./HojaTipoCambio";
import { FUENTES, etiquetaFuente, type FuenteTC } from "./instrumentos";

// Selector de fuente de TC (08): tocar otro chip navega ?tc=; tocar el chip
// ACTIVO abre la hoja para cargar el valor del día de esa fuente. Los chips
// sin valor cargado quedan deshabilitados.

type Props = {
  fuenteActiva: FuenteTC;
  cargadas: FuenteTC[];
  /** "MEP $ 1.470 · hoy 10 jul" (armada en el server) */
  leyenda: string | null;
};

export function SelectorTC({ fuenteActiva, cargadas, leyenda }: Props) {
  const router = useRouter();
  // sello > 0 = hoja abierta; se usa como key para remontarla limpia
  const [sello, setSello] = useState(0);

  return (
    <div className="mt-4">
      <div className="flex items-center gap-1.5" role="group" aria-label="Fuente del tipo de cambio">
        {FUENTES.map((fuente) => (
          <Chip
            key={fuente}
            escala="mini"
            seleccionado={fuente === fuenteActiva}
            disabled={fuente !== fuenteActiva && !cargadas.includes(fuente)}
            onClick={() =>
              fuente === fuenteActiva
                ? setSello((s) => s + 1)
                : router.push(`/patrimonio?tc=${fuente}`)
            }
            className="disabled:opacity-50"
          >
            {etiquetaFuente(fuente)}
          </Chip>
        ))}
      </div>

      {leyenda && (
        <p className="cifra mt-1.5 text-[10.5px] text-tinta-secundaria">{leyenda}</p>
      )}

      {sello > 0 && (
        <HojaTipoCambio
          key={sello}
          fuente={fuenteActiva}
          abierta
          onCerrar={() => setSello(0)}
        />
      )}
    </div>
  );
}
