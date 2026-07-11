"use client";

import { CircleAlert } from "lucide-react";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { EstadoVacio } from "@/components/sistema/EstadoVacio";

// Estado de error global: honesto y sobrio, sin drama.
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col justify-center">
      <EstadoVacio
        Icono={CircleAlert}
        titulo="Algo salió mal"
        cuerpo="No es tu culpa: algo falló de nuestro lado. Probá de nuevo; si sigue, cerrá y volvé a abrir la app."
        cta={
          <BotonPrimario ancho="contenido" onClick={reset}>
            Reintentar
          </BotonPrimario>
        }
      />
    </div>
  );
}
