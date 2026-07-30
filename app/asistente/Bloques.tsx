import { TriangleAlert } from "lucide-react";
import type { CategoriaSimple, MedioDePago } from "@/lib/datos/movimientos";
import type { BloqueAsistente, TonoDato } from "@/lib/dominio/asistente";
import { Comprobante } from "./Comprobante";

// Render de los bloques del asistente (ver lib/dominio/asistente.ts): la
// respuesta de la IA deja de ser texto y usa los componentes reales de la app.

const TINTA_TONO: Record<TonoDato, string> = {
  bien: "text-verde",
  atencion: "text-ambar-texto",
  mal: "text-rojo",
  neutro: "text-tinta",
};

export function Bloques({
  bloques,
  medios,
  categorias,
  hoy,
}: {
  bloques: BloqueAsistente[];
  medios: MedioDePago[];
  categorias: CategoriaSimple[];
  hoy: string;
}) {
  return (
    <div className="flex flex-col gap-2.5">
      {bloques.map((b, i) => {
        switch (b.tipo) {
          case "texto":
            return (
              <p key={i} className="text-[14px] leading-[1.6] whitespace-pre-wrap text-tinta">
                {b.texto}
              </p>
            );

          case "dato":
            return (
              <div key={i} className="rounded-cta border border-borde px-3.5 py-3">
                <p className="text-[11.5px] text-tinta-secundaria">{b.etiqueta}</p>
                <p className={`cifra mt-1 text-[26px] font-semibold ${TINTA_TONO[b.tono]}`}>
                  {b.valor}
                </p>
              </div>
            );

          case "partida":
            return (
              <div key={i} className="rounded-cta border border-borde px-3.5 py-3">
                <div className="flex items-baseline gap-2.5">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium text-tinta">
                    {b.nombre}
                  </span>
                  <span className="cifra shrink-0 text-[12.5px] font-semibold text-tinta">
                    {b.gastado}{" "}
                    <span className="font-normal text-tinta-secundaria">de {b.asignado}</span>
                  </span>
                </div>
                {b.progreso !== null && (
                  <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-pista">
                    <div
                      className={`h-full rounded-full ${
                        b.progreso >= 1
                          ? "bg-rojo"
                          : b.progreso > 0.85
                            ? "bg-ambar"
                            : "bg-verde"
                      }`}
                      style={{ width: `${Math.round(b.progreso * 100)}%` }}
                    />
                  </div>
                )}
              </div>
            );

          case "ojo":
            return (
              <div
                key={i}
                className="flex items-start gap-2 rounded-cta border border-borde-estimada bg-fondo-estimada px-3 py-2.5"
              >
                <TriangleAlert
                  className="mt-px size-[15px] shrink-0 text-ambar-texto"
                  strokeWidth={1.8}
                  aria-hidden
                />
                <p className="text-[12.5px] leading-[1.5] text-ambar-texto">{b.texto}</p>
              </div>
            );

          case "comprobante":
            return (
              <Comprobante
                key={i}
                leido={b.leido}
                medios={medios}
                categorias={categorias}
                hoy={hoy}
              />
            );

          // las repreguntas las muestra la pantalla abajo, como chips tocables
          case "luego":
            return null;
        }
      })}
    </div>
  );
}
