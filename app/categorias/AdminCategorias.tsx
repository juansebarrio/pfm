"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Plus, X } from "lucide-react";
import { crearCategoria, editarCategoria } from "@/app/acciones/categorias";
import { Chip } from "@/components/sistema/Chip";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import type { CategoriaSimple } from "@/lib/datos/movimientos";
import {
  GRUPO_INGRESOS,
  GRUPO_OTROS,
  ICONOS_POR_TEMA,
} from "@/lib/dominio/categorias";

// Alta y edición de categorías. El formulario es uno solo: en modo "nueva" pide
// tipo y ámbito; en modo "editar" esos quedan fijos (cambiarlos movería
// movimientos ya cargados de un lado al otro).

type Modo = { tipo: "cerrado" } | { tipo: "nueva" } | { tipo: "editar"; c: CategoriaSimple };

export function AdminCategorias({
  categorias,
  gruposGasto,
}: {
  categorias: CategoriaSimple[];
  gruposGasto: string[];
}) {
  const [modo, setModo] = useState<Modo>({ tipo: "cerrado" });

  // agrupadas para el listado, con Ingresos siempre al final
  const grupos = [...new Set(categorias.map((c) => c.grupo))].sort((a, b) => {
    if (a === GRUPO_INGRESOS) return 1;
    if (b === GRUPO_INGRESOS) return -1;
    return a.localeCompare(b, "es");
  });

  return (
    <div className="mt-5">
      {modo.tipo === "cerrado" ? (
        <button
          type="button"
          onClick={() => setModo({ tipo: "nueva" })}
          className="flex w-full items-center justify-center gap-2 rounded-cta bg-verde py-3.5 text-[14.5px] font-semibold text-papel"
        >
          <Plus className="size-[18px]" strokeWidth={2} aria-hidden />
          Nueva categoría
        </button>
      ) : (
        <Formulario
          key={modo.tipo === "editar" ? modo.c.id : "nueva"}
          categoria={modo.tipo === "editar" ? modo.c : null}
          gruposGasto={gruposGasto}
          alCerrar={() => setModo({ tipo: "cerrado" })}
        />
      )}

      <div className="mt-6 flex flex-col gap-5">
        {grupos.map((grupo) => (
          <section key={grupo}>
            <h2 className="text-[11.5px] font-semibold tracking-[0.04em] text-tinta-secundaria uppercase">
              {grupo}
            </h2>
            <ul className="mt-2 divide-y divide-separador rounded-card border border-borde">
              {categorias
                .filter((c) => c.grupo === grupo)
                .map((c) => (
                  <li key={c.id} className="flex items-center gap-2.5 px-3.5 py-3">
                    <IconoCategoria nombre={c.icono} />
                    <span className="min-w-0 flex-1 truncate text-[14px] text-tinta">
                      {c.nombre}
                    </span>
                    {c.ambito === "personal" && (
                      <span className="shrink-0 text-[10px] tracking-[0.04em] text-tinta-terciaria uppercase">
                        personal
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setModo({ tipo: "editar", c })}
                      aria-label={`Editar ${c.nombre}`}
                      className="hit-44 shrink-0 text-tinta-secundaria"
                    >
                      <Pencil className="size-4" strokeWidth={1.5} aria-hidden />
                    </button>
                  </li>
                ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-6 text-[11.5px] leading-[1.5] text-tinta-terciaria">
        Las categorías no se borran: hay movimientos que las usan y borrarlas
        rompería tu historial. Para dejar de usar una, apagá su partida cuando
        armes el presupuesto del mes.
      </p>
    </div>
  );
}

function Formulario({
  categoria,
  gruposGasto,
  alCerrar,
}: {
  categoria: CategoriaSimple | null;
  gruposGasto: string[];
  alCerrar: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const editando = categoria !== null;

  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [icono, setIcono] = useState(categoria?.icono ?? "tag");
  const [esIngreso, setEsIngreso] = useState(categoria?.grupo === GRUPO_INGRESOS);
  const [ambito, setAmbito] = useState<"hogar" | "personal">(categoria?.ambito ?? "hogar");
  const [grupo, setGrupo] = useState(
    categoria && categoria.grupo !== GRUPO_INGRESOS ? categoria.grupo : GRUPO_OTROS,
  );
  const [error, setError] = useState<string | null>(null);

  function guardar() {
    if (pendiente) return;
    setError(null);
    const grupoFinal = esIngreso ? GRUPO_INGRESOS : grupo.trim() || GRUPO_OTROS;
    iniciar(async () => {
      const r = editando
        ? await editarCategoria({
            categoriaId: categoria.id,
            nombre,
            grupo: grupoFinal,
            icono,
          })
        : await crearCategoria({ nombre, grupo: grupoFinal, icono, ambito });
      if (r.ok) {
        router.refresh();
        alCerrar();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="rounded-card border border-borde p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-tinta">
          {editando ? `Editar ${categoria.nombre}` : "Nueva categoría"}
        </h2>
        <button
          type="button"
          onClick={alCerrar}
          aria-label="Cancelar"
          className="hit-44 text-tinta-secundaria"
        >
          <X className="size-[18px]" strokeWidth={2} aria-hidden />
        </button>
      </div>

      {/* tipo y ámbito solo al crear: cambiarlos después movería movimientos */}
      {!editando && (
        <>
          <div className="mt-3 flex rounded-cta bg-fondo-segmented p-[3px]">
            {[false, true].map((ing) => (
              <button
                key={String(ing)}
                type="button"
                aria-pressed={esIngreso === ing}
                onClick={() => setEsIngreso(ing)}
                className={`flex-1 rounded-[9px] py-2 text-[13px] transition-colors ${
                  esIngreso === ing
                    ? "bg-segmented-activo font-semibold text-tinta shadow-thumb"
                    : "font-medium text-tinta-secundaria"
                }`}
              >
                {ing ? "Para ingresos" : "Para gastos"}
              </button>
            ))}
          </div>

          <div className="mt-2 flex rounded-cta bg-fondo-segmented p-[3px]">
            {(["hogar", "personal"] as const).map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={ambito === a}
                onClick={() => setAmbito(a)}
                className={`flex-1 rounded-[9px] py-2 text-[13px] transition-colors ${
                  ambito === a
                    ? "bg-segmented-activo font-semibold text-tinta shadow-thumb"
                    : "font-medium text-tinta-secundaria"
                }`}
              >
                {a === "hogar" ? "Del hogar" : "Solo mía"}
              </button>
            ))}
          </div>
        </>
      )}

      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        maxLength={40}
        placeholder="Nombre (ej. Peluquería)"
        aria-label="Nombre de la categoría"
        className="mt-3 h-11 w-full rounded-cta border border-borde bg-superficie px-3.5 text-[16px] text-tinta placeholder:text-tinta-terciaria"
      />

      {/* el grupo ordena el presupuesto; las de ingreso no van al presupuesto */}
      {!esIngreso && (
        <div className="mt-3">
          <p className="text-[12px] text-tinta-secundaria">Grupo</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {[...new Set([...gruposGasto, GRUPO_OTROS])].map((g) => (
              <Chip
                key={g}
                escala="mini"
                seleccionado={grupo === g}
                tonoSeleccion="verde"
                onClick={() => setGrupo(g)}
              >
                {g}
              </Chip>
            ))}
          </div>
          <input
            type="text"
            value={grupo}
            onChange={(e) => setGrupo(e.target.value)}
            maxLength={40}
            placeholder="…o escribí un grupo nuevo"
            aria-label="Grupo de la categoría"
            className="mt-2 h-10 w-full rounded-cta border border-borde bg-superficie px-3.5 text-[14px] text-tinta placeholder:text-tinta-terciaria"
          />
        </div>
      )}

      <div className="mt-3">
        <p className="text-[12px] text-tinta-secundaria">Ícono</p>
        <div className="mt-1.5 flex flex-col gap-2">
          {ICONOS_POR_TEMA.map((tema) => (
            <div key={tema.tema} className="flex flex-wrap gap-1.5">
              {tema.iconos.map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={i}
                  aria-pressed={icono === i}
                  onClick={() => setIcono(i)}
                  className={`flex size-9 items-center justify-center rounded-cta border ${
                    icono === i
                      ? "border-[1.5px] border-verde bg-verde-suave"
                      : "border-borde bg-superficie"
                  }`}
                >
                  <IconoCategoria nombre={i} tono={icono === i ? "verde" : "normal"} />
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={pendiente || nombre.trim() === ""}
        onClick={guardar}
        className="mt-4 flex w-full items-center justify-center gap-2 rounded-cta bg-verde py-3.5 text-[14.5px] font-semibold text-papel disabled:opacity-40"
      >
        <Check className="size-[18px]" strokeWidth={2} aria-hidden />
        {pendiente ? "Guardando…" : editando ? "Guardar cambios" : "Crear categoría"}
      </button>
    </div>
  );
}
