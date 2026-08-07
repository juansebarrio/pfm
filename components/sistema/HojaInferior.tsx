"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

// Hoja inferior (bottom sheet) del sistema: conciliación (06), alta de
// tenencia y carga de TC (08). <dialog> nativo: foco atrapado y Esc gratis.
//
// En escritorio (lg+) la MISMA hoja es un cajón lateral que entra desde la
// derecha, alto completo: una hoja que sube desde abajo es un gesto de
// pulgar, no de mouse. El eje de la animación cambia en globals.css.
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
    if (abierta) {
      // showModal solo si hace falta, pero la subida SIEMPRE: si la hoja se
      // reabre mientras el close() diferido del cierre anterior sigue pendiente,
      // el diálogo ya está open y saltear setVisible la dejaba abierta pero
      // abajo de la pantalla para siempre.
      if (!dialogo.open) dialogo.showModal();
      // dos frames: el primero pinta la hoja abajo, el segundo dispara la subida
      const raf = requestAnimationFrame(() =>
        requestAnimationFrame(() => setVisible(true)),
      );
      return () => cancelAnimationFrame(raf);
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
      className="hoja-inferior m-0 mx-auto mt-auto w-full max-w-[430px] rounded-t-[18px] border-t border-borde bg-superficie p-0 text-tinta backdrop:bg-tinta/40 lg:mx-0 lg:mt-0 lg:ml-auto lg:h-dvh lg:max-h-none lg:rounded-none lg:border-t-0 lg:border-l"
    >
      {/* En lg el interior es una columna de alto completo: el título y la X
          quedan fijos y el scroll vive en el cuerpo — si el contenido usa
          lg:mt-auto en su pie, los CTAs se pinean al fondo del cajón. */}
      <div className="px-5 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] lg:flex lg:h-full lg:flex-col lg:pt-5 lg:pb-6">
        <div aria-hidden className="mx-auto h-1 w-9 rounded-full bg-tinta-muda lg:hidden" />
        <div className="mt-3.5 flex items-center justify-between lg:mt-0 lg:shrink-0">
          <h2 className="text-[16px] font-semibold lg:text-[17px]">{titulo}</h2>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="hit-44 text-tinta-secundaria"
          >
            <X className="size-[22px]" strokeWidth={2} aria-hidden />
          </button>
        </div>
        <div className="mt-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto">{children}</div>
      </div>
    </dialog>
  );
}
