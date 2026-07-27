const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

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

module.exports = config;
