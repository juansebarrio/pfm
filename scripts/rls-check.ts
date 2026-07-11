/**
 * Verificación de RLS con usuarios reales.
 * Crea (con la secret key) dos hogares con sus usuarios y datos mezclados de
 * visibilidad, y comprueba (con la publishable key, como haría el navegador):
 *   1. nadie lee NADA de un hogar ajeno,
 *   2. un miembro no ve los movimientos/presupuestos/cuentas PERSONALES de
 *      otro miembro de su propio hogar,
 *   3. nadie escribe en un hogar ajeno ni pisa lo personal de otro.
 * Falla ruidosamente (exit 1) si algo se filtra. Limpia todo al final.
 *
 * Uso: pnpm rls:check
 */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
const PUBLISHABLE = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !SECRET || !PUBLISHABLE) {
  console.error("Faltan variables de Supabase en .env.local");
  process.exit(1);
}

const admin = createClient(URL, SECRET, { auth: { persistSession: false } });

const FIXTURES = [
  { email: "rls-ana@sobres.local", password: "rls-check-ana-2026" }, // hogar Norte, administradora
  { email: "rls-beto@sobres.local", password: "rls-check-beto-2026" }, // hogar Norte, miembro
  { email: "rls-carla@sobres.local", password: "rls-check-carla-2026" }, // hogar Sur
];

let fallas = 0;
function esperar(condicion: boolean, mensaje: string) {
  if (condicion) {
    console.log(`  ✓ ${mensaje}`);
  } else {
    fallas += 1;
    console.error(`  ✗ FILTRACIÓN: ${mensaje}`);
  }
}

async function limpiar() {
  for (const nombre of ["RLS Norte", "RLS Sur"]) {
    const { data } = await admin.from("hogares").select("id").eq("nombre", nombre);
    for (const h of data ?? []) await admin.from("hogares").delete().eq("id", h.id);
  }
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of lista?.users ?? []) {
    if (FIXTURES.some((f) => f.email === u.email)) await admin.auth.admin.deleteUser(u.id);
  }
}

