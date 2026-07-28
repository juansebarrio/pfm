"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, ChevronLeft, RotateCcw } from "lucide-react";
import {
  avisosDe,
  parsearRespuesta,
  repreguntas,
  sinAvisosRepetidos,
  type BloqueAsistente,
} from "@/lib/dominio/asistente";
import { Bloques } from "./Bloques";

// Asistente financiero.
//
// A propósito NO es un chat genérico. Dos decisiones que lo separan:
//
// 1. ABRE ÉL. Al entrar no hay pantalla en blanco ni "¿en qué te ayudo?": el
//    asistente ya tiene tus números, así que arranca leyéndolos. El pedido de
//    apertura lo pone el server (no viaja un mensaje falso del usuario) y por
//    eso esa respuesta no lleva pregunta arriba.
//
// 2. NO ESCRIBE PÁRRAFOS, COMPONE LA APP. Las respuestas traen marcadores que
//    se renderizan con los componentes reales — la cifra grande, la barra del
//    presupuesto. Ver lib/dominio/asistente.ts.
//
// El historial vive en memoria del cliente: recargás y se termina.

const MAX_HISTORIAL = 24;

/** Lo que se ofrece tocar cuando el modelo no propuso repreguntas propias. */
const REPREGUNTAS_BASE = [
  "¿En qué estoy gastando de más?",
  "¿Me conviene pagar el total de la tarjeta?",
];

type Mensaje = { rol: "usuario" | "asistente"; texto: string };

type Turno = {
  pregunta: string | null; // null = la apertura, que nadie escribió
  bloques: BloqueAsistente[];
  crudo: string;
};

