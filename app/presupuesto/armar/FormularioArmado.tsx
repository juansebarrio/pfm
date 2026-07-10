"use client";

// Formulario de armado del mes (02): ajuste general por inflación en vivo,
// filas con toggle + monto editable (§3.19–3.21) y footer sticky con total.
// Todo en centavos enteros; el ajuste trabaja en décimas de punto porcentual
// (25 = 2,5 %) y redondea a $ 25 (2.500 centavos), como el export.
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { armarPresupuesto } from "@/app/acciones/presupuesto";
import { formatearImporte } from "@/lib/dominio/dinero";
import { BotonPrimario } from "@/components/sistema/BotonPrimario";
import { Card } from "@/components/sistema/Card";
import { Importe } from "@/components/sistema/Importe";

export type PartidaArmado = {
  categoriaId: string;
  nombre: string;
  asignadoAnteriorCentavos: number;
  fija: boolean;
  rollover: boolean;
  activaInicial: boolean;
};

type Props = {
  mes: string; // YYYY-MM-01
  ambito: "hogar" | "personal";
  nombreMes: string; // "agosto"
  mesPrevioCorto: string; // "jul"
  hayAnterior: boolean;
  partidas: PartidaArmado[];
};

type EstadoFila = {
  activa: boolean;
  /** Monto editado a mano en centavos; null = sigue el ajuste general. */
  override: number | null;
  nota: string;
};

/** asignado × (1 + décimas/1000), redondeado a $ 25 — sin floats acumulados. */
function ajustar(asignadoCentavos: number, decimas: number): number {
  return (
    Math.round((asignadoCentavos * (1000 + decimas)) / 1000 / 2500) * 2500
  );
}

/** 25 → "2,5" · 120 → "12" · 0 → "0" */
function decimasATexto(decimas: number): string {
  const entero = Math.trunc(decimas / 10);
  const decimal = decimas % 10;
  return decimal === 0 ? String(entero) : `${entero},${decimal}`;
}

/** "2,5" → 25 · "2," → 20 · "" → 0 */
function textoADecimas(texto: string): number {
  const m = texto.match(/^(\d+)(?:,(\d)?)?$/);
  return m ? Number(m[1]) * 10 + Number(m[2] ?? 0) : 0;
}

