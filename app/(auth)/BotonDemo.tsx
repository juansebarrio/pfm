"use client";

import { useState, useTransition } from "react";
import { entrarDemo } from "./acciones";

// Botón para entrar a la demo sin credenciales. Solo se renderiza cuando
// NEXT_PUBLIC_DEMO está activa (producción); la acción valida igual del lado
// server, así que no depende solo de que el botón exista.
export function BotonDemo() {
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-6">
      <div className="mb-4 flex items-center gap-3">
        <span className="h-px flex-1 bg-borde" />
        <span className="text-[11.5px] text-tinta-secundaria">o probá sin cuenta</span>
        <span className="h-px flex-1 bg-borde" />
      </div>
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await entrarDemo();
            if (r?.error) setError(r.error);
          })
        }
        className="h-[50px] w-full rounded-cta border border-verde text-[15px] font-semibold text-verde disabled:opacity-60"
      >
        {pendiente ? "Entrando…" : "Ver demo de prueba"}
      </button>
      {error && (
        <p role="alert" className="mt-2 text-center text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}
      <p className="mt-2 text-center text-[11px] text-tinta-secundaria">
        Datos de ejemplo compartidos, solo para explorar.
      </p>
    </div>
  );
}
