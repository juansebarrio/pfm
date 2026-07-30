/**
 * Verificar (y opcionalmente quitar) el canal alfa de un PNG de ícono.
 *
 * POR QUÉ EXISTE. App Store Connect rechaza el ícono de 1024×1024 si tiene
 * transparencia o canal alfa: es un error de validación, no una advertencia, y
 * aparece recién al subir el build. docs/APP-STORE.md afirma que el ícono no
 * tiene alfa; este script es lo que hace que esa afirmación sea verificable en
 * vez de una creencia.
 *
 * Ojo con la distinción que importa: un PNG puede ser RGBA con TODO el alfa en
 * 255 — es decir, opaco a la vista pero con el canal presente. Apple rechaza el
 * canal, no la transparencia visible. Por eso el chequeo mira el tipo de color,
 * y `--aplanar` reescribe el archivo como RGB (tipo 2) sin tocar un solo píxel
 * de color.
 *
 * Uso:
 *   pnpm tsx scripts/icono-alfa.ts <archivo.png> [...]        # solo verifica
 *   pnpm tsx scripts/icono-alfa.ts --aplanar <archivo.png>    # RGBA → RGB
 *
 * Sale con código 1 si algún archivo tiene canal alfa (sin --aplanar), así
 * sirve como gate.
 */
import { deflateSync, inflateSync } from "node:zlib";
import { readFileSync, writeFileSync } from "node:fs";

const FIRMA = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Bytes por píxel según el tipo de color del PNG. */
const CANALES: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

type Png = {
  ancho: number;
  alto: number;
  profundidad: number;
  tipoColor: number;
  /** los IDAT concatenados y descomprimidos, todavía con los filtros por fila */
  datos: Buffer;
};

function leerPng(ruta: string): Png {
  const buf = readFileSync(ruta);
  if (!buf.subarray(0, 8).equals(FIRMA)) throw new Error(`${ruta}: no es un PNG`);

  let pos = 8;
  let ihdr: Png | null = null;
  const idat: Buffer[] = [];

  while (pos < buf.length) {
    const largo = buf.readUInt32BE(pos);
    const tipo = buf.subarray(pos + 4, pos + 8).toString("latin1");
    const datos = buf.subarray(pos + 8, pos + 8 + largo);
    if (tipo === "IHDR") {
      ihdr = {
        ancho: datos.readUInt32BE(0),
        alto: datos.readUInt32BE(4),
        profundidad: datos[8],
        tipoColor: datos[9],
        datos: Buffer.alloc(0),
      };
      if (datos[12] !== 0) throw new Error(`${ruta}: entrelazado Adam7, no soportado`);
    }
    if (tipo === "IDAT") idat.push(Buffer.from(datos));
    if (tipo === "IEND") break;
    pos += 12 + largo;
  }

  if (!ihdr) throw new Error(`${ruta}: sin IHDR`);
  return { ...ihdr, datos: inflateSync(Buffer.concat(idat)) };
}

/** Deshace los filtros por fila y devuelve los píxeles crudos. */
function desfiltrar(png: Png): Buffer {
  const canales = CANALES[png.tipoColor];
  if (canales === undefined) throw new Error(`tipo de color ${png.tipoColor} no soportado`);
  if (png.profundidad !== 8) throw new Error(`profundidad ${png.profundidad}, se esperaba 8`);

  const bpp = canales;
  const anchoFila = png.ancho * bpp;
  const salida = Buffer.alloc(anchoFila * png.alto);
  let pos = 0;

  for (let y = 0; y < png.alto; y++) {
    const filtro = png.datos[pos++];
    const fila = salida.subarray(y * anchoFila, (y + 1) * anchoFila);
    png.datos.copy(fila, 0, pos, pos + anchoFila);
    pos += anchoFila;
    const anterior = y > 0 ? salida.subarray((y - 1) * anchoFila, y * anchoFila) : null;

    for (let i = 0; i < anchoFila; i++) {
      const a = i >= bpp ? fila[i - bpp] : 0;
      const b = anterior ? anterior[i] : 0;
      const c = anterior && i >= bpp ? anterior[i - bpp] : 0;
      switch (filtro) {
        case 0:
          break;
        case 1:
          fila[i] = (fila[i] + a) & 0xff;
          break;
        case 2:
          fila[i] = (fila[i] + b) & 0xff;
          break;
        case 3:
          fila[i] = (fila[i] + ((a + b) >> 1)) & 0xff;
          break;
        case 4: {
          const p = a + b - c;
          const pa = Math.abs(p - a);
          const pb = Math.abs(p - b);
          const pc = Math.abs(p - c);
          fila[i] = (fila[i] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff;
          break;
        }
        default:
          throw new Error(`filtro ${filtro} desconocido`);
      }
    }
  }
  return salida;
}

function trozo(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4);
  largo.writeUInt32BE(datos.length);
  const cuerpo = Buffer.concat([Buffer.from(tipo, "latin1"), datos]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(cuerpo));
  return Buffer.concat([largo, cuerpo, crc]);
}

