import "server-only";
import type { CicloResumen } from "@/lib/datos/tarjetas";

/** Suma días corridos a una fecha YYYY-MM-DD (negativo resta). */
export function sumarDias(fecha: string, dias: number): string {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  const d = new Date(Date.UTC(anio, mes - 1, dia + dias));
  return d.toISOString().slice(0, 10);
}

/**
 * Ciclo por defecto de 06: el abierto más próximo (primer abierto cuyo
 * cierre no pasó). Si todos los abiertos ya cerraron por fecha, el más
 * reciente de ellos; si no hay abiertos, el último ciclo (histórico).
 * `ciclos` viene ordenado por cierre ascendente (obtenerTarjeta).
 */
export function indiceCicloVigente(ciclos: CicloResumen[], hoy: string): number {
  const abiertos = ciclos
    .map((ciclo, indice) => ({ ciclo, indice }))
    .filter(({ ciclo }) => ciclo.estado === "abierto");
  const proximo = abiertos.find(({ ciclo }) => ciclo.fechaCierre >= hoy);
  if (proximo) return proximo.indice;
  if (abiertos.length > 0) return abiertos[abiertos.length - 1].indice;
  return ciclos.length - 1;
}
