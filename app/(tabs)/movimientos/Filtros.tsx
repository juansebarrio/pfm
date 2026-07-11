"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { Chip } from "@/components/sistema/Chip";
import { HojaInferior } from "@/components/sistema/HojaInferior";

// Búsqueda + fila de filtros de 05 (§3.15, chips de §3.6): los tres chips con
// chevron abren una hoja inferior con opciones; elegir setea searchParams y
// cierra. Hogar/Personal son toggle exclusivo (?ambito=). Todo el estado vive
// en la URL: el server filtra y esta fila solo la refleja.

export type Opcion = { valor: string; etiqueta: string };

type Props = {
  q: string;
  ambito: "hogar" | "personal" | null;
  medio: string | null;
  categoria: string | null;
  miembro: string | null;
  tipo: "gasto" | "ingreso" | null;
  medios: Opcion[];
  categorias: Opcion[];
  miembros: Opcion[];
};

type HojaAbierta = "medio" | "categoria" | "miembro" | "tipo" | null;

// Opciones fijas del filtro por tipo (gasto/ingreso). El historial ya excluye
// transferencias y pagos de resumen, así que acá solo estos dos.
const OPCIONES_TIPO: Opcion[] = [
  { valor: "gasto", etiqueta: "Solo gastos" },
  { valor: "ingreso", etiqueta: "Solo ingresos" },
];

export function Filtros({
  q,
  ambito,
  medio,
  categoria,
  miembro,
  tipo,
  medios,
  categorias,
  miembros,
}: Props) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const [texto, setTexto] = useState(q);
  const [hoja, setHoja] = useState<HojaAbierta>(null);

  // resincroniza el input cuando la búsqueda cambia desde afuera (back/forward,
  // tocar la tab Movimientos que vuelve a /movimientos sin q): sin esto el input
  // quedaba mostrando el término viejo aunque la lista ya no estuviera filtrada
  useEffect(() => {
    setTexto(q);
  }, [q]);

  function actualizar(cambios: Record<string, string | null>) {
    const siguientes = new URLSearchParams(parametros.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null || valor === "") siguientes.delete(clave);
      else siguientes.set(clave, valor);
    }
    const qs = siguientes.toString();
    router.replace(qs ? `${ruta}?${qs}` : ruta, { scroll: false });
  }

  const hojas = {
    medio: {
      titulo: "Cuenta",
      parametro: "medio",
      opciones: medios,
      actual: medio,
      todas: "Todas las cuentas",
    },
    categoria: {
      titulo: "Categoría",
      parametro: "categoria",
      opciones: categorias,
      actual: categoria,
      todas: "Todas las categorías",
    },
    miembro: {
      titulo: "Miembro",
      parametro: "miembro",
      opciones: miembros,
      actual: miembro,
      todas: "Todos los miembros",
    },
    tipo: {
      titulo: "Tipo",
      parametro: "tipo",
      opciones: OPCIONES_TIPO,
      actual: tipo,
      todas: "Gastos e ingresos",
    },
  } as const;
  const hojaActiva = hoja ? hojas[hoja] : null;

  function elegir(parametro: string, valor: string | null) {
    actualizar({ [parametro]: valor });
    setHoja(null);
  }

  const etiquetaDe = (opciones: Opcion[], valor: string | null, fallback: string) =>
    opciones.find((o) => o.valor === valor)?.etiqueta ?? fallback;

  return (
    <div>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          actualizar({ q: texto.trim() || null });
        }}
        className="relative"
      >
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-[15px] -translate-y-1/2 text-tinta-terciaria"
          strokeWidth={1.5}
          aria-hidden
        />
        <input
          type="search"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          enterKeyHint="search"
          placeholder="Buscar comercio o categoría"
          aria-label="Buscar comercio o categoría"
          className="w-full rounded-cta border border-borde bg-superficie py-[10px] pr-3 pl-[35px] text-[13px] text-tinta placeholder:text-tinta-terciaria"
        />
      </form>

      <div className="-mx-5 mt-2.5 flex gap-2 overflow-x-auto px-5 py-1 [mask-image:linear-gradient(to_right,#000_calc(100%_-_24px),transparent)] [scrollbar-width:none]">
        <Chip
          seleccionado={medio !== null}
          onClick={() => setHoja("medio")}
          className="hit-44"
        >
          {etiquetaDe(medios, medio, "Cuenta")}
          <ChevronDown className="size-3" strokeWidth={1.5} aria-hidden />
        </Chip>
        <Chip
          seleccionado={categoria !== null}
          onClick={() => setHoja("categoria")}
          className="hit-44"
        >
          {etiquetaDe(categorias, categoria, "Categoría")}
          <ChevronDown className="size-3" strokeWidth={1.5} aria-hidden />
        </Chip>
        <Chip
          seleccionado={miembro !== null}
          onClick={() => setHoja("miembro")}
          className="hit-44"
        >
          {etiquetaDe(miembros, miembro, "Miembro")}
          <ChevronDown className="size-3" strokeWidth={1.5} aria-hidden />
        </Chip>
        <Chip seleccionado={tipo !== null} onClick={() => setHoja("tipo")} className="hit-44">
          {etiquetaDe(OPCIONES_TIPO, tipo, "Tipo")}
          <ChevronDown className="size-3" strokeWidth={1.5} aria-hidden />
        </Chip>
        <Chip
          seleccionado={ambito === "hogar"}
          onClick={() => actualizar({ ambito: ambito === "hogar" ? null : "hogar" })}
          className="hit-44"
        >
          Hogar
        </Chip>
        <Chip
          seleccionado={ambito === "personal"}
          onClick={() => actualizar({ ambito: ambito === "personal" ? null : "personal" })}
          className="hit-44"
        >
          Personal
        </Chip>
      </div>

      <HojaInferior
        abierta={hoja !== null}
        onCerrar={() => setHoja(null)}
        titulo={hojaActiva?.titulo ?? ""}
      >
        {hojaActiva && (
          <ul className="max-h-[50vh] divide-y divide-separador overflow-y-auto">
            <li>
              <OpcionFila
                etiqueta={hojaActiva.todas}
                seleccionada={hojaActiva.actual === null}
                onElegir={() => elegir(hojaActiva.parametro, null)}
              />
            </li>
            {hojaActiva.opciones.map((opcion) => (
              <li key={opcion.valor}>
                <OpcionFila
                  etiqueta={opcion.etiqueta}
                  seleccionada={hojaActiva.actual === opcion.valor}
                  onElegir={() => elegir(hojaActiva.parametro, opcion.valor)}
                />
              </li>
            ))}
          </ul>
        )}
      </HojaInferior>
    </div>
  );
}

function OpcionFila({
  etiqueta,
  seleccionada,
  onElegir,
}: {
  etiqueta: string;
  seleccionada: boolean;
  onElegir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onElegir}
      aria-pressed={seleccionada}
      className={`flex w-full items-center justify-between py-3 text-left text-[14px] ${
        seleccionada ? "font-semibold text-verde" : "font-medium text-tinta"
      }`}
    >
      {etiqueta}
      {seleccionada && <Check className="size-4" strokeWidth={2} aria-hidden />}
    </button>
  );
}
