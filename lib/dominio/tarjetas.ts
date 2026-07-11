// Lógica pura de tarjetas: resumen proyectado, conciliación y qué computa
// en presupuesto. Criterio contable del brief: el presupuesto trabaja por
// devengado; el pago del resumen es una transferencia y JAMÁS computa como gasto.

export type TipoMovimiento = "gasto" | "ingreso" | "transferencia" | "pago_resumen";

/**
 * Solo los gastos computan en presupuesto (por devengado, con categoría).
 * transferencia y pago_resumen quedan afuera SIEMPRE.
 */
export function computaEnPresupuesto(tipo: TipoMovimiento, categoriaId: string | null): boolean {
  return tipo === "gasto" && categoriaId !== null;
}

/** Resumen proyectado (06): consumos del ciclo + cuotas del mes + impuestos estimados. */
export function proyectadoResumen(entrada: {
  consumosCentavos: number;
  cuotasCentavos: number;
  impuestosCentavos: number;
}): number {
  const { consumosCentavos, cuotasCentavos, impuestosCentavos } = entrada;
  if (
    !Number.isInteger(consumosCentavos) ||
    !Number.isInteger(cuotasCentavos) ||
    !Number.isInteger(impuestosCentavos)
  ) {
    throw new Error("proyectado con valores no enteros");
  }
  return consumosCentavos + cuotasCentavos + impuestosCentavos;
}

export type DiferenciaConciliacion = {
  centavos: number; // real − proyectado (positivo: vino más caro)
  /** verde si la diferencia es chica (≤ 5 % del proyectado), ámbar si es grande */
  tono: "verde" | "ambar";
};

/** Diferencia en vivo de la conciliación (06). */
export function diferenciaConciliacion(
  realCentavos: number,
  proyectadoCentavos: number,
): DiferenciaConciliacion {
  if (!Number.isInteger(realCentavos) || !Number.isInteger(proyectadoCentavos)) {
    throw new Error("conciliación con valores no enteros");
  }
  const centavos = realCentavos - proyectadoCentavos;
  const umbral = Math.round(proyectadoCentavos * 0.05);
  return { centavos, tono: Math.abs(centavos) <= umbral ? "verde" : "ambar" };
}

export type CuotaMensual = { mes: string; centavos: number };

/**
 * Comprometido de los próximos N meses (07): suma de cuotas por mes a partir
 * del mes dado. Los meses sin cuotas van en 0 (barras stub del gráfico).
 */
export function comprometidoPorMes(
  cuotas: Array<{ fecha: string; importeCentavos: number }>,
  desdeMes: string, // YYYY-MM-01
  cantidadMeses: number,
): CuotaMensual[] {
  const [anio, mes] = desdeMes.split("-").map(Number);
  const resultado: CuotaMensual[] = [];
  for (let i = 0; i < cantidadMeses; i++) {
    const total = anio * 12 + (mes - 1) + i;
    const clave = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
    resultado.push({
      mes: `${clave}-01`,
      centavos: cuotas
        .filter((c) => c.fecha.startsWith(clave))
        .reduce((s, c) => s + c.importeCentavos, 0),
    });
  }
  return resultado;
}

/** Primer mes sin cuotas — "en marzo quedás libre". Null si no se libera en la ventana. */
export function mesLibre(comprometido: CuotaMensual[]): string | null {
  // el primer mes con 0 después de haber visto alguno con carga
  let vioCarga = false;
  for (const m of comprometido) {
    if (m.centavos > 0) vioCarga = true;
    else if (vioCarga) return m.mes;
  }
  return null;
}
