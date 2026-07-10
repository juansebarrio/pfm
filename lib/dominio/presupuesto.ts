// Estado semántico de una partida y proyección de fin de mes.
// Regla de negocio anotada en el export: "El color de cada partida sale de la
// proyección, no del % gastado: una fija pagada al 100 % se ve calma."
// Fórmula del brief: proyección lineal simple sobre las partidas variables,
// gastado / días transcurridos × días del mes.
// Decisión anotada (DESIGN_NOTES.md): las partidas fijas y las de rollover
// no proyectan — una suscripción que se cobra una vez no es un ritmo diario.

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

  // fija (pagada o a medias) y pools de rollover: calma, no proyectan
  if (e.fija || e.rollover || e.gastadoCentavos === 0) {
    return {
      estado: "ok",
      proyeccionCentavos: null,
      excedenteProyectadoCentavos: null,
      quedaCentavos: queda,
    };
  }

  const proyeccion = proyeccionLineal(e.gastadoCentavos, e.diaDelMes, e.diasDelMes);
  if (proyeccion > disponibleTotal) {
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
