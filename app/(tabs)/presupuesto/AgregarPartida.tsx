"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import { agregarPartida } from "@/app/acciones/presupuesto";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import { centavosDesdeTexto } from "@/lib/dominio/dinero";

// Sumar una categoría a un mes YA armado — la que quedó afuera al armar o se
// creó después. Solo aparecen las que todavía no tienen partida en el mes.

export type CategoriaDisponible = { id: string; nombre: string; icono: string };

export function AgregarPartida({
  mes,
  ambito,
  categorias,
}: {
  mes: string;
  ambito: "hogar" | "personal";
  categorias: CategoriaDisponible[];
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState(false);
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [montoTexto, setMontoTexto] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, iniciar] = useTransition();

  // sin categorías libres no hay nada para sumar
  if (categorias.length === 0) return null;

  const montoCentavos = centavosDesdeTexto(montoTexto);
  const listo = categoriaId !== null && montoCentavos !== null && montoCentavos > 0;

  function abrir() {
    setCategoriaId(null);
    setMontoTexto("");
    setError(null);
    setAbierta(true);
  }

  function guardar() {
    if (!listo || pendiente || categoriaId === null || montoCentavos === null) return;
    setError(null);
    iniciar(async () => {
      const r = await agregarPartida({
        mes,
        ambito,
        categoriaId,
        asignadoCentavos: montoCentavos,
      });
      if (r.ok) {
        router.refresh();
        setAbierta(false);
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="hit-44 mx-auto mt-4 flex items-center gap-1.5 text-[13.5px] font-medium text-verde"
      >
        <Plus className="size-4" strokeWidth={2} aria-hidden />
        Sumar una partida a este mes
      </button>

      <HojaInferior
        abierta={abierta}
        onCerrar={() => setAbierta(false)}
        titulo="Sumar una partida"
      >
        <p className="text-[11.5px] text-tinta-secundaria">Categoría</p>
        <div className="mt-1.5 flex max-h-44 flex-wrap gap-1.5 overflow-y-auto">
          {categorias.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setCategoriaId(c.id)}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-medium ${
                categoriaId === c.id
                  ? "border-verde bg-verde-suave text-verde"
                  : "border-borde bg-papel text-tinta-secundaria"
              }`}
            >
              <IconoCategoria nombre={c.icono} className="size-3.5" />
              {c.nombre}
            </button>
          ))}
        </div>

        <p className="mt-4 text-[11.5px] text-tinta-secundaria">Monto del mes</p>
        <input
          type="text"
          inputMode="decimal"
          value={montoTexto}
          onChange={(e) => setMontoTexto(e.target.value)}
          placeholder="$ 0"
          aria-label="Monto asignado"
          aria-invalid={montoTexto !== "" && montoCentavos === null}
          className={`cifra mt-1.5 h-14 w-full rounded-cta border bg-papel px-3.5 text-[26px] font-semibold text-tinta placeholder:text-tinta-terciaria ${
            montoTexto !== "" && montoCentavos === null ? "border-rojo" : "border-borde"
          }`}
        />

        {error && <p className="mt-2 text-[12.5px] text-rojo">{error}</p>}

        <button
          type="button"
          onClick={guardar}
          disabled={!listo || pendiente}
          className="mt-4 h-12 w-full rounded-cta bg-verde text-[15px] font-semibold text-papel disabled:opacity-40"
        >
          {pendiente ? "Sumando…" : "Sumar la partida"}
        </button>
      </HojaInferior>
    </>
  );
}