export function FormularioArmado({
  mes,
  ambito,
  nombreMes,
  mesPrevioCorto,
  hayAnterior,
  partidas,
}: Props) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [decimas, setDecimas] = useState(hayAnterior ? 25 : 0);
  const [textoPct, setTextoPct] = useState(decimasATexto(hayAnterior ? 25 : 0));
  const [editandoPct, setEditandoPct] = useState(false);

  const [filas, setFilas] = useState<EstadoFila[]>(() =>
    partidas.map((p) => ({ activa: p.activaInicial, override: null, nota: "" })),
  );
  const [edicionMonto, setEdicionMonto] = useState<{
    indice: number;
    texto: string;
  } | null>(null);

  function montoFila(i: number): number {
    return (
      filas[i].override ?? ajustar(partidas[i].asignadoAnteriorCentavos, decimas)
    );
  }

  function actualizarFila(i: number, cambio: Partial<EstadoFila>) {
    setFilas((previas) =>
      previas.map((f, j) => (j === i ? { ...f, ...cambio } : f)),
    );
  }

  function cambiarPct(texto: string) {
    const limpio = texto.replace(/[^\d,]/g, "");
    if (!/^\d{0,3}(,\d?)?$/.test(limpio)) return;
    setTextoPct(limpio);
    setDecimas(textoADecimas(limpio));
  }

  function cerrarEdicionPct() {
    setEditandoPct(false);
    setTextoPct(decimasATexto(decimas));
  }

  /** "Copiar sin ajuste": ajuste 0 y se descartan los retoques manuales. */
  function copiarSinAjuste() {
    setDecimas(0);
    setTextoPct("0");
    setEditandoPct(false);
    setFilas((previas) => previas.map((f) => ({ ...f, override: null })));
  }

  function abrirEdicionMonto(i: number) {
    const pesos = Math.round(montoFila(i) / 100);
    setEdicionMonto({ indice: i, texto: pesos > 0 ? String(pesos) : "" });
  }

  function confirmarEdicionMonto() {
    if (!edicionMonto) return;
    const pesos = edicionMonto.texto === "" ? 0 : parseInt(edicionMonto.texto, 10);
    actualizarFila(edicionMonto.indice, { override: pesos * 100 });
    setEdicionMonto(null);
  }

  const indicesActivas = filas
    .map((f, i) => (f.activa ? i : -1))
    .filter((i) => i >= 0);
  const totalCentavos = indicesActivas.reduce((s, i) => s + montoFila(i), 0);
  const cantidadActivas = indicesActivas.length;

  function confirmar() {
    setError(null);
    const carga = {
      mes,
      ambito,
      partidas: partidas.map((p, i) => ({
        categoriaId: p.categoriaId,
        asignadoCentavos: filas[i].activa ? montoFila(i) : 0,
        activa: filas[i].activa,
        fija: p.fija,
        rollover: p.rollover,
        nota: !filas[i].activa && filas[i].nota.trim() ? filas[i].nota.trim() : null,
      })),
    };
    iniciarTransicion(async () => {
      const resultado = await armarPresupuesto(carga);
      if (resultado.ok) {
        router.push(`/presupuesto?mes=${mes}&ambito=${ambito}`);
      } else {
        setError(resultado.error);
      }
    });
  }

  return (
    <>
      <div className="flex-1 px-5 pb-5">
        {hayAnterior && (
          <Card className="mt-3.5 px-3.5 py-[13px]">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <h2 className="text-[13.5px] font-semibold">
                  Ajuste general por inflación
                </h2>
                <p className="mt-1 text-[11.5px] leading-[1.45] text-tinta-secundaria">
                  Se aplica a todas las partidas; después ajustá las que quieras
                  una por una.
                </p>
              </div>
              {editandoPct ? (
                <div className="flex flex-none items-center gap-2 rounded-chip border-[1.5px] border-tinta bg-papel px-3 py-[9px]">
                  <input
                    autoFocus
                    inputMode="decimal"
                    value={textoPct}
                    onChange={(e) => cambiarPct(e.target.value)}
                    onBlur={cerrarEdicionPct}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Escape") cerrarEdicionPct();
                    }}
                    aria-label="Porcentaje de ajuste por inflación"
                    className="cifra w-[58px] bg-transparent text-right text-[19px] font-semibold outline-none"
                  />
                  <span className="cifra text-[19px] font-semibold" aria-hidden>
                    %
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditandoPct(true)}
                  aria-label={`Editar ajuste por inflación, ahora ${decimasATexto(decimas)} por ciento`}
                  className="flex flex-none items-center gap-2 rounded-chip border-[1.5px] border-tinta bg-papel px-3 py-[9px]"
                >
                  <span className="cifra text-[19px] font-semibold">
                    {decimas > 0 ? "+ " : ""}
                    {decimasATexto(decimas)} %
                  </span>
                  <Pencil
                    className="size-[13px] text-tinta-secundaria"
                    strokeWidth={1.5}
                    aria-hidden
                  />
                </button>
              )}
            </div>
            <div className="mt-[9px] border-t border-separador pt-[9px]">
              <button
                type="button"
                onClick={copiarSinAjuste}
                className="hit-44 text-[12.5px] font-medium text-verde"
              >
                Copiar sin ajuste
              </button>
            </div>
          </Card>
        )}

        <Card className="mt-3.5 divide-y divide-separador">
          {partidas.map((p, i) => {
            const fila = filas[i];
            const monto = montoFila(i);
            const delta = monto - p.asignadoAnteriorCentavos;
            const editando = edicionMonto?.indice === i;
            return (
              <div
                key={p.categoriaId}
                className="flex items-center gap-[11px] px-3.5 py-[11px]"
              >
                <button
                  type="button"
                  role="switch"
                  aria-checked={fila.activa}
                  aria-label={`Partida ${p.nombre}`}
                  onClick={() => actualizarFila(i, { activa: !fila.activa })}
                  className={`hit-44 flex h-[22px] w-[38px] flex-none items-center rounded-full p-0.5 ${
                    fila.activa
                      ? "justify-end bg-verde"
                      : "justify-start bg-toggle-apagado"
                  }`}
                >
                  <span
                    aria-hidden
                    className="size-[18px] rounded-full bg-blanco"
                  />
                </button>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-[14px] font-medium ${
                      fila.activa ? "text-tinta" : "text-tinta-terciaria"
                    }`}
                  >
                    {p.nombre}
                  </p>
                  {fila.activa && p.asignadoAnteriorCentavos > 0 && (
                    <p className="cifra mt-0.5 text-[11px] text-tinta-terciaria line-through">
                      {mesPrevioCorto}{" "}
                      {formatearImporte(p.asignadoAnteriorCentavos)}
                    </p>
                  )}
                  {!fila.activa && (
                    <p className="mt-0.5 flex items-baseline gap-1 text-[11px] text-tinta-terciaria">
                      <span className="flex-none">desactivada este mes ·</span>
                      <input
                        value={fila.nota}
                        maxLength={120}
                        onChange={(e) =>
                          actualizarFila(i, { nota: e.target.value })
                        }
                        placeholder="agregá una nota"
                        aria-label={`Nota para ${p.nombre}`}
                        className="w-full min-w-0 bg-transparent text-[11px] text-tinta-terciaria outline-none placeholder:text-tinta-muda"
                      />
                    </p>
                  )}
                </div>

                <div className="text-right">
                  {!fila.activa ? (
                    <span className="cifra text-[14px] font-semibold text-tinta-deshabilitada">
                      $ 0
                    </span>
                  ) : editando ? (
                    <input
                      autoFocus
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={edicionMonto.texto}
                      onChange={(e) => {
                        const limpio = e.target.value.replace(/\D/g, "");
                        if (limpio.length <= 9)
                          setEdicionMonto({ indice: i, texto: limpio });
                      }}
                      onBlur={confirmarEdicionMonto}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") confirmarEdicionMonto();
                        if (e.key === "Escape") setEdicionMonto(null);
                      }}
                      aria-label={`Monto de ${p.nombre} en pesos`}
                      className="cifra w-[104px] border-b border-dashed border-tinta-muda bg-transparent pb-px text-right text-[14px] font-semibold outline-none"
                    />
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => abrirEdicionMonto(i)}
                        aria-label={`Editar monto de ${p.nombre}`}
                        className="hit-44 border-b border-dashed border-tinta-muda pb-px"
                      >
                        <Importe centavos={monto} variante="editable" />
                      </button>
                      {hayAnterior &&
                        p.asignadoAnteriorCentavos > 0 &&
                        delta !== 0 && (
                          <p className="cifra mt-0.5 text-[10.5px] text-tinta-secundaria">
                            {delta > 0 ? "+ " : "− "}
                            {formatearImporte(Math.abs(delta))}
                          </p>
                        )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      <div
        className="sticky bottom-0 mt-auto border-t border-borde px-5 pt-3 pb-[30px]"
        style={{ background: "var(--footer-fondo)" }}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-[11.5px] text-tinta-secundaria">
            Total {nombreMes} ·{" "}
            {cantidadActivas === 1
              ? "1 partida activa"
              : `${cantidadActivas} partidas activas`}
          </span>
          <span className="cifra text-[17px] font-semibold">
            {formatearImporte(totalCentavos)}
          </span>
        </div>
        {error && (
          <p role="alert" className="mt-2 text-[12.5px] font-medium text-rojo">
            {error}
          </p>
        )}
        <BotonPrimario
          className="mt-2.5"
          onClick={confirmar}
          disabled={pendiente || partidas.length === 0}
        >
          {pendiente ? "Confirmando…" : "Confirmar presupuesto"}
        </BotonPrimario>
      </div>
    </>
  );
}
