"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { NavegadorMes } from "@/components/sistema/NavegadorMes";
import { Solapas } from "@/components/sistema/Solapas";
import { formatearImporte } from "@/lib/dominio/dinero";

// Header de la pantalla de presupuesto (01a) + barra condensada de scroll (01b):
// título + avatar 34px, el navegador de mes, y el segmented Hogar/Personal.
// Pasados ~120px de scroll aparece la barra fija "julio 2026 · Hogar / queda $ X"
// — "mes y disponible siempre a la vista" (DESIGN_AUDIT.md §3.17.5).
//
// El cambio de mes usa el MISMO componente que Movimientos (NavegadorMes): antes
// eran dos chevrons pegados al título a la izquierda, y en la otra pantalla una
// fila centrada. Dos formas de hacer lo mismo en dos pantallas hermanas se leen
// como dos apps. De paso la pantalla gana un título, que no tenía: el mes hacía
// de título y por eso el mes no podía ir centrado como corresponde.

type Props = {
  /** "julio 2026", para la barra condensada */
  mesTitulo: string;
  /** aaaa-mm-01 */
  mes: string;
  mesActual: string;
  /** inicial del miembro para el avatar (link a /hogar) */
  inicial: string;
  ambito: "hogar" | "personal";
  hrefHogar: string;
  hrefPersonal: string;
  /** disponible del mes para la barra condensada; null si no hay presupuesto */
  quedaCentavos: number | null;
  vista: "partidas" | "categorias";
  /** aaaa-mm, solo si NO es el mes en curso (así el link queda limpio) */
  mesEnUrl?: string;
};

const UMBRAL_SCROLL = 120;

/** El link de una solapa conservando mes y ámbito. */
function hrefVista(p: Props, vista: string): string {
  const params = new URLSearchParams({ ambito: p.ambito });
  if (p.mesEnUrl) params.set("mes", p.mesEnUrl);
  if (vista !== "partidas") params.set("vista", vista);
  return `/presupuesto?${params.toString()}`;
}

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
      <header className="flex items-center justify-between px-5 pt-14">
        <h1 className="text-[22px] font-semibold text-tinta">Presupuesto</h1>
        <Link
          href="/hogar"
          aria-label={`Hogar y perfil de ${p.inicial}`}
          className="hit-44 flex size-[34px] items-center justify-center rounded-full bg-tinta text-[14px] font-semibold text-papel"
        >
          {p.inicial}
        </Link>
      </header>

      <div className="px-5">
        <NavegadorMes
          mes={p.mes}
          mesActual={p.mesActual}
          ruta="/presupuesto"
          otrosParametros={{
            ambito: p.ambito,
            ...(p.vista === "categorias" ? { vista: p.vista } : {}),
          }}
        />
      </div>

      <div className="px-5">
        <Solapas
          activa={p.vista}
          opciones={[
            { clave: "partidas", etiqueta: "Partidas", href: hrefVista(p, "partidas") },
            { clave: "categorias", etiqueta: "Por categoría", href: hrefVista(p, "categorias") },
          ]}
        />
      </div>

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
