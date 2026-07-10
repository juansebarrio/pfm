"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { formatearImporte } from "@/lib/dominio/dinero";

// Header de la pantalla de presupuesto (01a) + barra condensada de scroll (01b):
// chevrons de mes, "julio 2026" 600 17px, avatar 34px, segmented Hogar/Personal.
// Pasados ~120px de scroll aparece la barra fija "julio 2026 · Hogar / queda $ X"
// — "mes y disponible siempre a la vista" (DESIGN_AUDIT.md §3.17.5).

type Props = {
  /** "julio 2026" */
  mesTitulo: string;
  hrefMesAnterior: string;
  hrefMesSiguiente: string;
  /** inicial del miembro para el avatar (link a /hogar) */
  inicial: string;
  ambito: "hogar" | "personal";
  hrefHogar: string;
  hrefPersonal: string;
  /** disponible del mes para la barra condensada; null si no hay presupuesto */
  quedaCentavos: number | null;
};

const UMBRAL_SCROLL = 120;

export function EncabezadoPresupuesto(p: Props) {
  const [condensado, setCondensado] = useState(false);

  useEffect(() => {
    const alScrollear = () => setCondensado(window.scrollY > UMBRAL_SCROLL);
    alScrollear();
    window.addEventListener("scroll", alScrollear, { passive: true });
    return () => window.removeEventListener("scroll", alScrollear);
  }, []);

  const etiquetaAmbito = p.ambito === "hogar" ? "Hogar" : "Personal";

  return (
    <>
      <header className="flex items-center px-5 pt-14">
        <div className="flex items-center gap-2">
          <Link
            href={p.hrefMesAnterior}
            aria-label="Mes anterior"
            className="hit-44 text-tinta-secundaria"
          >
            <ChevronLeft className="size-[18px]" strokeWidth={1.5} aria-hidden />
          </Link>
          <h1 className="text-[17px] font-semibold text-tinta">{p.mesTitulo}</h1>
          <Link
            href={p.hrefMesSiguiente}
            aria-label="Mes siguiente"
            className="hit-44 text-tinta-secundaria"
          >
            <ChevronRight className="size-[18px]" strokeWidth={1.5} aria-hidden />
          </Link>
        </div>
        <div className="flex-1" />
        <Link
          href="/hogar"
          aria-label={`Hogar y perfil de ${p.inicial}`}
          className="hit-44 flex size-[34px] items-center justify-center rounded-full bg-tinta text-[14px] font-semibold text-papel"
        >
          {p.inicial}
        </Link>
      </header>

      <nav
        aria-label="Ámbito del presupuesto"
        className="mx-5 mt-4 grid grid-cols-2 rounded-[11px] bg-fondo-segmented p-[2px]"
      >
        <Link
          href={p.hrefHogar}
          aria-current={p.ambito === "hogar" ? "true" : undefined}
          className={`rounded-[9px] py-2 text-center text-[13px] ${
            p.ambito === "hogar"
              ? "bg-segmented-activo font-semibold text-tinta shadow-thumb"
              : "font-medium text-tinta-secundaria"
          }`}
        >
          Hogar
        </Link>
        <Link
          href={p.hrefPersonal}
          aria-current={p.ambito === "personal" ? "true" : undefined}
          className={`rounded-[9px] py-2 text-center text-[13px] ${
            p.ambito === "personal"
              ? "bg-segmented-activo font-semibold text-tinta shadow-thumb"
              : "font-medium text-tinta-secundaria"
          }`}
        >
          Personal
        </Link>
      </nav>

      {p.quedaCentavos !== null && (
        <div
          aria-hidden={!condensado}
          className={`fixed top-0 left-1/2 z-30 w-full max-w-[430px] -translate-x-1/2 border-b border-borde bg-papel px-5 pt-2 pb-[9px] transition-opacity duration-150 ${
            condensado ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
        >
          <div className="flex items-baseline justify-between">
            <p className="text-[14px] font-semibold text-tinta">
              {p.mesTitulo} · {etiquetaAmbito}
            </p>
            <p className="cifra text-[12px] font-semibold text-tinta">
              queda {formatearImporte(p.quedaCentavos)}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
