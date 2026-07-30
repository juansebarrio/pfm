import * as ImageManipulator from "expo-image-manipulator";
import * as ImagePicker from "expo-image-picker";

// Sacar o elegir la foto de un comprobante y prepararla para subir.
//
// POR QUÉ REESCALAR. La cámara del iPhone da ~4000 px y varios MB. Para leer un
// ticket no aporta nada: el texto ya es legible a 1600 px, y el modelo cobra por
// píxel. Reescalar antes de subir baja el costo, la latencia y los datos
// móviles de una vez. Espeja lib/imagen.ts de la web.
//
// La imagen NO se guarda en ninguna parte: se manda, se lee y se descarta. El
// archivo temporal que deja el picker lo limpia iOS solo.

const LADO_MAXIMO = 1600;
const CALIDAD = 0.82;

export type ImagenLista = {
  tipo: "image/jpeg";
  /** los bytes en base64, sin el prefijo data: */
  base64: string;
  /** uri local para la miniatura */
  uri: string;
};

/** Motivo por el que no hay imagen: cada uno se le cuenta distinto al usuario. */
export type FalloImagen = "cancelado" | "sin-permiso-camara" | "sin-permiso-fotos" | "error";

export type ResultadoImagen =
  | { ok: true; imagen: ImagenLista }
  | { ok: false; motivo: FalloImagen };

/**
 * Un HEIC de iPhone entra acá y sale JPEG reescalado, sin que nadie lo note.
 *
 * El reescalado es CONDICIONAL y va sobre el lado más largo. Dos trampas de
 * resize() que esto evita: pedirle `width: 1600` a un screenshot de 420 px lo
 * AGRANDA (más bytes, cero información nueva), y fijar el ancho en una foto
 * vertical de un ticket largo deja el alto en 3000 px sin tocar.
 */
async function preparar(uri: string, ancho: number, alto: number): Promise<ImagenLista> {
  let contexto = ImageManipulator.ImageManipulator.manipulate(uri);
  if (Math.max(ancho, alto) > LADO_MAXIMO) {
    contexto = contexto.resize(
      ancho >= alto ? { width: LADO_MAXIMO } : { height: LADO_MAXIMO },
    );
  }
  const imagen = await contexto.renderAsync();
  const guardada = await imagen.saveAsync({
    compress: CALIDAD,
    format: ImageManipulator.SaveFormat.JPEG,
    base64: true,
  });
  if (!guardada.base64) throw new Error("sin base64");
  return { tipo: "image/jpeg", base64: guardada.base64, uri: guardada.uri };
}

/** Cámara: el caso del ticket de papel que tenés en la mano. */
export async function sacarFoto(): Promise<ResultadoImagen> {
  const permiso = await ImagePicker.requestCameraPermissionsAsync();
  if (!permiso.granted) return { ok: false, motivo: "sin-permiso-camara" };

  const r = await ImagePicker.launchCameraAsync({
    mediaTypes: ["images"],
    quality: 1, // la compresión la hace preparar(), después de reescalar
  });
  if (r.canceled || !r.assets[0]) return { ok: false, motivo: "cancelado" };
  return await procesar(r.assets[0]);
}

/** Galería: el caso del screenshot del mail o del comprobante de transferencia. */
export async function elegirDeGaleria(): Promise<ResultadoImagen> {
  // en iOS el picker moderno no necesita permiso para elegir de a una, pero
  // pedirlo igual deja claro el propósito y funciona en las dos plataformas
  const permiso = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permiso.granted) return { ok: false, motivo: "sin-permiso-fotos" };

  const r = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 1,
  });
  if (r.canceled || !r.assets[0]) return { ok: false, motivo: "cancelado" };
  return await procesar(r.assets[0]);
}

/** El asset del picker → la imagen lista. Un fallo acá no tira la pantalla. */
async function procesar(asset: ImagePicker.ImagePickerAsset): Promise<ResultadoImagen> {
  try {
    return { ok: true, imagen: await preparar(asset.uri, asset.width, asset.height) };
  } catch {
    return { ok: false, motivo: "error" };
  }
}

export const MENSAJE_FALLO: Record<Exclude<FalloImagen, "cancelado">, string> = {
  "sin-permiso-camara":
    "Para sacarle una foto al comprobante hay que dar permiso de cámara en Ajustes.",
  "sin-permiso-fotos": "Para elegir un comprobante hay que dar permiso de fotos en Ajustes.",
  error: "No pude leer esa imagen. Probá con otra foto o un screenshot.",
};
