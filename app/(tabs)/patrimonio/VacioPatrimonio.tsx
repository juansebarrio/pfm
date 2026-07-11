"use client";

import { useState } from "react";
import { ChartLine } from "lucide-react";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Chip } from "@/components/sistema/Chip";
import { EstadoVacio } from "@/components/sistema/EstadoVacio";
import { HojaTenencia } from "./HojaTenencia";
import type { Instrumento } from "./instrumentos";

// 08b — Patrimonio sin tenencias: estado vacío con CTA y tres chips de
// sugerencia que abren la hoja con ese instrumento preseleccionado.

const SUGERENCIAS: Array<{ instrumento: Instrumento; etiqueta: string }> = [
  { instrumento: "dolar_billete", etiqueta: "Dólar billete" },
  { instrumento: "plazo_fijo", etiqueta: "Plazo fijo" },
  { instrumento: "fci_money_market", etiqueta: "FCI" },
];

type Hoja = { sello: number; instrumento: Instrumento | null };

export function VacioPatrimonio() {
  const [hoja, setHoja] = useState<Hoja | null>(null);

  function abrir(instrumento: Instrumento | null) {
    setHoja((previa) => ({ sello: (previa?.sello ?? 0) + 1, instrumento }));
  }

  return (
    <div className="flex min-h-[55dvh] flex-col justify-center">
      <EstadoVacio
        Icono={ChartLine}
        titulo="Cargá tu primera tenencia"
        cuerpo="Anotá lo que tienen y actualizá la valuación cuando quieras. El total sale solo."
        cta={
          <BotonPrimario type="button" ancho="contenido" onClick={() => abrir(null)}>
            Cargar tenencia
          </BotonPrimario>
        }
        sugerencias={
          <>
            {SUGERENCIAS.map((s) => (
              <Chip key={s.instrumento} onClick={() => abrir(s.instrumento)}>
                {s.etiqueta}
              </Chip>
            ))}
          </>
        }
      />

      {hoja && (
        <HojaTenencia
          key={hoja.sello}
          abierta
          onCerrar={() => setHoja(null)}
          instrumentoInicial={hoja.instrumento}
        />
      )}
    </div>
  );
}
