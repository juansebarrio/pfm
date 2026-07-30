// Categorías del hogar (pushed, sin tab bar): listado agrupado y alta de
// categorías propias. Se llega desde /hogar.
//
// No hay borrado: la RLS no lo permite y es correcto — los movimientos
// referencian categorias con una FK sin cascade. Para dejar de usar una,
// se desactiva su partida en el presupuesto del mes.
import type { Metadata } from "next";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { categoriasDelHogar } from "@/lib/datos/movimientos";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { GRUPO_INGRESOS } from "@/lib/dominio/categorias";
import { AdminCategorias } from "./AdminCategorias";

export const metadata: Metadata = { title: "Categorías — Fin de mes" };

export default async function PaginaCategorias() {
  const sesion = await obtenerSesionHogar();
  const todas = await categoriasDelHogar(sesion);

  // los grupos de gasto que ya usa el hogar, para ofrecerlos al crear
  const gruposGasto = [
    ...new Set(todas.filter((c) => c.grupo !== GRUPO_INGRESOS).map((c) => c.grupo)),
  ].sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div className="px-5 pt-14 pb-10">
      <header className="flex items-center gap-2.5">
        <Link href="/hogar" aria-label="Volver a hogar" className="hit-44 text-tinta">
          <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
        </Link>
        <div>
          <h1 className="text-[19px] font-semibold text-tinta">Categorías</h1>
          <p className="text-[12px] text-tinta-secundaria">
            {todas.length} en total · las tuyas y las del hogar
          </p>
        </div>
      </header>

      <AdminCategorias categorias={todas} gruposGasto={gruposGasto} />
    </div>
  );
}
