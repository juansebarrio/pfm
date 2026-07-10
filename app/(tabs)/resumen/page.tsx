import Link from "next/link";
import { CalendarClock, ChevronRight, CreditCard, Inbox, Zap, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/sistema/Badge";
import { BarraAvance } from "@/components/sistema/BarraAvance";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { FilaMovimiento } from "@/components/sistema/FilaMovimiento";
import { Importe } from "@/components/sistema/Importe";
import { movimientosCategorizados } from "@/lib/datos/movimientos";
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
};

export default async function Resumen() {
  const sesion = await obtenerSesionHogar();
  const hoy = hoyBA();
  const mesActual = mesDe(hoy);
  const [presupuesto, avisos, ultimos] = await Promise.all([
    obtenerPresupuestoMes(sesion, mesActual, "hogar"),
    avisosParaAtender(sesion, hoy),
    movimientosCategorizados(sesion, { limite: 3 }),
  ]);

  const nombreMes = formatearMesSolo(mesActual);
  const quedanDias = diasDelMes(hoy) - diaDelMes(hoy);

  return (
    <div className="px-5 pt-14">
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
        <Link
          href="/hogar"
          aria-label="Tu hogar"
          className="hit-44 flex size-[34px] shrink-0 items-center justify-center rounded-full bg-tinta text-[14px] font-semibold text-papel"
        >
          {sesion.nombreMiembro.charAt(0).toUpperCase()}
        </Link>
      </header>

      {/* Card de disponible, tocable → /presupuesto */}
      {presupuesto ? (
        <Link href="/presupuesto" className="mt-4 block">
          <Card className="px-3.5 py-3.5">
            <div className="flex items-center justify-between">
              <p className="text-[12px] font-medium text-tinta-secundaria">
                Disponible en {nombreMes} · Hogar
              </p>
              <ChevronRight
                className="size-4 shrink-0 text-tinta-muda"
                strokeWidth={1.5}
                aria-hidden
              />
            </div>
            <Importe
              centavos={presupuesto.disponibleCentavos}
              variante="card"
              className="mt-1 block text-tinta"
            />
            <BarraAvance
              progreso={
                presupuesto.asignadoCentavos > 0
                  ? presupuesto.gastadoCentavos / presupuesto.asignadoCentavos
                  : 0
              }
              tono="tinta"
              marcadorDia={diaDelMes(hoy) / diasDelMes(hoy)}
              etiqueta={`gastado ${formatearImporte(presupuesto.gastadoCentavos)} de ${formatearImporte(presupuesto.asignadoCentavos)}`}
              className="mt-3"
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
                {quedanDias === 1 ? "queda 1 día" : `quedan ${quedanDias} días`}
              </span>
            </div>
          </Card>
        </Link>
      ) : (
        <Link href="/presupuesto/armar" className="mt-4 block">
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
          {avisos.map((aviso) => {
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
        </div>
      )}

      {/* Últimos movimientos: 3 filas, sin "ver más" (corta a propósito) */}
      {ultimos.length > 0 && (
        <>
          <EncabezadoSeccion>Últimos movimientos</EncabezadoSeccion>
          <Card className="divide-y divide-separador">
            {ultimos.map((m) => (
              <FilaMovimiento
                key={m.id}
                descripcion={m.descripcion}
                icono={m.categoria?.icono}
                metadata={[m.categoria?.nombre, m.medio].filter(Boolean).join(" · ")}
                importeCentavos={m.importeCentavos}
                esIngreso={m.tipo === "ingreso"}
                ambito={m.visibilidad === "compartido" ? "hogar" : "personal"}
                badgeCuota={
                  m.esCuota && m.nCuota && m.nCuotasTotal
                    ? `CUOTA ${m.nCuota}/${m.nCuotasTotal}`
                    : undefined
                }
              />
            ))}
          </Card>
        </>
      )}
    </div>
  );
}
