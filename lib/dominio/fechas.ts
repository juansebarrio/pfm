// Fechas de negocio como strings YYYY-MM-DD, sin hora. Los cortes de mes y
// ciclo se calculan SIEMPRE en America/Argentina/Buenos_Aires, sin importar
// dónde corra el servidor.
import { TZDate } from "@date-fns/tz";
import { format } from "date-fns";
import { es } from "date-fns/locale";

export const HUSO = "America/Argentina/Buenos_Aires";

/** Hoy en Buenos Aires, YYYY-MM-DD. */
export function hoyBA(): string {
  return format(TZDate.tz(HUSO), "yyyy-MM-dd");
}

function aFecha(fecha: string): TZDate {
  const [anio, mes, dia] = fecha.split("-").map(Number);
  return new TZDate(anio, mes - 1, dia, HUSO);
}

/** Primer día del mes de una fecha: 2026-07-10 → 2026-07-01. */
export function mesDe(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

export function diaDelMes(fecha: string): number {
  return Number(fecha.slice(8, 10));
}

export function diasDelMes(fecha: string): number {
  const [anio, mes] = fecha.split("-").map(Number);
  return new Date(Date.UTC(anio, mes, 0)).getUTCDate();
}

export function mesAnterior(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const total = anio * 12 + (m - 1) - 1;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

export function mesSiguiente(mes: string): string {
  const [anio, m] = mes.split("-").map(Number);
  const total = anio * 12 + (m - 1) + 1;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
}

/** "julio 2026" */
export function formatearMesLargo(mes: string): string {
  return format(aFecha(mes), "MMMM yyyy", { locale: es });
}

/** "julio" */
export function formatearMesSolo(mes: string): string {
  return format(aFecha(mes), "MMMM", { locale: es });
}

/** "viernes 10 de julio" */
export function formatearDiaLargo(fecha: string): string {
  return format(aFecha(fecha), "EEEE d 'de' MMMM", { locale: es });
}

/** "10 jul" — sin punto, como el export */
export function formatearDiaCorto(fecha: string): string {
  return format(aFecha(fecha), "d MMM", { locale: es }).replace(".", "");
}

/** "Hoy" / "Ayer" / "8 jul" para los separadores de día. */
export function etiquetaDia(fecha: string, hoy: string): string {
  if (fecha === hoy) return "Hoy";
  const d = aFecha(hoy);
  d.setDate(d.getDate() - 1);
  if (fecha === format(d, "yyyy-MM-dd")) return "Ayer";
  return formatearDiaCorto(fecha);
}

/** Días de diferencia (b − a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}
