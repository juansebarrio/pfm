"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeftRight, Camera, ChartLine, House, Plus, Wallet } from "lucide-react";

// El botón flotante es DOBLE: una pastilla partida al medio. Izquierda, la
// cámara: un comprobante que el asistente lee. Derecha, el +: el alta a mano de
// siempre. Las dos formas de cargar un movimiento tienen el mismo peso visual
// porque tienen el mismo peso real.
//
// Diferencia honesta con la app nativa: allá la cámara se abre sola al tocar.
// Acá lleva al asistente, donde el botón de cámara está a un toque, porque el
// navegador bloquea abrir el selector de archivos sin un gesto del usuario — y
// un botón que a veces no hace nada es peor que uno que te deja a un paso.

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
    null, // el hueco que deja lugar a la pastilla
    tabs[2],
    tabs[3],
  ];

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[430px] -translate-x-1/2 border-t border-borde pt-[9px] pb-[max(24px,env(safe-area-inset-bottom))] backdrop-blur-sm"
      style={{ background: "var(--tab-bar-fondo)" }}
    >
      {/* La pastilla flota ARRIBA de la barra, no dentro de una celda: es más
          ancha que una columna de la grilla y adentro le comería las etiquetas
          de Presupuesto y Movimientos. */}
      <div className="absolute -top-7 left-1/2 flex -translate-x-1/2 items-center rounded-full bg-verde text-papel shadow-fab">
        <Link
          href="/asistente"
          aria-label="Leer un comprobante con el asistente"
          className="flex h-[52px] w-[57px] items-center justify-center rounded-l-full active:opacity-70"
        >
          <Camera className="size-[22px]" strokeWidth={2} aria-hidden />
        </Link>
        {/* el divisor tiene que VERSE: es lo único que dice que son dos botones
            y no uno con dos dibujos */}
        <span aria-hidden className="h-[26px] w-px bg-black/30" />
        <Link
          href="/gasto/nuevo"
          aria-label="Cargar un movimiento a mano"
          className="flex h-[52px] w-[57px] items-center justify-center rounded-r-full active:opacity-70"
        >
          <Plus className="size-6" strokeWidth={2.4} aria-hidden />
        </Link>
      </div>

      <div className="grid grid-cols-5 px-[10px]">
        {posiciones.map((tab) =>
          tab === null ? (
            <div key="hueco" aria-hidden />
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
