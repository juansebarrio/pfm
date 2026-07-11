// Pantalla 06 — Tarjeta, ciclo actual (pushed, sin tab bar).
// La pantalla diferencial argentina: timeline del ciclo con cierre y
// vencimiento estimados (punteado ámbar) o confirmados, resumen proyectado
// con desglose y conciliación de un solo campo, pago del resumen (jamás
// computa como gasto) y los consumos del ciclo.
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, ChevronRight, CreditCard } from "lucide-react";
import { Badge } from "@/components/sistema/Badge";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { Importe } from "@/components/sistema/Importe";
import { categoriasDelHogar, mediosDePago } from "@/lib/datos/movimientos";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { detalleCiclo, obtenerTarjeta } from "@/lib/datos/tarjetas";
import { formatearImporte } from "@/lib/dominio/dinero";
import { diasEntre, etiquetaDia, formatearDiaCorto, hoyBA } from "@/lib/dominio/fechas";
import { diferenciaConciliacion } from "@/lib/dominio/tarjetas";
import { BotonVolver } from "./BotonVolver";
import { Conciliacion } from "./Conciliacion";
import { ConfirmarFecha } from "./ConfirmarFecha";
import { ImpuestosEditable } from "./ImpuestosEditable";
import { ListaConsumos, type FilaConsumo } from "./ListaConsumos";
import { PagoResumen } from "./PagoResumen";
import { indiceCicloVigente, sumarDias } from "./datos";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ciclo?: string }>;
};

