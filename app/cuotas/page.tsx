// Pantalla 07 — Cuotas activas (pushed, sin tab bar): el sueldo ya
// comprometido. Todo derivado de cuotasDelHogar(): hero del mes próximo,
// gráfico de 12 meses con la regla de 3 niveles (§3.25) y las compras
// activas con su progreso (§3.26). Nada pintado.
import Link from "next/link";
import { CalendarOff, ChevronLeft } from "lucide-react";
import { Badge } from "@/components/sistema/Badge";
import { BarraAvance } from "@/components/sistema/BarraAvance";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { EstadoVacio } from "@/components/sistema/EstadoVacio";
import { Importe } from "@/components/sistema/Importe";
import { cuotasDelHogar } from "@/lib/datos/tarjetas";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { formatearImporte } from "@/lib/dominio/dinero";
import {
  formatearMesSolo,
  hoyBA,
  mesDe,
  mesSiguiente,
} from "@/lib/dominio/fechas";
import {
  comprometidoPorMes,
  mesLibre,
  type CuotaMensual,
} from "@/lib/dominio/tarjetas";

// ── Gráfico SVG propio: 12 barras, regla de 3 niveles (§3.25) ──────────────
// Mes próximo pleno (máx 64px), meses con carga a opacity .75 con altura
// proporcional (piso chico para que no desaparezcan), meses en 0 stub de 3px.

const ANCHO_BARRA = 22;
const ESPACIO = 5;
const ALTO_MAX = 64;
const ALTO_SVG = 80;
// 12 barras + 11 gaps = 319, casi 1:1 con el ancho útil de la card en 390px
const ANCHO_TOTAL = 12 * ANCHO_BARRA + 11 * ESPACIO;

/** Rect con tope redondeado 3px 3px 0 0, como el export. */
function trazoBarra(x: number, alto: number, base: number): string {
  const r = Math.min(3, alto / 2, ANCHO_BARRA / 2);
  const y = base - alto;
  return [
    `M ${x} ${base}`,
    `V ${y + r}`,
    `Q ${x} ${y} ${x + r} ${y}`,
    `H ${x + ANCHO_BARRA - r}`,
    `Q ${x + ANCHO_BARRA} ${y} ${x + ANCHO_BARRA} ${y + r}`,
    `V ${base}`,
    "Z",
  ].join(" ");
}

function etiquetaMes(mes: string): string {
  return formatearMesSolo(mes).slice(0, 3);
}

