import { hoyBA } from "@dominio/fechas";
import { supabase } from "./supabase";
import type { Resultado } from "./acciones";
import type { SesionHogar } from "./datos";

// Escrituras de patrimonio. Espejan app/acciones/patrimonio.ts de la web
// (guardarTenencia / desactivarTenencia): misma validación que su esquema zod
// y misma semántica de fila. Como en acciones.ts, la barrera de seguridad es
// la RLS + los CHECK de la base; la validación de acá es UX, no seguridad.

// ─────────────────────────────── instrumentos (espeja app/(tabs)/patrimonio/instrumentos.ts)

export type Instrumento =
  | "dolar_billete"
  | "dolar_mep"
  | "fci_money_market"
  | "plazo_fijo"
  | "cedears"
  | "cripto"
  | "cuenta_remunerada"
  | "otro";

export const ETIQUETA_INSTRUMENTO: Record<Instrumento, string> = {
  dolar_billete: "Dólar billete",
  dolar_mep: "Dólar MEP",
  fci_money_market: "FCI money market",
  plazo_fijo: "Plazo fijo",
  cedears: "CEDEARs",
  cripto: "Cripto",
  cuenta_remunerada: "Cuenta remunerada",
  otro: "Otro",
};

export const INSTRUMENTOS = Object.keys(ETIQUETA_INSTRUMENTO) as Instrumento[];

/** Instrumentos que guardan cantidad en USD y se valúan al TC activo. */
export const INSTRUMENTOS_EN_USD: ReadonlySet<Instrumento> = new Set([
  "dolar_billete",
  "dolar_mep",
  "cedears",
  "cripto",
]);

/** Solo acá se deja elegir la moneda con el mini toggle; el resto se deriva. */
export const CON_TOGGLE_MONEDA: ReadonlySet<Instrumento> = new Set([
  "cedears",
  "cripto",
  "otro",
]);

/** La sigla va en MAYÚSCULA (MEP); "blue" y "oficial" en minúscula. */
export function etiquetaFuente(fuente: string): string {
  return fuente === "mep" ? "MEP" : fuente;
}

/** Un instrumento guardado que no está en la lista cerrada se edita como "otro" (espeja HojaTenencia). */
export function instrumentoValido(valor: string): Instrumento {
  return (INSTRUMENTOS as readonly string[]).includes(valor)
    ? (valor as Instrumento)
    : "otro";
}

// ─────────────────────────────── tenencias

export type Moneda = "ARS" | "USD";

/** Lo que necesitan las hojas para editar: la fila cruda, no la valuada. */
export type TenenciaEditable = {
  id: string;
  instrumento: string;
  nombre: string;
  detalle: string | null;
  moneda: Moneda;
  cantidadUsdCentavos: number | null;
  valuacionCentavos: number | null;
  fechaValuacion: string;
};

/**
 * La fila cruda de una tenencia, para precargar la hoja de revaluación.
 * obtenerPatrimonio (datos.ts) devuelve la tenencia YA valuada en ARS; acá
 * hace falta la cantidad/valuación original con su fecha.
 */
export async function obtenerTenenciaEditable(
  sesion: SesionHogar,
  tenenciaId: string,
): Promise<TenenciaEditable | null> {
  const { data } = await supabase
    .from("tenencias")
    .select(
      "id, instrumento, nombre, detalle, moneda, cantidad_usd_centavos, valuacion_centavos, fecha_valuacion",
    )
    .eq("id", tenenciaId)
    .eq("hogar_id", sesion.hogarId)
    .eq("activa", true)
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id,
    instrumento: data.instrumento,
    nombre: data.nombre,
    detalle: data.detalle ?? null,
    moneda: data.moneda === "USD" ? "USD" : "ARS",
    cantidadUsdCentavos: data.cantidad_usd_centavos ?? null,
    valuacionCentavos: data.valuacion_centavos ?? null,
    fechaValuacion: data.fecha_valuacion,
  };
}

// Topes del esquema zod de la web (app/acciones/patrimonio.ts).
const MAX_USD_CENTAVOS = 1_000_000_000_00;
const MAX_ARS_CENTAVOS = 100_000_000_000;

export type EntradaTenencia = {
  /** null = alta; con id, edición/revaluación */
  tenenciaId: string | null;
  instrumento: Instrumento;
  nombre: string;
  detalle: string | null;
  moneda: Moneda;
  cantidadUsdCentavos: number | null;
  valuacionCentavos: number | null;
  fechaValuacion: string;
};

