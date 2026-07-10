"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Hoja inferior (bottom sheet) del sistema: conciliación (06), alta de
// tenencia y carga de TC (08). <dialog> nativo: foco atrapado y Esc gratis.

type Props = {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
};

export function HojaInferior({ abierta, onCerrar, titulo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierta && !dialogo.open) dialogo.showModal();
    if (!abierta && dialogo.open) dialogo.close();
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      onClose={onCerrar}
      onClick={(e) => {
        // clic en el backdrop cierra
        if (e.target === ref.current) onCerrar();
      }}
      className="m-0 mt-auto w-full max-w-[430px] rounded-t-[18px] border-t border-borde bg-superficie p-0 text-tinta backdrop:bg-tinta/40 [&:not([open])]:hidden"
      style={{ marginInline: "auto" }}
    >
      <div className="px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))]">
        <div aria-hidden className="mx-auto h-1 w-9 rounded-full bg-tinta-muda" />
        <div className="mt-3.5 flex items-center justify-between">
          <h2 className="text-[16px] font-semibold">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="hit-44 text-tinta-secundaria"
          >
            <X className="size-[22px]" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </dialog>
  );
}