const TABLA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Escribe un PNG RGB de 8 bits, sin filtro (el ícono es plano: no comprime peor). */
function escribirRgb(ruta: string, ancho: number, alto: number, rgb: Buffer) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(ancho, 0);
  ihdr.writeUInt32BE(alto, 4);
  ihdr[8] = 8; // profundidad
  ihdr[9] = 2; // tipo de color: RGB, sin alfa
  ihdr[10] = 0; // compresión
  ihdr[11] = 0; // filtro
  ihdr[12] = 0; // sin entrelazado

  const anchoFila = ancho * 3;
  const conFiltros = Buffer.alloc((anchoFila + 1) * alto);
  for (let y = 0; y < alto; y++) {
    conFiltros[y * (anchoFila + 1)] = 0;
    rgb.copy(conFiltros, y * (anchoFila + 1) + 1, y * anchoFila, (y + 1) * anchoFila);
  }

  writeFileSync(
    ruta,
    Buffer.concat([
      FIRMA,
      trozo("IHDR", ihdr),
      trozo("IDAT", deflateSync(conFiltros, { level: 9 })),
      trozo("IEND", Buffer.alloc(0)),
    ]),
  );
}

const args = process.argv.slice(2);
const aplanar = args.includes("--aplanar");
const rutas = args.filter((a) => a !== "--aplanar");
if (rutas.length === 0) {
  console.error("uso: icono-alfa.ts [--aplanar] <archivo.png> [...]");
  process.exit(2);
}

let conAlfa = 0;
for (const ruta of rutas) {
  const png = leerPng(ruta);
  const canales = CANALES[png.tipoColor];
  const tieneAlfa = png.tipoColor === 4 || png.tipoColor === 6;
  const etiqueta = `${png.ancho}×${png.alto} ${
    { 0: "gris", 2: "RGB", 3: "paleta", 4: "gris+alfa", 6: "RGBA" }[png.tipoColor]
  }`;

  if (!tieneAlfa) {
    console.log(`✓ ${ruta} — ${etiqueta}, sin canal alfa`);
    continue;
  }

  const pixeles = desfiltrar(png);
  let alfaMin = 255;
  for (let i = canales - 1; i < pixeles.length; i += canales) {
    if (pixeles[i] < alfaMin) alfaMin = pixeles[i];
  }

  if (!aplanar) {
    conAlfa++;
    console.log(
      `✗ ${ruta} — ${etiqueta}, CON canal alfa (mínimo ${alfaMin}${
        alfaMin === 255 ? ", opaco" : ", con transparencia real"
      })`,
    );
    continue;
  }

  if (png.tipoColor !== 6) throw new Error(`${ruta}: solo se aplana RGBA, es ${etiqueta}`);
  if (alfaMin !== 255) {
    // aplanar algo con transparencia real cambiaría la imagen: eso lo decide
    // quien diseñó el ícono, no este script
    throw new Error(
      `${ruta}: tiene transparencia real (alfa ${alfaMin}). Aplanarlo cambiaría la imagen.`,
    );
  }

  const rgb = Buffer.alloc(png.ancho * png.alto * 3);
  for (let p = 0, q = 0; p < pixeles.length; p += 4, q += 3) {
    rgb[q] = pixeles[p];
    rgb[q + 1] = pixeles[p + 1];
    rgb[q + 2] = pixeles[p + 2];
  }
  escribirRgb(ruta, png.ancho, png.alto, rgb);
  console.log(`↓ ${ruta} — RGBA → RGB (alfa era opaco: ningún píxel cambió)`);
}

if (conAlfa > 0) {
  console.error(`\n${conAlfa} archivo(s) con canal alfa. Corré con --aplanar para arreglarlo.`);
  process.exit(1);
}
