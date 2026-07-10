"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { ArrowDownLeft, Inbox } from "lucide-react";
import { categorizarMovimiento } from "@/app/acciones/movimientos";
import { Chip } from "@/components/sistema/Chip";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import { Importe } from "@/components/sistema/Importe";

// Card "Bandeja de entrada" (05, §3.8): borde cálido único en el sistema,
// contador pill ámbar, y categorización en tanda: tocás un ítem, se abre
// inline (3 chips sugeridos + "todas →" con la grilla completa), asignás
// y pasa al historial sin salir — optimista, la fila desaparece al toque.

export type CategoriaChip = { id: string; nombre: string; icono: string };

export type ItemBandeja = {
  id: string;
  descripcion: string;
  importeCentavos: number;
  esIngreso: boolean;
  /** "hoy · Visa •• 4321" */
  meta: string;
  ambito: "hogar" | "personal";
};

type PorAmbito = { hogar: CategoriaChip[]; personal: CategoriaChip[] };

type Props = {
  items: ItemBandeja[];
  /** las 3 categorías más usadas, por ámbito */
  sugeridas: PorAmbito;
  /** todas las categorías, por ámbito, para la grilla completa */
  categorias: PorAmbito;
};

export function Bandeja({ items, sugeridas, categorias }: Props) {
  const router = useRouter();
  const [, iniciarTransicion] = useTransition();
  const [abiertoId, setAbiertoId] = useState<string | null>(null);
  const [grillaAbierta, setGrillaAbierta] = useState(false);
  const [ocultos, setOcultos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const visibles = items.filter((i) => !ocultos.includes(i.id));
  if (visibles.length === 0) return null;

  function alternar(id: string) {
    setAbiertoId((actual) => (actual === id ? null : id));
    setGrillaAbierta(false);
  }

  function categorizar(item: ItemBandeja, categoriaId: string) {
    // optimista: la fila desaparece de la bandeja al instante
    setOcultos((prev) => [...prev, item.id]);
    setAbiertoId(null);
    setGrillaAbierta(false);
    setError(null);
    iniciarTransicion(async () => {
      const resultado = await categorizarMovimiento({
        movimientoId: item.id,
        categoriaId,
      });
      if (!resultado.ok) {
        setOcultos((prev) => prev.filter((id) => id !== item.id));
        setError("No pudimos categorizar. Probá de nuevo.");
        return;
      }
      router.refresh(); // el ítem pasa al historial sin salir
    });
  }

  return (
    <section
      aria-label="Bandeja de entrada"
      className="rounded-card border border-borde-bandeja bg-superficie shadow-card"
    >
      <header className="flex items-center gap-2 px-3.5 pt-3 pb-1.5">
        <Inbox className="size-[15px] text-ambar" strokeWidth={1.5} aria-hidden />
        <h2 className="text-[13.5px] font-semibold text-tinta">Bandeja de entrada</h2>
        <span className="cifra ml-auto flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-ambar px-1.5 text-[11px] font-semibold text-blanco">
          {visibles.length}
        </span>
      </header>

      <div className="divide-y divide-separador">
        {visibles.map((item) => {
          const abierto = abiertoId === item.id;
          return (
            <div key={item.id}>
              <button
                type="button"
                onClick={() => alternar(item.id)}
                aria-expanded={abierto}
                className="flex w-full items-center gap-[11px] px-3.5 py-[9px] text-left"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-tinta">
                    {item.descripcion}
                  </p>
                  <p className="mt-0.5 truncate text-[11px] text-tinta-secundaria">
                    {item.meta}
                  </p>
                </div>
                {item.esIngreso && (
                  <ArrowDownLeft
                    className="size-[17px] text-verde"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                )}
                <Importe
                  centavos={item.importeCentavos}
                  variante="fila"
                  conSigno={item.esIngreso}
                  className={item.esIngreso ? "text-verde" : "text-tinta"}
                />
              </button>

              {abierto && (
                <div className="px-3.5 pb-3">
                  {!grillaAbierta ? (
                    <div className="flex flex-wrap gap-1.5">
                      {sugeridas[item.ambito].map((c) => (
                        <Chip
                          key={c.id}
                          escala="mini"
                          tonoSeleccion="verde"
                          onClick={() => categorizar(item, c.id)}
                          className="hit-44"
                        >
                          <IconoCategoria nombre={c.icono} className="size-[13px]" />
                          {c.nombre}
                        </Chip>
                      ))}
                      <Chip
                        escala="mini"
                        onClick={() => setGrillaAbierta(true)}
                        className="hit-44"
                      >
                        todas →<span className="sr-only"> ver todas las categorías</span>
                      </Chip>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-[7px]">
                      {categorias[item.ambito].map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => categorizar(item, c.id)}
                          className="flex flex-col items-center gap-1 rounded-cta border border-borde bg-superficie px-0.5 py-[9px]"
                        >
                          <IconoCategoria nombre={c.icono} />
                          <span className="w-full truncate text-center text-[10px] font-medium text-tinta">
                            {c.nombre}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p aria-live="polite" className={error ? "px-3.5 pb-2.5 text-[11px] text-rojo" : "sr-only"}>
        {error}
      </p>
    </section>
  );
}