/**
 * Alta y edición de tenencia. Espeja guardarTenencia de la web: los
 * instrumentos en dólares guardan cantidad y se convierten con el TC activo;
 * los demás guardan valuación manual en pesos con su fecha.
 */
export async function guardarTenencia(
  sesion: SesionHogar,
  d: EntradaTenencia,
): Promise<Resultado> {
  const nombre = d.nombre.trim();
  if (nombre === "" || nombre.length > 60) {
    return { ok: false, error: "Poné un nombre (hasta 60 letras)" };
  }
  const detalle = d.detalle?.trim() || null;
  if (detalle && detalle.length > 80) {
    return { ok: false, error: "El detalle es muy largo (hasta 80 letras)" };
  }
  if (!(INSTRUMENTOS as readonly string[]).includes(d.instrumento)) {
    return { ok: false, error: "Elegí un instrumento" };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.fechaValuacion)) {
    return { ok: false, error: "Fecha inválida" };
  }
  // mismo refine que la web: USD exige cantidad, ARS exige valuación
  if (d.moneda === "USD") {
    const c = d.cantidadUsdCentavos;
    if (c === null || !Number.isInteger(c) || c <= 0) {
      return { ok: false, error: "Cargá la cantidad en USD" };
    }
    if (c > MAX_USD_CENTAVOS) return { ok: false, error: "Esa cantidad no entra" };
  } else {
    const v = d.valuacionCentavos;
    if (v === null || !Number.isInteger(v) || v <= 0) {
      return { ok: false, error: "Cargá la valuación en pesos" };
    }
    if (v > MAX_ARS_CENTAVOS) return { ok: false, error: "Esa valuación no entra" };
  }

  // misma fila que arma la server action de la web
  const fila = {
    hogar_id: sesion.hogarId,
    user_id: sesion.userId,
    instrumento: d.instrumento,
    nombre,
    detalle,
    moneda: d.moneda,
    cantidad_usd_centavos: d.moneda === "USD" ? d.cantidadUsdCentavos : null,
    valuacion_centavos: d.moneda === "ARS" ? d.valuacionCentavos : null,
    fecha_valuacion: d.fechaValuacion,
    visibilidad: "compartido",
  };

  if (d.tenenciaId) {
    // el select confirma que la RLS dejó pasar el update (0 filas ≠ éxito)
    const { error, data } = await supabase
      .from("tenencias")
      .update(fila)
      .eq("id", d.tenenciaId)
      .eq("hogar_id", sesion.hogarId)
      .select("id");
    if (error || !data?.length) {
      return { ok: false, error: "No pudimos actualizar la tenencia" };
    }
  } else {
    const { error } = await supabase.from("tenencias").insert(fila);
    if (error) return { ok: false, error: "No pudimos guardar la tenencia" };
  }
  return { ok: true };
}

/**
 * Revaluación mínima: valor nuevo con fecha de HOY, el resto queda igual.
 * Es guardarTenencia con la fila precargada — mismo update, menos campos en
 * pantalla. Guardar el mismo valor también sirve: renueva la frescura.
 */
export function revaluarTenencia(
  sesion: SesionHogar,
  tenencia: TenenciaEditable,
  valorCentavos: number,
): Promise<Resultado> {
  return guardarTenencia(sesion, {
    tenenciaId: tenencia.id,
    instrumento: instrumentoValido(tenencia.instrumento),
    nombre: tenencia.nombre,
    detalle: tenencia.detalle,
    moneda: tenencia.moneda,
    cantidadUsdCentavos: tenencia.moneda === "USD" ? valorCentavos : null,
    valuacionCentavos: tenencia.moneda === "ARS" ? valorCentavos : null,
    fechaValuacion: hoyBA(),
  });
}

/** Sin borrado físico: la tenencia se desactiva. Espeja desactivarTenencia web. */
export async function desactivarTenencia(
  sesion: SesionHogar,
  tenenciaId: string,
): Promise<Resultado> {
  const { error, data } = await supabase
    .from("tenencias")
    .update({ activa: false })
    .eq("id", tenenciaId)
    .eq("hogar_id", sesion.hogarId)
    .select("id");
  if (error || !data?.length) return { ok: false, error: "No pudimos desactivar" };
  return { ok: true };
}
