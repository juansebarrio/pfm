import "server-only";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";

const CATEGORIAS_SUGERIDAS: Array<[string, string, string]> = [
  ["Vivienda", "Alquiler", "house"],
  ["Vivienda", "Expensas", "building-2"],
  ["Comida", "Supermercado", "shopping-cart"],
  ["Comida", "Delivery", "bike"],
  ["Comida", "Restaurantes", "utensils"],
  ["Ahorro", "Ahorro e inversión", "piggy-bank"],
  ["Salud", "Prepaga", "heart-pulse"],
  ["Salud", "Farmacia", "pill"],
  ["Servicios", "Luz", "zap"],
  ["Servicios", "Internet", "wifi"],
  ["Servicios", "Celular", "smartphone"],
  ["Suscripciones", "Suscripciones", "tv"],
  ["Transporte", "Nafta", "fuel"],
  ["Transporte", "SUBE", "bus"],
  ["Entretenimiento", "Entretenimiento", "clapperboard"],
];

export type SesionHogar = {
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>;
  userId: string;
  hogarId: string;
  nombreMiembro: string;
  rol: "administrador" | "miembro";
};

/**
 * Usuario + su hogar. Si el usuario recién se registró y no tiene hogar,
 * se le crea uno con las categorías sugeridas (decisión anotada: onboarding
 * sin fricción; el nombre se edita después en /hogar).
 */
export async function obtenerSesionHogar(): Promise<SesionHogar> {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // hogar activo = el último al que te sumaste: así, quien acepta una
  // invitación después de haber recibido su hogar automático aterriza en el
  // hogar compartido (decisión anotada, DESIGN_NOTES.md)
  const { data: miembro } = await supabase
    .from("miembros_hogar")
    .select("hogar_id, rol, nombre")
    .eq("user_id", user.id)
    .order("creado_el", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (miembro) {
    return {
      supabase,
      userId: user.id,
      hogarId: miembro.hogar_id,
      nombreMiembro: miembro.nombre,
      rol: miembro.rol,
    };
  }

  // primer ingreso: hogar propio + categorías sugeridas
  const nombre =
    (user.user_metadata?.nombre as string | undefined) ??
    user.email?.split("@")[0] ??
    "Yo";
  const { data: hogarId, error } = await supabase.rpc("crear_hogar", {
    nombre_hogar: "Mi hogar",
    nombre_miembro: nombre,
  });
  if (error || !hogarId) {
    throw new Error(`no pude crear el hogar inicial: ${error?.message}`);
  }
  await supabase.from("categorias").insert(
    CATEGORIAS_SUGERIDAS.map(([grupo, nombreCat, icono], i) => ({
      hogar_id: hogarId,
      grupo,
      nombre: nombreCat,
      icono,
      ambito: "hogar",
      orden: i,
    })),
  );

  return { supabase, userId: user.id, hogarId, nombreMiembro: nombre, rol: "administrador" };
}
