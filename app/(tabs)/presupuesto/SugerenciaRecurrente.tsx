"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmarRecurrente } from "@/app/acciones/movimientos";

// Fila fantasma de recurrente sin movimiento este mes (v1): al final del grupo
// de su categoría, con la acción "Confirmar" en texto verde (§3.14 — lo
// secundario nunca es botón relleno). Nunca se autoinsertan: un tap confirma.

type Props = {
  recurrenteId: string;
  /** YYYY-MM-01 del mes visible */
  mes: string;
  descripcion: string;
  /** "vence el 18 jul · $ 45.000 sugerido" (lo arma el server) */
  detalle: string;
};

export function SugerenciaRecurrente({ recurrenteId, mes, descripcion, detalle }: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirmar = () => {
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await confirmarRecurrente({ recurrenteId, mes });
      if (!resultado.ok) {
        setError(resultado.error);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div
      className={`flex items-center gap-2.5 px-3.5 py-[11px] ${pendiente ? "opacity-60" : ""}`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-tinta-secundaria">
          {descripcion}
        </p>
        <p className="cifra mt-0.5 text-[11px] text-tinta-secundaria">{detalle}</p>
        {error && <p className="mt-0.5 text-[11px] font-medium text-rojo">{error}</p>}
      </div>
      <button
        type="button"
        onClick={confirmar}
        disabled={pendiente}
        aria-label={`Confirmar ${descripcion}`}
        className="hit-44 shrink-0 text-[12.5px] font-medium text-verde disabled:opacity-60"
      >
        Confirmar
      </button>
    </div>
  );
}
