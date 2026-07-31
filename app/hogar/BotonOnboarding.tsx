"use client";

import { useState } from "react";
import { ChevronRight, GraduationCap } from "lucide-react";
import { Card } from "@/components/sistema/Card";
import { Onboarding } from "@/components/sistema/Onboarding";

// La puerta de re-entrada al recorrido de bienvenida. Existe porque un
// onboarding que solo pasa una vez es un folleto que se tira: acá se vuelve
// cuando le prestás el teléfono a alguien o te olvidaste cómo era algo.

export function BotonOnboarding() {
  const [abierto, setAbierto] = useState(false);

  return (
    <>
      <Card className="mt-4">
        <button
          type="button"
          onClick={() => setAbierto(true)}
          className="flex w-full items-center gap-2.5 px-4 py-3.5 text-left"
        >
          <GraduationCap className="size-[17px] shrink-0 text-tinta" strokeWidth={1.5} aria-hidden />
          <div className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-tinta">
              Enseñame a utilizar la app
            </span>
            <span className="block text-[11.5px] text-tinta-secundaria">
              El recorrido de bienvenida, las veces que quieras
            </span>
          </div>
          <ChevronRight className="size-4 shrink-0 text-tinta-terciaria" strokeWidth={1.5} aria-hidden />
        </button>
      </Card>

      <Onboarding abierto={abierto} onCerrar={() => setAbierto(false)} />
    </>
  );
}
