"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Check, Inbox, TriangleAlert } from "lucide-react";
import { crearGasto } from "@/app/acciones/movimientos";
import { Chip } from "@/components/sistema/Chip";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import type { CategoriaSimple, MedioDePago } from "@/lib/datos/movimientos";
import { GRUPO_INGRESOS } from "@/lib/dominio/categorias";
import {
  altaDesdeComprobante,
  bloqueantes,
  elegirCategoria,
  elegirMedio,
  type CampoFaltante,
  type ComprobanteLeido,
} from "@/lib/dominio/comprobante";
import { centavosDesdeTexto, formatearImporte } from "@/lib/dominio/dinero";

// La tarjeta de confirmación de un comprobante leído.
//
// ES LA PIEZA DELICADA DE LA FEATURE, y el criterio con el que está hecha es
// uno solo: la foto propone, el usuario dispone. Nada se carga sin un toque
// explícito, aunque el modelo haya leído los seis campos perfectos. Un OCR que
// confunde un 8 con un 3 y carga solo es peor que no tener la feature.
//
// Todo lo leído es EDITABLE en el lugar. Lo que el modelo no leyó aparece como
// un campo pidiendo atención, no como un error.
//
// Sin categoría se puede cargar igual: eso es exactamente la bandeja de
// entrada, que ya existe para lo que entra sin clasificar.

type Estado =
  | { fase: "editando" }
  | { fase: "cargando" }
  | { fase: "cargado"; aBandeja: boolean }
  | { fase: "descartado" };

