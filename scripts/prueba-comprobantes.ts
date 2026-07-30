/**
 * Prueba de lectura de comprobantes contra el modelo real.
 *
 * Le manda a /api/asistente tres imágenes muy distintas — un ticket fiscal, un
 * screenshot de un mail de compra y un comprobante de transferencia recibida —
 * y verifica que el marcador #comprobante salga con lo que de verdad dice cada
 * uno. Esto NO es un test unitario (hay un modelo del otro lado): es la prueba
 * de que el prompt y el parser se entienden.
 *
 * Uso: la app corriendo en :3000 y
 *   pnpm tsx --env-file=.env.local scripts/prueba-comprobantes.ts <carpeta>
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsearRespuesta } from "../lib/dominio/asistente";
import { bloqueantes, type ComprobanteLeido } from "../lib/dominio/comprobante";

const BASE = process.env.BASE_PRUEBA ?? "http://localhost:3000";
const CARPETA = process.argv[2];
if (!CARPETA) throw new Error("falta la carpeta con las imágenes");

const HOY = "2026-07-30";

type Esperado = {
  archivo: string;
  que: string;
  /** lo que el comprobante dice de verdad; null = tiene que quedar sin leer */
  montoCentavos: number;
  tipo: "gasto" | "ingreso";
  fecha: string;
  /** substring que tiene que aparecer en el comercio, sin distinguir caso */
  comercio: string;
  /** medio esperado, o null si el comprobante no lo dice */
  medioContiene: string | null;
  cuotas: number | null;
};

const CASOS: Esperado[] = [
  {
    archivo: "ticket.png",
    que: "ticket fiscal de supermercado, pagado con Visa ****4321",
    montoCentavos: 8432000,
    tipo: "gasto",
    fecha: "2026-07-29",
    comercio: "coto",
    medioContiene: "visa",
    cuotas: null,
  },
  {
    archivo: "mail.png",
    que: "screenshot de un mail de Mercado Libre, 6 cuotas con Mastercard 8810",
    montoCentavos: 8290000,
    tipo: "gasto",
    fecha: "2026-07-29",
    comercio: "mercado",
    medioContiene: "mastercard",
    cuotas: 6,
  },
  {
    archivo: "transfer.png",
    que: "transferencia recibida en la cuenta del Galicia",
    montoCentavos: 34000000,
    tipo: "ingreso",
    fecha: "2026-07-29",
    comercio: "",
    medioContiene: "galicia",
    cuotas: null,
  },
];

async function token(): Promise<string> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
  const r = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "juanse@sobres.local",
      password: "coghlan-juanse-2026",
    }),
  });
  if (!r.ok) throw new Error(`login falló: ${r.status}`);
  return (await r.json()).access_token;
}

async function leer(archivo: string, jwt: string): Promise<string> {
  const bytes = readFileSync(path.join(CARPETA, archivo));
  const r = await fetch(`${BASE}/api/asistente`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${jwt}` },
    body: JSON.stringify({
      mensajes: [{ rol: "usuario", texto: "" }],
      imagenes: [{ tipo: "image/png", base64: bytes.toString("base64") }],
    }),
  });
  if (!r.ok) throw new Error(`${archivo}: HTTP ${r.status} — ${await r.text()}`);
  return await r.text();
}

let fallas = 0;
const check = (ok: boolean, etiqueta: string, detalle = "") => {
  if (!ok) fallas++;
  console.log(`  ${ok ? "✓" : "✗"} ${etiqueta}${detalle ? ` — ${detalle}` : ""}`);
};

async function main() {
  const jwt = await token();

  for (const caso of CASOS) {
    console.log(`\n▸ ${caso.archivo}: ${caso.que}`);
    const respuesta = await leer(caso.archivo, jwt);
    const bloques = parsearRespuesta(respuesta, { hoy: HOY });
    const bloque = bloques.find((b) => b.tipo === "comprobante");

    if (bloque?.tipo !== "comprobante") {
      check(false, "emitió un #comprobante", `respondió: ${respuesta.slice(0, 220)}`);
      continue;
    }
    const c: ComprobanteLeido = bloque.leido;
    console.log(`    leído: ${JSON.stringify(c)}`);

    check(c.montoCentavos === caso.montoCentavos, "el monto total", `${c.montoCentavos}`);
    check(c.tipo === caso.tipo, "el tipo", `${c.tipo}`);
    check(c.fecha === caso.fecha, "la fecha", `${c.fecha}`);
    if (caso.comercio) {
      check(
        (c.comercio ?? "").toLowerCase().includes(caso.comercio),
        "el comercio",
        `${c.comercio}`,
      );
    }
    if (caso.medioContiene) {
      check(
        (c.medio ?? "").toLowerCase().includes(caso.medioContiene),
        "el medio",
        `${c.medio}`,
      );
    }
    check(c.cuotas === caso.cuotas, "las cuotas", `${c.cuotas}`);
    // lo importante para la UI: que no falte nada para poder cargarlo
    check(bloqueantes(c).length === 0, "nada bloquea la carga", bloqueantes(c).join(", "));
  }

  console.log(`\n${fallas === 0 ? "todo bien" : `${fallas} fallas`}`);
  process.exit(fallas === 0 ? 0 : 1);
}

main();
