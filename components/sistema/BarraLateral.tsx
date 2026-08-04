"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeftRight,
  CalendarDays,
  Camera,
  ChartLine,
  House,
  Plus,
  Sparkles,
  UsersRound,
  Wallet,
  type LucideIcon,
} from "lucide-react";

// La navegación de escritorio (lg+): columna fija a la izquierda que reemplaza
// a la TabBar y a la pastilla flotante. Mismos destinos, otro cuerpo: en una
// pantalla grande la mano no está abajo, está a la izquierda.
//
// Las dos formas de cargar viven arriba como botones con nombre (acá hay lugar
// para las palabras que la pastilla no tiene).

type ItemNav = { href: string; etiqueta: string; Icono: LucideIcon; tecla: string };

const SECCIONES: ItemNav[] = [
  { href: "/resumen", etiqueta: "Resumen", Icono: House, tecla: "r" },
  { href: "/presupuesto", etiqueta: "Presupuesto", Icono: Wallet, tecla: "p" },
  { href: "/movimientos", etiqueta: "Movimientos", Icono: ArrowLeftRight, tecla: "m" },
  { href: "/patrimonio", etiqueta: "Patrimonio", Icono: ChartLine, tecla: "t" },
];

const SECUNDARIAS: ItemNav[] = [
  { href: "/calendario", etiqueta: "Calendario", Icono: CalendarDays, tecla: "c" },
  { href: "/asistente", etiqueta: "Asistente", Icono: Sparkles, tecla: "a" },
  { href: "/hogar", etiqueta: "Tu hogar", Icono: UsersRound, tecla: "h" },
];

function Fila({
  href,
  etiqueta,
  Icono,
  tecla,
  activa,
}: ItemNav & { activa: boolean }) {
  return (
    <Link
      href={href}
      aria-current={activa ? "page" : undefined}
      className={`group flex items-center gap-3 rounded-[10px] px-3 py-2 text-[13.5px] transition-colors ${
        activa
          ? "bg-superficie font-semibold text-verde"
          : "font-medium text-tinta-secundaria hover:bg-superficie hover:text-tinta"
      }`}
    >
      <Icono className="size-[18px]" strokeWidth={activa ? 1.8 : 1.5} aria-hidden />
      <span className="flex-1">{etiqueta}</span>
      {/* la pista del atajo asoma al pasar el mouse: quien no usa teclado no
          tiene por qué mirarla */}
      <kbd
        aria-hidden
        className="cifra rounded-[5px] border border-borde px-1.5 py-px text-[10px] text-tinta-terciaria opacity-0 transition-opacity group-hover:opacity-100"
      >
        {tecla}
      </kbd>
    </Link>
  );
}

export function BarraLateral() {
  const rutaActual = usePathname();

  return (
    <aside
      aria-label="Navegación principal"
      className="fixed inset-y-0 left-0 z-40 hidden w-60 flex-col border-r border-borde bg-papel px-4 pt-7 pb-6 lg:flex"
    >
      <Link href="/resumen" className="flex items-center gap-2.5 px-2">
        <Image
          src="/iconos/icono-144.png"
          alt=""
          width={30}
          height={30}
          className="rounded-[8px]"
        />
        <span className="text-[17px] font-semibold text-tinta">Fin de mes</span>
      </Link>

      {/* cargar: las dos puertas, con nombre */}
      <div className="mt-6 flex flex-col gap-1.5">
        <Link
          href="/gasto/nuevo"
          title="Atajo: g"
          className="flex items-center justify-center gap-2 rounded-cta bg-verde px-3 py-2.5 text-[13.5px] font-semibold text-papel hover:bg-verde-hover"
        >
          <Plus className="size-[17px]" strokeWidth={2.2} aria-hidden />
          Cargar movimiento
        </Link>
        <Link
          href="/asistente"
          className="flex items-center justify-center gap-2 rounded-cta border border-borde px-3 py-2.5 text-[13.5px] font-medium text-tinta hover:bg-superficie"
        >
          <Camera className="size-[16px]" strokeWidth={1.8} aria-hidden />
          Leer comprobante
        </Link>
      </div>

      <nav className="mt-7 flex flex-col gap-0.5">
        {SECCIONES.map((s) => (
          <Fila key={s.href} {...s} activa={rutaActual.startsWith(s.href)} />
        ))}
      </nav>

      <div aria-hidden className="mx-3 my-4 h-px bg-separador" />

      <nav className="flex flex-col gap-0.5">
        {SECUNDARIAS.map((s) => (
          <Fila key={s.href} {...s} activa={rutaActual.startsWith(s.href)} />
        ))}
      </nav>
    </aside>
  );
}