export function Comprobante({
  leido,
  medios,
  categorias,
  hoy,
}: {
  leido: ComprobanteLeido;
  medios: MedioDePago[];
  categorias: CategoriaSimple[];
  hoy: string;
}) {
  const [, iniciar] = useTransition();
  const [estado, setEstado] = useState<Estado>({ fase: "editando" });
  const [error, setError] = useState<string | null>(null);

  // el estado arranca con lo que el modelo leyó, ya resuelto contra los datos
  // reales del hogar: un nombre de tarjeta se vuelve el id de esa tarjeta
  const [comercio, setComercio] = useState(leido.comercio ?? "");
  const [montoTexto, setMontoTexto] = useState(
    leido.montoCentavos !== null ? formatearImporte(leido.montoCentavos) : "",
  );
  const [fecha, setFecha] = useState(leido.fecha ?? "");
  const [tipo, setTipo] = useState<"gasto" | "ingreso">(leido.tipo ?? "gasto");
  const [ambito, setAmbito] = useState<"hogar" | "personal">("hogar");
  const [medioId, setMedioId] = useState<string | null>(
    () =>
      elegirMedio(
        leido.medio,
        medios.map((m) => ({
          id: m.id,
          tipo: m.tipo,
          nombre: m.nombre,
          ultimos4: m.tipo === "tarjeta" ? m.ultimos4 : null,
        })),
      )?.id ?? null,
  );
  const [categoriaId, setCategoriaId] = useState<string | null>(
    () => elegirCategoria(leido.categoria, categorias)?.id ?? null,
  );

  const montoCentavos = centavosDesdeTexto(montoTexto);
  const esIngreso = tipo === "ingreso";
  // un ingreso entra a una cuenta: la base lo exige, así que no ofrecemos tarjetas
  const mediosPosibles = esIngreso ? medios.filter((m) => m.tipo === "cuenta") : medios;
  const medio = mediosPosibles.find((m) => m.id === medioId) ?? null;
  const deEsteAmbito = categorias.filter(
    (c) => c.ambito === ambito && (c.grupo === GRUPO_INGRESOS) === esIngreso,
  );
  const categoria = deEsteAmbito.find((c) => c.id === categoriaId) ?? null;

  const falta = bloqueantes({
    ...leido,
    montoCentavos,
    fecha: fecha || null,
    tipo,
    medio: medio ? medio.nombre : null,
  });

  function cargar() {
    if (estado.fase !== "editando" || falta.length > 0 || !medio || montoCentavos === null) {
      return;
    }
    setError(null);
    setEstado({ fase: "cargando" });
    const aBandeja = categoria === null;
    iniciar(async () => {
      const r = await crearGasto(
        altaDesdeComprobante({
          montoCentavos,
          fecha,
          tipo,
          medio: { id: medio.id, tipo: medio.tipo },
          categoriaId: categoria?.id ?? null,
          ambito,
          comercio: comercio.trim() || null,
        }),
      );
      if (r.ok) {
        setEstado({ fase: "cargado", aBandeja });
      } else {
        setError(r.error);
        setEstado({ fase: "editando" });
      }
    });
  }

  if (estado.fase === "descartado") {
    return (
      <p className="rounded-cta border border-borde px-3.5 py-3 text-[12.5px] text-tinta-secundaria">
        Descartaste esta lectura. Nada se cargó.
      </p>
    );
  }

  if (estado.fase === "cargado") {
    return (
      <div className="rounded-cta border border-verde bg-verde-suave px-3.5 py-3 lg:max-w-[480px]">
        <div className="flex items-center gap-2">
          {estado.aBandeja ? (
            <Inbox className="size-[17px] shrink-0 text-verde" strokeWidth={1.8} aria-hidden />
          ) : (
            <Check className="size-[17px] shrink-0 text-verde" strokeWidth={2.2} aria-hidden />
          )}
          <p className="text-[13.5px] font-semibold text-tinta">
            {estado.aBandeja ? "Fue a la bandeja de entrada" : "Cargado"}
          </p>
        </div>
        <p className="mt-1 text-[12.5px] leading-[1.5] text-tinta-secundaria">
          {comercio.trim() || (esIngreso ? "Ingreso" : "Gasto")} ·{" "}
          {montoCentavos !== null ? formatearImporte(montoCentavos) : ""}
          {estado.aBandeja ? " · te falta elegirle categoría" : ""}
        </p>
        <Link
          href="/movimientos"
          className="mt-2 inline-block text-[12.5px] font-medium text-verde underline underline-offset-2"
        >
          Ver en movimientos
        </Link>
      </div>
    );
  }

  const cargando = estado.fase === "cargando";

  return (
    <div className="rounded-card border border-borde p-3.5 lg:max-w-[480px]">
      <p className="text-[11.5px] tracking-[0.04em] text-tinta-secundaria uppercase">
        Lo que leí del comprobante
      </p>

      <input
        type="text"
        value={comercio}
        onChange={(e) => setComercio(e.target.value)}
        maxLength={80}
        placeholder="Comercio o concepto"
        aria-label="Comercio o concepto"
        className="mt-2 h-10 w-full rounded-cta border border-borde bg-superficie px-3 text-[15px] font-medium text-tinta placeholder:text-tinta-terciaria"
      />

      {/* el monto en la tipografía de cifra: es el dato que hay que revisar */}
      <input
        type="text"
        inputMode="decimal"
        value={montoTexto}
        onChange={(e) => setMontoTexto(e.target.value)}
        placeholder="$ 0"
        aria-label="Importe"
        aria-invalid={montoTexto !== "" && montoCentavos === null}
        className={`cifra mt-2 h-14 w-full rounded-cta border bg-superficie px-3 text-[28px] font-semibold text-tinta placeholder:text-tinta-terciaria ${
          montoTexto !== "" && montoCentavos === null ? "border-rojo" : "border-borde"
        }`}
      />
      {montoTexto !== "" && montoCentavos === null && (
        <p className="mt-1 text-[11.5px] text-rojo">
          No pude entender ese importe. Escribilo como $ 84.320.
        </p>
      )}

      <div className="mt-2.5 flex gap-2">
        <label className="min-w-0 flex-1">
          <span className="text-[11.5px] text-tinta-secundaria">Fecha</span>
          <input
            type="date"
            value={fecha}
            max={hoy}
            onChange={(e) => setFecha(e.target.value)}
            aria-label="Fecha del comprobante"
            className="mt-1 h-10 w-full rounded-cta border border-borde bg-superficie px-2.5 text-[13.5px] text-tinta"
          />
        </label>
        <div className="min-w-0 flex-1">
          <span className="text-[11.5px] text-tinta-secundaria">Tipo</span>
          <div className="mt-1 flex h-10 rounded-cta bg-fondo-segmented p-[3px]">
            {(["gasto", "ingreso"] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tipo === t}
                onClick={() => {
                  setTipo(t);
                  // cambiar de lado invalida lo elegido del otro lado
                  setCategoriaId(null);
                  if (t === "ingreso" && medio?.tipo === "tarjeta") setMedioId(null);
                }}
                className={`flex-1 rounded-[8px] text-[12.5px] transition-colors ${
                  tipo === t
                    ? "bg-segmented-activo font-semibold text-tinta shadow-thumb"
                    : "font-medium text-tinta-secundaria"
                }`}
              >
                {t === "gasto" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <Grupo etiqueta={esIngreso ? "Entra a" : "Se pagó con"} pendiente={falta.includes("medio")}>
        {mediosPosibles.map((m) => (
          <Chip
            key={m.id}
            escala="mini"
            seleccionado={medioId === m.id}
            tonoSeleccion="verde"
            onClick={() => setMedioId(m.id)}
          >
            {m.tipo === "tarjeta" ? m.etiqueta : m.nombre}
          </Chip>
        ))}
      </Grupo>

      <Grupo etiqueta="Ámbito">
        {(["hogar", "personal"] as const).map((a) => (
          <Chip
            key={a}
            escala="mini"
            seleccionado={ambito === a}
            tonoSeleccion="verde"
            onClick={() => {
              setAmbito(a);
              setCategoriaId(null); // las categorías son por ámbito
            }}
          >
            {a === "hogar" ? "Del hogar" : "Solo mío"}
          </Chip>
        ))}
      </Grupo>

      <div className="mt-3">
        <p className="text-[11.5px] text-tinta-secundaria">Categoría</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {deEsteAmbito.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categoriaId === c.id}
              onClick={() => setCategoriaId(categoriaId === c.id ? null : c.id)}
              className={`flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-[12px] ${
                categoriaId === c.id
                  ? "border-[1.5px] border-verde bg-verde-suave font-semibold text-tinta"
                  : "border-borde bg-superficie text-tinta"
              }`}
            >
              <IconoCategoria
                nombre={c.icono}
                tono={categoriaId === c.id ? "verde" : "normal"}
              />
              {c.nombre}
            </button>
          ))}
        </div>
        {categoria === null && (
          <p className="mt-1.5 flex items-start gap-1.5 text-[11.5px] leading-[1.5] text-tinta-secundaria">
            <Inbox className="mt-px size-[13px] shrink-0" strokeWidth={1.8} aria-hidden />
            Sin categoría va a la bandeja de entrada y la elegís después.
          </p>
        )}
      </div>

      {/* Lo que el comprobante dice y esta pantalla decide no hacer sola. */}
      {leido.cuotas !== null && (
        <div className="mt-3 flex items-start gap-2 rounded-cta border border-borde-estimada bg-fondo-estimada px-3 py-2.5">
          <TriangleAlert
            className="mt-px size-[15px] shrink-0 text-ambar-texto"
            strokeWidth={1.8}
            aria-hidden
          />
          <p className="text-[12px] leading-[1.5] text-ambar-texto">
            El comprobante dice {leido.cuotas} cuotas. Se carga como un solo
            movimiento por el total; si querés la serie, cargala desde Compras en
            cuotas.
          </p>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}

      <div className="mt-3.5 flex items-center gap-2">
        <button
          type="button"
          disabled={falta.length > 0 || cargando}
          onClick={cargar}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-cta bg-verde text-[14px] font-semibold text-papel disabled:opacity-40"
        >
          <Check className="size-[17px]" strokeWidth={2.2} aria-hidden />
          {cargando ? "Cargando…" : categoria ? "Cargar" : "Cargar a la bandeja"}
        </button>
        <button
          type="button"
          disabled={cargando}
          onClick={() => setEstado({ fase: "descartado" })}
          className="hit-44 shrink-0 px-2 text-[13px] font-medium text-tinta-secundaria"
        >
          Descartar
        </button>
      </div>

      {falta.length > 0 && (
        <p className="mt-2 text-center text-[11.5px] text-tinta-terciaria">
          Falta {listar(falta.map((c) => NOMBRE_CAMPO[c]))} para poder cargarlo.
        </p>
      )}
    </div>
  );
}

const NOMBRE_CAMPO: Record<CampoFaltante, string> = {
  monto: "el importe",
  fecha: "la fecha",
  tipo: "el tipo",
  medio: "con qué se pagó",
  // categoria nunca llega acá: no bloquea la carga (va a la bandeja)
  categoria: "la categoría",
};

/** "el importe", "el importe y la fecha", "el importe, la fecha y el medio". */
function listar(partes: string[]): string {
  if (partes.length <= 1) return partes[0] ?? "";
  return `${partes.slice(0, -1).join(", ")} y ${partes[partes.length - 1]}`;
}

function Grupo({
  etiqueta,
  pendiente = false,
  children,
}: {
  etiqueta: string;
  pendiente?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <p className="text-[11.5px] text-tinta-secundaria">
        {etiqueta}
        {pendiente && <span className="ml-1 text-ambar-texto">· elegí uno</span>}
      </p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