function GraficoDoceMeses({ comprometido }: { comprometido: CuotaMensual[] }) {
  const maximo = Math.max(...comprometido.map((m) => m.centavos), 1);
  const descripcion = comprometido
    .map(
      (m) =>
        `${formatearMesSolo(m.mes)} ${
          m.centavos > 0 ? formatearImporte(m.centavos) : "sin cuotas"
        }`,
    )
    .join(", ");

  return (
    <svg
      viewBox={`0 0 ${ANCHO_TOTAL} ${ALTO_SVG}`}
      className="mt-3 w-full"
      role="img"
      aria-label={`Comprometido por mes, próximos 12 meses: ${descripcion}`}
    >
      {comprometido.map((m, i) => {
        const x = i * (ANCHO_BARRA + ESPACIO);
        const conCarga = m.centavos > 0;
        const alto = conCarga
          ? Math.max(6, Math.round((m.centavos / maximo) * ALTO_MAX))
          : 3;
        return (
          <g key={m.mes}>
            <path
              d={trazoBarra(x, alto, ALTO_MAX)}
              className={conCarga ? "fill-tinta" : "fill-barra-futura"}
              opacity={conCarga && i > 0 ? 0.75 : 1}
            />
            <text
              x={x + ANCHO_BARRA / 2}
              y={ALTO_SVG - 2.5}
              textAnchor="middle"
              fontSize={9}
              className="cifra fill-tinta-secundaria"
            >
              {etiquetaMes(m.mes)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Textos derivados ────────────────────────────────────────────────────────

/** "Visa y Mastercard" a partir de las redes únicas, en orden de aparición. */
function listarRedes(etiquetas: string[]): string {
  const redes = [...new Set(etiquetas.map((e) => e.split(" ••")[0]).filter(Boolean))];
  if (redes.length <= 1) return redes[0] ?? "";
  return `${redes.slice(0, -1).join(", ")} y ${redes[redes.length - 1]}`;
}

/** "ago $ 339.550 · desde sep $ 86.250": primer mes + primer valor distinto. */
function pieDelGrafico(comprometido: CuotaMensual[]): string {
  const primero = comprometido[0];
  let texto = `${etiquetaMes(primero.mes)} ${formatearImporte(primero.centavos)}`;
  const distinto = comprometido.find(
    (m) => m.centavos > 0 && m.centavos !== primero.centavos,
  );
  if (distinto) {
    texto += ` · desde ${etiquetaMes(distinto.mes)} ${formatearImporte(distinto.centavos)}`;
  }
  return texto;
}

/** "feb 2027" para "termina …". */
function finDeCompra(terminaMes: string): string {
  return `${etiquetaMes(terminaMes)} ${terminaMes.slice(0, 4)}`;
}

// ── Pantalla ────────────────────────────────────────────────────────────────

export default async function Cuotas() {
  const sesion = await obtenerSesionHogar();
  const { cuotas, compras } = await cuotasDelHogar(sesion);

  const mesProximo = mesSiguiente(mesDe(hoyBA()));
  const comprometido = comprometidoPorMes(cuotas, mesProximo, 12);
  const libre = mesLibre(comprometido);

  const cuantas =
    compras.length === 1 ? "1 compra en cuotas" : `${compras.length} compras en cuotas`;
  const redes = listarRedes(compras.map((c) => c.tarjetaEtiqueta));

  return (
    <div className="flex min-h-dvh flex-col pb-8">
      {/* Header de detalle con back (§3.17 patrón 3) */}
      <header className="flex items-center gap-2 px-5 pt-14">
        <Link
          href="/resumen"
          aria-label="Volver"
          className="hit-44 flex items-center justify-center"
        >
          <ChevronLeft className="size-5 text-tinta" strokeWidth={1.5} aria-hidden />
        </Link>
        <h1 className="flex-1 text-[17px] font-semibold text-tinta">
          Cuotas activas
        </h1>
      </header>

      {compras.length === 0 ? (
        <div className="flex flex-1 flex-col justify-center">
          <EstadoVacio
            Icono={CalendarOff}
            titulo="Sin cuotas activas"
            cuerpo="Cuando compres en cuotas, acá vas a ver cuánto de los próximos sueldos ya está comprometido."
          />
        </div>
      ) : (
        <div className="px-5">
          {/* Hero: comprometido del mes próximo (primera barra del gráfico) */}
          <section className="pt-6">
            <p className="text-[12px] font-medium text-tinta-secundaria">
              Comprometido por mes, ahora
            </p>
            <p className="mt-1">
              <Importe
                centavos={comprometido[0].centavos}
                variante="hero"
                className="text-tinta"
              />
            </p>
            <p className="mt-1 text-[12px] text-tinta-secundaria">
              {cuantas}
              {redes && ` · ${redes}`}
            </p>
          </section>

          {/* Próximos 12 meses (§3.25) */}
          <Card className="mt-5 px-3.5 pt-3.5 pb-3">
            <p className="text-[12px] font-medium text-tinta-secundaria">
              Próximos 12 meses
            </p>
            <GraficoDoceMeses comprometido={comprometido} />
            <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-separador pt-2.5">
              <p className="cifra text-[10.5px] text-tinta-secundaria">
                {pieDelGrafico(comprometido)}
              </p>
              {libre && (
                <p className="shrink-0 text-[11px] font-medium text-verde">
                  en {formatearMesSolo(libre)} quedás libre
                </p>
              )}
            </div>
          </Card>

          {/* Compras en cuotas (§3.26): progreso = cuotas devengadas, en tinta */}
          <EncabezadoSeccion>Compras en cuotas</EncabezadoSeccion>
          <Card className="divide-y divide-separador">
            {compras.map((c) => (
              <div key={c.id} className="flex flex-col gap-[7px] px-3.5 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-[14px] font-medium text-tinta">
                    {c.descripcion}
                  </p>
                  <Badge variante="cuota">
                    Cuota {c.cuotaActual}/{c.nCuotas}
                  </Badge>
                </div>
                <BarraAvance
                  progreso={c.nCuotas > 0 ? c.cuotaActual / c.nCuotas : 0}
                  tono="tinta"
                  etiqueta={`cuota ${c.cuotaActual} de ${c.nCuotas}`}
                />
                <div className="flex items-baseline justify-between gap-2">
                  <p className="cifra text-[11px] text-tinta-secundaria">
                    {formatearImporte(c.cuotaMensualCentavos)}/mes · {c.tarjetaEtiqueta}
                  </p>
                  <p className="shrink-0 text-[11px] text-tinta-secundaria">
                    termina {finDeCompra(c.terminaMes)}
                  </p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}
    </div>
  );
}
