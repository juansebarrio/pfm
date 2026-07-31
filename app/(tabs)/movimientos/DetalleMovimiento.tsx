"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Pencil, Trash2 } from "lucide-react";
import {
  actualizarFecha,
  actualizarMovimiento,
  actualizarNota,
} from "@/app/acciones/movimientos";
import { Badge } from "@/components/sistema/Badge";
import { Chip } from "@/components/sistema/Chip";
import { HojaInferior } from "@/components/sistema/HojaInferior";
import { IconoCategoria } from "@/components/sistema/IconoCategoria";
import { Importe } from "@/components/sistema/Importe";
import type { CategoriaSimple, MedioDePago, MovimientoLista } from "@/lib/datos/movimientos";
import { GRUPO_INGRESOS } from "@/lib/dominio/categorias";
import { centavosDesdeTexto, formatearImporte } from "@/lib/dominio/dinero";
import { formatearDiaLargo } from "@/lib/dominio/fechas";

// Detalle de un movimiento en hoja inferior (feature nueva). Muestra todo lo
// que hay, deja editar el comentario y ofrece el borrado; si es una cuota,
// aclara que borra la compra.
//
// "Editar" abre un formulario EN LA MISMA HOJA con descripción, importe,
// categoría, medio y ámbito — la fecha ya se editaba inline en la tabla. Para
// una cuota, el importe y el medio los define la serie, y lo demás se propaga
// a las hermanas: renombrar la cuota 3 y que las otras cinco digan lo viejo
// sería peor que no dejar editar.

const NOMBRE_TIPO: Record<MovimientoLista["tipo"], string | null> = {
  gasto: null, // es lo esperado, no hace falta rotularlo
  ingreso: "Ingreso",
  transferencia: "Transferencia",
  pago_resumen: "Pago de resumen",
};

function Fila({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3.5 py-3">
      <dt className="text-[12.5px] text-tinta-secundaria">{etiqueta}</dt>
      <dd className="min-w-0 truncate text-right text-[13.5px] font-medium text-tinta">
        {children}
      </dd>
    </div>
  );
}

