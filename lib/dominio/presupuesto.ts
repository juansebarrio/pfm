// Estado semántico de una partida y proyección de fin de mes.
// Regla de negocio anotada en el export: "El color de cada partida sale de la
// proyección, no del % gastado: una fija pagada al 100 % se ve calma."
// Fórmula del brief: proyección lineal simple sobre las partidas variables,
// gastado / días transcurridos × días del mes.
// Decisión anotada (DESIGN_NOTES.md): las partidas fijas y las de rollover
// no proyectan — una suscripción que se cobra una vez no es un ritmo diario.
//
// La proyección habla recién cuando hay señal (2026-08-02): con pocos días
// transcurridos el divisor chico convierte cualquier compra normal en una
// falsa alarma — una ida al súper el día 2 "proyectaba" 15 veces eso. Dos
// compuertas: nada antes del día 7 (una semana de datos) y, desde ahí,
// "atención" solo si la proyección supera lo disponible por más del 10 %.
// "Excedido" no pasa por ninguna compuerta: no es proyección, es un hecho.

export type EntradaEstadoPartida = {
  asignadoCentavos: number;
  gastadoCentavos: number;
  /** arrastre del mes anterior (0 si la partida no acumula) */
  rolloverCentavos?: number;
  fija?: boolean;
  /** la partida acumula rollover (pool, no ritmo) */
  rollover?: boolean;
  diaDelMes: number;
  diasDelMes: number;
};

export type EstadoPartida = "ok" | "atencion" | "excedido";

export type ResultadoEstadoPartida = {
  estado: EstadoPartida;
  /** proyección de gasto a fin de mes; null si la partida no proyecta */
  proyeccionCentavos: number | null;
  /** cuánto se pasa la proyección del disponible; null si no se pasa */
  excedenteProyectadoCentavos: number | null;
  /** asignado + rollover − gastado */
  quedaCentavos: number;
};

/** La proyección no existe antes de este día: sin una semana de datos, calla. */
export const DIA_MINIMO_PROYECCION = 7;

/**
 * "Atención" solo si la proyección supera lo disponible por más de este
 * margen (10 %): los casos borde que un día alarmaban y al otro no, calman.
 * Comparación en enteros: proyección × 10 > disponible × 11.
 */
const MARGEN_PROYECCION_NUMERADOR = 11;
const MARGEN_PROYECCION_DENOMINADOR = 10;

export function proyeccionLineal(
  gastadoCentavos: number,
  diaDelMes: number,
  diasDelMes: number,
): number {
  if (!Number.isInteger(gastadoCentavos)) throw new Error("gastado no entero");
  if (diaDelMes < 1 || diaDelMes > diasDelMes) throw new Error("día fuera del mes");
  return Math.round((gastadoCentavos * diasDelMes) / diaDelMes);
}

export function estadoPartida(e: EntradaEstadoPartida): ResultadoEstadoPartida {
  const arrastre = e.rolloverCentavos ?? 0;
  const disponibleTotal = e.asignadoCentavos + arrastre;
  const queda = disponibleTotal - e.gastadoCentavos;

  // gastado ya por encima → excedido, sin importar proyecciones
  if (e.gastadoCentavos > disponibleTotal) {
    return {
      estado: "excedido",
      proyeccionCentavos: null,
      excedenteProyectadoCentavos: null,
      quedaCentavos: queda,
    };
  }

  // fija (pagada o a medias), pools de rollover y el arranque del mes:
  // calma, no proyectan — antes del día 7 no hay ritmo, hay ruido
  if (
    e.fija ||
    e.rollover ||
    e.gastadoCentavos === 0 ||
    e.diaDelMes < DIA_MINIMO_PROYECCION
  ) {
    return {
      estado: "ok",
      proyeccionCentavos: null,
      excedenteProyectadoCentavos: null,
      quedaCentavos: queda,
    };
  }

  const proyeccion = proyeccionLineal(e.gastadoCentavos, e.diaDelMes, e.diasDelMes);
  const superaConMargen =
    proyeccion * MARGEN_PROYECCION_DENOMINADOR >
    disponibleTotal * MARGEN_PROYECCION_NUMERADOR;
  if (superaConMargen) {
    return {
      estado: "atencion",
      proyeccionCentavos: proyeccion,
      excedenteProyectadoCentavos: proyeccion - disponibleTotal,
      quedaCentavos: queda,
    };
  }

  return {
    estado: "ok",
    proyeccionCentavos: proyeccion,
    excedenteProyectadoCentavos: null,
    quedaCentavos: queda,
  };
}
