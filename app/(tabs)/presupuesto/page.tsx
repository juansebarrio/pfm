import Link from "next/link";
import { Mail } from "lucide-react";
import { BarraAvance } from "@/components/sistema/BarraAvance";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { CardPartida, type DatosPartida } from "@/components/sistema/CardPartida";
import { EstadoVacio } from "@/components/sistema/EstadoVacio";
import { Importe } from "@/components/sistema/Importe";
import {
  obtenerPresupuestoMes,
  sugerenciasRecurrentes,
  type PartidaConEstado,
  type SugerenciaRecurrente as Sugerencia,
} from "@/lib/datos/presupuesto";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { formatearImporte, formatearPorcentaje } from "@/lib/dominio/dinero";
import {
  diaDelMes,
  diasDelMes,
  formatearDiaCorto,
  formatearMesLargo,
  formatearMesSolo,
  hoyBA,
  mesAnterior,
  mesDesdeParametro,
  mesDe,
  mesSiguiente,
} from "@/lib/dominio/fechas";
import { existePresupuesto } from "./datos";
import { BotonRepetir } from "./BotonRepetir";
import { EncabezadoPresupuesto } from "./EncabezadoPresupuesto";
import { PorCategoria } from "@/components/sistema/PorCategoria";
import { gastosPorCategoria } from "@/lib/datos/movimientos";
import { SugerenciaRecurrente } from "./SugerenciaRecurrente";

// Pantalla 01 — Presupuesto (01a/01b/01c del export). Server Component:
// carga sesión + presupuesto del mes y pasa props planas a los client
// components (header condensable y filas fantasma de recurrentes).

type Ambito = "hogar" | "personal";

/** PartidaConEstado → props de CardPartida, con el léxico verbatim de §3.6. */
function aDatosPartida(
  p: PartidaConEstado,
  mes: string,
  sugerencias: Sugerencia[],
): DatosPartida {
  const notaDiceBroker = (p.nota ?? "").toLowerCase().includes("broker");
  const sufijoMeta =
    notaDiceBroker || p.esAhorro ? "· a Broker" : p.fija ? "· fijo" : undefined;

  const sugerencia = sugerencias.find((s) => s.categoriaId === p.categoriaId);
  const avisoRecurrente = sugerencia
    ? `recurrente · vence el ${formatearDiaCorto(sugerencia.fechaVencimiento)}`
    : undefined;

  const textoRollover =
    p.rolloverCentavos > 0
      ? `arrastrás + ${formatearImporte(p.rolloverCentavos)} de ${formatearMesSolo(mesAnterior(mes))}`
      : undefined;

  return {
    nombre: p.nombre,
    icono: p.icono,
    asignadoCentavos: p.asignadoCentavos,
    gastadoCentavos: p.gastadoCentavos,
    rolloverCentavos: p.rolloverCentavos,
    fija: p.fija,
    rollover: p.rollover,
    estado: p.resultado.estado,
    excedenteProyectadoCentavos: p.resultado.excedenteProyectadoCentavos,
    sufijoMeta,
    avisoRecurrente,
    textoRollover,
    esAhorro: p.esAhorro,
  };
}

