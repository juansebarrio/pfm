"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CreditCard, Mail } from "lucide-react";
import { aceptarSugerencia, descartarSugerencia } from "@/app/acciones/gmail";
import { Card } from "@/components/sistema/Card";
import { Chip } from "@/components/sistema/Chip";
import { EstadoVacio } from "@/components/sistema/EstadoVacio";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { Importe } from "@/components/sistema/Importe";
import type { CategoriaSimple, MedioDePago } from "@/lib/datos/movimientos";
import { nombreDeRemitente } from "@/lib/dominio/correo";
import { formatearDiaCorto } from "@/lib/dominio/fechas";

// Revisión de sugerencias: cada mail detectado se convierte en movimiento con
// un tap (elegís medio, ámbito y categoría) o se descarta. Optimistic UI: la
// fila desaparece al confirmar y router.refresh() reconcilia.

export type SugerenciaFila = {
  id: string;
  fecha: string;
  tipo: "gasto" | "ingreso";
  importeCentavos: number;
  comercio: string | null;
  remitente: string;
  ultimos4: string | null;
  tarjetaId: string | null;
};

type Props = {
  sugerencias: SugerenciaFila[];
  medios: MedioDePago[];
  categoriasHogar: CategoriaSimple[];
  categoriasPersonales: CategoriaSimple[];
};

type Ambito = "hogar" | "personal";

