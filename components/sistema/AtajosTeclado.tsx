"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Atajos de teclado, pensados para el escritorio (aunque un iPad con teclado
// también los aprovecha). Una letra, sin modificadores, como los de Gmail o
// Linear: r/p/m/t para las secciones, g para cargar un gasto, "/" para buscar.
//
// No se activan escribiendo en un input ni con Cmd/Ctrl/Alt apretados: la
// única palabra reservada de verdad es la que el usuario está tipeando.

const DESTINOS: Record<string, string> = {
  r: "/resumen",
  p: "/presupuesto",
  m: "/movimientos",
  t: "/patrimonio",
  c: "/calendario",
  a: "/asistente",
  h: "/hogar",
  g: "/gasto/nuevo",
};

export function AtajosTeclado() {
  const router = useRouter();

  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const foco = document.activeElement;
      if (
        foco instanceof HTMLInputElement ||
        foco instanceof HTMLTextAreaElement ||
        foco instanceof HTMLSelectElement ||
        (foco instanceof HTMLElement && foco.isContentEditable)
      )
        return;
      // con un diálogo abierto, el teclado es del diálogo (Esc ya lo cierra)
      if (document.querySelector("dialog[open]")) return;

      if (e.key === "/") {
        e.preventDefault();
        const buscador = document.querySelector<HTMLInputElement>('input[type="search"]');
        if (buscador) buscador.focus();
        else router.push("/movimientos");
        return;
      }

      const destino = DESTINOS[e.key.toLowerCase()];
      if (destino) {
        e.preventDefault();
        router.push(destino);
      }
    }

    window.addEventListener("keydown", alTeclear);
    return () => window.removeEventListener("keydown", alTeclear);
  }, [router]);

  return null;
}
