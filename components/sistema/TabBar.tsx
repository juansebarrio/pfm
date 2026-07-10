"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, ChartLine, House, Plus, Wallet } from "lucide-react";

const tabs = [
  { href: "/resumen", etiqueta: "Resumen", Icono: House },
  { href: "/presupuesto", etiqueta: "Presupuesto", Icono: Wallet },
  { href: "/movimientos", etiqueta: "Movimientos", Icono: ArrowLeftRight },
  { href: "/patrimonio", etiqueta: "Patrimonio", Icono: ChartLine },
] as const;

export function TabBar() {
  const rutaActual = usePathname();

  const posiciones = [
    tabs[0],
    tabs[1],
    null, // FAB central
    tabs[2],
    tabs[3],
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-borde pt-[9px] pb-[max(24px,env(safe-area-inset-bottom))] backdrop-blur-sm"
      style={{ background: "var(--tab-bar-fondo)" }}
    >
      <div className="grid grid-cols-5 px-[10px]">
        {posiciones.map((tab) =>
          tab === null ? (
            <div key="fab" className="flex justify-center">
              <Link
                href="/gasto/nuevo"
                aria-label="Cargar gasto"
                className="-mt-6 flex size-[52px] items-center justify-center rounded-full bg-verde text-papel shadow-fab"
              >
                <Plus className="size-6" strokeWidth={2} aria-hidden />
              </Link>
            </div>
          ) : (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={
                rutaActual.startsWith(tab.href) ? "page" : undefined
              }
              className={`flex flex-col items-center gap-[3px] py-1 text-[10px] ${
                rutaActual.startsWith(tab.href)
                  ? "font-semibold text-verde"
                  : "font-medium text-tinta-secundaria"
              }`}
            >
              <tab.Icono
                className="size-[21px]"
                strokeWidth={rutaActual.startsWith(tab.href) ? 1.8 : 1.5}
                aria-hidden
              />
              {tab.etiqueta}
            </Link>
          ),
        )}
      </div>
    </nav>
  );
}
