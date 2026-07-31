import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// Página de soporte. App Store pide una URL de soporte que funcione; esta es
// pública igual que /privacidad (el middleware la deja pasar sin sesión).

export const metadata: Metadata = {
  title: "Soporte — Fin de mes",
  description: "Cómo pedir ayuda con Fin de mes.",
};

export default function Soporte() {
  return (
    <div className="mx-auto min-h-dvh max-w-[680px] px-5 py-8">
      <Link
        href="/resumen"
        className="hit-44 inline-flex items-center gap-1.5 text-[13px] text-tinta-secundaria"
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
        Volver
      </Link>

      <h1 className="mt-6 text-[26px] font-semibold text-tinta">Soporte</h1>

      <p className="mt-6 text-[15px] leading-[1.65] text-tinta">
        ¿Algo no funciona, un número no cierra o tenés una idea para mejorar la
        app? Escribinos y te respondemos a la brevedad.
      </p>

      <p className="mt-4 text-[15px] leading-[1.65] text-tinta">
        <a
          href="mailto:contacto@juansebarrio.com?subject=Fin%20de%20mes%20—%20soporte"
          className="font-medium text-verde underline underline-offset-2"
        >
          contacto@juansebarrio.com
        </a>
      </p>

      <p className="mt-6 text-[13.5px] leading-[1.65] text-tinta-secundaria">
        Si el problema es con un dato tuyo (un movimiento, una tarjeta, un
        cierre), contanos los pasos para verlo — sin mandar contraseñas ni
        datos de tarjetas reales. Para saber qué guardamos y cómo borrarlo,
        está la página de{" "}
        <Link href="/privacidad" className="text-verde underline underline-offset-2">
          privacidad
        </Link>
        .
      </p>
    </div>
  );
}
