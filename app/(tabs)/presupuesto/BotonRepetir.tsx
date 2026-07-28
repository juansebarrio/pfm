"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { repetirPresupuesto } from "@/app/acciones/presupuesto";

// El camino de un toque para el mes nuevo: copiar el presupuesto anterior tal
// cual. Para ajustar montos antes está el armado a mano, que ya lo sugiere.

export function BotonRepetir({
  mes,
  ambito,
  etiquetaMes,
}: {
  mes: string;
  ambito: "hogar" | "personal";
  etiquetaMes: string;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 text-center">
      <button
        type="button"
        disabled={pendiente}
        onClick={() =>
          iniciar(async () => {
            const r = await repetirPresupuesto({ mes, ambito });
            if (r.ok) router.refresh();
            else setError(r.error);
          })
        }
        className="hit-44 text-[13px] font-medium text-verde underline underline-offset-2 disabled:opacity-60"
      >
        {pendiente ? "Copiando…" : `Repetir el presupuesto de ${etiquetaMes}`}
      </button>
      {error && <p className="mt-1.5 text-[12px] text-rojo">{error}</p>}
    </div>
  );
}
