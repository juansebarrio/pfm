/**
 * Seed del dataset del export: hogar Coghlan, viernes 10 de julio de 2026.
 * Reproduce 1:1 los números de las 10 pantallas (DESIGN_AUDIT.md §4) y
 * VERIFICA cada agregado antes de terminar: si algo no cierra, falla ruidosamente.
 *
 * Uso: pnpm seed   (usa SUPABASE_SECRET_KEY de .env.local)
 */
import { createClient } from "@supabase/supabase-js";
import { generarCuotas } from "../lib/dominio/cuotas";
import { asignarCiclo } from "../lib/dominio/ciclos";
import { usdAArs } from "../lib/dominio/dinero";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY;
if (!URL || !SECRET) {
  console.error("Faltan NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SECRET_KEY (.env.local)");
  process.exit(1);
}

const admin = createClient(URL, SECRET, { auth: { persistSession: false } });

/** pesos enteros → centavos */
const $ = (pesos: number): number => {
  if (!Number.isInteger(pesos)) throw new Error(`pesos no enteros: ${pesos}`);
  return pesos * 100;
};

const HOY = "2026-07-10"; // el dataset del export está clavado en esta fecha

const USUARIOS = [
  { email: "juanse@sobres.local", password: "coghlan-juanse-2026", nombre: "Juanse" },
  { email: "vale@sobres.local", password: "coghlan-vale-2026", nombre: "Vale" },
];

function fallar(mensaje: string): never {
  console.error(`\n✗ SEED INCONSISTENTE: ${mensaje}`);
  process.exit(1);
}

function verificar(condicion: boolean, mensaje: string) {
  if (!condicion) fallar(mensaje);
  console.log(`  ✓ ${mensaje}`);
}

async function limpiar() {
  console.log("Limpiando datos previos…");
  const { data: hogares } = await admin.from("hogares").select("id").eq("nombre", "Coghlan");
  for (const h of hogares ?? []) {
    await admin.from("hogares").delete().eq("id", h.id);
  }
  const { data: lista } = await admin.auth.admin.listUsers({ perPage: 1000 });
  for (const u of lista?.users ?? []) {
    if (USUARIOS.some((s) => s.email === u.email)) {
      await admin.auth.admin.deleteUser(u.id);
    }
  }
}

