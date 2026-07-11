import "server-only";
import type { SesionHogar } from "./sesion";

export type MiembroHogar = {
  userId: string;
  nombre: string;
  descripcion: string | null; // "adulta del hogar"
  rol: "administrador" | "miembro";
  esUsuarioActual: boolean;
};

export type InvitacionPendiente = {
  id: string;
  email: string;
  rol: "administrador" | "miembro";
  token: string;
  creadoEl: string; // ISO
  venceEl: string; // ISO
};

export type DatosHogar = {
  id: string;
  nombre: string;
  miembros: MiembroHogar[];
  invitacionesPendientes: InvitacionPendiente[];
};

export async function obtenerHogar(sesion: SesionHogar): Promise<DatosHogar> {
  const [{ data: hogar }, { data: miembros }, { data: invitaciones }] = await Promise.all([
    sesion.supabase.from("hogares").select("id, nombre").eq("id", sesion.hogarId).single(),
    sesion.supabase
      .from("miembros_hogar")
      .select("user_id, nombre, descripcion, rol, creado_el")
      .eq("hogar_id", sesion.hogarId)
      .order("creado_el", { ascending: true }),
    sesion.supabase
      .from("invitaciones")
      .select("id, email, rol, token, creado_el, vence_el")
      .eq("hogar_id", sesion.hogarId)
      .eq("estado", "pendiente")
      .order("creado_el", { ascending: true }),
  ]);

  return {
    id: sesion.hogarId,
    nombre: hogar?.nombre ?? "Mi hogar",
    miembros: (miembros ?? []).map((m) => ({
      userId: m.user_id,
      nombre: m.nombre,
      descripcion: m.descripcion,
      rol: m.rol,
      esUsuarioActual: m.user_id === sesion.userId,
    })),
    invitacionesPendientes: (invitaciones ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      rol: i.rol,
      token: i.token,
      creadoEl: i.creado_el,
      venceEl: i.vence_el,
    })),
  };
}
