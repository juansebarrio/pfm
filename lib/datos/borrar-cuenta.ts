import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Borrado de cuenta. Apple lo exige desde 2022: tiene que poder hacerse DESDE
 * la app, no por mail (guía 5.1.1(v)). Lo comparten la web y la app nativa.
 *
 * La regla de fondo: lo tuyo se va, lo del hogar queda si el hogar sigue vivo.
 *
 *  · Hogar donde eras el único: se borra el hogar entero. Todo cuelga de
 *    `hogar_id ... on delete cascade`, así que una sola sentencia limpia
 *    cuentas, tarjetas, ciclos, movimientos, presupuestos y tenencias.
 *  · Hogar compartido: el presupuesto y los movimientos compartidos son de la
 *    casa, no tuyos — borrarlos le vaciaría el historial a la otra persona.
 *    Esas filas se reasignan a quien queda; solo se borra lo estrictamente
 *    personal.
 *
 * Al final se borra el usuario de auth. Ese paso tiene que ir último: once
 * tablas apuntan a auth.users sin cascade, así que si queda una fila colgada
 * el delete falla — y falla ruidosamente, que es lo que queremos.
 */
export async function borrarCuenta(
  userId: string,
  /** El cliente del propio usuario. Se usa para un solo paso: ascender a su
   *  sucesor antes de irse (ver `vaciarloDelHogar`). */
  suyo: SupabaseClient,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const admin = crearClienteAdmin();

  // La cuenta de demo es de todos: el botón del login le da una sesión a
  // cualquiera, así que sin esta guarda cualquier visitante anónimo podría
  // borrar el dataset entero (y el borrado llega hasta auth.users: la demo
  // dejaría de existir). Se chequea acá — y no en la UI — para cubrir a la
  // web, a la app nativa y a cualquier cliente futuro con un solo candado.
  if (process.env.DEMO_EMAIL) {
    const { data: usuario } = await admin.auth.admin.getUserById(userId);
    if (usuario?.user?.email === process.env.DEMO_EMAIL) {
      return {
        ok: false,
        error: "La cuenta de demo es compartida y no se puede borrar.",
      };
    }
  }

  const { data: membresias, error: errMembresias } = await admin
    .from("miembros_hogar")
    .select("hogar_id")
    .eq("user_id", userId);
  if (errMembresias) return { ok: false, error: "No pudimos leer tus hogares" };

  for (const { hogar_id } of membresias ?? []) {
    const { data: otros, error: errOtros } = await admin
      .from("miembros_hogar")
      .select("user_id")
      .eq("hogar_id", hogar_id)
      .neq("user_id", userId);
    if (errOtros) return { ok: false, error: "No pudimos leer el hogar" };

    if (!otros || otros.length === 0) {
      const { error } = await admin.from("hogares").delete().eq("id", hogar_id);
      if (error) return { ok: false, error: "No pudimos borrar tu hogar" };
      continue;
    }

    const heredero = otros[0].user_id;
    const problema = await vaciarloDelHogar(admin, suyo, userId, hogar_id, heredero);
    if (problema) return { ok: false, error: problema };
  }

  // Gmail y sugerencias sí cascadean desde auth.users; el resto ya no existe.
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) return { ok: false, error: "No pudimos borrar tu usuario" };
  return { ok: true };
}

type Admin = ReturnType<typeof crearClienteAdmin>;

/** Tablas donde `user_id` marca al dueño de una fila PERSONAL: esas se borran. */
const PERSONALES = [
  { tabla: "movimientos", columna: "visibilidad", valor: "personal" },
  { tabla: "cuentas", columna: "visibilidad", valor: "personal" },
  { tabla: "tarjetas", columna: "visibilidad", valor: "personal" },
  { tabla: "categorias", columna: "ambito", valor: "personal" },
  { tabla: "presupuestos", columna: "ambito", valor: "personal" },
  { tabla: "recurrentes", columna: "visibilidad", valor: "personal" },
] as const;

