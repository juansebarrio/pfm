"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Hoja inferior (bottom sheet) del sistema: conciliación (06), alta de
// tenencia y carga de TC (08). <dialog> nativo: foco atrapado y Esc gratis.
//
// La entrada y la salida están animadas: la hoja sube desde abajo y el fondo
// hace fade (.hoja-inferior en globals.css). El ciclo lo maneja el efecto de
// abajo: al abrir, showModal() y data-visible al frame siguiente para que la
// transición corra; al cerrar, se saca data-visible (la hoja baja) y el
// close() de verdad espera al fin de la transición. Antes aparecía de golpe,
// que en una hoja que viene "desde abajo" se siente como un golpe de verdad.

type Props = {
  abierta: boolean;
  onCerrar: () => void;
  titulo: string;
  children: React.ReactNode;
};

const DURACION_MS = 300; // = la transición de transform en globals.css

export function HojaInferior({ abierta, onCerrar, titulo, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const dialogo = ref.current;
    if (!dialogo) return;
    if (abierta && !dialogo.open) {
      dialogo.showModal();
      // dos frames: el primero pinta la hoja abajo, el segundo dispara la subida
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)));
    }
    if (!abierta && dialogo.open) {
      setVisible(false); // la hoja baja…
      const timer = setTimeout(() => dialogo.close(), DURACION_MS); // …y recién ahí se cierra
      return () => clearTimeout(timer);
    }
  }, [abierta]);

  return (
    <dialog
      ref={ref}
      data-visible={visible ? "true" : undefined}
      onClose={onCerrar}
      onCancel={(e) => {
        // Esc también sale por la animación, no de golpe
        e.preventDefault();
        onCerrar();
      }}
      onClick={(e) => {
        // clic en el backdrop cierra
        if (e.target === ref.current) onCerrar();
      }}
      className="hoja-inferior m-0 mt-auto w-full max-w-[430px] rounded-t-[18px] border-t border-borde bg-superficie p-0 text-tinta backdrop:bg-tinta/40"
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