export function Chat({ nombre }: { nombre: string }) {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [borrador, setBorrador] = useState("");
  const [pensando, setPensando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const finRef = useRef<HTMLDivElement>(null);
  const arrancado = useRef(false);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [turnos, pensando]);

  const preguntar = useCallback(
    async (texto: string | null) => {
      const limpio = texto?.trim() ?? null;
      if ((texto !== null && !limpio) || pensando) return;

      setError(null);
      setPensando(true);
      setBorrador("");

      // El server necesita SIEMPRE un último mensaje de usuario; en la apertura
      // lo reemplaza por su propio pedido, así que acá va un marcador cualquiera.
      const historial: Mensaje[] = [
        ...turnos.flatMap((t): Mensaje[] =>
          t.pregunta === null
            ? [{ rol: "asistente", texto: t.crudo }]
            : [
                { rol: "usuario", texto: t.pregunta },
                { rol: "asistente", texto: t.crudo },
              ],
        ),
        { rol: "usuario" as const, texto: limpio ?? "." },
      ].slice(-MAX_HISTORIAL);

      setTurnos((prev) => [...prev, { pregunta: limpio, bloques: [], crudo: "" }]);

      let acumulado = "";
      try {
        const respuesta = await fetch("/api/asistente", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensajes: historial, apertura: limpio === null }),
        });
        if (!respuesta.ok || !respuesta.body) {
          const detalle = await respuesta.text().catch(() => "");
          throw new Error(detalle || "sin respuesta");
        }

        const lector = respuesta.body.getReader();
        const decodificador = new TextDecoder();
        for (;;) {
          const { done, value } = await lector.read();
          if (done) break;
          acumulado += decodificador.decode(value, { stream: true });
          const actual = acumulado;
          setTurnos((prev) => {
            const copia = [...prev];
            copia[copia.length - 1] = {
              ...copia[copia.length - 1],
              crudo: actual,
              bloques: parsearRespuesta(actual, { parcial: true }),
            };
            return copia;
          });
        }
        if (acumulado.trim() === "") throw new Error("respuesta vacía");
        // cerrado el stream se re-parsea completo: la última línea ya cuenta
        setTurnos((prev) => {
          const copia = [...prev];
          copia[copia.length - 1] = {
            ...copia[copia.length - 1],
            bloques: parsearRespuesta(acumulado),
          };
          return copia;
        });
      } catch (e) {
        const detalle = e instanceof Error ? e.message : "";
        setError(
          detalle && detalle !== "sin respuesta" && detalle !== "respuesta vacía"
            ? detalle
            : "No pude responder. Fijate la conexión y probá de nuevo.",
        );
        // el turno sin respuesta se descarta: no dejamos un hueco vacío
        setTurnos((prev) => prev.slice(0, -1));
      } finally {
        setPensando(false);
      }
    },
    [pensando, turnos],
  );

  // la lectura de apertura, una sola vez
  useEffect(() => {
    if (arrancado.current) return;
    arrancado.current = true;
    void preguntar(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ultimo = turnos[turnos.length - 1];
  const propuestas = !pensando && ultimo ? repreguntas(ultimo.bloques) : [];
  const aOfrecer =
    propuestas.length > 0 ? propuestas : !pensando && ultimo ? REPREGUNTAS_BASE : [];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-2.5 pb-4">
        <Link href="/resumen" aria-label="Volver al resumen" className="hit-44 text-tinta">
          <ChevronLeft className="size-5" strokeWidth={1.5} aria-hidden />
        </Link>
        <div className="flex-1">
          <h1 className="text-[19px] font-semibold text-tinta">Tus números</h1>
          <p className="text-[12px] text-tinta-secundaria">Al día de hoy, {nombre}</p>
        </div>
        {turnos.length > 1 && !pensando && (
          <button
            type="button"
            aria-label="Empezar de nuevo"
            onClick={() => {
              setTurnos([]);
              arrancado.current = false;
              void preguntar(null);
            }}
            className="hit-44 text-tinta-secundaria"
          >
            <RotateCcw className="size-[17px]" strokeWidth={1.5} aria-hidden />
          </button>
        )}
      </header>

      <div className="flex flex-1 flex-col gap-[18px] pb-4">
        {turnos.map((t, i) => (
          <div key={i} className="flex flex-col gap-2.5">
            {/* la pregunta va como encabezado tenue, no como burbuja: lo que
                importa es la respuesta, no el ida y vuelta */}
            {t.pregunta && (
              <p className="text-[12.5px] font-semibold text-tinta-secundaria">
                {t.pregunta}
              </p>
            )}
            {t.bloques.length === 0 && pensando && i === turnos.length - 1 ? (
              <p className="text-[13.5px] text-tinta-terciaria">Mirando tus números…</p>
            ) : (
              <Bloques
                bloques={sinAvisosRepetidos(
                  t.bloques,
                  turnos.slice(0, i).flatMap((p) => avisosDe(p.bloques)),
                )}
              />
            )}
          </div>
        ))}

        {error && (
          <p role="alert" className="text-[12.5px] font-medium text-rojo">
            {error}
          </p>
        )}

        {aOfrecer.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {aOfrecer.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => preguntar(s)}
                className="rounded-chip border border-borde bg-superficie px-3 py-2 text-left text-[12.5px] text-tinta"
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <div ref={finRef} />
      </div>

      {/* input pegado abajo */}
      <div className="sticky bottom-0 -mx-5 mt-auto bg-papel px-5 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            preguntar(borrador);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            maxLength={2000}
            placeholder="Preguntá lo que quieras…"
            aria-label="Tu pregunta"
            className="h-11 min-w-0 flex-1 rounded-cta border border-borde bg-superficie px-3.5 text-[16px] text-tinta placeholder:text-tinta-terciaria"
          />
          <button
            type="submit"
            disabled={borrador.trim() === "" || pensando}
            aria-label="Enviar"
            className="flex size-11 shrink-0 items-center justify-center rounded-cta bg-verde text-papel disabled:opacity-50"
          >
            <ArrowUp className="size-5" strokeWidth={2} aria-hidden />
          </button>
        </form>
        <p className="mt-1.5 text-center text-[10.5px] text-tinta-terciaria">
          Orientación general con IA — no es asesoramiento financiero profesional.
        </p>
      </div>
    </div>
  );
}