export default async function DetalleTarjeta({ params, searchParams }: Props) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const sesion = await obtenerSesionHogar();
  const tarjeta = await obtenerTarjeta(sesion, id);
  if (!tarjeta) notFound();

  const titulo = (
    <header className="flex items-center gap-2.5">
      <BotonVolver />
      <CreditCard className="size-[18px] shrink-0 text-tinta" strokeWidth={1.5} aria-hidden />
      <h1 className="min-w-0 flex-1 truncate text-[17px] font-semibold text-tinta">
        {tarjeta.nombre} <span className="cifra">•• {tarjeta.ultimos4}</span>
      </h1>
    </header>
  );

  if (tarjeta.ciclos.length === 0) {
    return (
      <div className="px-5 pt-14 pb-10">
        {titulo}
        <Card className="mt-4 px-3.5 py-3">
          <p className="text-[13px] text-tinta-secundaria">
            Todavía no hay ciclos para esta tarjeta.
          </p>
        </Card>
      </div>
    );
  }

  const hoy = hoyBA();

  // Ciclo seleccionado: ?ciclo=<id> o el vigente (abierto más próximo)
  const indiceVigente = indiceCicloVigente(tarjeta.ciclos, hoy);
  const indiceElegido = sp.ciclo
    ? tarjeta.ciclos.findIndex((c) => c.id === sp.ciclo)
    : -1;
  const indice = indiceElegido >= 0 ? indiceElegido : indiceVigente;
  const ciclo = tarjeta.ciclos[indice];
  const esVigente = indice === indiceVigente;
  const anterior = indice > 0 ? tarjeta.ciclos[indice - 1] : null;
  const siguiente = indice < tarjeta.ciclos.length - 1 ? tarjeta.ciclos[indice + 1] : null;

  const [detalle, medios, categorias] = await Promise.all([
    detalleCiclo(sesion, ciclo.id, tarjeta.impuestosEstimadosCentavos),
    mediosDePago(sesion),
    categoriasDelHogar(sesion),
  ]);
  const cuentas = medios
    .filter((m) => m.tipo === "cuenta")
    .map((m) => ({ id: m.id, etiqueta: m.etiqueta }));

  // Geometría del timeline (§3.23): inicio = día después del cierre anterior
  // (o cierre − 30 días si es el primer ciclo); posiciones proporcionales.
  const inicio =
    anterior !== null ? sumarDias(anterior.fechaCierre, 1) : sumarDias(ciclo.fechaCierre, -30);
  const totalDias = Math.max(1, diasEntre(inicio, ciclo.fechaVencimiento));
  const progreso = Math.min(1, Math.max(0, diasEntre(inicio, hoy) / totalDias));
  const posCierre = Math.min(1, Math.max(0, diasEntre(inicio, ciclo.fechaCierre) / totalDias));
  const enCurso = hoy >= inicio && hoy <= ciclo.fechaVencimiento;

  const estimado = ciclo.estadoFechas === "estimado";
  const badgeFechas = estimado ? "estimada" : "confirmada";
  // hito estimado: punteado ámbar ("todavía no es un hecho"); confirmado: sólido
  const claseNodoHito = estimado
    ? "border-[1.5px] border-dashed border-borde-estimada bg-fondo-estimada"
    : "border-[1.5px] border-tinta bg-superficie";

  // Conciliación / pago
  const realCentavos = ciclo.totalRealCentavos;
  const dif =
    ciclo.estado === "conciliado" && realCentavos !== null
      ? diferenciaConciliacion(realCentavos, detalle.proyectadoCentavos)
      : null;
  const mostrarConciliar = esVigente || ciclo.fechaCierre <= hoy;
  const mostrarPago =
    ciclo.estado !== "abierto" ||
    ciclo.fechaCierre <= hoy ||
    (esVigente && diasEntre(hoy, ciclo.fechaVencimiento) <= 7);
  const totalAPagar = realCentavos ?? detalle.proyectadoCentavos;

  // Filas de consumos: "hoy · Supermercado" (relativa + categoría o "sin
  // categorizar"); cuotas: "1 jul · Hogar/Personal" — sin badge de ámbito.
  const iconoPorNombre = new Map(categorias.map((c) => [c.nombre, c.icono]));
  const filas: FilaConsumo[] = detalle.consumos.map((c) => ({
    id: c.id,
    descripcion: c.descripcion,
    icono: c.categoriaNombre ? iconoPorNombre.get(c.categoriaNombre) : undefined,
    metadata: c.esCuota
      ? `${formatearDiaCorto(c.fecha)} · ${c.visibilidad === "compartido" ? "Hogar" : "Personal"}`
      : `${etiquetaDia(c.fecha, hoy).toLowerCase()} · ${c.categoriaNombre ?? "sin categorizar"}`,
    importeCentavos: c.importeCentavos,
    badgeCuota:
      c.esCuota && c.nCuota && c.nCuotasTotal
        ? `CUOTA ${c.nCuota}/${c.nCuotasTotal}`
        : undefined,
  }));

  return (
    <div className="px-5 pt-14 pb-10">
      {titulo}

      {/* Paginador de ciclo: ‹ Ciclo actual · 29 jun – 28 jul › */}
      <nav aria-label="Ciclos de la tarjeta" className="mt-5 flex items-center justify-center gap-2">
        {anterior ? (
          <Link
            href={`/tarjetas/${tarjeta.id}?ciclo=${anterior.id}`}
            aria-label="Ciclo anterior"
            className="hit-44 text-tinta-secundaria"
          >
            <ChevronLeft className="size-4" strokeWidth={1.5} aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className="text-tinta-muda">
            <ChevronLeft className="size-4" strokeWidth={1.5} />
          </span>
        )}
        <p className="text-[13px] font-semibold text-tinta">
          {esVigente ? "Ciclo actual" : "Ciclo"} ·{" "}
          <span className="cifra">
            {formatearDiaCorto(inicio)} – {formatearDiaCorto(ciclo.fechaCierre)}
          </span>
        </p>
        {siguiente ? (
          <Link
            href={`/tarjetas/${tarjeta.id}?ciclo=${siguiente.id}`}
            aria-label="Ciclo siguiente"
            className="hit-44 text-tinta-secundaria"
          >
            <ChevronRight className="size-4" strokeWidth={1.5} aria-hidden />
          </Link>
        ) : (
          <span aria-hidden className="text-tinta-muda">
            <ChevronRight className="size-4" strokeWidth={1.5} />
          </span>
        )}
      </nav>

      {/* Timeline del ciclo (§3.23): pista 3px, dot de inicio, nodo hoy,
          hitos de cierre y vencimiento punteados si son estimados */}
      <Card className="mt-3 px-[18px] pt-[18px] pb-3.5">
        <p className="sr-only">
          Ciclo del {formatearDiaCorto(inicio)} al {formatearDiaCorto(ciclo.fechaCierre)}; el
          resumen vence el {formatearDiaCorto(ciclo.fechaVencimiento)}.
        </p>
        <div aria-hidden className="relative h-4">
          <div className="absolute top-[6px] left-0 h-[3px] w-full rounded-[2px] bg-pista" />
          <div
            className="absolute top-[6px] left-0 h-[3px] rounded-[2px] bg-tinta"
            style={{ width: `${progreso * 100}%` }}
          />
          <div className="absolute top-1 left-0 size-[7px] rounded-full bg-tinta" />
          {enCurso && (
            <div
              className="absolute top-[1px] size-[13px] -translate-x-1/2 rounded-full border-[3px] border-tinta bg-papel"
              style={{ left: `${progreso * 100}%` }}
            />
          )}
          <div
            className={`absolute top-[1px] size-[13px] -translate-x-1/2 rounded-full ${claseNodoHito}`}
            style={{ left: `${posCierre * 100}%` }}
          />
          <div className={`absolute top-[1px] right-0 size-[13px] rounded-full ${claseNodoHito}`} />
        </div>
        <div aria-hidden className="relative mt-1 h-[15px]">
          <span className="cifra absolute left-0 text-[10px] text-tinta-terciaria">
            {formatearDiaCorto(inicio)}
          </span>
          {enCurso && (
            <span
              className="cifra absolute -translate-x-1/2 text-[10.5px] font-semibold text-tinta"
              style={{ left: `${progreso * 100}%` }}
            >
              hoy
            </span>
          )}
        </div>
        <ConfirmarFecha
          cicloId={ciclo.id}
          fechaCierre={ciclo.fechaCierre}
          fechaVencimiento={ciclo.fechaVencimiento}
          cierreCorto={formatearDiaCorto(ciclo.fechaCierre)}
          vencimientoCorto={formatearDiaCorto(ciclo.fechaVencimiento)}
          estadoFechas={ciclo.estadoFechas}
          conAcciones={esVigente}
        />
      </Card>

      {/* Resumen proyectado (§3.24): monto 30px + desglose label/valor */}
      <Card className="mt-3 px-4 pt-3.5 pb-3.5">
        <div className="flex items-center gap-2">
          <h2 className="text-[12px] font-medium text-tinta-secundaria">Resumen proyectado</h2>
          <Badge variante={badgeFechas}>{badgeFechas}</Badge>
        </div>
        <Importe
          centavos={detalle.proyectadoCentavos}
          variante="proyectado"
          className="mt-1 block text-tinta"
        />
        <div className="mt-3 flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] text-tinta-secundaria">Consumos del ciclo</span>
            <span className="cifra text-[12.5px] font-medium text-tinta">
              {formatearImporte(detalle.consumosCentavos)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[12.5px] text-tinta-secundaria">Cuotas del mes</span>
            <span className="cifra text-[12.5px] font-medium text-tinta">
              {formatearImporte(detalle.cuotasCentavos)}
            </span>
          </div>
          <ImpuestosEditable
            tarjetaId={tarjeta.id}
            impuestosCentavos={tarjeta.impuestosEstimadosCentavos}
          />
        </div>

        {dif && realCentavos !== null ? (
          <p className="mt-3 border-t border-separador pt-3 text-[12.5px] text-tinta-secundaria">
            Conciliado:{" "}
            <span className="cifra font-medium text-tinta">{formatearImporte(realCentavos)}</span>
            {" · "}diferencia{" "}
            <span
              className={`cifra font-medium ${
                dif.tono === "verde" ? "text-verde" : "text-ambar-texto"
              }`}
            >
              {dif.centavos > 0 ? "+ " : dif.centavos < 0 ? "− " : ""}
              {formatearImporte(Math.abs(dif.centavos))}
            </span>
          </p>
        ) : mostrarConciliar ? (
          <Conciliacion cicloId={ciclo.id} proyectadoCentavos={detalle.proyectadoCentavos} />
        ) : null}
      </Card>

      {/* Pago del resumen: cuando cerró, está conciliado o vence pronto */}
      {(mostrarPago || detalle.pagadoCentavos > 0) && (
        <Card className="mt-3">
          {mostrarPago && (
            <PagoResumen cicloId={ciclo.id} totalCentavos={totalAPagar} cuentas={cuentas} />
          )}
          {detalle.pagadoCentavos > 0 && (
            <p
              className={`px-3.5 py-[10px] text-[12px] text-tinta-secundaria ${
                mostrarPago ? "border-t border-separador" : ""
              }`}
            >
              Pagado{" "}
              <span className="cifra font-semibold text-tinta">
                {formatearImporte(detalle.pagadoCentavos)}
              </span>
            </p>
          )}
        </Card>
      )}

      {/* Consumos del ciclo · N (§3.34, con contador) */}
      <EncabezadoSeccion>Consumos del ciclo · {filas.length}</EncabezadoSeccion>
      {filas.length === 0 ? (
        <Card className="px-3.5 py-3">
          <p className="text-[13px] text-tinta-secundaria">Sin consumos en este ciclo.</p>
        </Card>
      ) : (
        <ListaConsumos filas={filas} />
      )}
    </div>
  );
}
