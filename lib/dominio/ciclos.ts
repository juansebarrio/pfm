// Asignación de consumos de tarjeta a su ciclo.
// Regla del brief: un consumo cae en el ciclo cuya fecha_cierre es la más
// cercana >= fecha del consumo. Un consumo EN la fecha exacta de cierre
// pertenece a ese ciclo (fecha <= fecha_cierre). Espejo del SQL
// reasignar_consumos_tarjeta() de la migración 0003.

export type CicloParaAsignar = {
  id: string;
  fechaCierre: string; // YYYY-MM-DD
};

export function asignarCiclo(
  fechaConsumo: string,
  ciclos: CicloParaAsignar[],
): string | null {
  const candidatos = ciclos
    .filter((c) => c.fechaCierre >= fechaConsumo)
    .sort((a, b) => a.fechaCierre.localeCompare(b.fechaCierre));
  return candidatos[0]?.id ?? null;
}

/**
 * Propone el ciclo siguiente a partir del último cierre: mismo día del mes
 * siguiente, corrido a día hábil hacia atrás si cae en fin de semana
 * (los cierres bancarios no caen sábado ni domingo). Queda `estimado`.
 */
export function proponerCicloSiguiente(ultimoCierre: string): {
  fechaCierre: string;
  fechaVencimiento: string;
} {
  const cierre = correrADiaHabil(sumarUnMes(ultimoCierre));
  // vencimiento estimado: 9 días corridos después del cierre, a día hábil
  const vencimiento = correrADiaHabil(sumarDias(cierre, 9));
  return { fechaCierre: cierre, fechaVencimiento: vencimiento };
}

function sumarUnMes(fecha: string): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const mesesTotales = anio * 12 + (mes - 1) + 1;
  const anioNuevo = Math.floor(mesesTotales / 12);
  const mesNuevo = (mesesTotales % 12) + 1;
  const ultimoDiaMes = new Date(Date.UTC(anioNuevo, mesNuevo, 0)).getUTCDate();
  const diaNuevo = Math.min(dia, ultimoDiaMes);
  return `${anioNuevo}-${String(mesNuevo).padStart(2, "0")}-${String(diaNuevo).padStart(2, "0")}`;
}

function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

function correrADiaHabil(fecha: string): string {
  // Corre hacia atrás: sábado → viernes, domingo → viernes.
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia));
  const diaSemana = d.getUTCDay(); // 0 domingo, 6 sábado
  if (diaSemana === 6) return sumarDias(fecha, -1);
  if (diaSemana === 0) return sumarDias(fecha, -2);
  return fecha;
}
