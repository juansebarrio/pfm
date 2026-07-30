// Categorías propias del usuario: catálogo de íconos y reglas de nombre.
//
// Vive en el dominio porque lo comparten los dos clientes: el catálogo tiene
// que ser el MISMO en la web y en la nativa, o una categoría creada en el
// teléfono aparecería sin ícono en la web. Cada plataforma mapea estos nombres
// a su paquete de lucide (lucide-react / lucide-react-native), pero la lista
// canónica es esta.

/** Grupo especial: sus categorías solo se ofrecen al cargar un INGRESO. */
export const GRUPO_INGRESOS = "Ingresos";

/** Grupo por defecto de una categoría de gasto sin grupo propio. */
export const GRUPO_OTROS = "Otros";

/**
 * Íconos ofrecidos en el selector, agrupados para que elegir sea rápido.
 * Los nombres son de lucide y tienen que existir en los mapas de las dos
 * plataformas (`components/sistema/IconoCategoria.tsx` y
 * `movil/src/componentes/sistema.tsx`).
 */
export const ICONOS_POR_TEMA: Array<{ tema: string; iconos: string[] }> = [
  { tema: "Casa", iconos: ["house", "building-2", "zap", "flame", "droplet", "wifi", "wrench"] },
  { tema: "Comida", iconos: ["shopping-cart", "utensils", "bike", "coffee"] },
  { tema: "Transporte", iconos: ["fuel", "bus", "car", "plane"] },
  { tema: "Salud", iconos: ["heart-pulse", "pill", "dumbbell"] },
  { tema: "Personal", iconos: ["shirt", "scissors", "graduation-cap", "book", "baby", "dog"] },
  { tema: "Ocio", iconos: ["clapperboard", "tv", "music", "gamepad-2", "ticket", "sparkles", "camera"] },
  { tema: "Plata", iconos: ["piggy-bank", "banknote", "briefcase", "hand-coins", "landmark", "shield", "receipt", "smartphone", "gift", "tag"] },
];

/** Todos los íconos del catálogo, en un solo array. */
export const ICONOS_DISPONIBLES: string[] = ICONOS_POR_TEMA.flatMap((g) => g.iconos);

/**
 * Clave de comparación de nombres: sin tildes, sin mayúsculas y con los
 * espacios colapsados. Así "Café  Cuervo" y "cafe cuervo" son la misma
 * categoría y no se duplican (el problema que ya apareció en producción).
 */
export function claveNombre(nombre: string): string {
  return nombre
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ");
}

export type ErrorNombre = "vacio" | "largo" | "repetido";

/**
 * Valida el nombre de una categoría nueva contra las que ya existen en el
 * mismo ámbito. Devuelve null si está bien.
 */
export function validarNombre(
  nombre: string,
  existentes: string[],
): ErrorNombre | null {
  const limpio = nombre.trim();
  if (limpio === "") return "vacio";
  if (limpio.length > 40) return "largo";
  const clave = claveNombre(limpio);
  return existentes.some((e) => claveNombre(e) === clave) ? "repetido" : null;
}

export const MENSAJE_ERROR_NOMBRE: Record<ErrorNombre, string> = {
  vacio: "Ponele un nombre",
  largo: "Máximo 40 caracteres",
  repetido: "Ya tenés una categoría con ese nombre",
};
