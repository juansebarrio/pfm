import { diasDelMes } from "./fechas";

// La grilla del calendario mensual: semanas de lunes a domingo, con celdas
// vacías de relleno en los bordes. Aritmética pura sobre fechas YYYY-MM-DD
// (sin objetos Date con huso: el string ES la fecha, como en todo el dominio).
//
// La vista que lo consume pinta cada día según su relación con hoy: los
// pasados cuentan lo que pasó (movimientos reales) y los futuros lo que
// viene (recurrentes con su día de vencimiento).

export const DIAS_SEMANA = ["L", "M", "M", "J", "V", "S", "D"] as const;

/** 0 = lunes … 6 = domingo, del primer día del mes. */
function columnaDelPrimerDia(mes: string): number {
  const [a, m] = mes.split("-").map(Number);
  // getUTCDay: 0 = domingo; la semana argentina arranca en lunes
  const dia = new Date(Date.UTC(a, m - 1, 1)).getUTCDay();
  return (dia + 6) % 7;
}

/**
 * Las semanas del mes como filas de 7 fechas ("YYYY-MM-DD") o null de
 * relleno. `mes` es "YYYY-MM-01".
 */
export function semanasDelMes(mes: string): (string | null)[][] {
  const prefijo = mes.slice(0, 8); // "YYYY-MM-"
  const dias = diasDelMes(mes);
  const corrimiento = columnaDelPrimerDia(mes);

  const celdas: (string | null)[] = [
    ...Array.from({ length: corrimiento }, () => null),
    ...Array.from({ length: dias }, (_, i) => `${prefijo}${String(i + 1).padStart(2, "0")}`),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  const semanas: (string | null)[][] = [];
  for (let i = 0; i < celdas.length; i += 7) semanas.push(celdas.slice(i, i + 7));
  return semanas;
}

export type DiaConPlata = {
  gastosCentavos: number;
  ingresosCentavos: number;
};

/**
 * Agrupa movimientos por fecha para pintar la grilla de un vistazo.
 * Recibe filas mínimas (fecha, tipo, importe) para servir a las dos apps.
 */
export function plataPorDia(
  movimientos: Array<{ fecha: string; tipo: "gasto" | "ingreso"; importeCentavos: number }>,
): Map<string, DiaConPlata> {
  const porDia = new Map<string, DiaConPlata>();
  for (const m of movimientos) {
    const dia = porDia.get(m.fecha) ?? { gastosCentavos: 0, ingresosCentavos: 0 };
    if (m.tipo === "ingreso") dia.ingresosCentavos += m.importeCentavos;
    else dia.gastosCentavos += m.importeCentavos;
    porDia.set(m.fecha, dia);
  }
  return porDia;
}

/**
 * Los recurrentes de un mes, resueltos a fecha concreta. `diaMes` está
 * acotado a 1–28 por la base, así que siempre cae dentro del mes.
 */
export function recurrentesPorDia<T extends { diaMes: number }>(
  mes: string,
  recurrentes: T[],
): Map<string, T[]> {
  const prefijo = mes.slice(0, 8);
  const porDia = new Map<string, T[]>();
  for (const r of recurrentes) {
    const fecha = `${prefijo}${String(r.diaMes).padStart(2, "0")}`;
    porDia.set(fecha, [...(porDia.get(fecha) ?? []), r]);
  }
  return porDia;
}