export default async function PaginaPresupuesto({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; ambito?: string; vista?: string }>;
}) {
  const params = await searchParams;
  const hoy = hoyBA();
  const mes = mesDesdeParametro(params.mes) ?? mesDe(hoy);
  const ambito: Ambito = params.ambito === "personal" ? "personal" : "hogar";
  const vista = params.vista === "categorias" ? "categorias" : "partidas";
  const mesProximo = mesSiguiente(mes);

  const sesion = await obtenerSesionHogar();
  const [presupuesto, sugerencias, proximoArmado, hayAnterior] = await Promise.all([
    obtenerPresupuestoMes(sesion, mes, ambito),
    sugerenciasRecurrentes(sesion, mes),
    existePresupuesto(sesion, mesProximo, ambito),
    existePresupuesto(sesion, mesAnterior(mes), ambito),
  ]);

  // solo en su solapa: es una consulta más que en "Partidas" no se usa
  const porCategoria =
    vista === "categorias" ? await gastosPorCategoria(sesion, mes, ambito) : [];

  const mesTitulo = formatearMesLargo(mes);
  const mesNombre = formatearMesSolo(mes);
  const inicial = (sesion.nombreMiembro.trim().charAt(0) || "Y").toUpperCase();

  const encabezado = (
    <EncabezadoPresupuesto
      mesTitulo={mesTitulo}
      mes={mes}
      mesActual={mesDe(hoy)}
      inicial={inicial}
      ambito={ambito}
      hrefHogar={`/presupuesto?mes=${mes}&ambito=hogar${vista === "categorias" ? "&vista=categorias" : ""}`}
      hrefPersonal={`/presupuesto?mes=${mes}&ambito=personal${vista === "categorias" ? "&vista=categorias" : ""}`}
      quedaCentavos={presupuesto?.disponibleCentavos ?? null}
      vista={vista}
      mesEnUrl={mes === mesDe(hoy) ? undefined : mes.slice(0, 7)}
    />
  );

  // 01c — sin presupuesto del mes: estado vacío con CTA al armado
  // Va antes del early-return de "sin presupuesto" a propósito: podés haber
  // gastado sin haber armado el presupuesto del mes, y en ese caso el reparto
  // por categoría sigue siendo la única foto útil que la pantalla puede dar.
  if (vista === "categorias") {
    return (
      <div className="px-5 pb-10">
        {encabezado}
        <PorCategoria
          items={porCategoria}
          vacio={`No hay gastos ${ambito === "hogar" ? "del hogar" : "personales"} en ${mesTitulo}.`}
        />
      </div>
    );
  }

  if (!presupuesto) {
    return (
      <div>
        {encabezado}
        <div className="flex min-h-[55dvh] flex-col justify-center">
          <EstadoVacio
            Icono={Mail}
            titulo="Armá tu primer presupuesto"
            cuerpo="Asignale un monto a cada partida del mes, como sobres de plata, y mirá cuánto queda a medida que cargás gastos."
            cta={
              <Link
                href={`/presupuesto/armar?mes=${mes}&ambito=${ambito}`}
                className="inline-block rounded-cta bg-verde px-[30px] py-3.5 text-[14.5px] font-semibold text-papel"
              >
                Empezar con {mesNombre}
              </Link>
            }
          />
          {/* con presupuesto el mes pasado, el arrastre es un toque */}
          {hayAnterior && (
            <BotonRepetir
              mes={mes}
              ambito={ambito}
              etiquetaMes={formatearMesSolo(mesAnterior(mes))}
            />
          )}
        </div>
      </div>
    );
  }

  const dias = diasDelMes(mes);
  const esMesActual = mesDe(hoy) === mes;
  const dia = esMesActual ? diaDelMes(hoy) : dias;
  const quedanDias = dias - dia;
  const fraccionGastada =
    presupuesto.asignadoCentavos > 0
      ? presupuesto.gastadoCentavos / presupuesto.asignadoCentavos
      : 0;

  return (
    <div>
      {encabezado}

      {/* Hero: disponible del mes + barra con marcador del día (01a) */}
      <section className="px-5 pt-6">
        <p className="text-[12px] font-medium text-tinta-secundaria">
          Disponible en {mesNombre}
        </p>
        <p className="mt-1">
          <Importe
            centavos={presupuesto.disponibleCentavos}
            variante="hero"
            className={presupuesto.disponibleCentavos < 0 ? "text-rojo" : "text-tinta"}
          />
        </p>
        <p className="cifra mt-1 text-[11px] text-tinta-secundaria">
          asignado {formatearImporte(presupuesto.asignadoCentavos)} · gastado{" "}
          {formatearImporte(presupuesto.gastadoCentavos)}
        </p>
        <BarraAvance
          progreso={fraccionGastada}
          tono="tinta"
          marcadorDia={esMesActual ? dia / dias : undefined}
          etiqueta={`Mes: gastado ${formatearImporte(presupuesto.gastadoCentavos)} de ${formatearImporte(presupuesto.asignadoCentavos)}`}
          className="mt-3"
        />
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <p className="cifra text-[10.5px] text-tinta-secundaria">
            {formatearPorcentaje(fraccionGastada * 100)} gastado
          </p>
          {esMesActual && (
            <p className="cifra text-[10.5px] text-verde">
              día {dia} de {dias} ·{" "}
              {quedanDias === 1 ? "queda 1 día" : `quedan ${quedanDias} días`}
            </p>
          )}
        </div>
      </section>

      {/* Grupos de partidas + filas fantasma de recurrentes */}
      <div className="px-5 pt-2">
        {presupuesto.grupos.map((g) => {
          const fantasmas = sugerencias.filter((s) =>
            g.partidas.some((p) => p.categoriaId === s.categoriaId),
          );
          return (
            <section key={g.grupo}>
              <EncabezadoSeccion>{g.grupo}</EncabezadoSeccion>
              <Card className="divide-y divide-separador">
                {g.partidas.map((p) => (
                  <CardPartida key={p.id} {...aDatosPartida(p, mes, sugerencias)} />
                ))}
                {fantasmas.map((s) => (
                  <SugerenciaRecurrente
                    key={s.id}
                    recurrenteId={s.id}
                    mes={mes}
                    descripcion={s.descripcion}
                    detalle={`vence el ${formatearDiaCorto(s.fechaVencimiento)} · ${formatearImporte(s.importeSugeridoCentavos)} sugerido`}
                  />
                ))}
              </Card>
            </section>
          );
        })}

        {!proximoArmado && (
          <p className="mt-6 text-center">
            <Link
              href={`/presupuesto/armar?mes=${mesProximo}&ambito=${ambito}`}
              className="text-[13.5px] font-medium text-verde"
            >
              Armar presupuesto de {formatearMesSolo(mesProximo)} →
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