async function main() {
  await limpiar();

  console.log("Armando fixtures (secret key)…");
  const ids: string[] = [];
  for (const f of FIXTURES) {
    const { data, error } = await admin.auth.admin.createUser({
      email: f.email, password: f.password, email_confirm: true,
    });
    if (error || !data.user) throw new Error(`creando ${f.email}: ${error?.message}`);
    ids.push(data.user.id);
  }
  const [ANA, BETO, CARLA] = ids;

  const { data: norte } = await admin.from("hogares").insert({ nombre: "RLS Norte", creado_por: ANA }).select().single();
  const { data: sur } = await admin.from("hogares").insert({ nombre: "RLS Sur", creado_por: CARLA }).select().single();

  await admin.from("miembros_hogar").insert([
    { user_id: ANA, hogar_id: norte!.id, rol: "administrador", nombre: "Ana" },
    { user_id: BETO, hogar_id: norte!.id, rol: "miembro", nombre: "Beto" },
    { user_id: CARLA, hogar_id: sur!.id, rol: "administrador", nombre: "Carla" },
  ]);

  const { data: catNorte } = await admin.from("categorias")
    .insert({ hogar_id: norte!.id, grupo: "Comida", nombre: "Super", ambito: "hogar" })
    .select().single();

  const { data: cuentaCompartida } = await admin.from("cuentas")
    .insert({ hogar_id: norte!.id, user_id: ANA, nombre: "Banco Norte", tipo: "banco", visibilidad: "compartido" })
    .select().single();
  const { data: cuentaPersonalAna } = await admin.from("cuentas")
    .insert({ hogar_id: norte!.id, user_id: ANA, nombre: "Caja secreta de Ana", tipo: "efectivo", visibilidad: "personal" })
    .select().single();

  const { data: movCompartido } = await admin.from("movimientos").insert({
    hogar_id: norte!.id, user_id: ANA, tipo: "gasto", descripcion: "Super compartido",
    importe_centavos: 100000, fecha: "2026-07-10", cuenta_id: cuentaCompartida!.id,
    categoria_id: catNorte!.id, visibilidad: "compartido",
  }).select().single();
  const { data: movPersonalAna } = await admin.from("movimientos").insert({
    hogar_id: norte!.id, user_id: ANA, tipo: "gasto", descripcion: "Regalo sorpresa para Beto",
    importe_centavos: 500000, fecha: "2026-07-10", cuenta_id: cuentaPersonalAna!.id,
    visibilidad: "personal",
  }).select().single();

  const { data: presuPersonalAna } = await admin.from("presupuestos")
    .insert({ hogar_id: norte!.id, mes: "2026-07-01", ambito: "personal", user_id: ANA })
    .select().single();

  await admin.from("tenencias").insert({
    hogar_id: norte!.id, user_id: ANA, instrumento: "dolar_billete", nombre: "Dólares de Ana",
    moneda: "USD", cantidad_usd_centavos: 100000, fecha_valuacion: "2026-07-10", visibilidad: "personal",
  });

  await admin.from("movimientos").insert({
    hogar_id: sur!.id, user_id: CARLA, tipo: "ingreso", descripcion: "Sueldo de Carla",
    importe_centavos: 900000, fecha: "2026-07-10",
    cuenta_id: (await admin.from("cuentas").insert({
      hogar_id: sur!.id, user_id: CARLA, nombre: "Banco Sur", tipo: "banco",
    }).select().single()).data!.id,
  });

  // -------------------------------------------------- sesiones reales
  const sesion = async (email: string, password: string) => {
    const cliente = createClient(URL!, PUBLISHABLE!, { auth: { persistSession: false } });
    const { error } = await cliente.auth.signInWithPassword({ email, password });
    if (error) throw new Error(`login ${email}: ${error.message}`);
    return cliente;
  };
  const ana = await sesion(FIXTURES[0].email, FIXTURES[0].password);
  const beto = await sesion(FIXTURES[1].email, FIXTURES[1].password);
  const carla = await sesion(FIXTURES[2].email, FIXTURES[2].password);

  console.log("\n1) Aislamiento entre hogares (Carla vs hogar Norte):");
  for (const tabla of ["hogares", "miembros_hogar", "cuentas", "movimientos", "categorias", "presupuestos", "tenencias"]) {
    const { data } = await carla.from(tabla).select("*");
    const ajenos = (data ?? []).filter((r: { hogar_id?: string; id?: string }) =>
      "hogar_id" in r ? r.hogar_id === norte!.id : r.id === norte!.id,
    );
    esperar(ajenos.length === 0, `Carla no lee ${tabla} del hogar Norte`);
  }
  const { data: carlaVeSuyo } = await carla.from("movimientos").select("*");
  esperar((carlaVeSuyo ?? []).length === 1, "Carla sí ve su propio movimiento");

  console.log("\n2) Lo personal dentro del mismo hogar (Beto vs lo de Ana):");
  const { data: movsBeto } = await beto.from("movimientos").select("*");
  esperar(
    (movsBeto ?? []).some((m) => m.id === movCompartido!.id),
    "Beto ve el movimiento compartido del hogar",
  );
  esperar(
    !(movsBeto ?? []).some((m) => m.id === movPersonalAna!.id),
    "Beto NO ve el movimiento personal de Ana",
  );
  const { data: cuentasBeto } = await beto.from("cuentas").select("*");
  esperar(
    !(cuentasBeto ?? []).some((c) => c.id === cuentaPersonalAna!.id),
    "Beto NO ve la cuenta personal de Ana",
  );
  const { data: presusBeto } = await beto.from("presupuestos").select("*");
  esperar(
    !(presusBeto ?? []).some((p) => p.id === presuPersonalAna!.id),
    "Beto NO ve el presupuesto personal de Ana",
  );
  const { data: partidasBeto } = await beto.from("partidas_presupuesto").select("*");
  esperar((partidasBeto ?? []).length === 0, "Beto NO ve partidas del presupuesto personal de Ana");
  const { data: tenenciasBeto } = await beto.from("tenencias").select("*");
  esperar((tenenciasBeto ?? []).length === 0, "Beto NO ve la tenencia personal de Ana");

  const { data: movsAna } = await ana.from("movimientos").select("*");
  esperar(
    (movsAna ?? []).some((m) => m.id === movPersonalAna!.id),
    "Ana sí ve su propio movimiento personal",
  );

  console.log("\n3) Escrituras cruzadas:");
  const { error: insCarla } = await carla.from("movimientos").insert({
    hogar_id: norte!.id, user_id: CARLA, tipo: "gasto", descripcion: "intruso",
    importe_centavos: 1000, fecha: "2026-07-10", cuenta_id: cuentaCompartida!.id,
  });
  esperar(insCarla !== null, "Carla no puede insertar movimientos en el hogar Norte");

  const { data: updBeto } = await beto.from("movimientos")
    .update({ descripcion: "hackeado" })
    .eq("id", movPersonalAna!.id)
    .select();
  esperar((updBeto ?? []).length === 0, "Beto no puede editar el movimiento personal de Ana");

  const { error: invBeto } = await beto.from("invitaciones").insert({
    hogar_id: norte!.id, email: "x@x.com", rol: "miembro",
    vence_el: "2026-08-01T00:00:00Z", creada_por: BETO,
  });
  esperar(invBeto !== null, "Beto (miembro, no admin) no puede invitar al hogar");

  // el miembro no puede auto-ascenderse a administrador (trigger de rol)
  const { error: ascensoBeto } = await beto.from("miembros_hogar")
    .update({ rol: "administrador" })
    .eq("user_id", BETO)
    .eq("hogar_id", norte!.id);
  esperar(ascensoBeto !== null, "Beto no puede auto-ascenderse a administrador");
  // pero sí puede editar su propio nombre (rol intacto)
  const { error: nombreBeto } = await beto.from("miembros_hogar")
    .update({ nombre: "Betito" })
    .eq("user_id", BETO)
    .eq("hogar_id", norte!.id);
  esperar(nombreBeto === null, "Beto sí puede editar su propio nombre");

  console.log("\n4) Conexión Gmail y sugerencias del correo (privadas del usuario):");
  await admin.from("conexiones_gmail").insert({
    user_id: ANA, email_gmail: "ana@gmail.com", refresh_token_cifrado: "iv.tag.datos-de-prueba",
  });
  const { data: sugAna } = await admin.from("sugerencias_correo").insert({
    hogar_id: norte!.id, user_id: ANA, gmail_id: "mail-rls-1", remitente: "Banco <avisos@banco.com>",
    fecha: "2026-07-10", tipo: "gasto", importe_centavos: 123400, comercio: "Kiosco de Ana",
  }).select().single();

  // ni Beto (mismo hogar) ni Carla (otro hogar) ven lo del correo de Ana
  const { data: conexBeto } = await beto.from("conexiones_gmail").select("id, email_gmail");
  esperar((conexBeto ?? []).length === 0, "Beto NO ve la conexión Gmail de Ana");
  const { data: sugBeto } = await beto.from("sugerencias_correo").select("*");
  esperar((sugBeto ?? []).length === 0, "Beto NO ve las sugerencias de correo de Ana");
  const { data: sugCarla } = await carla.from("sugerencias_correo").select("*");
  esperar((sugCarla ?? []).length === 0, "Carla NO ve las sugerencias de correo de Ana");

  // la dueña ve su conexión, pero NO puede leer el token cifrado (revoke de columna)
  const { data: conexAna } = await ana.from("conexiones_gmail").select("id, email_gmail");
  esperar((conexAna ?? []).length === 1, "Ana sí ve su propia conexión (sin token)");
  const { error: tokenAna } = await ana.from("conexiones_gmail").select("refresh_token_cifrado");
  esperar(tokenAna !== null, "Ni siquiera Ana puede LEER el refresh token cifrado");
  const { data: sugDeAna } = await ana.from("sugerencias_correo").select("*");
  esperar((sugDeAna ?? []).length === 1, "Ana sí ve su propia sugerencia");

  // Beto no puede aceptar/tocar la sugerencia de Ana
  const { data: updSugBeto } = await beto.from("sugerencias_correo")
    .update({ estado: "aceptada" })
    .eq("id", sugAna!.id)
    .select();
  esperar((updSugBeto ?? []).length === 0, "Beto no puede aceptar la sugerencia de Ana");

  await limpiar();

  if (fallas > 0) {
    console.error(`\n✗ rls:check FALLÓ: ${fallas} filtración(es). NO desplegar.`);
    process.exit(1);
  }
  console.log("\n✓ rls:check: cero filtraciones entre hogares y entre lo personal de miembros.");
}

main().catch(async (e) => {
  console.error(e);
  await limpiar();
  process.exit(1);
});