export function DetalleMovimiento({
  movimiento,
  categorias = [],
  medios = [],
  onCerrar,
  onBorrar,
}: {
  movimiento: MovimientoLista | null;
  /** para el formulario de edición; sin ellos, el botón Editar no aparece */
  categorias?: CategoriaSimple[];
  medios?: MedioDePago[];
  onCerrar: () => void;
  onBorrar: () => void;
}) {
  const m = movimiento;
  const esIngreso = m?.tipo === "ingreso";
  const tipo = m ? NOMBRE_TIPO[m.tipo] : null;
  const [editando, setEditando] = useState(false);
  // el detalle puede abrirse con otro movimiento: la edición no sobrevive
  const editable =
    m !== null && (m.tipo === "gasto" || m.tipo === "ingreso") &&
    categorias.length > 0 && medios.length > 0;

  return (
    <HojaInferior
      abierta={m !== null}
      onCerrar={() => {
        setEditando(false);
        onCerrar();
      }}
      titulo={editando ? "Editar movimiento" : "Detalle del movimiento"}
    >
      {m && editando ? (
        <FormularioEdicion
          key={m.id}
          movimiento={m}
          categorias={categorias}
          medios={medios}
          onListo={() => {
            setEditando(false);
            onCerrar();
          }}
          onCancelar={() => setEditando(false)}
        />
      ) : m ? (
        <div>
          <div className="text-center">
            <Importe
              centavos={m.importeCentavos}
              variante="card"
              conSigno={esIngreso}
              className={esIngreso ? "text-verde" : "text-tinta"}
            />
            <p className="mt-1 text-[15px] font-medium text-tinta">{m.descripcion}</p>
          </div>

          <dl className="mt-4 divide-y divide-separador rounded-card border border-borde">
            <Fila etiqueta="Categoría">
              {m.categoria ? (
                <span className="inline-flex items-center gap-1.5">
                  <IconoCategoria nombre={m.categoria.icono} className="size-4" />
                  {m.categoria.nombre}
                </span>
              ) : (
                <span className="text-tinta-secundaria">Sin categorizar</span>
              )}
            </Fila>
            {m.medio && <Fila etiqueta="Medio">{m.medio}</Fila>}
            <Fila etiqueta="Fecha">
              {m.esCuota ? (
                formatearDiaLargo(m.fecha)
              ) : (
                <EditorFecha key={m.id} movimientoId={m.id} fechaInicial={m.fecha} />
              )}
            </Fila>
            <Fila etiqueta="Ámbito">
              <Badge variante={m.visibilidad === "compartido" ? "hogar" : "personal"}>
                {m.visibilidad === "compartido" ? "hogar" : "personal"}
              </Badge>
            </Fila>
            {m.cierreCiclo && (
              <Fila etiqueta="Ciclo">
                <span className="text-ambar-texto">{m.cierreCiclo}</span>
              </Fila>
            )}
            {m.esCuota && m.nCuota && m.nCuotasTotal && (
              <Fila etiqueta="Cuota">
                <Badge variante="cuota">{`Cuota ${m.nCuota}/${m.nCuotasTotal}`}</Badge>
              </Fila>
            )}
            {tipo && <Fila etiqueta="Tipo">{tipo}</Fila>}
          </dl>

          {/* comentario editable; key por movimiento para resetear el borrador */}
          <EditorNota key={m.id} movimientoId={m.id} notaInicial={m.nota} />

          {m.esCuota && (
            <p className="mt-2.5 text-[11.5px] leading-[1.5] text-tinta-secundaria">
              Es una cuota de una compra. Borrar acá elimina la compra completa
              {m.nCuotasTotal ? ` (${m.nCuotasTotal} cuotas)` : ""}.
            </p>
          )}

          {editable && (
            <button
              type="button"
              onClick={() => setEditando(true)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-cta bg-verde py-3.5 text-[14px] font-semibold text-papel"
            >
              <Pencil className="size-4" strokeWidth={1.8} aria-hidden />
              {m.esCuota ? "Editar la compra" : "Editar movimiento"}
            </button>
          )}

          <button
            type="button"
            onClick={onBorrar}
            className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-cta border border-rojo py-3.5 text-[14px] font-semibold text-rojo"
          >
            <Trash2 className="size-4" strokeWidth={1.8} aria-hidden />
            {m.esCuota && m.nCuotasTotal
              ? `Borrar la compra · ${m.nCuotasTotal} cuotas`
              : "Borrar movimiento"}
          </button>
        </div>
      ) : null}
    </HojaInferior>
  );
}

/**
 * El formulario de edición, dentro de la hoja. Mismos controles que la
 * confirmación de un comprobante: son la misma tarea (revisar los campos de un
 * movimiento) y verse igual es lo que los hace aprenderse una sola vez.
 */
function FormularioEdicion({
  movimiento: m,
  categorias,
  medios,
  onListo,
  onCancelar,
}: {
  movimiento: MovimientoLista;
  categorias: CategoriaSimple[];
  medios: MedioDePago[];
  onListo: () => void;
  onCancelar: () => void;
}) {
  const router = useRouter();
  const [pendiente, iniciar] = useTransition();
  const esIngreso = m.tipo === "ingreso";

  const [descripcion, setDescripcion] = useState(m.descripcion);
  const [montoTexto, setMontoTexto] = useState(formatearImporte(m.importeCentavos));
  const [categoriaId, setCategoriaId] = useState<string | null>(m.categoria?.id ?? null);
  const [medioId, setMedioId] = useState<string | null>(m.medioId);
  const [ambito, setAmbito] = useState<"hogar" | "personal">(
    m.visibilidad === "compartido" ? "hogar" : "personal",
  );
  const [error, setError] = useState<string | null>(null);

  const montoCentavos = centavosDesdeTexto(montoTexto);
  // un ingreso entra a una cuenta; una cuota no cambia de medio ni de importe
  const mediosPosibles = esIngreso ? medios.filter((x) => x.tipo === "cuenta") : medios;
  const medio = mediosPosibles.find((x) => x.id === medioId) ?? null;
  const deEsteAmbito = categorias.filter(
    (c) => c.ambito === ambito && (c.grupo === GRUPO_INGRESOS) === esIngreso,
  );
  const listo =
    descripcion.trim() !== "" && montoCentavos !== null && montoCentavos > 0 && medio !== null;

  function guardar() {
    if (!listo || pendiente || !medio) return;
    setError(null);
    iniciar(async () => {
      const r = await actualizarMovimiento({
        movimientoId: m.id,
        descripcion: descripcion.trim(),
        importeCentavos: montoCentavos,
        categoriaId: deEsteAmbito.some((c) => c.id === categoriaId) ? categoriaId : null,
        medioTipo: medio.tipo,
        medioId: medio.id,
        ambito,
      });
      if (r.ok) {
        router.refresh();
        onListo();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div>
      <input
        type="text"
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        maxLength={80}
        placeholder="Comercio o concepto"
        aria-label="Comercio o concepto"
        className="h-11 w-full rounded-cta border border-borde bg-papel px-3.5 text-[15px] font-medium text-tinta placeholder:text-tinta-terciaria"
      />

      <input
        type="text"
        inputMode="decimal"
        value={montoTexto}
        onChange={(e) => setMontoTexto(e.target.value)}
        disabled={m.esCuota}
        aria-label="Importe"
        aria-invalid={montoTexto !== "" && montoCentavos === null}
        className={`cifra mt-2.5 h-14 w-full rounded-cta border bg-papel px-3.5 text-[26px] font-semibold text-tinta disabled:opacity-50 ${
          montoTexto !== "" && montoCentavos === null ? "border-rojo" : "border-borde"
        }`}
      />

      {!m.esCuota && (
        <div className="mt-3">
          <p className="text-[11.5px] text-tinta-secundaria">
            {esIngreso ? "Entra a" : "Se pagó con"}
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {mediosPosibles.map((x) => (
              <Chip
                key={x.id}
                escala="mini"
                seleccionado={medioId === x.id}
                tonoSeleccion="verde"
                onClick={() => setMedioId(x.id)}
              >
                {x.tipo === "tarjeta" ? x.etiqueta : x.nombre}
              </Chip>
            ))}
          </div>
        </div>
      )}

      <div className="mt-3">
        <p className="text-[11.5px] text-tinta-secundaria">Ámbito</p>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
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
        </div>
      </div>

      <div className="mt-3">
        <p className="text-[11.5px] text-tinta-secundaria">Categoría</p>
        <div className="mt-1.5 flex max-h-40 flex-wrap gap-1.5 overflow-y-auto">
          {deEsteAmbito.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={categoriaId === c.id}
              onClick={() => setCategoriaId(categoriaId === c.id ? null : c.id)}
              className={`flex items-center gap-1.5 rounded-chip border px-2.5 py-1.5 text-[12px] ${
                categoriaId === c.id
                  ? "border-[1.5px] border-verde bg-verde-suave font-semibold text-tinta"
                  : "border-borde bg-papel text-tinta"
              }`}
            >
              <IconoCategoria nombre={c.icono} tono={categoriaId === c.id ? "verde" : "normal"} />
              {c.nombre}
            </button>
          ))}
        </div>
        {categoriaId === null && (
          <p className="mt-1.5 text-[11.5px] text-tinta-secundaria">
            Sin categoría vuelve a la bandeja de entrada.
          </p>
        )}
      </div>

      {m.esCuota && (
        <p className="mt-3 text-[11.5px] leading-[1.5] text-tinta-secundaria">
          Es una cuota: el importe y el medio los maneja la compra. Lo que cambies
          acá se aplica a las {m.nCuotasTotal ?? ""} cuotas.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-3 text-[12.5px] font-medium text-rojo">
          {error}
        </p>
      )}

      <div className="mt-4 flex items-center gap-2">
        <button
          type="button"
          disabled={!listo || pendiente}
          onClick={guardar}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-cta bg-verde text-[14px] font-semibold text-papel disabled:opacity-40"
        >
          <Check className="size-[17px]" strokeWidth={2.2} aria-hidden />
          {pendiente ? "Guardando…" : "Guardar cambios"}
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={onCancelar}
          className="hit-44 shrink-0 px-2 text-[13px] font-medium text-tinta-secundaria"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

// Campo de comentario del detalle: mismo input que el alta rápida. El botón
// "Guardar" aparece solo cuando el texto difiere de lo guardado; al confirmar
// muestra "Guardado ✓" y refresca la lista de fondo.
/**
 * La fecha se edita acá mismo y se guarda al elegirla — cambiarla a un día de
 * otro mes es "arrastrar" el movimiento a ese mes. Si es de tarjeta, el server
 * le reasigna el ciclo que corresponde.
 */
function EditorFecha({
  movimientoId,
  fechaInicial,
}: {
  movimientoId: string;
  fechaInicial: string;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [fecha, setFecha] = useState(fechaInicial);
  const [error, setError] = useState(false);

  function guardar(nueva: string) {
    if (!nueva || nueva === fecha || pendiente) return;
    const anterior = fecha;
    setFecha(nueva); // optimista: el input ya muestra la fecha nueva
    setError(false);
    iniciarTransicion(async () => {
      const r = await actualizarFecha({ movimientoId, fecha: nueva });
      if (r.ok) {
        router.refresh();
      } else {
        setFecha(anterior);
        setError(true);
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {error && <span className="text-[11px] text-rojo">no se pudo</span>}
      <input
        type="date"
        value={fecha}
        onChange={(e) => guardar(e.target.value)}
        aria-label="Fecha del movimiento"
        className="bg-transparent text-right text-[13.5px] font-medium text-tinta [color-scheme:inherit]"
      />
    </span>
  );
}

function EditorNota({
  movimientoId,
  notaInicial,
}: {
  movimientoId: string;
  notaInicial: string | null;
}) {
  const router = useRouter();
  const [pendiente, iniciarTransicion] = useTransition();
  const [texto, setTexto] = useState(notaInicial ?? "");
  const [guardada, setGuardada] = useState(notaInicial ?? "");
  const [confirmado, setConfirmado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cambio = texto.trim() !== guardada.trim();

  function guardar() {
    if (!cambio || pendiente) return;
    setError(null);
    iniciarTransicion(async () => {
      const r = await actualizarNota({ movimientoId, nota: texto.trim() });
      if (r.ok) {
        setGuardada(texto);
        setConfirmado(true);
        setTimeout(() => setConfirmado(false), 2000);
        router.refresh();
      } else {
        setError(r.error);
      }
    });
  }

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          maxLength={200}
          placeholder="Comentario (opcional)"
          aria-label="Comentario del movimiento"
          className="h-11 min-w-0 flex-1 rounded-cta border border-borde bg-superficie px-3.5 text-[16px] text-tinta placeholder:text-tinta-terciaria"
        />
        {(cambio || confirmado) && (
          <button
            type="button"
            onClick={guardar}
            disabled={pendiente || !cambio}
            className="hit-44 shrink-0 text-[13px] font-semibold text-verde disabled:opacity-60"
          >
            {pendiente ? "Guardando…" : confirmado ? "Guardado ✓" : "Guardar"}
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-1.5 text-[12px] font-medium text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
