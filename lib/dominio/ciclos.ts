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

export type CicloEstimado = { fechaCierre: string; fechaVencimiento: string };

/**
 * Propone el ciclo siguiente a partir del último cierre: mismo día del mes
 * siguiente, corrido a día hábil hacia atrás si cae en fin de semana
 * (los cierres bancarios no caen sábado ni domingo). Queda `estimado`.
 */
export function proponerCicloSiguiente(ultimoCierre: string): CicloEstimado {
  const cierre = correrADiaHabil(sumarUnMes(ultimoCierre));
  // vencimiento estimado: 9 días corridos después del cierre, a día hábil
  const vencimiento = correrADiaHabil(sumarDias(cierre, 9));
  return { fechaCierre: cierre, fechaVencimiento: vencimiento };
}

/**
 * Primer ciclo estimado de una tarjeta recién dada de alta: el primer cierre
 * en el día `diaCierre` del mes que sea >= `desde` (hoy). Si ya pasó este mes,
 * arranca el mes siguiente.
 */
export function primerCicloEstimado(diaCierre: number, desde: string): CicloEstimado {
  const [anio, mes] = desde.split("-").map(Number);
  const conDia = (a: number, m: number) => {
    const ultimoDia = new Date(Date.UTC(a, m, 0)).getUTCDate();
    const d = Math.min(diaCierre, ultimoDia);
    return `${a}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  };
  // se compara con el día NOMINAL (sin correr a hábil) para no perder el mes
  let cierreNominal = conDia(anio, mes);
  if (cierreNominal < desde) {
    const total = anio * 12 + (mes - 1) + 1;
    cierreNominal = conDia(Math.floor(total / 12), (total % 12) + 1);
  }
  const cierre = correrADiaHabil(cierreNominal);
  const vencimiento = correrADiaHabil(sumarDias(cierre, 9));
  return { fechaCierre: cierre, fechaVencimiento: vencimiento };
}

/**
 * Genera ciclos estimados sucesivos a partir del último cierre conocido, hasta
 * que uno de ellos cubra `fechaObjetivo` (fecha_cierre >= objetivo). Sirve para
 * que un consumo o una cuota futura tengan siempre un ciclo donde caer.
 * Devuelve solo los ciclos NUEVOS (vacío si el último ya cubría). Cota dura de
 * 60 meses para no lazar de más ante fechas absurdas.
 */
export function generarCiclosHasta(
  ultimoCierre: string,
  fechaObjetivo: string,
): CicloEstimado[] {
  const nuevos: CicloEstimado[] = [];
  let cierre = ultimoCierre;
  while (cierre < fechaObjetivo && nuevos.length < 60) {
    const siguiente = proponerCicloSiguiente(cierre);
    nuevos.push(siguiente);
    cierre = siguiente.fechaCierre;
  }
  return nuevos;
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