async function main() {
  await limpiar();

  // ============================================================ usuarios
  console.log("Creando usuarios…");
  const ids: Record<string, string> = {};
  for (const u of USUARIOS) {
    const { data, error } = await admin.auth.admin.createUser({
      email: u.email,
      password: u.password,
      email_confirm: true,
      user_metadata: { nombre: u.nombre },
    });
    if (error || !data.user) fallar(`no pude crear ${u.email}: ${error?.message}`);
    ids[u.nombre] = data.user.id;
    console.log(`  ${u.nombre}: ${u.email} / ${u.password}`);
  }
  const JUANSE = ids["Juanse"];
  const VALE = ids["Vale"];

  // ============================================================ hogar
  const { data: hogar, error: errHogar } = await admin
    .from("hogares")
    .insert({ nombre: "Coghlan", creado_por: JUANSE })
    .select()
    .single();
  if (errHogar) fallar(errHogar.message);
  const HOGAR = hogar.id;

  await admin.from("miembros_hogar").insert([
    { user_id: JUANSE, hogar_id: HOGAR, rol: "administrador", nombre: "Juanse" },
    { user_id: VALE, hogar_id: HOGAR, rol: "miembro", nombre: "Vale", descripcion: "adulta del hogar" },
  ]);

  await admin.from("invitaciones").insert({
    hogar_id: HOGAR,
    email: "sofi.rios@gmail.com",
    rol: "miembro",
    estado: "pendiente",
    creada_por: JUANSE,
    creado_el: "2026-07-05T15:00:00Z", // invitada hace 5 días
    vence_el: "2026-07-19T15:00:00Z",
  });

  // ============================================================ cuentas y tarjetas
  const { data: cuentas } = await admin
    .from("cuentas")
    .insert(
      [
        { nombre: "Efectivo", tipo: "efectivo" },
        { nombre: "Galicia", tipo: "banco" },
        { nombre: "Mercado Pago", tipo: "billetera" },
        { nombre: "Broker", tipo: "inversion" },
      ].map((c) => ({ ...c, hogar_id: HOGAR, user_id: JUANSE, moneda: "ARS", visibilidad: "compartido" })),
    )
    .select();
  const cuenta = (nombre: string) => {
    const c = cuentas?.find((x) => x.nombre === nombre);
    if (!c) fallar(`cuenta ${nombre} no creada`);
    return c.id;
  };

  const { data: tarjetas } = await admin
    .from("tarjetas")
    .insert([
      {
        hogar_id: HOGAR, user_id: JUANSE, nombre: "Visa Galicia", banco: "Galicia",
        red: "visa", ultimos4: "4321", visibilidad: "compartido",
        impuestos_estimados_centavos: $(58000),
      },
      {
        hogar_id: HOGAR, user_id: JUANSE, nombre: "Mastercard BBVA", banco: "BBVA",
        red: "mastercard", ultimos4: "8810", visibilidad: "compartido",
        impuestos_estimados_centavos: $(31500),
      },
    ])
    .select();
  const VISA = tarjetas!.find((t) => t.red === "visa")!.id;
  const MC = tarjetas!.find((t) => t.red === "mastercard")!.id;

  // ============================================================ ciclos
  // Visa cierra ~28, vence ~6 del siguiente. El actual (29 jun – 28 jul) es ESTIMADO.
  const { data: ciclosVisa } = await admin
    .from("ciclos_tarjeta")
    .insert([
      { tarjeta_id: VISA, fecha_cierre: "2026-03-28", fecha_vencimiento: "2026-04-06", estado_fechas: "confirmado", estado: "cerrado", total_real_centavos: $(512300) },
      { tarjeta_id: VISA, fecha_cierre: "2026-04-28", fecha_vencimiento: "2026-05-06", estado_fechas: "confirmado", estado: "cerrado", total_real_centavos: $(486750) },
      { tarjeta_id: VISA, fecha_cierre: "2026-05-28", fecha_vencimiento: "2026-06-05", estado_fechas: "confirmado", estado: "cerrado", total_real_centavos: $(612000) },
      { tarjeta_id: VISA, fecha_cierre: "2026-06-28", fecha_vencimiento: "2026-07-06", estado_fechas: "confirmado", estado: "conciliado", total_real_centavos: $(734500) },
      { tarjeta_id: VISA, fecha_cierre: "2026-07-28", fecha_vencimiento: "2026-08-06", estado_fechas: "estimado", estado: "abierto" },
    ])
    .select();
  const { data: ciclosMC } = await admin
    .from("ciclos_tarjeta")
    .insert([
      { tarjeta_id: MC, fecha_cierre: "2026-06-13", fecha_vencimiento: "2026-06-23", estado_fechas: "confirmado", estado: "cerrado", total_real_centavos: $(47900) },
      { tarjeta_id: MC, fecha_cierre: "2026-07-13", fecha_vencimiento: "2026-07-23", estado_fechas: "confirmado", estado: "abierto" },
    ])
    .select();

  const paraAsignarVisa = ciclosVisa!.map((c) => ({ id: c.id, fechaCierre: c.fecha_cierre }));
  const paraAsignarMC = ciclosMC!.map((c) => ({ id: c.id, fechaCierre: c.fecha_cierre }));
  const cicloDe = (tarjeta: string, fecha: string) =>
    asignarCiclo(fecha, tarjeta === VISA ? paraAsignarVisa : paraAsignarMC);
  const CICLO_VISA_ACTUAL = paraAsignarVisa.find((c) => c.fechaCierre === "2026-07-28")!.id;
  const CICLO_MC_ACTUAL = paraAsignarMC.find((c) => c.fechaCierre === "2026-07-13")!.id;

  // ============================================================ categorías
  const categoriasHogar: Array<[string, string, string]> = [
    // [grupo, nombre, icono lucide]
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
  const categoriasPersonales: Array<[string, string, string]> = [
    ["Personal", "Gustos", "sparkles"],
    ["Personal", "Fotografía", "camera"],
    ["Personal", "Regalos", "gift"],
  ];

  const { data: cats } = await admin
    .from("categorias")
    .insert([
      ...categoriasHogar.map(([grupo, nombre, icono], i) => ({
        hogar_id: HOGAR, grupo, nombre, icono, ambito: "hogar", orden: i,
      })),
      ...categoriasPersonales.map(([grupo, nombre, icono], i) => ({
        hogar_id: HOGAR, grupo, nombre, icono, ambito: "personal", user_id: JUANSE, orden: i,
      })),
    ])
    .select();
  const cat = (nombre: string) => {
    const c = cats?.find((x) => x.nombre === nombre);
    if (!c) fallar(`categoría ${nombre} no creada`);
    return c.id;
  };

  // ============================================================ presupuestos
  // Asignados de julio (los 15 del export: 12 dibujados + Nafta/SUBE/Entretenimiento
  // que cierran los $ 275.000 ocultos — DESIGN_AUDIT.md §4.12)
  const asignadosHogar: Array<[string, number, { fija?: boolean; rollover?: boolean }]> = [
    ["Alquiler", 780000, { fija: true }],
    ["Expensas", 165000, { fija: true }],
    ["Supermercado", 520000, {}],
    ["Delivery", 90000, {}],
    ["Restaurantes", 120000, {}],
    ["Ahorro e inversión", 400000, { fija: true }],
    ["Prepaga", 310000, { fija: true }],
    ["Farmacia", 40000, {}],
    ["Luz", 45000, {}],
    ["Internet", 38000, { fija: true }],
    ["Celular", 22000, { fija: true }],
    ["Suscripciones", 55000, { rollover: true }],
    ["Nafta", 150000, {}],
    ["SUBE", 45000, {}],
    ["Entretenimiento", 80000, {}],
  ];

  const { data: presupuestos } = await admin
    .from("presupuestos")
    .insert([
      { hogar_id: HOGAR, mes: "2026-06-01", ambito: "hogar" },
      { hogar_id: HOGAR, mes: "2026-07-01", ambito: "hogar" },
      { hogar_id: HOGAR, mes: "2026-05-01", ambito: "personal", user_id: JUANSE },
      { hogar_id: HOGAR, mes: "2026-06-01", ambito: "personal", user_id: JUANSE },
      { hogar_id: HOGAR, mes: "2026-07-01", ambito: "personal", user_id: JUANSE },
    ])
    .select();
  const presu = (mes: string, ambito: string) => {
    const p = presupuestos?.find((x) => x.mes === mes && x.ambito === ambito);
    if (!p) fallar(`presupuesto ${mes} ${ambito} no creado`);
    return p.id;
  };

  const partidas: object[] = [];
  for (const mes of ["2026-06-01", "2026-07-01"]) {
    for (const [nombre, asignado, extra] of asignadosHogar) {
      partidas.push({
        presupuesto_id: presu(mes, "hogar"),
        categoria_id: cat(nombre),
        asignado_centavos: $(asignado),
        fija: extra.fija ?? false,
        rollover: extra.rollover ?? false,
      });
    }
  }
  // personales de Juanse: Gustos / Fotografía (rollover) / Regalos
  for (const mes of ["2026-05-01", "2026-06-01", "2026-07-01"]) {
    partidas.push(
      { presupuesto_id: presu(mes, "personal"), categoria_id: cat("Gustos"), asignado_centavos: $(120000) },
      { presupuesto_id: presu(mes, "personal"), categoria_id: cat("Fotografía"), asignado_centavos: $(150000), rollover: true },
      { presupuesto_id: presu(mes, "personal"), categoria_id: cat("Regalos"), asignado_centavos: $(60000) },
    );
  }
  await admin.from("partidas_presupuesto").insert(partidas);

  // ============================================================ compras en cuotas
  const { data: compras } = await admin
    .from("compras_en_cuotas")
    .insert([
      // DESIGN_NOTES.md §1.1: compra el 1 mar 2026 → julio es la cuota 5/12,
      // termina feb 2027 y "en marzo quedás libre" (elegimos la narrativa del export)
      { hogar_id: HOGAR, user_id: JUANSE, tarjeta_id: VISA, descripcion: "Aire acondicionado", total_centavos: $(1035000), n_cuotas: 12, fecha: "2026-03-01" },
      { hogar_id: HOGAR, user_id: JUANSE, tarjeta_id: VISA, descripcion: "Notebook", total_centavos: $(1260000), n_cuotas: 6, fecha: "2026-03-01" },
      { hogar_id: HOGAR, user_id: JUANSE, tarjeta_id: MC, descripcion: "Zapatillas", total_centavos: $(129900), n_cuotas: 3, fecha: "2026-06-01" },
    ])
    .select();

  const movimientos: object[] = [];
  for (const compra of compras ?? []) {
    const cuotas = generarCuotas(compra.total_centavos, compra.n_cuotas, compra.fecha);
    for (const c of cuotas) {
      movimientos.push({
        hogar_id: HOGAR,
        user_id: JUANSE,
        tipo: "gasto",
        descripcion: compra.descripcion,
        importe_centavos: c.importeCentavos,
        fecha: c.fecha,
        tarjeta_id: compra.tarjeta_id,
        ciclo_id: cicloDe(compra.tarjeta_id, c.fecha),
        compra_id: compra.id,
        n_cuota: c.n,
        visibilidad: "compartido",
        creado_el: `${c.fecha}T09:00:00-03:00`,
        // sin categoría a propósito: las cuotas no pisan partidas del export
        // (DESIGN_NOTES.md §1.4); la bandeja las excluye por compra_id
      });
    }
  }

  // ============================================================ movimientos
  type Mov = {
    fecha: string; desc: string; pesos: number; cat?: string;
    cuenta?: string; tarjeta?: string; tipo?: "gasto" | "ingreso";
    visibilidad?: "personal" | "compartido"; nota?: string; hora?: string;
  };

  const listado: Mov[] = [
    // ---- mayo (personal, para el rollover de Fotografía: gasta 40.000 de 150.000)
    { fecha: "2026-05-15", desc: "Filtro ND", pesos: 40000, cat: "Fotografía", cuenta: "Mercado Pago", visibilidad: "personal" },

    // ---- junio hogar (deja Suscripciones en 41.200: rollover $ 13.800 a julio)
    { fecha: "2026-06-01", desc: "Alquiler junio", pesos: 780000, cat: "Alquiler", cuenta: "Galicia" },
    { fecha: "2026-06-02", desc: "Expensas Consorcio", pesos: 165000, cat: "Expensas", cuenta: "Galicia" },
    { fecha: "2026-06-01", desc: "OSDE", pesos: 310000, cat: "Prepaga", cuenta: "Galicia" },
    { fecha: "2026-06-05", desc: "Fibertel", pesos: 38000, cat: "Internet", cuenta: "Galicia" },
    { fecha: "2026-06-04", desc: "Personal", pesos: 22000, cat: "Celular", cuenta: "Galicia" },
    { fecha: "2026-06-01", desc: "Transferencia a Broker", pesos: 400000, cat: "Ahorro e inversión", cuenta: "Galicia", nota: "a Broker" },
    { fecha: "2026-06-03", desc: "Netflix", pesos: 25500, cat: "Suscripciones", tarjeta: "visa" },
    { fecha: "2026-06-06", desc: "Spotify", pesos: 15700, cat: "Suscripciones", tarjeta: "visa" },
    { fecha: "2026-06-05", desc: "Dia", pesos: 79300, cat: "Supermercado", tarjeta: "visa" },
    { fecha: "2026-06-14", desc: "Coto", pesos: 101200, cat: "Supermercado", tarjeta: "visa" },
    { fecha: "2026-06-26", desc: "Coto", pesos: 76300, cat: "Supermercado", tarjeta: "visa" },
    { fecha: "2026-06-08", desc: "PedidosYa", pesos: 19800, cat: "Delivery", cuenta: "Mercado Pago" },
    { fecha: "2026-06-15", desc: "Rappi", pesos: 24100, cat: "Delivery", tarjeta: "visa" },
    { fecha: "2026-06-21", desc: "La Fonda", pesos: 38000, cat: "Restaurantes", tarjeta: "visa" },
    { fecha: "2026-06-12", desc: "YPF", pesos: 58000, cat: "Nafta", cuenta: "Galicia" },
    { fecha: "2026-06-20", desc: "Cinemark Palermo", pesos: 14200, cat: "Entretenimiento", tarjeta: "visa" },
    { fecha: "2026-06-11", desc: "Farmacity", pesos: 5900, cat: "Farmacia", cuenta: "Mercado Pago" },

    // ---- fin de junio con Visa: caen en el ciclo actual (29 jun – 28 jul)
    { fecha: "2026-06-29", desc: "Shell", pesos: 14500, cat: "Nafta", tarjeta: "visa" },
    { fecha: "2026-06-30", desc: "Kiosco 25hs", pesos: 3800, cat: "Supermercado", tarjeta: "visa" },
    { fecha: "2026-06-30", desc: "Carga SUBE", pesos: 8900, cat: "SUBE", tarjeta: "visa" },
    { fecha: "2026-06-29", desc: "Farmacity", pesos: 6200, cat: "Farmacia", tarjeta: "visa" },
    { fecha: "2026-06-30", desc: "Panadería La Espiga", pesos: 4800, cat: "Supermercado", tarjeta: "visa" },
    { fecha: "2026-06-29", desc: "Verdulería", pesos: 3000, cat: "Supermercado", tarjeta: "visa" },

    // ---- julio hogar: los gastados exactos del export por partida
    { fecha: "2026-07-01", desc: "Alquiler julio", pesos: 780000, cat: "Alquiler", cuenta: "Galicia" },
    { fecha: "2026-07-02", desc: "Expensas Consorcio", pesos: 165000, cat: "Expensas", cuenta: "Galicia" },
    { fecha: "2026-07-01", desc: "OSDE", pesos: 310000, cat: "Prepaga", cuenta: "Galicia" },
    { fecha: "2026-07-05", desc: "Fibertel", pesos: 38000, cat: "Internet", cuenta: "Galicia" },
    { fecha: "2026-07-04", desc: "Personal", pesos: 22000, cat: "Celular", cuenta: "Galicia" },
    { fecha: "2026-07-01", desc: "Transferencia a Broker", pesos: 400000, cat: "Ahorro e inversión", cuenta: "Galicia", nota: "a Broker" },
    { fecha: "2026-07-03", desc: "Netflix", pesos: 25500, cat: "Suscripciones", tarjeta: "visa" },
    { fecha: "2026-07-06", desc: "Spotify", pesos: 15700, cat: "Suscripciones", tarjeta: "visa" },
    { fecha: "2026-07-01", desc: "Dia", pesos: 88600, cat: "Supermercado", tarjeta: "visa" },
    { fecha: "2026-07-04", desc: "Coto", pesos: 95480, cat: "Supermercado", tarjeta: "visa" },
    { fecha: "2026-07-10", desc: "Coto", pesos: 84320, cat: "Supermercado", tarjeta: "visa", hora: "17:30" },
    { fecha: "2026-07-02", desc: "PedidosYa", pesos: 22800, cat: "Delivery", cuenta: "Mercado Pago" },
    { fecha: "2026-07-05", desc: "Rappi", pesos: 31200, cat: "Delivery", tarjeta: "visa" },
    { fecha: "2026-07-07", desc: "PedidosYa", pesos: 17300, cat: "Delivery", cuenta: "Mercado Pago" },
    { fecha: "2026-07-06", desc: "La Farola", pesos: 45000, cat: "Restaurantes", tarjeta: "visa" },
    { fecha: "2026-07-02", desc: "Farmacity", pesos: 3600, cat: "Farmacia", cuenta: "Mercado Pago" },
    { fecha: "2026-07-09", desc: "Farmacity", pesos: 8900, cat: "Farmacia", cuenta: "Mercado Pago" },
    { fecha: "2026-07-03", desc: "YPF", pesos: 60600, cat: "Nafta", cuenta: "Galicia" },
    { fecha: "2026-07-10", desc: "YPF", pesos: 45000, cat: "Nafta", tarjeta: "mc", hora: "12:40" },
    { fecha: "2026-07-02", desc: "Carga SUBE", pesos: 12000, cat: "SUBE", cuenta: "Mercado Pago" },
    { fecha: "2026-07-08", desc: "Carga SUBE", pesos: 9000, cat: "SUBE", cuenta: "Efectivo" },
    { fecha: "2026-07-08", desc: "Cinemark Palermo", pesos: 16800, cat: "Entretenimiento", tarjeta: "visa" },
    { fecha: "2026-07-07", desc: "Steam", pesos: 24000, cat: "Entretenimiento", tarjeta: "visa" },

    // ---- julio personal de Juanse
    { fecha: "2026-07-10", desc: "Café Cuervo", pesos: 6800, cat: "Gustos", cuenta: "Mercado Pago", visibilidad: "personal", hora: "14:15" },
    { fecha: "2026-07-05", desc: "Vinilos Palermo", pesos: 38000, cat: "Gustos", cuenta: "Mercado Pago", visibilidad: "personal" },

    // ---- bandeja de entrada: 3 sin categorizar (Rappi, una transferencia y uno más)
    { fecha: "2026-07-10", desc: "Rappi", pesos: 18400, tarjeta: "visa", hora: "16:05" },
    { fecha: "2026-07-10", desc: "Transferencia recibida", pesos: 120000, cuenta: "Galicia", tipo: "ingreso", hora: "13:00" },
    { fecha: "2026-07-09", desc: "MercadoLibre", pesos: 32900, tarjeta: "mc" },
  ];

  for (const m of listado) {
    const tarjetaId = m.tarjeta === "visa" ? VISA : m.tarjeta === "mc" ? MC : null;
    movimientos.push({
      hogar_id: HOGAR,
      user_id: JUANSE,
      tipo: m.tipo ?? "gasto",
      descripcion: m.desc,
      importe_centavos: $(m.pesos),
      fecha: m.fecha,
      cuenta_id: m.cuenta ? cuenta(m.cuenta) : null,
      tarjeta_id: tarjetaId,
      ciclo_id: tarjetaId ? cicloDe(tarjetaId, m.fecha) : null,
      categoria_id: m.cat ? cat(m.cat) : null,
      visibilidad: m.visibilidad ?? "compartido",
      nota: m.nota ?? null,
      creado_el: `${m.fecha}T${m.hora ?? "12:00"}:00-03:00`,
    });
  }

  const { error: errMovs } = await admin.from("movimientos").insert(movimientos);
  if (errMovs) fallar(`insertando movimientos: ${errMovs.message}`);

  // ============================================================ recurrentes
  await admin.from("recurrentes").insert({
    hogar_id: HOGAR, user_id: JUANSE, descripcion: "Luz (Edenor)",
    categoria_id: cat("Luz"), cuenta_id: cuenta("Galicia"),
    importe_sugerido_centavos: $(45000), dia_mes: 18,
  });

  // ============================================================ patrimonio
  await admin.from("tenencias").insert([
    { hogar_id: HOGAR, user_id: JUANSE, instrumento: "dolar_mep", nombre: "Dólar MEP", moneda: "USD", cantidad_usd_centavos: $(9500), fecha_valuacion: HOY },
    { hogar_id: HOGAR, user_id: JUANSE, instrumento: "cedears", nombre: "CEDEARs", moneda: "USD", cantidad_usd_centavos: $(7800), fecha_valuacion: HOY },
    { hogar_id: HOGAR, user_id: JUANSE, instrumento: "dolar_billete", nombre: "Dólar billete", moneda: "USD", cantidad_usd_centavos: $(6000), fecha_valuacion: HOY },
    { hogar_id: HOGAR, user_id: JUANSE, instrumento: "fci_money_market", nombre: "FCI money market", detalle: "Mercado Pago + Galicia", moneda: "ARS", valuacion_centavos: $(5200000), fecha_valuacion: HOY },
    { hogar_id: HOGAR, user_id: JUANSE, instrumento: "cripto", nombre: "Cripto", moneda: "USD", cantidad_usd_centavos: $(2100), fecha_valuacion: "2026-07-07" },
    { hogar_id: HOGAR, user_id: JUANSE, instrumento: "plazo_fijo", nombre: "Plazo fijo", moneda: "ARS", valuacion_centavos: $(3000000), fecha_valuacion: "2026-06-01" },
    { hogar_id: HOGAR, user_id: JUANSE, instrumento: "cuenta_remunerada", nombre: "Cuenta remunerada MP", detalle: "rinde diario", moneda: "ARS", valuacion_centavos: $(1850000), fecha_valuacion: HOY },
  ]);

  // TC del día (MEP $ 1.470 del export; blue y oficial son relleno anotado)
  await admin.from("tipos_cambio").insert([
    { hogar_id: HOGAR, fecha: HOY, fuente: "mep", valor_centavos: $(1470) },
    { hogar_id: HOGAR, fecha: HOY, fuente: "blue", valor_centavos: $(1485) },
    { hogar_id: HOGAR, fecha: HOY, fuente: "oficial", valor_centavos: $(1320) },
    { hogar_id: HOGAR, fecha: "2026-06-10", fuente: "mep", valor_centavos: $(1418) },
  ]);

  // snapshots mensuales ago 25 – jul 26 (sparkline; trayectoria de relleno anotada,
  // el último punto es la suma real de hoy)
  const trayectoria: Array<[string, number]> = [
    ["2025-08-10", 31900000], ["2025-09-10", 33400000], ["2025-10-10", 34100000],
    ["2025-11-10", 35800000], ["2025-12-10", 36200000], ["2026-01-10", 38900000],
    ["2026-02-10", 40100000], ["2026-03-10", 41700000], ["2026-04-10", 43200000],
    ["2026-05-10", 44100000], ["2026-06-10", 45900000], [HOY, 47388000],
  ];
  const tcAprox = [118000, 121000, 124500, 127000, 130000, 133500, 137000, 140000, 143000, 145000, 141800, 147000];
  await admin.from("snapshots_patrimonio").insert(
    trayectoria.map(([fecha, totalPesos], i) => ({
      hogar_id: HOGAR,
      fecha,
      total_ars_centavos: $(totalPesos),
      total_usd_centavos: Math.round(($(totalPesos) * 100) / tcAprox[i]),
      detalle: {},
    })),
  );

  // ============================================================ verificaciones
  console.log("\nVerificando contra los números del export…");

  const { data: movs } = await admin
    .from("movimientos")
    .select("descripcion, tipo, importe_centavos, fecha, categoria_id, ciclo_id, compra_id, visibilidad, tarjeta_id")
    .eq("hogar_id", HOGAR);
  if (!movs) fallar("no pude releer movimientos");

  const julioHogar = movs.filter(
    (m) => m.fecha >= "2026-07-01" && m.fecha <= "2026-07-31"
      && m.tipo === "gasto" && m.categoria_id && m.visibilidad === "compartido",
  );
  const gastadoJulio = julioHogar.reduce((s, m) => s + m.importe_centavos, 0);
  verificar(gastadoJulio === $(2320800), `gastado julio hogar = $ 2.320.800 (dio ${gastadoJulio / 100})`);

  const gastadosEsperados: Record<string, number> = {
    Alquiler: 780000, Expensas: 165000, Supermercado: 268400, Delivery: 71300,
    Restaurantes: 45000, "Ahorro e inversión": 400000, Prepaga: 310000, Farmacia: 12500,
    Luz: 0, Internet: 38000, Celular: 22000, Suscripciones: 41200,
    Nafta: 105600, SUBE: 21000, Entretenimiento: 40800,
  };
  for (const [nombre, esperado] of Object.entries(gastadosEsperados)) {
    const suma = julioHogar
      .filter((m) => m.categoria_id === cat(nombre))
      .reduce((s, m) => s + m.importe_centavos, 0);
    verificar(suma === $(esperado), `partida ${nombre}: gastado $ ${esperado.toLocaleString("es-AR")}`);
  }

  const asignadoJulio = asignadosHogar.reduce((s, [, monto]) => s + $(monto), 0);
  verificar(asignadoJulio === $(2860000), "asignado julio hogar = $ 2.860.000");
  verificar(asignadoJulio - gastadoJulio === $(539200), "disponible julio = $ 539.200");

  // rollover Suscripciones: junio asignado 55.000 − gastado 41.200 = 13.800
  const junioSusc = movs
    .filter((m) => m.fecha >= "2026-06-01" && m.fecha <= "2026-06-30" && m.categoria_id === cat("Suscripciones"))
    .reduce((s, m) => s + m.importe_centavos, 0);
  verificar($(55000) - junioSusc === $(13800), "rollover de Suscripciones a julio = $ 13.800");

  // ciclo Visa actual: 18 consumos, no-cuota 486.200, cuotas 296.250, proyectado 840.450
  const consumosVisa = movs.filter((m) => m.ciclo_id === CICLO_VISA_ACTUAL && m.tipo === "gasto");
  const noCuota = consumosVisa.filter((m) => !m.compra_id);
  const cuotasCiclo = consumosVisa.filter((m) => m.compra_id);
  verificar(consumosVisa.length === 18, `ciclo Visa actual: 18 consumos (dio ${consumosVisa.length})`);
  verificar(
    noCuota.reduce((s, m) => s + m.importe_centavos, 0) === $(486200),
    "consumos del ciclo Visa = $ 486.200",
  );
  verificar(
    cuotasCiclo.reduce((s, m) => s + m.importe_centavos, 0) === $(296250),
    "cuotas del mes (Visa) = $ 296.250",
  );
  verificar(
    consumosVisa.reduce((s, m) => s + m.importe_centavos, 0) + $(58000) === $(840450),
    "resumen proyectado Visa = $ 840.450",
  );

  // ciclo MC: proyectado 152.700 (consumos + cuota Zapatillas + impuestos 31.500)
  const consumosMC = movs.filter((m) => m.ciclo_id === CICLO_MC_ACTUAL && m.tipo === "gasto");
  verificar(
    consumosMC.reduce((s, m) => s + m.importe_centavos, 0) + $(31500) === $(152700),
    "proyectado Mastercard = $ 152.700",
  );

  // bandeja: exactamente 3 sin categorizar (las cuotas no cuentan)
  const bandeja = movs.filter((m) => !m.categoria_id && !m.compra_id && (m.tipo === "gasto" || m.tipo === "ingreso"));
  verificar(bandeja.length === 3, `bandeja de entrada: 3 pendientes (dio ${bandeja.length})`);

  // comprometido por cuotas: jul y ago 339.550; sep–feb 86.250; mar 2027 en adelante 0
  const cuotasPorMes = (mes: string) =>
    movs.filter((m) => m.compra_id && m.fecha.startsWith(mes)).reduce((s, m) => s + m.importe_centavos, 0);
  verificar(cuotasPorMes("2026-07") === $(339550), "comprometido julio = $ 339.550");
  verificar(cuotasPorMes("2026-08") === $(339550), "comprometido agosto = $ 339.550");
  verificar(cuotasPorMes("2026-09") === $(86250), "desde septiembre = $ 86.250");
  verificar(cuotasPorMes("2027-02") === $(86250), "última cuota en febrero 2027");
  verificar(cuotasPorMes("2027-03") === 0, "en marzo quedás libre");

  // patrimonio: suma real $ 47.388.000 al MEP $ 1.470
  const { data: tenencias } = await admin.from("tenencias").select("*").eq("hogar_id", HOGAR);
  const totalPatrimonio = (tenencias ?? []).reduce((s, t) => {
    const ars = t.moneda === "USD" ? usdAArs(t.cantidad_usd_centavos, $(1470)) : t.valuacion_centavos;
    return s + ars;
  }, 0);
  verificar(totalPatrimonio === $(47388000), "patrimonio total = $ 47.388.000 (se muestra ≈ $ 47.400.000)");

  // rollover personal Fotografía: mayo sobra 110.000 + junio 150.000 = 260.000
  const fotoMayo = movs
    .filter((m) => m.fecha >= "2026-05-01" && m.fecha <= "2026-05-31" && m.categoria_id === cat("Fotografía"))
    .reduce((s, m) => s + m.importe_centavos, 0);
  const arrastreJulio = $(150000) - fotoMayo + $(150000) - 0;
  verificar(arrastreJulio === $(260000), "rollover de Fotografía a julio = $ 260.000");

  console.log("\n✓ Seed Coghlan completo y verificado.");
  console.log("  Usuarios: juanse@sobres.local / coghlan-juanse-2026 · vale@sobres.local / coghlan-vale-2026");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
