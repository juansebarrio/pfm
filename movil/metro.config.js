const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");
const fs = require("fs");

const proyecto = __dirname;
// la raíz del repo: ahí vive lib/dominio, que se comparte con la web
const raiz = path.resolve(proyecto, "..");

const config = getDefaultConfig(proyecto);

// Metro solo mira dentro del proyecto por defecto. Para importar el dominio
// compartido (../lib/dominio) hay que sumarlo a watchFolders y decirle dónde
// buscar node_modules (el de movil/ primero, el de la raíz como respaldo).
config.watchFolders = [raiz];
config.resolver.nodeModulesPaths = [
  path.resolve(proyecto, "node_modules"),
  path.resolve(raiz, "node_modules"),
];

// ─────────────────────────────────────────────────────────────────────────────
// El dominio compartido, adentro del proyecto.
//
// La decisión de arquitectura es UNA fuente para las reglas de plata
// (lib/dominio, compartida con la web). Pero `expo export:embed` — el paso de
// Xcode que empaqueta el JS para un build real — NO puede leer archivos fuera
// de movil/: ni con watchFolders, ni con resolvers custom, ni siquiera con un
// import relativo a un archivo que existe (probado las cuatro formas; el file
// map de Metro nunca indexa fuera del proyecto en ese modo). En Expo Go nunca
// se notó porque el server de desarrollo sí lo hace.
//
// Solución: al cargar esta config —que corre en TODO arranque de Metro, dev y
// export— se sincroniza lib/dominio → src/dominio como copia generada
// (gitignoreada, con encabezado de NO EDITAR), y @dominio/* se resuelve ahí.
// La fuente sigue siendo una: lib/dominio. El tsconfig sigue apuntando al
// original, así "ir a definición" te lleva a donde SÍ se edita.
//
// Trampa conocida: un cambio en lib/dominio se toma al REINICIAR el server
// (la sincronización corre al cargar la config, no en caliente).
const origenDominio = path.resolve(raiz, "lib/dominio");
const copiaDominio = path.resolve(proyecto, "src/dominio");
const ENCABEZADO = "// GENERADO desde lib/dominio — editá allá; esto lo pisa metro.config.js.\n";

fs.mkdirSync(copiaDominio, { recursive: true });
for (const archivo of fs.readdirSync(origenDominio)) {
  if (!archivo.endsWith(".ts") || archivo.endsWith(".test.ts")) continue;
  const contenido = ENCABEZADO + fs.readFileSync(path.join(origenDominio, archivo), "utf8");
  const destino = path.join(copiaDominio, archivo);
  // escribir solo si cambió: no invalidar la caché de Metro sin motivo
  if (!fs.existsSync(destino) || fs.readFileSync(destino, "utf8") !== contenido) {
    fs.writeFileSync(destino, contenido);
  }
}
for (const archivo of fs.readdirSync(copiaDominio)) {
  // lo que ya no existe en el origen se va: nada de huérfanos importables
  if (!fs.existsSync(path.join(origenDominio, archivo))) {
    fs.unlinkSync(path.join(copiaDominio, archivo));
  }
}

const PREFIJO = "@dominio/";
config.resolver.resolveRequest = (contexto, nombreModulo, plataforma) => {
  if (nombreModulo.startsWith(PREFIJO)) {
    const destino = path.join(copiaDominio, nombreModulo.slice(PREFIJO.length));
    return contexto.resolveRequest(contexto, destino, plataforma);
  }
  return contexto.resolveRequest(contexto, nombreModulo, plataforma);
};

module.exports = config;
