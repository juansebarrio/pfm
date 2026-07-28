/**
 * Prueba del borrado de cuenta contra la base real, con usuarios descartables.
 * Cubre las dos ramas: hogar de una sola persona (se borra entero) y hogar
 * compartido (lo compartido se traspasa, lo personal se va).
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const admin = createClient(URL, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const API = process.env.APP_URL ?? "http://localhost:3000";

/** Una aserción con las dos frases: la que se lee si salió y la que si no. */
function chequear(condicion: boolean, salio: string, fallo: string) {
  if (condicion) {
    console.log(`  ✓ ${salio}`);
    return;
  }
  console.error(`  ✗ ${fallo}`);
  process.exitCode = 1;
}

async function crearUsuario(email: string) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: "prueba-borrado-2026",
    email_confirm: true,
  });
  if (error) throw new Error(`${email}: ${error.message}`);
  return data.user!.id;
}

async function token(email: string) {
  const anon = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    auth: { persistSession: false },
  });
  const { data, error } = await anon.auth.signInWithPassword({
    email,
    password: "prueba-borrado-2026",
  });
  if (error) throw new Error(error.message);
  return data.session!.access_token;
}

async function borrarPorAPI(t: string) {
  const r = await fetch(`${API}/api/cuenta`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${t}` },
  });
  return { status: r.status, cuerpo: r.status === 204 ? "" : await r.text() };
}

async function movimiento(hogarId: string, userId: string, campos: object) {
  const { data, error } = await admin
    .from("movimientos")
    .insert({
      hogar_id: hogarId,
      user_id: userId,
      tipo: "gasto",
      importe_centavos: 100000,
      fecha: "2026-07-20",
      ...campos,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return data.id as string;
}

async function main() {
  const sello = Date.now();
  const solo = `borrado-solo-${sello}@prueba.local`;
  const seVa = `borrado-seva-${sello}@prueba.local`;
  const queda = `borrado-queda-${sello}@prueba.local`;

  // ─────────────────────────────── caso 1: único miembro
  console.log("\ncaso 1 · hogar de una sola persona");
  const idSolo = await crearUsuario(solo);
  const { data: h1 } = await admin
    .from("hogares")
    .insert({ nombre: "Hogar prueba solo", creado_por: idSolo })
    .select("id")
    .single();
  await admin
    .from("miembros_hogar")
    .insert({ hogar_id: h1!.id, user_id: idSolo, nombre: "Solo", rol: "administrador" });
  const { data: c1 } = await admin
    .from("cuentas")
    .insert({ hogar_id: h1!.id, user_id: idSolo, nombre: "Caja", tipo: "efectivo" })
    .select("id")
    .single();
  await movimiento(h1!.id, idSolo, { descripcion: "Gasto solo", cuenta_id: c1!.id });

  const r1 = await borrarPorAPI(await token(solo));
  chequear(r1.status === 204, "la API respondió 204", `API ${r1.status}: ${r1.cuerpo}`);

  const { data: hogarQuedo } = await admin
    .from("hogares")
    .select("id")
    .eq("id", h1!.id)
    .maybeSingle();
  chequear(!(hogarQuedo), "el hogar se borró entero", "el hogar sigue existiendo");

  const { count: movsQuedaron } = await admin
    .from("movimientos")
    .select("id", { count: "exact", head: true })
    .eq("hogar_id", h1!.id);
  chequear(movsQuedaron === 0, "los movimientos cascadearon", `quedaron ${movsQuedaron} movimientos`);

  const { data: u1 } = await admin.auth.admin.getUserById(idSolo);
  chequear(!(u1.user), "el usuario se borró de auth", "el usuario sigue en auth");

  // ─────────────────────────────── caso 2: hogar compartido
  console.log("\ncaso 2 · hogar compartido");
  const idSeVa = await crearUsuario(seVa);
  const idQueda = await crearUsuario(queda);
  const { data: h2 } = await admin
    .from("hogares")
    .insert({ nombre: "Hogar prueba compartido", creado_por: idSeVa })
    .select("id")
    .single();
  await admin.from("miembros_hogar").insert([
    { hogar_id: h2!.id, user_id: idSeVa, nombre: "SeVa", rol: "administrador" },
    { hogar_id: h2!.id, user_id: idQueda, nombre: "Queda", rol: "miembro" },
  ]);
  const { data: c2 } = await admin
    .from("cuentas")
    .insert({ hogar_id: h2!.id, user_id: idSeVa, nombre: "Banco", tipo: "banco" })
    .select("id")
    .single();

  const compartido = await movimiento(h2!.id, idSeVa, {
    descripcion: "Súper del hogar",
    cuenta_id: c2!.id,
    visibilidad: "compartido",
  });
  const personal = await movimiento(h2!.id, idSeVa, {
    descripcion: "Mi cafecito",
    cuenta_id: c2!.id,
    visibilidad: "personal",
  });
  const delOtro = await movimiento(h2!.id, idQueda, {
    descripcion: "Gasto del otro",
    cuenta_id: c2!.id,
    visibilidad: "compartido",
  });

  const r2 = await borrarPorAPI(await token(seVa));
  chequear(r2.status === 204, "la API respondió 204", `API ${r2.status}: ${r2.cuerpo}`);

  const { data: h2Quedo } = await admin
    .from("hogares")
    .select("id, creado_por")
    .eq("id", h2!.id)
    .maybeSingle();
  chequear(h2Quedo !== null, "el hogar sobrevivió", "se borró el hogar compartido");
  chequear(h2Quedo?.creado_por === idQueda, "el hogar quedó a nombre del que queda", "creado_por no se traspasó");

  const { data: mCompartido } = await admin
    .from("movimientos")
    .select("id, user_id")
    .eq("id", compartido)
    .maybeSingle();
  chequear(mCompartido !== null, "el movimiento compartido sobrevivió", "se perdió el movimiento compartido");
  chequear(mCompartido?.user_id === idQueda, "y quedó a nombre del que queda", "el compartido no se traspasó");

  const { data: mPersonal } = await admin
    .from("movimientos")
    .select("id")
    .eq("id", personal)
    .maybeSingle();
  chequear(!(mPersonal), "lo personal se borró", "el movimiento personal sobrevivió");

  const { data: mOtro } = await admin
    .from("movimientos")
    .select("id, user_id")
    .eq("id", delOtro)
    .maybeSingle();
  chequear(mOtro?.user_id === idQueda, "el movimiento del otro quedó intacto", "se tocó el movimiento del otro");

  const { data: rolQueda } = await admin
    .from("miembros_hogar")
    .select("rol")
    .eq("hogar_id", h2!.id)
    .eq("user_id", idQueda)
    .single();
  chequear(rolQueda?.rol === "administrador", "el que queda pasó a administrador", `quedó como ${rolQueda?.rol}: el hogar se queda sin admin`);

  const { count: miembrosAhora } = await admin
    .from("miembros_hogar")
    .select("user_id", { count: "exact", head: true })
    .eq("hogar_id", h2!.id);
  chequear(miembrosAhora === 1, "la membresía del que se fue cascadeó", `quedaron ${miembrosAhora} miembros`);

  // ─────────────────────────────── limpieza
  console.log("\nlimpieza");
  await admin.from("hogares").delete().eq("id", h2!.id);
  await admin.auth.admin.deleteUser(idQueda);
  const { data: sobrantes } = await admin
    .from("hogares")
    .select("id")
    .like("nombre", "Hogar prueba%");
  chequear(sobrantes?.length === 0, "no quedaron hogares de prueba", `quedaron ${sobrantes?.length} hogares de prueba`);
}

main().catch((e) => {
  console.error("explotó:", e.message);
  process.exit(1);
});
