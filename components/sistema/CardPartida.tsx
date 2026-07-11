import { Check } from "lucide-react";
import { Badge } from "./Badge";
import { BarraAvance } from "./BarraAvance";
import { IconoCategoria } from "./IconoCategoria";
import { Importe } from "./Importe";
import { formatearImporte } from "@/lib/dominio/dinero";
import type { EstadoPartida } from "@/lib/dominio/presupuesto";

// Fila de partida (el "sobre"). Anatomía del export (DESIGN_AUDIT.md §3.5):
// ícono + nombre + estado a la derecha; barra 4px; meta mono 11px + aviso.
// Léxico de estados: pagado / transferido / queda $ X / · fijo / · a Broker /
// recurrente · vence el N / a este ritmo terminás $ X arriba / arrastrás + $ X.

export type DatosPartida = {
  nombre: string;
  icono: string;
  asignadoCentavos: number;
  gastadoCentavos: number;
  rolloverCentavos?: number;
  fija?: boolean;
  rollover?: boolean;
  estado: EstadoPartida;
  excedenteProyectadoCentavos?: number | null;
  /** "· fijo", "· a Broker" */
  sufijoMeta?: string;
  /** aviso a la derecha de la meta: recurrente que vence */
  avisoRecurrente?: string;
  /** "arrastrás + $ 13.800 de junio" (lo arma el caller con el mes real) */
  textoRollover?: string;
  /** partida desactivada este mes (02) */
  desactivada?: boolean;
  notaDesactivada?: string;
  /** grupo Ahorro: "transferido" en lugar de "pagado" */
  esAhorro?: boolean;
};

export function CardPartida(p: DatosPartida) {
  const disponible = p.asignadoCentavos + (p.rolloverCentavos ?? 0);
  const queda = disponible - p.gastadoCentavos;
  const pagada = p.fija && p.gastadoCentavos >= p.asignadoCentavos && p.estado === "ok";
  // guarda sobre el MISMO denominador que la división: una partida rollover con
  // asignado $0 y arrastre > 0 tenía disponible > 0 pero asignado 0 → Infinity
  const progreso = p.asignadoCentavos > 0 ? p.gastadoCentavos / p.asignadoCentavos : 0;
  const tieneAviso = Boolean(p.avisoRecurrente);
  // importe ámbar: atención + gastado ≥ 75 % del disponible (DESIGN_NOTES.md §1.8)
  const importeAmbar = p.estado === "atencion" && p.gastadoCentavos >= disponible * 0.75;

  if (p.desactivada) {
    return (
      <div className="flex items-center gap-2.5 px-3.5 py-[11px]">
        <IconoCategoria nombre={p.icono} />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-medium text-tinta-terciaria">{p.nombre}</p>
          {p.notaDesactivada && (
            <p className="mt-0.5 text-[11px] text-tinta-terciaria">{p.notaDesactivada}</p>
          )}
        </div>
        <span className="cifra text-[14px] font-semibold text-tinta-deshabilitada">$ 0</span>
      </div>
    );
  }

  return (
    <div className="px-3.5 py-[11px]">
      <div className="flex items-center gap-2.5">
        <IconoCategoria nombre={p.icono} tono={tieneAviso ? "ambar" : "normal"} />
        <p className="min-w-0 flex-1 truncate text-[14px] font-medium text-tinta">
          {p.nombre}
          {p.rollover && (
            <span className="ml-1.5 align-[2px]">
              <Badge variante="rollover">Rollover</Badge>
            </span>
          )}
        </p>
        {pagada ? (
          <span className="flex items-center gap-1 text-[12.5px] font-medium text-verde">
            <Check className="size-3.5" strokeWidth={2} aria-hidden />
            {p.esAhorro ? "transferido" : "pagado"}
          </span>
        ) : (
          <span className="flex items-baseline gap-1">
            <span className="text-[11px] text-tinta-secundaria">queda</span>
            <Importe
              centavos={queda}
              variante="fila"
              className={
                p.estado === "excedido"
                  ? "text-rojo"
                  : importeAmbar
                    ? "text-ambar-texto"
                    : "text-tinta"
              }
            />
          </span>
        )}
      </div>

      <BarraAvance
        progreso={progreso}
        tono={
          p.estado === "excedido"
            ? "excedido"
            : p.estado === "atencion"
              ? "atencion"
              : pagada
                ? "pagada"
                : "ok"
        }
        etiqueta={`${p.nombre}: gastado ${formatearImporte(p.gastadoCentavos)} de ${formatearImporte(disponible)}`}
        className="mt-2"
      />

      <div className="mt-1.5 flex items-baseline justify-between gap-2">
        <p className="cifra text-[11px] text-tinta-secundaria">
          {formatearImporte(p.gastadoCentavos)} de {formatearImporte(p.asignadoCentavos)}
          {p.sufijoMeta && <span> {p.sufijoMeta}</span>}
        </p>
        {p.avisoRecurrente && (
          <p className="text-[11px] text-ambar-texto">{p.avisoRecurrente}</p>
        )}
        {!p.avisoRecurrente && p.estado === "atencion" && p.excedenteProyectadoCentavos != null && (
          <p className="text-[11px] text-ambar-texto">
            a este ritmo terminás {formatearImporte(p.excedenteProyectadoCentavos)} arriba
          </p>
        )}
        {!p.avisoRecurrente && p.estado === "excedido" && (
          <p className="text-[11px] font-medium text-rojo">
            te pasaste {formatearImporte(-queda)}
          </p>
        )}
        {!p.avisoRecurrente && p.estado === "ok" && p.textoRollover && (
          <p className="text-[11px] text-azul">{p.textoRollover}</p>
        )}
      </div>
    </div>
  );
}
