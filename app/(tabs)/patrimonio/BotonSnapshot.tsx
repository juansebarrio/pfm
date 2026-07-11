"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { guardarSnapshot } from "@/app/acciones/patrimonio";

// Bloque final sobrio de 08: fila-link "Guardar foto del mes" con feedback
// "Guardada ✓". El registro automático mensual queda como fase siguiente.

export function BotonSnapshot() {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [guardada, setGuardada] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    if (pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await guardarSnapshot();
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      setGuardada(true);
      router.refresh();
    });
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={guardar}
        disabled={pendiente || guardada}
        className="hit-44 flex items-center gap-2 text-[13px] font-medium text-verde disabled:opacity-60"
      >
        <Camera className="size-[15px] shrink-0" strokeWidth={1.5} aria-hidden />
        <span role="status">
          {guardada ? "Guardada ✓" : pendiente ? "Guardando…" : "Guardar foto del mes"}
        </span>
      </button>
      {error && (
        <p role="alert" className="mt-1 text-[12px] font-medium text-rojo">
          {error}
        </p>
      )}
      <p className="mt-1 text-[11px] text-tinta-terciaria">
        El registro automático mensual llega en una próxima versión.
      </p>
    </div>
  );
}
