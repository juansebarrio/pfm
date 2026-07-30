"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { obtenerSesionHogar } from "@/lib/datos/sesion";
import {
  GRUPO_INGRESOS,
  ICONOS_DISPONIBLES,
  MENSAJE_ERROR_NOMBRE,
  validarNombre,
} from "@/lib/dominio/categorias";

// Categorías propias del usuario.
//
// Qué se puede y qué no, según la RLS (verificado con un usuario real):
//   crear  ✓   editar ✓   BORRAR ✗ — no hay policy de delete, a propósito:
// los movimientos referencian categorias con una FK sin cascade, así que
// borrar una categoría usada rompería el historial. "Dejar de usarla" se hace
// desactivando su partida en el presupuesto del mes.

export type ResultadoCategoria = { ok: true } | { ok: false; error: string };

const esquemaCrear = z.object({
  nombre: z.string().trim().min(1).max(40),
  grupo: z.string().trim().min(1).max(40),
  icono: z.string().trim().min(1).max(40),
  ambito: z.enum(["hogar", "personal"]),
});

/** El ícono tiene que estar en el catálogo compartido, o cae al fallback. */
function iconoValido(icono: string): string {
  return ICONOS_DISPONIBLES.includes(icono) ? icono : "tag";
}

export async function crearCategoria(entrada: unknown): Promise<ResultadoCategoria> {
  const parseo = esquemaCrear.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const datos = parseo.data;

  const sesion = await obtenerSesionHogar();

  // el nombre no puede chocar con otro del MISMO ámbito (personal: solo tuyas)
  let consulta = sesion.supabase
    .from("categorias")
    .select("nombre")
    .eq("hogar_id", sesion.hogarId)
    .eq("ambito", datos.ambito);
  if (datos.ambito === "personal") consulta = consulta.eq("user_id", sesion.userId);
  const { data: existentes } = await consulta;

  const problema = validarNombre(
    datos.nombre,
    (existentes ?? []).map((c) => c.nombre),
  );
  if (problema) return { ok: false, error: MENSAJE_ERROR_NOMBRE[problema] };

  // orden 500: después de las sugeridas (0-17) y antes de las creadas al
  // pasar (999), así lo que el usuario define a mano se ve primero
  const { error } = await sesion.supabase.from("categorias").insert({
    hogar_id: sesion.hogarId,
    user_id: datos.ambito === "personal" ? sesion.userId : null,
    grupo: datos.grupo,
    nombre: datos.nombre.trim(),
    ambito: datos.ambito,
    icono: iconoValido(datos.icono),
    orden: 500,
  });
  if (error) return { ok: false, error: "No pudimos crear la categoría" };

  revalidar();
  return { ok: true };
}

const esquemaEditar = z.object({
  categoriaId: z.uuid(),
  nombre: z.string().trim().min(1).max(40),
  grupo: z.string().trim().min(1).max(40),
  icono: z.string().trim().min(1).max(40),
});

/**
 * Renombrar / cambiar ícono / mover de grupo. NO cambia el ámbito: una
 * categoría con movimientos del hogar no puede volverse personal sin dejar
 * esos movimientos en un estado raro.
 */
export async function editarCategoria(entrada: unknown): Promise<ResultadoCategoria> {
  const parseo = esquemaEditar.safeParse(entrada);
  if (!parseo.success) return { ok: false, error: "Datos inválidos" };
  const datos = parseo.data;

  const sesion = await obtenerSesionHogar();
  const { data: actual } = await sesion.supabase
    .from("categorias")
    .select("id, ambito, grupo")
    .eq("id", datos.categoriaId)
    .eq("hogar_id", sesion.hogarId)
    .maybeSingle();
  if (!actual) return { ok: false, error: "No encontramos esa categoría" };

  // mover algo de/hacia Ingresos cambiaría de qué lado del alta aparece: se
  // rechaza para no dejar un ingreso categorizado como gasto (o al revés)
  const eraIngreso = actual.grupo === GRUPO_INGRESOS;
  const seraIngreso = datos.grupo === GRUPO_INGRESOS;
  if (eraIngreso !== seraIngreso) {
    return {
      ok: false,
      error: eraIngreso
        ? "Una categoría de ingreso no puede pasar a gasto"
        : "Una categoría de gasto no puede pasar a ingreso",
    };
  }

  let consulta = sesion.supabase
    .from("categorias")
    .select("id, nombre")
    .eq("hogar_id", sesion.hogarId)
    .eq("ambito", actual.ambito);
  if (actual.ambito === "personal") consulta = consulta.eq("user_id", sesion.userId);
  const { data: existentes } = await consulta;

  const problema = validarNombre(
    datos.nombre,
    (existentes ?? []).filter((c) => c.id !== datos.categoriaId).map((c) => c.nombre),
  );
  if (problema) return { ok: false, error: MENSAJE_ERROR_NOMBRE[problema] };

  const { error } = await sesion.supabase
    .from("categorias")
    .update({
      nombre: datos.nombre.trim(),
      grupo: datos.grupo,
      icono: iconoValido(datos.icono),
    })
    .eq("id", datos.categoriaId)
    .eq("hogar_id", sesion.hogarId);
  if (error) return { ok: false, error: "No pudimos guardar los cambios" };

  revalidar();
  return { ok: true };
}

/** Una categoría nueva o renombrada se ve en todas las pantallas que la usan. */
function revalidar() {
  for (const ruta of ["/categorias", "/gasto/nuevo", "/movimientos", "/presupuesto"]) {
    revalidatePath(ruta);
  }
}
