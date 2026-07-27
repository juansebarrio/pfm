"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, Sparkles } from "lucide-react";
import { Chip } from "@/components/sistema/Chip";

// Chat del asistente: historial en memoria del cliente (stateless en el
// server), respuesta en streaming leyendo el body por chunks. Nada se
// persiste: cerrás la pantalla y la conversación termina.

type Mensaje = { rol: "usuario" | "asistente"; texto: string };

const SUGERENCIAS = [
  "¿Cómo vengo este mes?",
  "¿En qué estoy gastando de más?",
  "¿Qué vence pronto?",
  "¿Me conviene pagar el total de la tarjeta?",
];

const MAX_HISTORIAL = 24;

export function Chat({ nombre }: { nombre: string }) {
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [borrador, setBorrador] = useState("");
  const [pensando, setPensando] = useState(false);
  const finRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [mensajes, pensando]);

  async function enviar(texto: string) {
    const limpio = texto.trim();
    if (!limpio || pensando) return;

    const historial: Mensaje[] = [
      ...mensajes.slice(-(MAX_HISTORIAL - 2)),
      { rol: "usuario", texto: limpio },
    ];
    setMensajes([...historial, { rol: "asistente", texto: "" }]);
    setBorrador("");
    setPensando(true);

    try {
      const respuesta = await fetch("/api/asistente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mensajes: historial }),
      });
      if (!respuesta.ok || !respuesta.body) {
        const detalle = await respuesta.text().catch(() => "");
        throw new Error(detalle || "sin respuesta");
      }

      const lector = respuesta.body.getReader();
      const decodificador = new TextDecoder();
      let acumulado = "";
      for (;;) {
        const { done, value } = await lector.read();
        if (done) break;
        acumulado += decodificador.decode(value, { stream: true });
        const textoActual = acumulado;
        setMensajes((prev) => {
          const copia = [...prev];
          copia[copia.length - 1] = { rol: "asistente", texto: textoActual };
          return copia;
        });
      }
      if (acumulado.trim() === "") throw new Error("respuesta vacía");
    } catch (e) {
      const texto =
        e instanceof Error && e.message && e.message !== "sin respuesta" && e.message !== "respuesta vacía"
          ? e.message
          : "No pude responder. Fijate la conexión y probá de nuevo.";
      setMensajes((prev) => {
        const copia = [...prev];
        copia[copia.length - 1] = { rol: "asistente", texto };
        return copia;
      });
    } finally {
      setPensando(false);
    }
  }

  const vacio = mensajes.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {vacio ? (
        /* estado inicial: saludo + preguntas sugeridas */
        <div className="flex flex-1 flex-col items-center justify-center pb-24 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-verde-suave">
            <Sparkles className="size-7 text-verde" strokeWidth={1.5} aria-hidden />
          </div>
          <h2 className="mt-5 text-[19px] font-semibold text-tinta">
            Hola, {nombre}
          </h2>
          <p className="mt-2.5 max-w-[280px] text-[13.5px] leading-[1.55] text-tinta-secundaria">
            Preguntame sobre tus números: veo tu presupuesto, tus tarjetas y tu
            patrimonio de este mes.
          </p>
          <div className="mt-6 flex max-w-[320px] flex-wrap justify-center gap-2">
            {SUGERENCIAS.map((s) => (
              <Chip key={s} escala="filtro" onClick={() => enviar(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        /* conversación */
        <div className="flex flex-1 flex-col gap-3 py-4">
          {mensajes.map((m, i) => (
            <div
              key={i}
              className={
                m.rol === "usuario"
                  ? "ml-auto max-w-[85%] rounded-cta rounded-br-[4px] bg-tinta px-3.5 py-2.5 text-[14px] leading-[1.5] text-papel"
                  : "mr-auto max-w-[90%] whitespace-pre-wrap rounded-cta rounded-bl-[4px] border border-borde bg-superficie px-3.5 py-2.5 text-[14px] leading-[1.55] text-tinta"
              }
            >
              {m.texto ||
                (pensando && i === mensajes.length - 1 ? (
                  <span className="text-tinta-terciaria">Pensando…</span>
                ) : (
                  ""
                ))}
            </div>
          ))}
          <div ref={finRef} />
        </div>
      )}

      {/* input pegado abajo */}
      <div className="sticky bottom-0 -mx-5 mt-auto bg-papel px-5 pt-2 pb-[max(16px,env(safe-area-inset-bottom))]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enviar(borrador);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            value={borrador}
            onChange={(e) => setBorrador(e.target.value)}
            maxLength={2000}
            placeholder="Preguntá sobre tus finanzas…"
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
