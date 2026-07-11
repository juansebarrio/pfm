import Link from "next/link";
import { Card, EncabezadoSeccion } from "@/components/sistema/Card";
import { Importe } from "@/components/sistema/Importe";
import { obtenerPatrimonio } from "@/lib/datos/patrimonio";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import { arsAUsd, formatearImporte, formatearPorcentaje } from "@/lib/dominio/dinero";
import { etiquetaDia, formatearDiaCorto, hoyBA } from "@/lib/dominio/fechas";
import { BotonSnapshot } from "./BotonSnapshot";
import { etiquetaFuente, type FuenteTC } from "./instrumentos";
import { ListaTenencias } from "./ListaTenencias";
import { SelectorTC } from "./SelectorTC";
import { Sparkline } from "./Sparkline";
import { VacioPatrimonio } from "./VacioPatrimonio";

// 08 — Patrimonio: total del hogar valuado al TC activo (?tc=mep|blue|oficial),
// sparkline de snapshots, composición normalizada al máximo y tenencias con
// vocabulario de frescura. Sin tenencias activas → estado vacío 08b.
// El hero redondea a la centena de mil con ≈ (DESIGN_NOTES §1.2); el detalle
// exacto vive en las filas.

const CENTENA_DE_MIL = 10_000_000; // $ 100.000 en centavos
const CENTENA_USD = 10_000; // USD 100 en centavos

/** "hoy 10 jul" / "ayer 9 jul" / "8 jul" para la leyenda del TC. */
function etiquetaFechaTC(fecha: string, hoy: string): string {
  const corto = formatearDiaCorto(fecha);
  const relativa = etiquetaDia(fecha, hoy).toLowerCase();
  return relativa === corto ? corto : `${relativa} ${corto}`;
}

type Props = {
  searchParams: Promise<{ tc?: string | string[] }>;
};

export default async function Patrimonio({ searchParams }: Props) {
  const { tc } = await searchParams;
  const tcParam = Array.isArray(tc) ? tc[0] : tc;
  const fuente: FuenteTC =
    tcParam === "blue" || tcParam === "oficial" ? tcParam : "mep";

  const sesion = await obtenerSesionHogar();
  const patrimonio = await obtenerPatrimonio(sesion, fuente);
  const hoy = hoyBA();
  const inicial = (sesion.nombreMiembro.trim().charAt(0) || "Y").toUpperCase();

  const encabezado = (
    <header className="flex items-start justify-between">
      <h1 className="text-[22px] font-semibold text-tinta">Patrimonio</h1>
      <Link
        href="/hogar"
        aria-label="Tu hogar"
        className="hit-44 flex size-[34px] shrink-0 items-center justify-center rounded-full bg-tinta text-[14px] font-semibold text-papel"
      >
        {inicial}
      </Link>
    </header>
  );

  // 08b — sin tenencias: solo el estado vacío (sin hero, composición ni TC)
  if (patrimonio.tenencias.length === 0) {
    return (
      <div className="px-5 pt-14">
        {encabezado}
        <VacioPatrimonio />
      </div>
    );
  }

  const { totalArsCentavos: total, tcActivo } = patrimonio;
  const totalRedondeado = Math.round(total / CENTENA_DE_MIL) * CENTENA_DE_MIL;
  const usdRedondeado = tcActivo
    ? Math.round(arsAUsd(total, tcActivo.valorCentavos) / CENTENA_USD) * CENTENA_USD
    : null;
  const leyenda = tcActivo
    ? `${etiquetaFuente(tcActivo.fuente)} ${formatearImporte(tcActivo.valorCentavos)} · ${etiquetaFechaTC(tcActivo.fecha, hoy)}`
    : null;

  return (
    <div className="px-5 pt-14">
      {encabezado}

      {/* Hero doble columna: total (≈ si el redondeo difiere) + sparkline 108×40 */}
      <section className="mt-4 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[12px] font-medium text-tinta-secundaria">Total del hogar</p>
          <p className="mt-0.5 flex items-baseline gap-1.5">
            {totalRedondeado !== total && (
              <span className="cifra text-[20px] font-medium text-tinta-secundaria">≈</span>
            )}
            <Importe centavos={totalRedondeado} variante="patrimonio" className="text-tinta" />
          </p>
          {usdRedondeado !== null && (
            <p className="cifra mt-1 text-[14px] font-medium text-tinta-secundaria">
              ≈ {formatearImporte(usdRedondeado, "USD")}
            </p>
          )}
        </div>
        <Sparkline snapshots={patrimonio.snapshots} />
      </section>

      <SelectorTC
        fuenteActiva={tcActivo?.fuente ?? fuente}
        cargadas={patrimonio.tcTodos.map((t) => t.fuente)}
        leyenda={leyenda}
      />

      {/* Composición: barras normalizadas al MÁXIMO, no al 100 % (§3.28) */}
      <Card className="mt-4 px-3.5 py-3.5">
        <h2 className="text-[12px] font-semibold text-tinta-secundaria">Composición</h2>
        <div className="mt-3 flex flex-col gap-2.5">
          {patrimonio.composicion.map((c, i) => (
            <div key={`${c.nombre}-${i}`} className="flex items-center gap-2.5">
              <span className="w-[110px] shrink-0 truncate text-[12px] text-tinta-secundaria">
                {c.nombre}
              </span>
              <span
                aria-hidden
                className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-[3px] bg-pista"
              >
                <span
                  className="block h-full rounded-[3px] bg-tinta"
                  style={{ width: `${(c.fraccionDelMaximo * 100).toFixed(1)}%` }}
                />
              </span>
              <span className="cifra w-9 shrink-0 text-right text-[11px] text-tinta-secundaria">
                {formatearPorcentaje(c.porcentaje)}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <EncabezadoSeccion>Tenencias</EncabezadoSeccion>
      <ListaTenencias tenencias={patrimonio.tenencias} />

      <BotonSnapshot />
    </div>
  );
}