export function RevisionSugerencias({
  sugerencias,
  medios,
  categoriasHogar,
  categoriasPersonales,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [abierta, setAbierta] = useState<SugerenciaFila | null>(null);
  const [medioId, setMedioId] = useState<string | null>(null);
  const [ambito, setAmbito] = useState<Ambito>("hogar");
  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // qué fila se está procesando (para deshabilitarla) y errores fuera de la hoja
  const [procesando, setProcesando] = useState<string | null>(null);
  const [errorFila, setErrorFila] = useState<string | null>(null);

  const visibles = sugerencias.filter((s) => !ocultas.has(s.id));

  function abrir(s: SugerenciaFila) {
    // un ingreso entra a una cuenta; un gasto arranca en la tarjeta detectada
    const mediosValidos = s.tipo === "ingreso" ? medios.filter((m) => m.tipo === "cuenta") : medios;
    const detectado = s.tarjetaId && mediosValidos.find((m) => m.id === s.tarjetaId);
    setAbierta(s);
    setMedioId(detectado ? detectado.id : (mediosValidos[0]?.id ?? null));
    setAmbito("hogar");
    setCategoriaId(null);
    setError(null);
  }

  function ocultar(id: string) {
    setOcultas((prev) => new Set(prev).add(id));
  }

  function aceptar() {
    if (!abierta || !medioId || pendiente) return;
    const medio = medios.find((m) => m.id === medioId);
    if (!medio) return;
    setError(null);
    iniciar(async () => {
      const r = await aceptarSugerencia({
        sugerenciaId: abierta.id,
        medioTipo: medio.tipo,
        medioId: medio.id,
        categoriaId,
        ambito,
      });
      if (r.ok) {
        ocultar(abierta.id);
        setAbierta(null);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  function descartar(s: SugerenciaFila) {
    if (pendiente) return;
    setErrorFila(null);
    setProcesando(s.id);
    iniciar(async () => {
      const r = await descartarSugerencia({ sugerenciaId: s.id });
      if (r.ok) {
        ocultar(s.id);
        if (abierta?.id === s.id) setAbierta(null);
        router.refresh();
      } else {
        // el error se ve fuera de la hoja (la fila puede estar cerrada) y,
        // si la hoja está abierta sobre esta fila, también adentro
        setErrorFila(r.error);
        if (abierta?.id === s.id) setError(r.error);
      }
      setProcesando(null);
    });
  }

  if (visibles.length === 0) {
    return (
      <div className="mt-16">
        <EstadoVacio
          Icono={Mail}
          titulo="Nada para revisar"
          cuerpo="Cuando lleguen mails con consumos o transferencias, van a aparecer acá como sugerencias."
        />
      </div>
    );
  }

  const mediosDeLaHoja =
    abierta?.tipo === "ingreso" ? medios.filter((m) => m.tipo === "cuenta") : medios;
  const categorias = ambito === "hogar" ? categoriasHogar : categoriasPersonales;

  return (
    <>
      <p className="mt-3 text-[12.5px] text-tinta-secundaria">
        Detectadas en tu correo. Nada se suma al presupuesto sin tu ok.
      </p>

      {errorFila && (
        <p role="alert" className="mt-2 text-center text-[12px] font-medium text-rojo">
          {errorFila}
        </p>
      )}

      <Card className="mt-3 divide-y divide-separador">
        {visibles.map((s) => {
          const etiqueta = s.comercio ?? nombreDeRemitente(s.remitente);
          const enCurso = procesando === s.id;
          return (
            <div
              key={s.id}
              className={`flex items-center gap-3 px-3.5 py-3 ${enCurso ? "opacity-50" : ""}`}
            >
              <Mail
                className="size-[18px] shrink-0 text-tinta-secundaria"
                strokeWidth={1.5}
                aria-hidden
              />
              <button
                type="button"
                onClick={() => abrir(s)}
                disabled={enCurso}
                className="min-w-0 flex-1 text-left"
              >
                <p className="truncate text-[13.5px] font-medium text-tinta">{etiqueta}</p>
                <p className="mt-[3px] truncate text-[11px] text-tinta-secundaria">
                  {formatearDiaCorto(s.fecha)} · {nombreDeRemitente(s.remitente)}
                  {s.ultimos4 ? ` · •• ${s.ultimos4}` : ""}
                </p>
              </button>
              <div className="shrink-0 text-right">
                <Importe
                  centavos={s.importeCentavos}
                  variante="fila"
                  conSigno={s.tipo === "ingreso"}
                  className={s.tipo === "ingreso" ? "text-verde" : "text-tinta"}
                />
                <div className="mt-1 flex items-center justify-end gap-4">
                  <button
                    type="button"
                    onClick={() => descartar(s)}
                    disabled={enCurso || pendiente}
                    aria-label={`Descartar ${etiqueta}`}
                    className="hit-44 text-[11.5px] font-medium text-tinta-secundaria disabled:opacity-50"
                  >
                    Descartar
                  </button>
                  <button
                    type="button"
                    onClick={() => abrir(s)}
                    disabled={enCurso}
                    aria-label={`Agregar ${etiqueta}`}
                    className="hit-44 text-[11.5px] font-semibold text-verde disabled:opacity-50"
                  >
                    Agregar
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </Card>

      <HojaInferior
        abierta={abierta !== null}
        onCerrar={() => setAbierta(null)}
        titulo={abierta?.tipo === "ingreso" ? "Agregar ingreso" : "Agregar gasto"}
      >
        {abierta && (
          <div>
            <div className="flex items-baseline justify-between">
              <p className="min-w-0 flex-1 truncate pr-3 text-[14px] font-medium text-tinta">
                {abierta.comercio ?? nombreDeRemitente(abierta.remitente)}
              </p>
              <Importe centavos={abierta.importeCentavos} variante="card" />
            </div>
            <p className="mt-1 text-[11.5px] text-tinta-secundaria">
              {formatearDiaCorto(abierta.fecha)} · desde {nombreDeRemitente(abierta.remitente)}
            </p>

            {/* medio de pago (preseleccionado si el mail nombró la tarjeta) */}
            <p className="mt-4 text-[12px] text-tinta-secundaria">
              {abierta.tipo === "ingreso" ? "¿A qué cuenta entró?" : "¿Con qué lo pagaste?"}
            </p>
            {mediosDeLaHoja.length > 0 && (
              <div
                role="group"
                aria-label="Medio de pago"
                className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 py-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {mediosDeLaHoja.map((m) => (
                  <Chip
                    key={m.id}
                    escala="medio"
                    seleccionado={m.id === medioId}
                    onClick={() => setMedioId(m.id)}
                  >
                    {m.tipo === "tarjeta" && (
                      <CreditCard className="size-3.5" strokeWidth={1.5} aria-hidden />
                    )}
                    {m.etiqueta}
                  </Chip>
                ))}
              </div>
            )}

            {/* ámbito + categoría opcional (sin categoría → bandeja) */}
            <div className="mt-3 flex items-center justify-between">
              <p className="text-[12px] text-tinta-secundaria">Categoría · opcional</p>
              <div
                role="group"
                aria-label="Ámbito"
                className="flex rounded-chip-chico bg-fondo-segmented p-[2px]"
              >
                {(["hogar", "personal"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    aria-pressed={ambito === a}
                    onClick={() => {
                      setAmbito(a);
                      setCategoriaId(null);
                    }}
                    className={`rounded-[7px] px-3 py-[5px] text-[11.5px] transition-colors ${
                      ambito === a
                        ? "bg-segmented-activo font-semibold text-tinta shadow-thumb"
                        : "font-medium text-tinta-secundaria"
                    }`}
                  >
                    {a === "hogar" ? "Hogar" : "Personal"}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex max-h-[104px] flex-wrap gap-1.5 overflow-y-auto">
              {categorias.map((c) => (
                <Chip
                  key={c.id}
                  escala="mini"
                  tonoSeleccion="verde"
                  seleccionado={c.id === categoriaId}
                  onClick={() => setCategoriaId(c.id === categoriaId ? null : c.id)}
                >
                  {c.nombre}
                </Chip>
              ))}
            </div>

            {error && (
              <p role="alert" className="mt-3 text-center text-[12px] font-medium text-rojo">
                {error}
              </p>
            )}
            {mediosDeLaHoja.length === 0 ? (
              // sin medio válido (ej. un ingreso y solo hay tarjetas, o el hogar
              // todavía no cargó ninguna cuenta): salida clara en vez de un CTA muerto
              <Link
                href="/cuentas"
                className="mt-4 block w-full rounded-cta bg-verde py-[15px] text-center text-[15px] font-semibold text-papel"
              >
                {abierta.tipo === "ingreso"
                  ? "Creá una cuenta para agregarlo"
                  : "Creá una cuenta o tarjeta"}
              </Link>
            ) : (
              <button
                type="button"
                disabled={!medioId || pendiente}
                onClick={aceptar}
                className="mt-4 w-full rounded-cta bg-verde py-[15px] text-[15px] font-semibold text-papel disabled:opacity-60"
              >
                {pendiente ? "Agregando…" : "Agregar movimiento"}
              </button>
            )}
            <button
              type="button"
              disabled={pendiente}
              onClick={() => descartar(abierta)}
              className="mt-2 w-full py-2 text-center text-[13px] font-medium text-rojo"
            >
              Descartar sugerencia
            </button>
          </div>
        )}
      </HojaInferior>
    </>
  );
}
