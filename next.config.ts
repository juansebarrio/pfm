import path from "node:path";
import type { NextConfig } from "next";

// Hay lockfiles sueltos fuera del repo (p. ej. ~/package-lock.json): sin raíz
// explícita Next infiere el home como workspace root y escanea de más.
const raiz = path.join(__dirname);

const nextConfig: NextConfig = {
  outputFileTracingRoot: raiz,
  turbopack: {
    root: raiz,
  },
};

export default nextConfig;
