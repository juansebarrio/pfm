import Link from "next/link";
import { CalendarClock, CalendarDays, ChevronRight, CreditCard, Inbox, Mail, Sparkles, Zap, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/sistema/Badge";
import { BarraAvance } from "@/components/sistema/BarraAvance";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { Importe } from "@/components/sistema/Importe";
import {
  categoriasDelHogar,
  mediosDePago,
  movimientosCategorizados,
  totalesDelMes,
} from "@/lib/datos/movimientos";
import { ListaMovimientosTocables } from "@/components/sistema/ListaMovimientosTocables";
import { OnboardingAuto } from "@/components/sistema/Onboarding";
import { obtenerPresupuestoMes } from "@/lib/datos/presupuesto";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { formatearImporte, formatearPorcentaje } from "@/lib/dominio/dinero";
import {
  diaDelMes,
  diasDelMes,
  formatearDiaLargo,
  formatearMesSolo,
  hoyBA,
  mesDe,
} from "@/lib/dominio/fechas";
import { avisosParaAtender, type Aviso } from "./datos";

// 04 — Resumen: el tab de apertura. Corta a propósito: disponible del mes,
// qué atender hoy y los últimos 3 movimientos. Nada más.

const iconosAviso: Record<Aviso["tipo"], LucideIcon> = {
  cierre: CreditCard,
  vencimiento: CalendarClock,
  recurrente: Zap,
  bandeja: Inbox,
  correo: Mail,
};

export default async function Resumen() {
  const sesion = await obtenerSesionHogar();
  const hoy = hoyBA();
  const mesActual = mesDe(hoy);
  const [presupuesto, avisos, ultimos, categorias, medios, totales] = await Promise.all([
    obtenerPresupuestoMes(sesion, mesActual, "hogar"),
    avisosParaAtender(sesion, hoy),
    movimientosCategorizados(sesion, { limite: 3 }),
    categoriasDelHogar(sesion),
    mediosDePago(sesion),
    totalesDelMes(sesion, mesActual),
  ]);

  const nombreMes = formatearMesSolo(mesActual);
  const quedanDias = diasDelMes(hoy) - diaDelMes(hoy);
  const balanceCentavos = totales.ingresosCentavos - totales.gastosCentavos;
  const sinIngresos = totales.ingresosCentavos === 0;
  // tope de 3 avisos: la pantalla corta a propósito, el resto se resume en
  // "y N más →". Los ocultos vienen en orden de prioridad, así que el destino
  // del primero (el más urgente de los que no entraron) es el que más sirve.
  const avisosVisibles = avisos.slice(0, 3);
  const avisosOcultos = avisos.slice(3);

  return (
    <div className="px-5 pt-14 lg:pt-10">
      {/* La bienvenida, solo la primera vez (localStorage). Vive acá porque el
          Resumen es la primera pantalla después de entrar. */}
      <OnboardingAuto />

      {/* Header: saludo + fecha + avatar (§3.17 patrón 1) */}
      <header className="flex items-start justify-between">
        <div>
          <h1 className="text-[22px] font-semibold text-tinta">
            Hola, {sesion.nombreMiembro}
          </h1>
          <p className="mt-0.5 text-[12.5px] text-tinta-secundaria">
            {formatearDiaLargo(hoy)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2.5">
          <Link
            href="/calendario"
            aria-label="Calendario del mes"
            className="hit-44 flex size-[34px] items-center justify-center rounded-full border border-borde bg-superficie text-tinta-secundaria"
          >
            <CalendarDays className="size-[17px]" strokeWidth={1.5} aria-hidden />
          </Link>
          {/* asistente con IA — solo con ANTHROPIC_API_KEY configurada */}
          {process.env.ANTHROPIC_API_KEY && (
            <Link
              href="/asistente"
              aria-label="Asistente financiero"
              className="hit-44 flex size-[34px] items-center justify-center rounded-full border border-borde bg-superficie text-verde"
            >
              <Sparkles className="size-[17px]" strokeWidth={1.5} aria-hidden />
            </Link>
          )}
          <Link
            href="/hogar"
            aria-label="Tu hogar"
            className="hit-44 flex size-[34px] items-center justify-center rounded-full bg-tinta text-[14px] font-semibold text-papel"
          >
            {sesion.nombreMiembro.charAt(0).toUpperCase()}
          </Link>
        </div>
      </header>

      {/* En escritorio el Resumen respira a dos columnas: el mes (caja, plan y
          avisos) a la izquierda, los últimos movimientos a la derecha. En el
          teléfono los divs no cambian nada: misma pila de siempre. */}
      <div className="lg:grid lg:grid-cols-[1fr_400px] lg:items-start lg:gap-10">
      <div>
      {/* Card principal: la CAJA del mes, como el totalizador de Movimientos —
          el balance (ingresos − gastos) protagonista y las dos cifras que lo
          componen en voz baja. Tocable → /movimientos.
          Sin ingresos cargados no hay balance que evaluar: la card pasa a
          "Gastos de {mes}" en tinta (el rojo se reserva para "excedido") y lo
          dice abajo. Sin ningún movimiento, directamente no aparece. */}
      {(totales.ingresosCentavos > 0 || totales.gastosCentavos > 0) && (
        <Link href="/movimientos" className="mt-4 block">
          <Card className="px-3.5 py-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-tinta-secundaria">
                {sinIngresos ? `Gastos de ${nombreMes}` : `Balance de ${nombreMes}`}
              </p>
              <ChevronRight
                className="size-4 shrink-0 text-tinta-muda"
                strokeWidth={1.5}
                aria-hidden
              />
            </div>
            <Importe
              centavos={sinIngresos ? totales.gastosCentavos : balanceCentavos}
              variante="card"
              className={`mt-1 block ${
                sinIngresos ? "text-tinta" : balanceCentavos < 0 ? "text-rojo" : "text-verde"
              }`}
            />
            {sinIngresos ? (
              <p className="mt-1.5 text-[11px] text-tinta-secundaria">
                sin ingresos cargados este mes
              </p>
            ) : (
              <p className="cifra mt-1.5 text-[11px] text-tinta-secundaria">
                ingresos {formatearImporte(totales.ingresosCentavos)} · gastos{" "}
                {formatearImporte(totales.gastosCentavos)}
              </p>
            )}
          </Card>
        </Link>
      )}

      {/* Card de disponible del presupuesto, tocable → /presupuesto. Segunda a
          propósito y en formato de DATO, no de héroe: etiqueta a la izquierda,
          cifra chica a la derecha y la barra como cuerpo de la card — la caja
          manda, el plan acompaña. */}
      {presupuesto ? (
        <Link href="/presupuesto" className="mt-2.5 block">
          <Card className="px-3.5 py-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-[12px] font-medium text-tinta-secundaria">
                Presupuesto · disponible
              </p>
              <span
                className={`cifra shrink-0 text-[17px] font-semibold ${
                  presupuesto.disponibleCentavos < 0 ? "text-rojo" : "text-tinta"
                }`}
              >
                {presupuesto.disponibleCentavos < 0 ? "− " : ""}
                {formatearImporte(Math.abs(presupuesto.disponibleCentavos))}
              </span>
            </div>
            <BarraAvance
              progreso={
                presupuesto.asignadoCentavos > 0
                  ? presupuesto.gastadoCentavos / presupuesto.asignadoCentavos
                  : 0
              }
              tono="tinta"
              marcadorDia={diaDelMes(hoy) / diasDelMes(hoy)}
              etiqueta={`gastado ${formatearImporte(presupuesto.gastadoCentavos)} de ${formatearImporte(presupuesto.asignadoCentavos)}`}
              className="mt-2.5"
            />
            <div className="mt-2 flex items-center justify-between">
              <span className="cifra text-[10.5px] text-tinta-secundaria">
                {formatearPorcentaje(
                  presupuesto.asignadoCentavos > 0
                    ? (presupuesto.gastadoCentavos / presupuesto.asignadoCentavos) * 100
                    : 0,
                )}{" "}
                gastado
              </span>
              <span className="cifra text-[10.5px] text-verde">
                {quedanDias === 0 ? "último día del mes" : quedanDias === 1 ? "queda 1 día" : `quedan ${quedanDias} días`}
              </span>
            </div>
          </Card>
        </Link>
      ) : (
        <Link href="/presupuesto/armar" className="mt-2.5 block">
          <Card className="px-3.5 py-4">
            <p className="text-center text-[13.5px] font-medium text-verde">
              Armá tu presupuesto de {nombreMes} →
            </p>
          </Card>
        </Link>
      )}

      {/* Para atender (§3.22): cards sueltas apiladas, gap 8px */}
      <EncabezadoSeccion>Para atender</EncabezadoSeccion>
      {avisos.length === 0 ? (
        <Card className="px-3.5 py-3">
          <p className="text-[13px] text-tinta-secundaria">Nada urgente por hoy</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-2">
          {avisosVisibles.map((aviso) => {
            const Icono = iconosAviso[aviso.tipo];
            return (
              <Link key={aviso.id} href={aviso.href} className="block">
                <Card className="flex items-center gap-[11px] px-3.5 py-3">
                  <Icono
                    className={`size-[18px] shrink-0 ${
                      aviso.tipo === "recurrente" ? "text-ambar" : "text-tinta-secundaria"
                    }`}
                    strokeWidth={1.5}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-medium text-tinta">
                      {aviso.titulo}
                    </p>
                    <p className="mt-[3px] flex items-center gap-1.5 text-[11px] text-tinta-secundaria">
                      <span className={`truncate ${aviso.metaCifra ? "cifra" : ""}`}>
                        {aviso.meta}
                      </span>
                      {aviso.badge && (
                        <Badge variante={aviso.badge}>{aviso.badge}</Badge>
                      )}
                    </p>
                  </div>
                  {aviso.accion ? (
                    <span className="shrink-0 text-[12.5px] font-medium text-verde">
                      {aviso.accion}
                    </span>
                  ) : (
                    <ChevronRight
                      className="size-4 shrink-0 text-tinta-muda"
                      strokeWidth={1.5}
                      aria-hidden
                    />
                  )}
                </Card>
              </Link>
            );
          })}
          {avisosOcultos.length > 0 && (
            <Link
              href={avisosOcultos[0].href}
              className="self-end px-1 text-[12px] text-tinta-secundaria"
            >
              y {avisosOcultos.length} más →
            </Link>
          )}
        </div>
      )}

      </div>

      {/* Últimos movimientos: 3 filas, sin "ver más" (corta a propósito) */}
      {ultimos.length > 0 && (
        <div>
          <EncabezadoSeccion>Últimos movimientos</EncabezadoSeccion>
          <ListaMovimientosTocables
            movimientos={ultimos}
            categorias={categorias}
            medios={medios}
          />
        </div>
      )}
      </div>
    </div>
  );
}
