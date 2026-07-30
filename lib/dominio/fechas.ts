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

/**
 * El parámetro `mes` de una URL → el primer día de ese mes, o null si no sirve.
 *
 * Acepta las DOS formas que conviven en la app: "2026-06" (lo que escribe el
 * navegador de meses, más corto en la barra de direcciones) y "2026-06-01" (lo
 * que arma el resto de los links). Existe porque no aceptar las dos ya causó un
 * bug: la pantalla de presupuesto validaba solo la forma larga, así que al
 * cambiar de mes la URL cambiaba y la pantalla se quedaba en el mes actual, sin
 * ningún error a la vista.
 */
export function mesDesdeParametro(valor: string | undefined): string | null {
  if (!valor) return null;
  const m = /^(\d{4})-(0[1-9]|1[0-2])(-01)?$/.exec(valor);
  return m ? `${m[1]}-${m[2]}-01` : null;
}

/**
 * Último día real del mes: 2026-02-01 → "2026-02-28", 2026-07-01 → "2026-07-31".
 *
 * Existe porque `${mes}-31` PARECE un tope inofensivo para un rango de fechas y
 * no lo es: Postgres rechaza "2026-02-31" con "date/time field value out of
 * range" y la consulta entera falla. Si el llamador no mira el error —el patrón
 * habitual es `const { data } = await ...`— el resultado es peor que un error:
 * la pantalla muestra cero en los cinco meses de 30 días o menos.
 */
export function ultimoDiaDelMes(mes: string): string {
  return `${mes.slice(0, 7)}-${String(diasDelMes(mes)).padStart(2, "0")}`;
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

/** Epoch ms (p. ej. internalDate de Gmail) → YYYY-MM-DD en Buenos Aires. */
export function fechaDesdeMs(ms: number): string {
  return format(new TZDate(ms, HUSO), "yyyy-MM-dd");
}
