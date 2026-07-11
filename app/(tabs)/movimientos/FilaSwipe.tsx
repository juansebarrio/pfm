"use client";

import { useRef, useState } from "react";
import { Trash2 } from "lucide-react";
import { FilaMovimiento, type DatosFilaMovimiento } from "@/components/sistema/FilaMovimiento";

// Fila de movimiento con dos gestos (feature nueva, fuera del export):
//  · tap en el cuerpo → abre el detalle (onTap)
//  · swipe a la izquierda → revela el borrado (panel rojo); tap ahí confirma
// touch-action: pan-y deja el scroll vertical intacto; solo interceptamos el
// arrastre horizontal.

const ANCHO_BORRAR = 92; // px del panel de borrado revelado
const UMBRAL_ABRIR = 46; // arrastre mínimo para que quede abierto
const UMBRAL_TAP = 8; // por debajo, es un tap y no un arrastre

type Props = {
  datos: DatosFilaMovimiento;
  abierto: boolean;
  etiquetaBorrar: string; // "Borrar" | "Borrar compra"
  onAbrir: () => void;
  onCerrar: () => void;
  onTap: () => void;
  onBorrar: () => void;
};

export function FilaSwipe({
  datos,
  abierto,
  etiquetaBorrar,
  onAbrir,
  onCerrar,
  onTap,
  onBorrar,
}: Props) {
  const inicio = useRef<{ x: number; y: number } | null>(null);
  const [arrastre, setArrastre] = useState<number | null>(null); // px en vivo, null si no arrastra

  const base = abierto ? -ANCHO_BORRAR : 0;
  let x = base + (arrastre ?? 0);
  if (x > 0) x = 0;
  if (x < -ANCHO_BORRAR) x = -ANCHO_BORRAR;
  const desplazamiento = arrastre !== null ? x : base;

  function alBajar(e: React.PointerEvent) {
    inicio.current = { x: e.clientX, y: e.clientY };
  }

  function alMover(e: React.PointerEvent) {
    if (!inicio.current) return;
    const dx = e.clientX - inicio.current.x;
    const dy = e.clientY - inicio.current.y;
    if (arrastre === null) {
      // solo interceptamos si el gesto es claramente horizontal
      if (Math.abs(dx) > UMBRAL_TAP && Math.abs(dx) > Math.abs(dy)) {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // algunos entornos no permiten capturar el puntero: seguimos igual
        }
        setArrastre(dx);
      }
      return;
    }
    setArrastre(dx);
  }

  function alSoltar(e: React.PointerEvent) {
    const inic = inicio.current;
    inicio.current = null;
    if (arrastre === null) {
      // fue un tap: abrir detalle, o cerrar si estaba revelado
      if (!inic) return;
      const dx = Math.abs(e.clientX - inic.x);
      const dy = Math.abs(e.clientY - inic.y);
      if (dx < UMBRAL_TAP && dy < UMBRAL_TAP) {
        if (abierto) onCerrar();
        else onTap();
      }
      return;
    }
    const finalX = base + arrastre;
    setArrastre(null);
    if (finalX <= -UMBRAL_ABRIR) onAbrir();
    else onCerrar();
  }

  function alCancelar() {
    inicio.current = null;
    setArrastre(null);
  }

  return (
    <div className="relative overflow-hidden" style={{ touchAction: "pan-y" }}>
      {/* panel de borrado, detrás de la fila */}
      <button
        type="button"
        onClick={onBorrar}
        aria-label={etiquetaBorrar}
        tabIndex={abierto ? 0 : -1}
        className="absolute inset-y-0 right-0 flex items-center gap-1.5 bg-rojo px-4 text-[12.5px] font-semibold text-blanco"
        style={{ width: ANCHO_BORRAR }}
      >
        <Trash2 className="size-4" strokeWidth={1.8} aria-hidden />
        {etiquetaBorrar}
      </button>

      {/* fila en primer plano, se desliza sobre el panel */}
      <div
        onPointerDown={alBajar}
        onPointerMove={alMover}
        onPointerUp={alSoltar}
        onPointerCancel={alCancelar}
        className={`relative bg-superficie ${arrastre === null ? "transition-transform duration-200" : ""}`}
        style={{ transform: `translateX(${desplazamiento}px)` }}
      >
        <FilaMovimiento {...datos} />
      </div>
    </div>
  );
}
