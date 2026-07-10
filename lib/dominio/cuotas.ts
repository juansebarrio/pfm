// Compras en cuotas: generación de movimientos hijos.
// Regla (brief + DESIGN_NOTES.md §1.4): la cuota k devenga el día 1 del mes
// k-ésimo contando desde el mes de la compra. Importe = total/N redondeado
// hacia abajo, con el resto sumado a la PRIMERA cuota para que la suma cierre exacta.

export type CuotaGenerada = {
  n: number; // 1..N
  fecha: string; // YYYY-MM-01
  importeCentavos: number;
};

export function generarCuotas(
  totalCentavos: number,
  nCuotas: number,
  fechaCompra: string, // YYYY-MM-DD
): CuotaGenerada[] {
  if (!Number.isInteger(totalCentavos) || totalCentavos <= 0) {
    throw new Error(`total inválido: ${totalCentavos}`);
  }
  if (!Number.isInteger(nCuotas) || nCuotas < 1 || nCuotas > 60) {
    throw new Error(`cantidad de cuotas inválida: ${nCuotas}`);
  }

  const base = Math.floor(totalCentavos / nCuotas);
  const resto = totalCentavos - base * nCuotas;

  const [anio, mes] = fechaCompra.split("-").map(Number);

  return Array.from({ length: nCuotas }, (_, i) => {
    // mes de la cuota i (0-based) a partir del mes de compra
    const mesesTotales = anio * 12 + (mes - 1) + i;
    const anioCuota = Math.floor(mesesTotales / 12);
    const mesCuota = (mesesTotales % 12) + 1;
    return {
      n: i + 1,
      fecha: `${anioCuota}-${String(mesCuota).padStart(2, "0")}-01`,
      importeCentavos: i === 0 ? base + resto : base,
    };
  });
}

/** Mes (YYYY-MM) en que devenga la última cuota — "termina feb 2027". */
export function mesUltimaCuota(fechaCompra: string, nCuotas: number): string {
  const cuotas = generarCuotas(100, nCuotas, fechaCompra);
  return cuotas[cuotas.length - 1].fecha.slice(0, 7);
}
