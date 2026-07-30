// Preparar una foto de comprobante para mandarla a leer.
//
// POR QUÉ REESCALAR EN EL CLIENTE. Una foto de iPhone son ~4000 px de ancho y
// varios MB. Para leer un ticket eso no aporta nada: el texto ya es legible a
// 1600 px, y el modelo cobra por píxel. Reescalar antes de subir baja el costo,
// la latencia y el uso de datos móviles de una vez.
//
// Vive fuera de /app porque también lo usa el compositor del chat y no tiene
// nada de servidor: es canvas puro.

/** Lado máximo de la imagen que se sube. Suficiente para leer un ticket. */
const LADO_MAXIMO = 1600;

/** JPEG con calidad alta pero no absurda: el ruido de una foto no comprime. */
const CALIDAD = 0.82;

export const TIPOS_ACEPTADOS = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];

export type ImagenLista = {
  /** image/jpeg salvo que se haya podido dejar el original */
  tipo: "image/jpeg" | "image/png" | "image/webp";
  /** los bytes en base64, SIN el prefijo data: */
  base64: string;
  /** data URL para la miniatura, que ya la tenemos armada */
  vistaPrevia: string;
};

/**
 * Un File del input o de la cámara → la imagen lista para subir.
 *
 * Sale siempre JPEG: es lo que la API acepta y lo que comprime mejor una foto.
 * Un HEIC de iPhone entra acá y sale JPEG sin que nadie tenga que saberlo,
 * porque el decode lo hace el navegador.
 */
export async function prepararImagen(archivo: File): Promise<ImagenLista> {
  const bitmap = await createImageBitmap(archivo);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const lienzo = document.createElement("canvas");
  lienzo.width = ancho;
  lienzo.height = alto;
  const pincel = lienzo.getContext("2d");
  if (!pincel) throw new Error("no se pudo procesar la imagen");
  pincel.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const dataUrl = lienzo.toDataURL("image/jpeg", CALIDAD);
  const coma = dataUrl.indexOf(",");
  if (coma === -1) throw new Error("no se pudo procesar la imagen");

  return {
    tipo: "image/jpeg",
    base64: dataUrl.slice(coma + 1),
    vistaPrevia: dataUrl,
  };
}