/**
 * Saca al usuario de un hogar que sigue vivo: borra lo personal y le pasa lo
 * compartido al heredero. Devuelve un mensaje si algo falló, o null si salió.
 */
async function vaciarloDelHogar(
  admin: Admin,
  suyo: SupabaseClient,
  userId: string,
  hogarId: string,
  heredero: string,
): Promise<string | null> {
  // 1. lo personal se va. Las compras en cuotas primero: sus movimientos hijos
  //    cascadean, así no quedan cuotas huérfanas de una compra ya borrada.
  const { error: errCompras } = await admin
    .from("compras_en_cuotas")
    .delete()
    .eq("hogar_id", hogarId)
    .eq("user_id", userId)
    .eq("visibilidad", "personal");
  if (errCompras) return "No pudimos borrar tus compras en cuotas";

  for (const { tabla, columna, valor } of PERSONALES) {
    const { error } = await admin
      .from(tabla)
      .delete()
      .eq("hogar_id", hogarId)
      .eq("user_id", userId)
      .eq(columna, valor);
    if (error) return `No pudimos borrar tus ${tabla}`;
  }

  // 2. las tenencias son siempre de una persona: se van todas
  const { error: errTenencias } = await admin
    .from("tenencias")
    .delete()
    .eq("hogar_id", hogarId)
    .eq("user_id", userId);
  if (errTenencias) return "No pudimos borrar tus tenencias";

  // 3. lo compartido cambia de dueño en vez de desaparecer
  const compartidas = [
    "movimientos",
    "cuentas",
    "tarjetas",
    "categorias",
    "presupuestos",
    "recurrentes",
    "compras_en_cuotas",
  ];
  for (const tabla of compartidas) {
    const { error } = await admin
      .from(tabla)
      .update({ user_id: heredero })
      .eq("hogar_id", hogarId)
      .eq("user_id", userId);
    if (error) return `No pudimos traspasar ${tabla}`;
  }

  // 4. el hogar y las invitaciones que creaste también apuntan a tu usuario
  const { error: errHogar } = await admin
    .from("hogares")
    .update({ creado_por: heredero })
    .eq("id", hogarId)
    .eq("creado_por", userId);
  if (errHogar) return "No pudimos traspasar el hogar";

  const { error: errInv } = await admin
    .from("invitaciones")
    .delete()
    .eq("hogar_id", hogarId)
    .eq("creada_por", userId);
  if (errInv) return "No pudimos borrar tus invitaciones";

  // 5. Si te vas siendo el único administrador, ascendés a tu sucesor antes de
  //    irte: un hogar sin admin no se puede invitar ni administrar más.
  //
  //    ⚠️ Este paso va con TU cliente, no con el de admin. El trigger
  //    `proteger_rol_miembro` (20260711090001_seguridad.sql) rechaza cualquier
  //    cambio de rol si `es_administrador(hogar_id)` es falso — y para la
  //    service key no hay `auth.uid()`, así que da falso y tira excepción.
  //    Con tu propio JWT el trigger ve a un administrador legítimo y pasa, que
  //    además es la semántica correcta: el que se va deja a alguien a cargo.
  const { data: admins } = await admin
    .from("miembros_hogar")
    .select("user_id, rol")
    .eq("hogar_id", hogarId)
    .eq("rol", "administrador");
  const otrosAdmins = (admins ?? []).filter((a) => a.user_id !== userId);
  const yoSoyAdmin = (admins ?? []).some((a) => a.user_id === userId);

  if (otrosAdmins.length === 0 && yoSoyAdmin) {
    const { error } = await suyo
      .from("miembros_hogar")
      .update({ rol: "administrador" })
      .eq("hogar_id", hogarId)
      .eq("user_id", heredero);
    if (error) return "No pudimos dejar un administrador en el hogar";
  }

  // la membresía se va sola con auth.users (es la única con on delete cascade)
  return null;
}
