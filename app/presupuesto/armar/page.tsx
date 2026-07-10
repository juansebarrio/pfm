// Pantalla 02 — Armado del presupuesto (modal de flujo, sin tab bar).
// Parte del mes anterior si existe (con flags fija/rollover) o de todas las
// categorías del ámbito en cero (primer uso, 01c → "Arrancamos de cero").
import Link from "next/link";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { obtenerPresupuestoMes } from "@/lib/datos/presupuesto";
import { categoriasDelHogar } from "@/lib/datos/movimientos";
import {
  formatearMesSolo,
  hoyBA,
  mesAnterior,
  mesDe,
  mesSiguiente,
} from "@/lib/dominio/fechas";
import { FormularioArmado, type PartidaArmado } from "./FormularioArmado";

type Props = {
  searchParams: Promise<{ mes?: string; ambito?: string }>;
};

export default async function ArmarPresupuesto({ searchParams }: Props) {
  const params = await searchParams;
  const mes =
    params.mes && /^\d{4}-\d{2}-01$/.test(params.mes)
      ? params.mes
      : mesSiguiente(mesDe(hoyBA()));
  const ambito = params.ambito === "personal" ? "personal" : "hogar";

  const sesion = await obtenerSesionHogar();

  const existente = await obtenerPresupuestoMes(sesion, mes, ambito);
  if (existente) redirect(`/presupuesto?mes=${mes}&ambito=${ambito}`);

  const mesPrevio = mesAnterior(mes);
  const anterior = await obtenerPresupuestoMes(sesion, mesPrevio, ambito);
  const categorias = (await categoriasDelHogar(sesion)).filter(
    (c) => c.ambito === ambito,
  );

  // Base: partidas del mes anterior en su orden; las categorías que no
  // estaban (nuevas o desactivadas aquel mes) van al final, apagadas en 0.
  let partidas: PartidaArmado[];
  if (anterior) {
    const previas = anterior.grupos.flatMap((g) => g.partidas);
    const idsPrevias = new Set(previas.map((p) => p.categoriaId));
    partidas = [
      ...previas.map((p) => ({
        categoriaId: p.categoriaId,
        nombre: p.nombre,
        asignadoAnteriorCentavos: p.asignadoCentavos,
        fija: p.fija,
        rollover: p.rollover,
        activaInicial: true,
      })),
      ...categorias
        .filter((c) => !idsPrevias.has(c.id))
        .map((c) => ({
          categoriaId: c.id,
          nombre: c.nombre,
          asignadoAnteriorCentavos: 0,
          fija: false,
          rollover: false,
          activaInicial: false,
        })),
    ];
  } else {
    partidas = categorias.map((c) => ({
      categoriaId: c.id,
      nombre: c.nombre,
      asignadoAnteriorCentavos: 0,
      fija: false,
      rollover: false,
      activaInicial: true,
    }));
  }

  const nombreMes = formatearMesSolo(mes);
  const nombreMesPrevio = formatearMesSolo(mesPrevio);

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="px-5 pt-14">
        <Link
          href="/presupuesto"
          aria-label="Cerrar"
          className="hit-44 inline-block"
        >
          <X className="size-[22px]" strokeWidth={1.5} aria-hidden />
        </Link>
        <h1 className="mt-2.5 text-[22px] font-semibold">
          Presupuesto de {nombreMes}
        </h1>
        <p className="mt-[3px] text-[13px] text-tinta-secundaria">
          {anterior ? `Partimos del de ${nombreMesPrevio}` : "Arrancamos de cero"}
        </p>
      </header>

      <FormularioArmado
        mes={mes}
        ambito={ambito}
        nombreMes={nombreMes}
        mesPrevioCorto={nombreMesPrevio.slice(0, 3)}
        hayAnterior={anterior !== null}
        partidas={partidas}
      />
    </div>
  );
}
